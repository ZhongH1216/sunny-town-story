const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { root, resolveNpm } = require("./env");

const cleanRoot = path.join(root, "dist", "clean-source-check");
const cleanProject = path.join(cleanRoot, "sunny-town-story");

const excludedDirs = new Set([".git", "dist", "node_modules", "playwright-report", "test-results", "__pycache__"]);
const excludedFiles = new Set([".env", "debug.log", "server.out.log", "server.err.log", "server.pid"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDir(dir) {
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

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(isWindowsScript ? "cmd.exe" : command, isWindowsScript ? ["/d", "/c", command, ...args] : args, {
      cwd,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
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

  await run(npm, ["ci"], cleanProject);
  await run(npm, ["run", "check"], cleanProject);
  await run(npm, ["test"], cleanProject);
  console.log("Clean-source verification passed");
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
});
