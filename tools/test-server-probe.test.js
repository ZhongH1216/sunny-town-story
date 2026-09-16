const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { probeGameServer } = require("./test-server-probe");

async function listen(t, handler) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    handler(request, response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  t.after(async () => {
    if (!server.listening) return;
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  });
  return { server, url, requests };
}

// Run the real launcher's control flow with a real HTTP listener, but replace
// every process spawn. No test in this file can start Python or a browser.
function runLauncher(url, childExitCode = 0) {
  const source = fs.readFileSync(path.join(__dirname, "run-tests.js"), "utf8");
  const spawns = [];
  const output = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Launcher did not finish within 3 seconds")), 3000);
    const complete = (code) => setImmediate(() => {
      clearTimeout(timer);
      resolve({ code, spawns, output: output.join("\n") });
    });
    const fakeProcess = {
      execPath: process.execPath, argv: [process.execPath, "run-tests.js"],
      env: {}, stdout: { write() {} }, stderr: { write() {} }, exit: complete,
      set exitCode(code) { complete(code); },
    };
    const replacements = {
      "node:child_process": {
        spawn(command, args) {
          spawns.push({ command, args });
          const child = new EventEmitter();
          child.stdout = new EventEmitter();
          child.stderr = new EventEmitter();
          child.exitCode = null;
          child.kill = () => { throw new Error("A reused listener must never be killed"); };
          queueMicrotask(() => {
            child.exitCode = childExitCode;
            child.emit("exit", childExitCode);
          });
          return child;
        },
      },
      "node:fs": { existsSync: () => true },
      "node:path": path,
      "./env": {
        root: path.resolve(__dirname, ".."),
        pythonAppCommand: async () => ({ command: "python-probe.exe", args: ["app.py"], url }),
        spawnSpec: (command, args) => ({ command, args }),
      },
      "./test-server-probe": { probeGameServer },
    };
    try {
      vm.runInNewContext(source, {
        require(name) {
          if (!(name in replacements)) throw new Error(`Unexpected launcher dependency: ${name}`);
          return replacements[name];
        },
        process: fakeProcess, setTimeout, clearTimeout,
        console: { log: (line) => output.push(line), error: (line) => output.push(line) },
      }, { filename: "run-tests.js", timeout: 1000 });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

test("200 with the game marker is reusable and launcher preserves the test exit code", { timeout: 5000 }, async (t) => {
  const service = await listen(t, (_request, response) => {
    response.writeHead(200, { "X-Sunny-Town-Server": "1" });
    response.end("game");
  });
  assert.deepEqual(await probeGameServer(service.url), { state: "ready", statusCode: 200 });
  const result = await runLauncher(service.url, 7);
  assert.equal(result.code, 7);
  assert.equal(result.spawns.length, 1, "only the mocked Playwright runner should start");
  assert.equal(result.spawns[0].command, process.execPath);
  assert.match(result.spawns[0].args[0], /[\\/]@playwright[\\/]test[\\/]cli\.js$/);
  assert.match(result.output, /reusing verified game server/);
  assert.equal(service.server.listening, true);
  assert.equal((await probeGameServer(service.url)).state, "ready");
  assert.ok(service.requests.every(({ method, url }) => method === "GET" && url === "/"));
});

for (const example of [
  { name: "503 even with the game marker", status: 503, marker: "1", reason: /HTTP 503/ },
  { name: "unrelated 200 without a marker", status: 200, marker: undefined, reason: /X-Sunny-Town-Server=missing/ },
  { name: "200 with the wrong marker", status: 200, marker: "2", reason: /X-Sunny-Town-Server="2"/ },
]) {
  test(`${example.name} is rejected without launching tests or stopping the listener`, { timeout: 5000 }, async (t) => {
    const service = await listen(t, (_request, response) => {
      response.writeHead(example.status, example.marker === undefined ? {} : { "X-Sunny-Town-Server": example.marker });
      response.end("another service");
    });
    const probe = await probeGameServer(service.url);
    assert.equal(probe.state, "rejected");
    assert.equal(probe.statusCode, example.status);
    assert.match(probe.reason, example.reason);
    const result = await runLauncher(service.url);
    assert.equal(result.code, 1);
    assert.deepEqual(result.spawns, []);
    assert.match(result.output, example.reason);
    assert.match(result.output, /existing service was left untouched/);
    assert.equal(service.server.listening, true);
    assert.equal((await probeGameServer(service.url)).statusCode, example.status);
    assert.ok(service.requests.every(({ method, url }) => method === "GET" && url === "/"));
  });
}

test("a refused connection is distinguished from an occupied port", { timeout: 5000 }, async (t) => {
  const service = await listen(t, (_request, response) => response.end());
  await new Promise((resolve, reject) => service.server.close((error) => error ? reject(error) : resolve()));
  const probe = await probeGameServer(service.url);
  assert.equal(probe.state, "unavailable");
  assert.equal(probe.code, "ECONNREFUSED");
});

test("a listener without response headers times out without being treated as a free port", { timeout: 5000 }, async (t) => {
  const service = await listen(t, () => {});
  const probe = await probeGameServer(service.url, { timeoutMs: 100 });
  assert.equal(probe.state, "rejected");
  assert.equal(probe.code, "ETIMEDOUT");
  assert.match(probe.reason, /within 100 ms/);
  assert.equal(service.server.listening, true);
});

test("complete valid headers suffice even when the response body never ends", { timeout: 5000 }, async (t) => {
  const service = await listen(t, (_request, response) => {
    response.writeHead(200, { "X-Sunny-Town-Server": "1" });
    response.flushHeaders();
    response.write("unfinished body");
  });
  assert.deepEqual(await probeGameServer(service.url, { timeoutMs: 500 }), { state: "ready", statusCode: 200 });
  assert.equal(service.server.listening, true);
});
