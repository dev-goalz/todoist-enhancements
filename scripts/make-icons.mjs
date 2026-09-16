/**
 * Draws the app's icons.
 *
 *   node scripts/make-icons.mjs
 *
 * The mark is three capsules on a solid ground — the same geometry as
 * public/favicon.svg, which stays the source of truth for the shape. It is
 * drawn here rather than converted from that file so the build depends on
 * nothing that has to be installed first, and so the one rule these icons have
 * to obey is written down in the same place as the icons:
 *
 *   EVERY RASTER ICON IS A FULL-BLEED OPAQUE SQUARE.
 *
 * No rounded corners, no transparency. Every surface that shows one of these
 * applies its own shape — iOS its squircle, Android its adaptive mask, Chromium
 * its tile — and a PNG that has already rounded itself gets rounded twice, so
 * the app's corners appear inside the system's as a visible border. That is
 * what shipped before this script: the 192 and 512 had their corners cut out to
 * alpha 0, and every one of them showed a ring.
 *
 * favicon.svg keeps its own rounding, because a browser tab masks nothing and
 * a hard square would be the odd one out there.
 *
 * The maskable pair carries the same mark smaller. Android may crop to any
 * shape inside the icon, guaranteeing only the middle 80% by diameter, so the
 * capsules are scaled until the furthest of their corners sits inside that
 * circle with room to spare.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** The brand red. The icon does not follow the accent setting: it is the app's
 *  identity on a home screen, not this device's preference. */
const GROUND = [0xd1, 0x45, 0x3b];
const MARK = [0xff, 0xff, 0xff];

/** Capsules in the 512 viewBox of favicon.svg: [x, y, width, height]. */
const BARS = [
  [104, 234, 74, 150],
  [219, 130, 74, 254],
  [334, 188, 74, 196],
];
const VIEW = 512;

/** Supersampling. Three samples a side is enough for edges this smooth. */
const SS = 3;

/**
 * Coverage of one pixel by the mark, 0..1.
 *
 * A capsule is a rectangle whose ends are half-circles, which is the same as
 * "within `r` of the inner rectangle" — so one distance test draws it, and the
 * radius never has to be stated separately.
 */
function coverage(px, py, bars, scale, size) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy += 1) {
    for (let sx = 0; sx < SS; sx += 1) {
      // Sample point, mapped back into the 512 viewBox and un-scaled.
      const x = ((px + (sx + 0.5) / SS) * VIEW) / size;
      const y = ((py + (sy + 0.5) / SS) * VIEW) / size;
      const ux = (x - VIEW / 2) / scale + VIEW / 2;
      const uy = (y - VIEW / 2) / scale + VIEW / 2;
      for (const [bx, by, bw, bh] of bars) {
        const r = bw / 2;
        const cx = Math.min(Math.max(ux, bx + r), bx + bw - r);
        const cy = Math.min(Math.max(uy, by + r), by + bh - r);
        if ((ux - cx) ** 2 + (uy - cy) ** 2 <= r * r) { hits += 1; break; }
      }
    }
  }
  return hits / (SS * SS);
}

function render(size, scale) {
  // RGBA, and alpha is 255 everywhere. See the note at the top of the file.
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const a = coverage(x, y, BARS, scale, size);
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        px[o + c] = Math.round(GROUND[c] * (1 - a) + MARK[c] * a);
      }
      px[o + 3] = 255;
    }
  }
  return px;
}

/* ---------- PNG ---------- */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // truecolour with alpha
  // Every scanline is stored with filter 0. The image is flat colour over a
  // flat ground and compresses to a few kilobytes regardless.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- output ---------- */

const FILES = [
  // purpose: any — shown whole, so the mark is at full size.
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // iOS, which reads this and not the manifest when a page is added to the
  // home screen. It applies its own squircle, so this must be a full square.
  ['apple-touch-icon.png', 180, 1],
  // purpose: maskable — anything outside the middle 80% may be cropped away.
  ['icon-maskable-192.png', 192, 0.82],
  ['icon-maskable-512.png', 512, 0.82],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, scale] of FILES) {
  const buf = png(size, render(size, scale));
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} kB`);
}
