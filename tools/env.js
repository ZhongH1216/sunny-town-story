const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");

function readDotEnv() {
  if (!fs.existsSync(envFile)) return {};
  const entries = {};
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[match[1]] = value;
  }
  return entries;
}

const dotEnv = readDotEnv();

function envValue(name) {
  return process.env[name] || dotEnv[name] || "";
}

function pathEntries() {
  return (process.env.PATH || "").split(path.delimiter).filter(Boolean);
}

function executableCandidates(command) {
  if (path.isAbsolute(command) || command.includes("\\") || command.includes("/")) {
    return [command];
  }

  const extensions = process.platform === "win32" ? ["", ".cmd", ".bat", ".exe"] : [""];
  return pathEntries().flatMap((entry) => extensions.map((extension) => path.join(entry, `${command}${extension}`)));
}

function resolveCommandPath(command) {
  return executableCandidates(command).find((candidate) => fs.existsSync(candidate)) || command;
}

function isWindowsScript(command) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

function quoteForCmd(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function spawnSpec(command, args) {
  const resolved = resolveCommandPath(command);
  if (isWindowsScript(resolved)) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", [quoteForCmd(resolved), ...args.map(quoteForCmd)].join(" ")],
    };
  }
  return { command: resolved, args };
}

function commandExists(command, args = ["--version"]) {
  return new Promise((resolve) => {
    let child;
    try {
      const spec = spawnSpec(command, args);
      child = spawn(spec.command, spec.args, {
        cwd: root,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      resolve(false);
      return;
    }
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function resolveNpm() {
  const npmNodePath = process.env.npm_node_execpath || process.execPath;
  if (process.platform === "win32" && npmNodePath) {
    const sibling = path.join(path.dirname(npmNodePath), "npm.cmd");
    if (fs.existsSync(sibling)) {
      return sibling;
    }
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const npmPath = resolveCommandPath(npmCommand);
  if (process.platform === "win32" && fs.existsSync(npmPath)) {
    return npmPath;
  }
  if (await commandExists(npmPath, ["--version"])) {
    return npmPath;
  }

  if (await commandExists("npm", ["--version"])) {
    return resolveCommandPath("npm");
  }

  return null;
}

async function resolvePython() {
  const configured = envValue("SUNNY_TOWN_PYTHON") || envValue("PYTHON");
  if (configured) {
    return { command: configured, args: [] };
  }

  if (process.platform === "win32" && (await commandExists("py", ["-3", "--version"]))) {
    return { command: "py", args: ["-3"] };
  }

  if (await commandExists("python", ["--version"])) {
    return { command: "python", args: [] };
  }

  if (await commandExists("python3", ["--version"])) {
    return { command: "python3", args: [] };
  }

  throw new Error(
    [
      "Python was not found.",
      "Install Python 3 or set SUNNY_TOWN_PYTHON in .env to the full Python executable path.",
      'Example: SUNNY_TOWN_PYTHON=C:\\Python\\python.exe',
    ].join("\n"),
  );
}

function appUrl() {
  const host = envValue("SUNNY_TOWN_HOST") || "127.0.0.1";
  const port = envValue("SUNNY_TOWN_PORT") || "8765";
  return { host, port, url: `http://${host}:${port}` };
}

async function pythonAppCommand() {
  const python = await resolvePython();
  const { host, port } = appUrl();
  return {
    command: python.command,
    args: [...python.args, "app.py", "--host", host, "--port", port],
    host,
    port,
    url: `http://${host}:${port}`,
  };
}

module.exports = {
  root,
  envValue,
  resolveNpm,
  resolvePython,
  pythonAppCommand,
  appUrl,
  resolveCommandPath,
  spawnSpec,
};
