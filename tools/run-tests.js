const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { root, pythonAppCommand } = require("./env");

let serverUrl = "http://127.0.0.1:8765";

function waitForServer(deadlineMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(serverUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Server did not respond at ${serverUrl}`));
          return;
        }
        setTimeout(probe, 250);
      });
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };
    probe();
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      stdio: "inherit",
      ...options,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const app = await pythonAppCommand();
  serverUrl = app.url;
  const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");
  if (!fs.existsSync(playwrightCli)) {
    throw new Error("Playwright is not installed. Run npm install first.");
  }

  const server = spawn(app.command, app.args, {
    cwd: root,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitForServer();
    const code = await run(process.execPath, [playwrightCli, "test", "--config=playwright.config.js"], {
      env: { ...process.env, PLAYWRIGHT_SKIP_WEBSERVER: "1" },
    });
    process.exitCode = code;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
