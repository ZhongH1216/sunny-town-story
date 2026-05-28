const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { root, resolvePython, spawnSpec } = require("./env");
const { packageName, packageDir, zipPath } = require("./package-local");

const requiredFiles = [
  "PACKAGE_README.txt",
  "README.md",
  "app.py",
  "index.html",
  "package.json",
  "package-lock.json",
  "start-sunny-town.bat",
  "stop-sunny-town.bat",
  "src/app.js",
  "src/asset-manifest.js",
  "src/styles.css",
  "node_modules/three/LICENSE",
  "node_modules/three/package.json",
  "node_modules/three/build/three.module.js",
];

function logOk(message) {
  console.log(`[ok] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function readTexturePaths() {
  const manifest = fs.readFileSync(path.join(root, "src", "asset-manifest.js"), "utf8");
  return [...manifest.matchAll(/path:\s*"([^"]+\.png)"/g)].map((match) => match[1]);
}

function assertFile(relativePath, { png = false } = {}) {
  const file = path.join(packageDir, relativePath);
  if (!fs.existsSync(file)) fail(`Missing package file: ${relativePath}`);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size <= 0) fail(`Package file is empty: ${relativePath}`);
  if (png) {
    const signature = fs.readFileSync(file).subarray(0, 8);
    if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      fail(`Texture is not a PNG: ${relativePath}`);
    }
  }
}

function zipEntries(file) {
  const data = fs.readFileSync(file);
  let eocd = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("Zip end-of-central-directory record not found");

  const count = data.readUInt16LE(eocd + 10);
  const centralOffset = data.readUInt32LE(eocd + 16);
  const entries = [];
  let offset = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) fail("Invalid zip central directory header");
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const name = data.slice(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode || 0));
    });
    req.setTimeout(4000, () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
    req.on("error", reject);
  });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(baseUrl) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < 10000) {
    try {
      const status = await request(`${baseUrl}/`);
      if (status === 200) return;
      lastError = `status ${status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  fail(`Package server did not become ready: ${lastError}`);
}

async function verifyServer() {
  const python = await resolvePython();
  const port = await freePort();
  const spec = spawnSpec(python.command, [...python.args, "app.py", "--host", "127.0.0.1", "--port", String(port)]);
  const child = spawn(spec.command, spec.args, {
    cwd: packageDir,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl);
    for (const route of [
      "/",
      "/index.html",
      "/src/app.js",
      "/src/asset-manifest.js",
      "/node_modules/three/build/three.module.js",
      `/${readTexturePaths()[0]}`,
    ]) {
      const status = await request(`${baseUrl}${route}`);
      if (status !== 200) fail(`Package route failed ${route}: HTTP ${status}`);
    }
    logOk(`package server smoke on ${baseUrl}`);
  } finally {
    child.kill();
  }

  if (child.exitCode && child.exitCode !== 0) {
    fail(`Package server exited early: ${output.trim()}`);
  }
}

async function runPackageBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "tools", "package-local.js")], {
      cwd: root,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`package-local exited with ${code}`));
    });
  });
}

async function main() {
  console.log("Sunny Town Story package verification");
  await runPackageBuild();

  if (!fs.existsSync(packageDir)) fail(`Package directory was not created: ${packageDir}`);
  if (!fs.existsSync(zipPath)) fail(`Package zip was not created: ${zipPath}`);
  logOk("package directory and zip exist");

  for (const file of requiredFiles) assertFile(file);
  const texturePaths = readTexturePaths();
  for (const file of texturePaths) assertFile(file, { png: true });
  logOk(`${requiredFiles.length} runtime files and ${texturePaths.length} PNG textures exist`);

  const entries = zipEntries(zipPath);
  const prefix = `${packageName}/`;
  if (!entries.length) fail("Zip has no entries");
  if (entries.some((entry) => !entry.startsWith(prefix))) fail(`Zip entries must live under ${prefix}`);
  for (const file of [...requiredFiles, ...texturePaths]) {
    if (!entries.includes(`${prefix}${file.replace(/\\/g, "/")}`)) {
      fail(`Zip is missing ${file}`);
    }
  }
  logOk(`zip root directory is ${packageName}/ with ${entries.length} files`);

  await verifyServer();
  console.log("Package verification passed");
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
});
