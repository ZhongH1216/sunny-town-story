const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const outputIndex = process.argv.indexOf("--output-dir");
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error("--output-dir requires a path");
const distRoot = path.resolve(root, outputIndex >= 0 ? process.argv[outputIndex + 1] : "dist");
const packageName = `${pkg.name}-${pkg.version}`;
const packageDir = path.join(distRoot, packageName);
const zipPath = path.join(distRoot, `${packageName}.zip`);

const includeFiles = [
  "app.py",
  "index.html",
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DEVELOPMENT_PLAN.md",
  "HANDOFF.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "start-sunny-town.bat",
  "stop-sunny-town.bat",
  "启动阳光小镇.bat",
  "停止阳光小镇.bat",
];

const includeDirs = ["assets", "docs", "scripts", "src", "tools"];

const runtimeNodeFiles = [
  "node_modules/three/LICENSE",
  "node_modules/three/package.json",
  "node_modules/three/build/three.module.js",
  "node_modules/three/build/three.core.js",
];

function assertInside(parent, target) {
  const relative = path.relative(parent, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${parent}: ${target}`);
  }
  if (fs.existsSync(target)) {
    const realRelative = path.relative(fs.realpathSync(parent), fs.realpathSync(target));
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(`Refusing to follow output path outside ${parent}: ${target}`);
    }
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(packageDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing package input: ${relativePath}`);
  }
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function copyDir(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(packageDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing package input: ${relativePath}`);
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (["__pycache__", ".DS_Store"].includes(entry.name) || entry.name.endsWith(".pyc")) continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in release: ${relativePath}/${entry.name}`);
    const childRelative = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      copyDir(childRelative);
    } else if (entry.isFile()) {
      copyFile(childRelative);
    }
  }
}

function emptyDir(dir) {
  assertInside(root, dir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { dosTime, dosDate };
}

function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort();
}

function createZip(sourceDir, targetFile, rootName) {
  const files = listFiles(sourceDir);
  const chunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const relativePath of files) {
    const absolutePath = path.join(sourceDir, relativePath);
    const data = fs.readFileSync(absolutePath);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const zipPath = rootName ? `${rootName}/${relativePath}` : relativePath;
    const name = Buffer.from(zipPath, "utf8");
    const crc = crc32(data);
    // A stable timestamp makes identical source builds byte-for-byte reproducible.
    const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.UTC(2026, 0, 1);
    if (!Number.isFinite(epoch)) throw new Error("SOURCE_DATE_EPOCH must be a Unix timestamp");
    const { dosTime, dosDate } = dosDateTime(new Date(epoch));

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralChunks.push(centralHeader, name);

    offset += localHeader.length + name.length + compressed.length;
  }

  const centralStart = offset;
  const centralSize = centralChunks.reduce((total, chunk) => total + chunk.length, 0);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(files.length, 8);
  endHeader.writeUInt16LE(files.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(centralStart, 16);
  endHeader.writeUInt16LE(0, 20);

  ensureDir(path.dirname(targetFile));
  fs.writeFileSync(targetFile, Buffer.concat([...chunks, ...centralChunks, endHeader]));
}

function writePackageReadme() {
  const text = [
    `阳光小镇物语 / Sunny Town Story ${pkg.version} 试玩版`,
    "",
    "1. 将 ZIP 完整解压到普通文件夹，不要在压缩包内直接运行。",
    "2. Windows 双击 start-sunny-town.bat，浏览器会自动打开游戏。",
    "3. 游玩期间保留服务器窗口；退出请按 Ctrl+C 或运行 stop-sunny-town.bat。",
    "",
    "运行要求：Python 3.10+、支持 WebGL 2 的桌面 Chrome / Edge / Firefox。",
    "本包已包含 Three.js 及全部游戏素材，玩家无需 Node.js、npm 或联网安装依赖。",
    "Python 未随包分发。官方下载：https://www.python.org/downloads/",
    "macOS / Linux：在本目录运行 python3 app.py，然后打开 http://127.0.0.1:8765/。",
    "请使用同一浏览器及端口继续存档；隐私模式和清除浏览器数据可能移除存档。",
    "如果 8765 端口被占用，请关闭旧的游戏服务器或使用 python app.py --port 8766。",
    "详见 docs/DEMO_RELEASE_NOTES.md。",
    "",
    "Extract the entire ZIP, then run start-sunny-town.bat. Python 3.10+ is required.",
    "Node.js/npm are only needed for development. This is a local browser demo, not a native executable.",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(packageDir, "PACKAGE_README.txt"), text, "utf8");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeManifest() {
  const files = Object.fromEntries(listFiles(packageDir).map((file) => [file, sha256(path.join(packageDir, file))]));
  fs.writeFileSync(path.join(packageDir, "PACKAGE_MANIFEST.json"), `${JSON.stringify({ name: pkg.name, version: pkg.version, files }, null, 2)}\n`, "utf8");
}

function main() {
  assertInside(root, distRoot);
  if (path.relative(root, distRoot).split(path.sep)[0] !== "dist") {
    throw new Error("Package output must be dist or a subdirectory of dist");
  }
  fs.mkdirSync(distRoot, { recursive: true });
  assertInside(root, distRoot);
  assertInside(distRoot, packageDir);
  assertInside(distRoot, zipPath);
  emptyDir(packageDir);
  fs.rmSync(zipPath, { force: true });

  for (const file of includeFiles) copyFile(file);
  for (const dir of includeDirs) copyDir(dir);
  for (const file of runtimeNodeFiles) copyFile(file);
  writePackageReadme();
  writeManifest();
  createZip(packageDir, zipPath, packageName);
  fs.writeFileSync(`${zipPath}.sha256`, `${sha256(zipPath)}  ${path.basename(zipPath)}\n`, "utf8");

  console.log(`Packaged ${packageName}`);
  console.log(path.relative(root, packageDir));
  console.log(path.relative(root, zipPath));
}

if (require.main === module) {
  main();
}

module.exports = {
  packageName,
  packageDir,
  zipPath,
  distRoot,
  listFiles,
  sha256,
};
