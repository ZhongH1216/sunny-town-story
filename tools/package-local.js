const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const distRoot = path.join(root, "dist");
const packageName = `${pkg.name}-${pkg.version}`;
const packageDir = path.join(distRoot, packageName);
const zipPath = path.join(distRoot, `${packageName}.zip`);

const includeFiles = [
  "app.py",
  "index.html",
  "README.md",
  "package.json",
  "package-lock.json",
  "start-sunny-town.bat",
  "stop-sunny-town.bat",
];

const includeDirs = ["assets", "docs", "scripts", "src", "tools"];

const runtimeNodeFiles = [
  "node_modules/three/LICENSE",
  "node_modules/three/package.json",
  "node_modules/three/build/three.module.js",
];

function assertInside(parent, target) {
  const relative = path.relative(parent, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${parent}: ${target}`);
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
    const childRelative = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      copyDir(childRelative);
    } else if (entry.isFile()) {
      copyFile(childRelative);
    }
  }
}

function emptyDir(dir) {
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
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
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
    const zipPath = rootName ? `${rootName}/${relativePath}` : relativePath;
    const name = Buffer.from(zipPath, "utf8");
    const crc = crc32(data);
    const { dosTime, dosDate } = dosDateTime(fs.statSync(absolutePath).mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralChunks.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
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
    `Sunny Town Story ${pkg.version} local browser package`,
    "",
    "Run start-sunny-town.bat to play.",
    "The package includes the browser runtime files and Three.js module needed by the game.",
    "Python 3 is still required to serve the local static files.",
    "No Electron or Tauri wrapper is included.",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(packageDir, "PACKAGE_README.txt"), text, "utf8");
}

function main() {
  fs.mkdirSync(distRoot, { recursive: true });
  assertInside(distRoot, packageDir);
  assertInside(distRoot, zipPath);
  emptyDir(packageDir);
  fs.rmSync(zipPath, { force: true });

  for (const file of includeFiles) copyFile(file);
  for (const dir of includeDirs) copyDir(dir);
  for (const file of runtimeNodeFiles) copyFile(file);
  writePackageReadme();
  createZip(packageDir, zipPath, packageName);

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
  listFiles,
};
