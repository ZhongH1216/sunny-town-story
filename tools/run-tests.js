const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const python = "D:\\python\\anaconda\\envs\\aigo\\python.exe";
const url = "http://127.0.0.1:8765";

function waitForServer(deadlineMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Server did not respond at ${url}`));
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
  const server = spawn(python, ["app.py", "--host", "127.0.0.1", "--port", "8765"], {
    cwd: root,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitForServer();
    const code = await run(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.config.js"], {
      env: { ...process.env, PLAYWRIGHT_SKIP_WEBSERVER: "1" },
    });
    process.exitCode = code;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
