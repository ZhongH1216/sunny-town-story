const { spawn } = require("node:child_process");
const { root, pythonAppCommand } = require("./env");

async function main() {
  const app = await pythonAppCommand();
  const child = spawn(app.command, app.args, {
    cwd: root,
    shell: false,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
