const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { root, resolveNpm } = require("./env");

const cleanRoot = path.join(root, "dist", "clean-source-check");
const cleanProject = path.join(cleanRoot, "sunny-town-story");

const excludedDirs = new Set([".git", ".agents", ".codex", "dist", "node_modules", "playwright-report", "test-results", "__pycache__"]);
const excludedFiles = new Set([".env", "debug.log", "server.out.log", "server.err.log", "server.pid"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDir(dir) {
  const relative = path.relative(path.join(root, "dist"), path.resolve(dir));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe clean-source target");
  if (fs.existsSync(dir)) {
    const actual = path.relative(fs.realpathSync(root), fs.realpathSync(dir));
    if (!actual || actual.startsWith("..") || path.isAbsolute(actual)) throw new Error("Clean-source target escapes workspace");
  }
  if (!fs.existsSync(dir)) {
    ensureDir(dir);
    return;
  }
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function copyTree(source, target) {
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in clean source: ${entry.name}`);
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    if (entry.isFile() && excludedFiles.has(entry.name)) continue;

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function run(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(isWindowsScript ? "cmd.exe" : command, isWindowsScript ? ["/d", "/c", command, ...args] : args, {
      cwd,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
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

async function main() {
  console.log("Sunny Town Story clean-source verification");
  emptyDir(cleanRoot);
  copyTree(root, cleanProject);
  console.log(`[ok] copied clean source to ${path.relative(root, cleanProject)}`);

  const npm = await resolveNpm();
  if (!npm) throw new Error("npm was not found");

  const env = { ...process.env, SUNNY_TOWN_HOST: "127.0.0.1", SUNNY_TOWN_PORT: String(await freePort()) };
  await run(npm, ["ci", ...(process.argv.includes("--offline") ? ["--offline"] : [])], cleanProject, env);
  await run(npm, ["run", "check"], cleanProject, env);
  await run(npm, ["run", "test:server"], cleanProject, env);
  await run(npm, ["run", "test:art"], cleanProject, env);
  await run(npm, ["test"], cleanProject, env);
  await run(npm, ["run", "verify:package"], cleanProject, env);
  console.log("Clean-source verification passed");
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
});
