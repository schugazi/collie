// Run from web/: dev-run -- bun scripts/build-terminal-icons.mjs
// One SVG supplies the transparent favicons and the gold Home Screen tiles.
// The tiles shrink the ring to 80%.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const source = new URL("./terminal-icon.svg", import.meta.url);
const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);
const svg = await readFile(source);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(`<style>
    body { margin: 0; }
    img { display: block; width: 100%; height: 100%; }
  </style><div id="tile"><img src="data:image/svg+xml;base64,${svg.toString("base64")}"></div>`);
  await page.locator("img").evaluate((img) => img.decode());

  const render = async (pixels) => {
    await page.locator("#tile").evaluate((tile, size) => {
      tile.style.width = `${size}px`;
      tile.style.height = `${size}px`;
    }, pixels);
    return page.locator("#tile").screenshot({ omitBackground: true });
  };

  // iOS 27 lifts a crisp two-tone tile off its background like a glyph, and Clear Dark then tints it
  // dark, unlike the other PWAs. Their tiles are drawn at 4x and shrunk with Pillow's Lanczos filter;
  // the softer colour mix that leaves makes iOS darken the whole tile instead, so these tiles match it.
  const tile = async (pixels) => {
    await page.locator("img").evaluate((img, size) => {
      const work = size * 4;
      const art = Math.round(work * 0.8);
      const big = new OffscreenCanvas(work, work).getContext("2d");
      big.fillStyle = "#FDCD03";
      big.fillRect(0, 0, work, work);
      big.drawImage(img, Math.floor((work - art) / 2), Math.floor((work - art) / 2), art, art);
      const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
      // One separable Lanczos-3 pass over RGBA rows (or columns), clamped to bytes like Pillow's.
      const pass = (src, w, h, horizontal) => {
        const [dw, dh] = horizontal ? [size, h] : [w, size];
        const dst = new Uint8ClampedArray(dw * dh * 4);
        const scale = (horizontal ? w : h) / size;
        for (let o = 0; o < size; o++) {
          const center = (o + 0.5) * scale;
          const lo = Math.max(0, Math.floor(center - 3 * scale));
          const hi = Math.min(horizontal ? w : h, Math.ceil(center + 3 * scale));
          const weights = [];
          for (let i = lo; i < hi; i++) {
            const x = (i - center + 0.5) / scale;
            weights.push(Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0);
          }
          const total = weights.reduce((a, b) => a + b, 0);
          for (let k = 0; k < (horizontal ? h : w); k++) {
            for (let c = 0; c < 4; c++) {
              let sum = 0;
              for (let i = lo; i < hi; i++) {
                sum += weights[i - lo] * src[(horizontal ? k * w + i : i * w + k) * 4 + c];
              }
              dst[(horizontal ? k * dw + o : o * dw + k) * 4 + c] = Math.round(sum / total);
            }
          }
        }
        return dst;
      };
      const wide = pass(big.getImageData(0, 0, work, work).data, work, work, true);
      // Screenshotting this canvas, rather than convertToBlob, keeps the PNG opaque RGB like the others.
      const out = document.querySelector("canvas") ?? document.body.appendChild(document.createElement("canvas"));
      out.width = out.height = size;
      out.style.display = "block";
      out.getContext("2d").putImageData(new ImageData(pass(wide, size, work, false), size, size), 0, 0);
    }, pixels);
    return page.locator("canvas").screenshot();
  };

  const favicon = await render(32);
  const apple = await tile(180);
  const icon192 = await tile(192);
  const icon512 = await tile(512);
  const icoSizes = [16, 32, 48];
  const icoImages = await Promise.all(icoSizes.map((size) => render(size)));
  const header = Buffer.alloc(6 + 16 * icoSizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoSizes.length, 4);
  let offset = header.length;
  for (const [index, size] of icoSizes.entries()) {
    const entry = 6 + 16 * index;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(icoImages[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += icoImages[index].length;
  }
  const ico = Buffer.concat([header, ...icoImages]);

  await Promise.all([
    ...["favicon.svg", "favicon-dev.svg", "favicon-playground.svg"].map((name) => writeFile(publicFile(name), svg)),
    ...["favicon-32x32.png", "favicon-dev-32x32.png", "favicon-playground-32x32.png"].map((name) => writeFile(publicFile(name), favicon)),
    ...["favicon.ico", "favicon-dev.ico", "favicon-playground.ico"].map((name) => writeFile(publicFile(name), ico)),
    ...["apple-touch-icon.png", "apple-touch-icon-dev.png"].map((name) => writeFile(publicFile(name), apple)),
    ...["web-app-manifest-192x192.png", "web-app-manifest-dev-192x192.png"].map((name) => writeFile(publicFile(name), icon192)),
    ...["web-app-manifest-512x512.png", "web-app-manifest-dev-512x512.png"].map((name) => writeFile(publicFile(name), icon512)),
  ]);
} finally {
  await browser.close();
}
