const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { root, resolveNpm, resolvePython, appUrl, spawnSpec } = require("./env");

function run(command, args) {
  return new Promise((resolve) => {
    let child;
    try {
      const spec = spawnSpec(command, args);
      child = spawn(spec.command, spec.args, {
        cwd: root,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve({ ok: false, output: error.message });
      return;
    }
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => resolve({ ok: false, output: error.message }));
    child.on("exit", (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

async function main() {
  console.log("Sunny Town Story environment check");
  console.log(`Project: ${root}`);
  const nodeEnvMatch = /[\\/]envs[\\/]([^\\/]+)[\\/]/.exec(process.execPath);
  const nodeCondaEnv = nodeEnvMatch?.[1] || "";
  if (process.env.CONDA_DEFAULT_ENV && nodeCondaEnv && process.env.CONDA_DEFAULT_ENV !== nodeCondaEnv) {
    console.log(`[ok] Conda env: ${process.env.CONDA_DEFAULT_ENV}; Node from ${nodeCondaEnv}`);
  } else if (process.env.CONDA_DEFAULT_ENV || nodeCondaEnv) {
    console.log(`[ok] Conda env: ${process.env.CONDA_DEFAULT_ENV || nodeCondaEnv}`);
  } else {
    console.log("[info] Conda env: not active in this shell");
  }

  const node = await run(process.execPath, ["--version"]);
  console.log(`${node.ok ? "[ok]" : "[missing]"} Node.js: ${node.output || process.execPath}`);

  const npm = await resolveNpm();
  if (npm) {
    const npmVersion = await run(npm, ["--version"]);
    console.log(`[ok] npm: ${npmVersion.ok ? npmVersion.output : npm}`);
  } else {
    console.log("[missing] npm");
    console.log("      Install npm with Node.js before running npm install or npm test.");
  }

  const npmLock = fs.existsSync(path.join(root, "package-lock.json"));
  console.log(`${npmLock ? "[ok]" : "[missing]"} package-lock.json`);

  const modules = fs.existsSync(path.join(root, "node_modules", "three", "build", "three.module.js"));
  console.log(`${modules ? "[ok]" : "[missing]"} node_modules`);
  if (!modules) {
    console.log("      Run npm install before starting or testing the game.");
  }

  try {
    const python = await resolvePython();
    const version = await run(python.command, [...python.args, "--version"]);
    console.log(`${version.ok ? "[ok]" : "[missing]"} Python: ${version.output || python.command}`);
  } catch (error) {
    console.log("[missing] Python");
    console.log(`      ${error.message.replace(/\n/g, "\n      ")}`);
  }

  const { url } = appUrl();
  console.log(`[ok] Game URL: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
