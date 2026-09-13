const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { root, resolvePython, spawnSpec } = require("./env");
const { packageName, packageDir, zipPath, distRoot, listFiles, sha256 } = require("./package-local");
const pkg = require("../package.json");

const requiredFiles = [
  "PACKAGE_README.txt", "PACKAGE_MANIFEST.json", "README.md", "docs/DEMO_RELEASE_NOTES.md",
  "app.py", "index.html", "package.json", "package-lock.json",
  "start-sunny-town.bat", "stop-sunny-town.bat", "scripts/find-python.bat",
  "src/app.js", "src/asset-manifest.js", "src/styles.css",
  "node_modules/three/LICENSE", "node_modules/three/package.json",
  "node_modules/three/build/three.module.js", "node_modules/three/build/three.core.js",
];
const verificationDir = path.join(distRoot, "package-verification");
const extractedDir = path.join(verificationDir, packageName);

function logOk(message) { console.log("[ok] " + message); }
function fail(message) { throw new Error(message); }

function readTexturePaths(directory) {
  const manifest = fs.readFileSync(path.join(directory, "src", "asset-manifest.js"), "utf8");
  return [...manifest.matchAll(/path:\s*"([^"]+\.png)"/g)].map((match) => match[1]);
}

function assertFile(directory, relativePath, { png = false } = {}) {
  const file = path.join(directory, relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size <= 0) {
    fail("Missing or empty package file: " + relativePath);
  }
  if (png && !fs.readFileSync(file).subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    fail("Texture is not a PNG: " + relativePath);
  }
}

// Read and extract our standard ZIP from its central directory. Verify the
// distributed archive itself, not only the build directory beside it.
function extractZip(file, target) {
  const data = fs.readFileSync(file);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) fail("ZIP central directory not found");
  const count = data.readUInt16LE(eocd + 10);
  const entries = [];
  let offset = data.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) fail("Invalid ZIP central directory");
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const size = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (!name.startsWith(packageName + "/") || name.includes("\\") || name.split("/").includes("..") || path.isAbsolute(name)) {
      fail("Unsafe or unexpected ZIP path: " + name);
    }
    if (entries.includes(name)) fail("Duplicate ZIP entry: " + name);
    if (data.readUInt32LE(localOffset) !== 0x04034b50) fail("Invalid ZIP local header");
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const packed = data.subarray(start, start + compressedSize);
    const contents = method === 8 ? zlib.inflateRawSync(packed) : method === 0 ? packed : fail("Unsupported ZIP compression");
    if (contents.length !== size) fail("ZIP size mismatch: " + name);
    const output = path.resolve(target, name);
    const relative = path.relative(target, output);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail("ZIP entry escapes extraction folder");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, contents);
    entries.push(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!entries.length) fail("ZIP is empty");
  return entries;
}

function verifyManifest(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "PACKAGE_MANIFEST.json"), "utf8"));
  if (manifest.version !== pkg.version || manifest.name !== pkg.name) fail("Package manifest version/name mismatch");
  const expected = Object.keys(manifest.files).sort();
  const actual = listFiles(directory).filter((file) => file !== "PACKAGE_MANIFEST.json");
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("Package file list differs from checksum manifest");
  for (const file of expected) {
    if (sha256(path.join(directory, file)) !== manifest.files[file]) fail("Package hash mismatch: " + file);
  }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode || 0));
    });
    req.setTimeout(4000, () => req.destroy(new Error("Timed out requesting " + url)));
    req.on("error", reject);
    req.end();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    if (child.exitCode !== null) fail("Package server exited with " + child.exitCode);
    try { if (await request(baseUrl + "/") === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  fail("Package server did not become ready");
}

function pngColorSignal(png) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(signature)) fail("Canvas screenshot is not a PNG");
  let width = 0;
  let height = 0;
  let channels = 0;
  const dataChunks = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (offset + size + 12 > png.length) fail("Truncated screenshot PNG");
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      if (size !== 13) fail("Invalid screenshot PNG header");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      if (!width || !height || !channels || data[8] !== 8 || data[10] || data[11] || data[12]) {
        fail("Screenshot must be a non-interlaced 8-bit RGB/RGBA PNG");
      }
    } else if (type === "IDAT") dataChunks.push(data);
    else if (type === "IEND") break;
    offset += size + 12;
  }
  if (!width || !height || !dataChunks.length) fail("Screenshot PNG has no pixel data");
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(dataChunks));
  if (raw.length !== (stride + 1) * height) fail("Screenshot PNG pixel size mismatch");
  let previous = Buffer.alloc(stride);
  const colors = new Set();
  let signal = 0;
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const filter = raw[start];
    if (filter > 4) fail("Unknown screenshot PNG row filter");
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const above = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const estimate = left + above - upperLeft;
        const a = Math.abs(estimate - left);
        const b = Math.abs(estimate - above);
        const c = Math.abs(estimate - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? above : upperLeft;
      }
      row[x] = (raw[start + 1 + x] + predictor) & 255;
    }
    for (let x = 0; x < stride; x += channels) {
      if (channels === 4 && row[x + 3] === 0) continue;
      signal += row[x] + row[x + 1] + row[x + 2];
      colors.add((row[x] << 16) | (row[x + 1] << 8) | row[x + 2]);
    }
    previous = row;
  }
  return { ok: colors.size > 6 && signal > 0, width, height, colors: colors.size, signal, source: "browser-screenshot" };
}

async function readTestCanvasRender(page) {
  // TEST_MODE retains its drawing buffer specifically for pixel-level QA.
  return page.locator("#scene").evaluate((canvas) => new Promise((resolve) => {
    requestAnimationFrame(() => {
      const gl = canvas.getContext("webgl2");
      if (!gl || gl.isContextLost()) return resolve({ ok: false, reason: "WebGL 2 context unavailable" });
      const pixels = new Uint8Array(64 * 64 * 4);
      gl.readPixels(Math.max(0, Math.floor(canvas.width / 2) - 32), Math.max(0, Math.floor(canvas.height / 2) - 32), 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colors = new Set();
      let signal = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        signal += pixels[i] + pixels[i + 1] + pixels[i + 2];
        colors.add(pixels[i] + "," + pixels[i + 1] + "," + pixels[i + 2]);
      }
      resolve({ ok: canvas.width > 0 && canvas.height > 0 && colors.size > 6 && signal > 0, width: canvas.width, height: canvas.height, colors: colors.size, signal, source: "test-drawing-buffer" });
    });
  }));
}

async function verifyBrowser(baseUrl) {
  const errors = [];
  const failedResources = [];
  const softwareWebgl = process.env.SUNNY_TOWN_SOFTWARE_WEBGL === "1";
  const webglBackendRequested = softwareWebgl ? "swiftshader" : "browser-default";
  console.log("[info] package browser WebGL backend requested: " + webglBackendRequested);
  const browser = await chromium.launch({
    headless: true,
    ...(softwareWebgl ? { args: ["--use-angle=swiftshader"] } : {}),
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedResources.push(response.status() + " " + response.url());
    });
    page.on("requestfailed", (req) => failedResources.push(req.failure()?.errorText + " " + req.url()));
    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
    await page.locator("#scene").waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(verificationDir, "demo-launch.png") });

    await page.locator("#startDemoButton").click();
    await page.locator("#welcomeOverlay").waitFor({ state: "hidden" });
    const surface = await page.locator("#scene").evaluate((canvas) => {
      const gl = canvas.getContext("webgl2");
      return { valid: Boolean(gl && !gl.isContextLost()), width: canvas.width, height: canvas.height };
    });
    if (!surface.valid || !surface.width || !surface.height) fail("Player WebGL 2 canvas is unavailable");
    const bounds = await page.locator("#scene").boundingBox();
    if (!bounds || bounds.width < 192 || bounds.height < 192) fail("Player canvas is too small to inspect");
    // Capture the composed scene after closing the welcome page. The center
    // 192px square excludes the HUD; no preserved GPU buffer is needed.
    const canvasShot = await page.screenshot({
      path: path.join(verificationDir, "demo-canvas.png"),
      clip: { x: Math.floor(bounds.x + bounds.width / 2 - 96), y: Math.floor(bounds.y + bounds.height / 2 - 96), width: 192, height: 192 },
    });
    const render = { ...pngColorSignal(canvasShot), canvasWidth: surface.width, canvasHeight: surface.height };
    if (!render.ok) fail("Package screenshot did not contain a rendered scene: " + JSON.stringify(render));
    logOk("normal player scene screenshot has " + render.colors + " sampled colors");
    await page.locator("#saveButton").click();
    const playerSave = await page.evaluate(() => JSON.parse(localStorage.getItem("sunny-town-story.save.v1") || "null"));
    if (playerSave?.version !== 3 || playerSave.city?.demo?.scenario !== "harbor") {
      fail("Player could not start and save the default demo through the UI");
    }
    await page.screenshot({ path: path.join(verificationDir, "demo-playing.png") });
    logOk("player starts the default story and saves through the actual UI");

    // Check the isolated ZIP's actual gameplay module, version and save roundtrip.
    await page.goto(baseUrl + "/?test=1", { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.sunnyTownTest));
    const testRender = await readTestCanvasRender(page);
    if (!testRender.ok) fail("Test-mode drawing buffer did not render: " + JSON.stringify(testRender));
    const gameplay = await page.evaluate(() => {
      const t = window.sunnyTownTest;
      t.advanceWeek(3);
      const before = t.getState();
      t.saveGame(true);
      const loaded = t.loadFromStorage();
      const after = t.getState();
      return { version: after.version, week: after.week, expectedWeek: before.week, roadCount: after.roadCount, loaded, finite: Object.values(after.stats).filter((v) => typeof v === "number").every(Number.isFinite) };
    });
    if (gameplay.version !== pkg.version) fail("Game version differs from package: " + gameplay.version);
    if (!gameplay.finite || gameplay.roadCount <= 0 || gameplay.week !== gameplay.expectedWeek || !gameplay.loaded) {
      fail("Packaged gameplay/save check failed: " + JSON.stringify(gameplay));
    }
    if (errors.length || failedResources.length) {
      fail("Packaged browser reported errors:\n" + [...errors, ...failedResources].join("\n"));
    }
    logOk("gameplay advances, save reloads, release version matches; no page errors or failed resources");
    return { webglBackendRequested, render, testRender, playerStart: { scenario: playerSave.city.demo.scenario, saveVersion: playerSave.version }, gameplay, pageErrors: errors, failedResources };
  } finally { await browser.close(); }
}

async function verifyServer() {
  const python = await resolvePython();
  const port = await freePort();
  const stateFile = path.join(extractedDir, "server.pid");
  const spec = spawnSpec(python.command, [...python.args, "app.py", "--host", "127.0.0.1", "--port", String(port), "--state-file", stateFile]);
  const child = spawn(spec.command, spec.args, { cwd: extractedDir, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  let spawnError = null;
  child.on("error", (error) => { spawnError = error; });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  try {
    const baseUrl = "http://127.0.0.1:" + port;
    await waitForServer(baseUrl, child);
    if (spawnError) throw spawnError;
    for (const route of ["/", "/src/app.js", "/node_modules/three/build/three.module.js", "/node_modules/three/build/three.core.js", ...readTexturePaths(extractedDir).map((file) => "/" + file)]) {
      const status = await request(baseUrl + route);
      if (status !== 200) fail("Package route failed " + route + ": HTTP " + status);
    }
    if (await request(baseUrl + "/server.pid") !== 403) fail("Server control token must not be served");
    if (await request(baseUrl + "/__sunny_town__/shutdown", { method: "POST" }) !== 403) fail("Unauthenticated shutdown was accepted");
    const result = await verifyBrowser(baseUrl);
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (await request(baseUrl + "/__sunny_town__/shutdown", { method: "POST", headers: { "X-Sunny-Town-Token": state.token } }) !== 204) {
      fail("Authenticated server shutdown failed");
    }
    await new Promise((resolve, reject) => {
      if (child.exitCode !== null) return resolve();
      const timeout = setTimeout(() => reject(new Error("Server did not stop after shutdown")), 5000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
    if (fs.existsSync(stateFile)) fail("Server state was not cleaned up");
    logOk("server shutdown only accepts this package's control token");
    fs.writeFileSync(path.join(verificationDir, "verification.json"), JSON.stringify({ version: pkg.version, archive: path.basename(zipPath), sha256: sha256(zipPath), ...result }, null, 2) + "\n", "utf8");
  } catch (error) {
    throw new Error(error.message + (output.trim() ? "\nServer output: " + output.trim() : ""));
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

function runPackageBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "tools", "package-local.js"), "--output-dir", distRoot], { cwd: root, shell: false, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("package-local exited with " + code)));
  });
}

async function main() {
  console.log("Sunny Town Story release package verification");
  if (!process.argv.includes("--no-build")) await runPackageBuild();
  for (const file of requiredFiles) assertFile(packageDir, file);
  for (const file of readTexturePaths(packageDir)) assertFile(packageDir, file, { png: true });
  verifyManifest(packageDir);
  const archiveHash = sha256(zipPath);
  if (!fs.readFileSync(zipPath + ".sha256", "utf8").startsWith(archiveHash + "  ")) fail("Archive SHA-256 mismatch");
  logOk("package files, texture signatures and SHA-256 manifest match");

  const relative = path.relative(root, verificationDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Unsafe verification directory");
  const actualParent = path.relative(fs.realpathSync(root), fs.realpathSync(distRoot));
  if (!actualParent || actualParent.startsWith("..") || path.isAbsolute(actualParent)) fail("Verification output escapes workspace");
  fs.rmSync(verificationDir, { recursive: true, force: true });
  fs.mkdirSync(verificationDir, { recursive: true });
  const entries = extractZip(zipPath, verificationDir);
  for (const file of requiredFiles) assertFile(extractedDir, file);
  verifyManifest(extractedDir);
  if (listFiles(packageDir).some((file) => sha256(path.join(packageDir, file)) !== sha256(path.join(extractedDir, file)))) fail("Extracted ZIP differs from build directory");
  logOk("distributed ZIP extracted and all " + entries.length + " files verified");
  await verifyServer();
  console.log("Package verification passed: " + path.relative(root, verificationDir));
}

if (require.main === module) main().catch((error) => { console.error("[fail] " + error.message); process.exitCode = 1; });
module.exports = { extractZip, verifyManifest };
