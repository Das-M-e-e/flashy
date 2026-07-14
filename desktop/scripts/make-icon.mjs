// Erzeugt build/icon.png (512x512) ohne externe Abhängigkeiten:
// ein Flashy-Markengradient als abgerundetes Quadrat mit weißem "F".
// electron-builder generiert daraus .ico/.icns automatisch.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 512;
const RADIUS = 110;

// Markenfarben (aus client/src/index.css).
const FROM = [124, 92, 255]; // #7c5cff
const TO = [79, 139, 255]; //  #4f8bff

const buf = Buffer.alloc(SIZE * SIZE * 4); // RGBA

function inRoundedRect(x, y) {
  const r = RADIUS;
  const nx = Math.min(x, SIZE - 1 - x);
  const ny = Math.min(y, SIZE - 1 - y);
  if (nx >= r || ny >= r) return true;
  const dx = r - nx;
  const dy = r - ny;
  return dx * dx + dy * dy <= r * r;
}

// Weißes "F" (Balken als Rechtecke).
function inF(x, y) {
  const stem = x >= 196 && x < 256 && y >= 150 && y < 362;
  const top = x >= 196 && x < 356 && y >= 150 && y < 210;
  const mid = x >= 196 && x < 326 && y >= 240 && y < 300;
  return stem || top || mid;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    if (!inRoundedRect(x, y)) {
      buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0; // transparent
      continue;
    }
    if (inF(x, y)) {
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = 255;
      continue;
    }
    const t = (x + y) / (2 * (SIZE - 1));
    buf[i] = Math.round(FROM[0] + (TO[0] - FROM[0]) * t);
    buf[i + 1] = Math.round(FROM[1] + (TO[1] - FROM[1]) * t);
    buf[i + 2] = Math.round(FROM[2] + (TO[2] - FROM[2]) * t);
    buf[i + 3] = 255;
  }
}

// ---- PNG-Encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Scanlines mit Filter-Byte 0.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, "..", "build");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "icon.png"), png);
console.log(`icon.png geschrieben (${png.length} Bytes)`);
