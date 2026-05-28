const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "src", "asset-manifest.js");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const header = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header, data])), 0);
  return Buffer.concat([length, header, data, crc]);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function writePng(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = row + 1 + x * 4;
      raw[target] = rgba[source];
      raw[target + 1] = rgba[source + 1];
      raw[target + 2] = rgba[source + 2];
      raw[target + 3] = rgba[source + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const data = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", data),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}

function parseManifest() {
  const source = fs.readFileSync(manifestPath, "utf8");
  const textureSize = Number(source.match(/textureSize:\s*(\d+)/)?.[1] || 16);
  const blocks = [...source.matchAll(/(\w+):\s*\{\s*path:\s*"([^"]+)",\s*palette:\s*\[([^\]]+)\]/g)];
  return blocks.map((match) => ({
    id: match[1],
    path: match[2],
    textureSize,
    palette: [...match[3].matchAll(/"#[0-9a-fA-F]{6}"/g)].map((item) => item[0].replaceAll('"', "")),
  }));
}

function texturePixels({ id, textureSize, palette }) {
  const colors = palette.map(hexToRgb);
  const rgba = Buffer.alloc(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const colorIndex = Math.abs((x * 3 + y * 5 + id.length) % colors.length);
      const isWindow = y >= 5 && y < 8 && x >= 2 && (x - 2) % 6 < 2;
      const [r, g, b] = colors[isWindow ? Math.min(3, colors.length - 1) : colorIndex];
      const i = (y * textureSize + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function main() {
  const textures = parseManifest();
  textures.forEach((texture) => {
    const file = path.join(root, texture.path);
    writePng(file, texture.textureSize, texture.textureSize, texturePixels(texture));
    console.log(`wrote ${path.relative(root, file)}`);
  });
}

main();
