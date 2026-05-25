const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const python = "D:\\python\\anaconda\\envs\\aigo\\python.exe";
const url = "http://127.0.0.1:8765";
const pidFile = path.join(root, "server.pid");

function probe() {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(deadlineMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    if (await probe()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  if (await probe()) {
    console.log(`Already running at ${url}`);
    console.log("Use stop-sunny-town.bat to stop the local server.");
    return;
  }

  const out = fs.openSync(path.join(root, "server.out.log"), "a");
  const err = fs.openSync(path.join(root, "server.err.log"), "a");
  const child = spawn(python, ["app.py", "--host", "127.0.0.1", "--port", "8765"], {
    cwd: root,
    detached: true,
    shell: false,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
  child.unref();

  if (!(await waitForServer())) {
    throw new Error("Server process started but did not become reachable.");
  }

  console.log(`Started Sunny Town Story at ${url}`);
  console.log(`PID ${child.pid}`);
  fs.writeFileSync(pidFile, `${child.pid}\n`, "utf8");
  console.log("Use stop-sunny-town.bat to stop the local server.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
