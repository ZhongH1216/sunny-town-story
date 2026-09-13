const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { root, resolvePython, spawnSpec } = require("./env");

function runPython(python, args, cwd) {
  const spec = spawnSpec(python.command, [...python.args, ...args]);
  const child = spawn(spec.command, spec.args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const result = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, output }));
  });
  const timeout = setTimeout(() => child.kill(), 12000);
  result.finally(() => clearTimeout(timeout));
  return { child, result, output: () => output };
}
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(3000, () => req.destroy(new Error("HTTP timeout")));
    req.on("error", reject);
    req.end();
  });
}

test("release server serves ES modules and only stops its own authenticated instance", { timeout: 20000 }, async () => {
  const parent = path.join(root, "dist", "server-regression");
  fs.mkdirSync(parent, { recursive: true });
  const actualParent = path.relative(fs.realpathSync(root), fs.realpathSync(parent));
  assert.ok(actualParent && !actualParent.startsWith("..") && !path.isAbsolute(actualParent));
  const directory = fs.mkdtempSync(path.join(parent, "case-"));
  const stateFile = path.join(directory, "server.pid");
  fs.copyFileSync(path.join(root, "app.py"), path.join(directory, "app.py"));
  fs.writeFileSync(path.join(directory, "index.html"), "<h1>Sunny Town isolated release test</h1>");
  fs.writeFileSync(path.join(directory, "module.js"), "export const working = true;");
  fs.writeFileSync(path.join(directory, ".env"), "PRIVATE_TEST_SENTINEL");
  const python = await resolvePython();
  const server = runPython(python, ["app.py", "--port", "0", "--state-file", stateFile], directory);
  try {
    const started = Date.now();
    while (!fs.existsSync(stateFile)) {
      if (server.child.exitCode !== null) assert.fail(server.output());
      if (Date.now() - started > 5000) assert.fail("Server startup timed out");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const base = "http://127.0.0.1:" + state.port;
    assert.equal((await request(base + "/")).status, 200);
    const moduleResponse = await request(base + "/module.js");
    assert.match(moduleResponse.headers["content-type"], /javascript/);
    assert.equal(moduleResponse.headers["cache-control"], "no-store");
    assert.equal(moduleResponse.headers["x-sunny-town-server"], "1");
    assert.equal((await request(base + "/favicon.ico")).status, 204);
    assert.equal((await request(base + "/server.pid")).status, 403);
    assert.equal((await request(base + "/.env")).status, 403);
    assert.equal((await request(base + "/__sunny_town__/shutdown", { method: "POST" })).status, 403);
    assert.equal((await request(base + "/")).status, 200);

    const collision = await runPython(python, ["app.py", "--port", String(state.port)], directory).result;
    assert.notEqual(collision.code, 0);
    assert.match(collision.output, /Unable to start/);
    assert.equal((await request(base + "/")).status, 200, "port collision must leave original server alive");

    const invalidState = path.join(directory, "invalid-state.json");
    fs.writeFileSync(invalidState, JSON.stringify({ port: state.port, token: "0".repeat(64) }));
    const rejected = await runPython(python, ["app.py", "--stop", "--state-file", invalidState], directory).result;
    assert.notEqual(rejected.code, 0);
    assert.equal((await request(base + "/")).status, 200, "wrong token must leave server alive");

    const stopped = await runPython(python, ["app.py", "--stop", "--state-file", stateFile], directory).result;
    assert.equal(stopped.code, 0, stopped.output);
    const finished = await server.result;
    assert.equal(finished.code, 0, finished.output);
    assert.equal(fs.existsSync(stateFile), false);
  } finally {
    if (server.child.exitCode === null) {
      server.child.kill();
      await server.result;
    }
    const relative = path.relative(parent, directory);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test("Node shim preserves zero/nonzero exit codes and quoted paths with spaces and exclamation marks", { skip: process.platform !== "win32", timeout: 10000 }, async () => {
  const parent = path.join(root, "dist", "server-regression");
  fs.mkdirSync(parent, { recursive: true });
  const actualParent = path.relative(fs.realpathSync(root), fs.realpathSync(parent));
  assert.ok(actualParent && !actualParent.startsWith("..") && !path.isAbsolute(actualParent));
  const directory = fs.mkdtempSync(path.join(parent, "shim space !-"));
  const toolsDirectory = path.join(directory, "tools");
  fs.mkdirSync(toolsDirectory);
  const shim = path.join(toolsDirectory, "node shim !.cmd");
  const probe = path.join(directory, "exit code ! probe.js");
  const argument = "argument with spaces ! preserved";
  fs.copyFileSync(path.join(root, "tools", "node-shim.cmd"), shim);
  fs.writeFileSync(probe, 'if (process.argv[3] !== "argument with spaces ! preserved") process.exit(91);\nprocess.exit(Number(process.argv[2]));\n');
  // Exercise the npm-provided executable branch and the PATH fallback without
  // copying an executable or depending on the invoking shell's Node selection.
  const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["npm_node_execpath", "path"].includes(key.toLowerCase())));
  baseEnv.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.PATH || process.env.Path || "");
  try {
    for (const mode of ["npm", "path"]) {
      const env = { ...baseEnv, ...(mode === "npm" ? { npm_node_execpath: process.execPath } : {}) };
      for (const expected of [0, 7]) {
        const actual = await new Promise((resolve, reject) => {
          // /s removes the outer pair; the remaining pairs protect every path.
          const command = '""' + shim + '" "' + probe + '" ' + expected + ' "' + argument + '""';
          const child = spawn("cmd.exe", ["/d", "/v:off", "/s", "/c", command], {
            cwd: directory, env, shell: false, windowsHide: true, windowsVerbatimArguments: true,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let output = "";
          child.stdout.on("data", (chunk) => { output += chunk; });
          child.stderr.on("data", (chunk) => { output += chunk; });
          const timeout = setTimeout(() => child.kill(), 4000);
          child.once("error", (error) => { clearTimeout(timeout); reject(error); });
          child.once("exit", (code) => { clearTimeout(timeout); resolve({ code, output }); });
        });
        assert.equal(actual.code, expected, mode + " branch: " + actual.output);
      }
    }
  } finally {
    const relative = path.relative(parent, directory);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
