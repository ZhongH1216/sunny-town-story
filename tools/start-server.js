const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { root, pythonAppCommand } = require("./env");

const pidFile = path.join(root, "server.pid");
let serverUrl = "http://127.0.0.1:8765";

function probe() {
  return new Promise((resolve) => {
    const req = http.get(serverUrl, (res) => {
      res.resume();
      resolve(res.statusCode === 200 && res.headers["x-sunny-town-server"] === "1" ? "game" : "occupied");
    });
    req.on("error", () => resolve("unavailable"));
    req.setTimeout(800, () => {
      req.destroy();
      resolve("unavailable");
    });
  });
}

async function waitForServer(deadlineMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    if (await probe() === "game") return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  const app = await pythonAppCommand();
  serverUrl = app.url;

  const existing = await probe();
  if (existing === "game") {
    console.log(`Already running at ${serverUrl}`);
    console.log("Use stop-sunny-town.bat to stop the local server.");
    return;
  }
  if (existing === "occupied") throw new Error(`The port at ${serverUrl} belongs to another server. Close it or choose SUNNY_TOWN_PORT.`);

  const out = fs.openSync(path.join(root, "server.out.log"), "a");
  const err = fs.openSync(path.join(root, "server.err.log"), "a");
  const child = spawn(app.command, [...app.args, "--state-file", pidFile], {
    cwd: root,
    detached: true,
    shell: false,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
  child.on("error", (error) => console.error(`Unable to launch game server: ${error.message}`));
  child.unref();

  if (!(await waitForServer())) {
    throw new Error("Server process started but did not become reachable.");
  }

  console.log(`Started Sunny Town Story at ${serverUrl}`);
  console.log(`PID ${child.pid}`);
  console.log("Use stop-sunny-town.bat to stop the local server.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
