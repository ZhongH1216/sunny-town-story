const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { root, pythonAppCommand, spawnSpec } = require("./env");
const { probeGameServer } = require("./test-server-probe");

let serverUrl = "http://127.0.0.1:8765";

function rejectUnexpectedServer(result) {
  throw new Error(`Refusing to use the service at ${serverUrl}: ${result.reason}. The existing service was left untouched; select another SUNNY_TOWN_PORT if needed.`);
}

async function waitForServer(checkProcess, deadlineMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    checkProcess();
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 0) break;
    const result = await probeGameServer(serverUrl, { timeoutMs: Math.min(1000, remaining) });
    if (result.state === "ready") return;
    if (result.state === "rejected") rejectUnexpectedServer(result);
    await new Promise((resolve) => setTimeout(resolve, Math.min(250, Math.max(0, deadlineMs - (Date.now() - started)))));
  }
  checkProcess();
  throw new Error(`Game server did not become ready at ${serverUrl} within ${deadlineMs} ms`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const spec = spawnSpec(command, args);
    const child = spawn(spec.command, spec.args, {
      cwd: root,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
      ...options,
    });
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
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

  let server = null;
  const existing = await probeGameServer(serverUrl);
  if (existing.state === "rejected") rejectUnexpectedServer(existing);

  try {
    if (existing.state === "unavailable") {
      const appSpec = spawnSpec(app.command, app.args);
      server = spawn(appSpec.command, appSpec.args, {
        cwd: root,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let startupError = null;
      server.once("error", (error) => { startupError = error; });
      server.stdout.on("data", (chunk) => process.stdout.write(chunk));
      server.stderr.on("data", (chunk) => process.stderr.write(chunk));
      await waitForServer(() => {
        if (startupError) throw startupError;
        if (server.exitCode !== null) throw new Error(`Game server exited before becoming ready (code ${server.exitCode})`);
      });
    } else {
      console.log(`[ok] reusing verified game server at ${serverUrl}`);
    }
    const code = await run(process.execPath, [playwrightCli, "test", "--config=playwright.config.js", ...process.argv.slice(2)], {
      env: { ...process.env, PLAYWRIGHT_SKIP_WEBSERVER: "1" },
    });
    process.exitCode = code;
  } finally {
    // Never kill a reused or rejected listener: this handle only exists when
    // this invocation started its own Python process.
    if (server && server.exitCode === null && !server.killed) server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
