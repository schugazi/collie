// Run from web/: dev-run -- bun scripts/build-terminal-icons.mjs
// One SVG supplies the transparent favicons and the gold Home Screen tiles.
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
    #tile { display: block; }
    img { display: block; width: 100%; height: 100%; }
  </style><div id="tile"><img src="data:image/svg+xml;base64,${svg.toString("base64")}"></div>`);
  await page.locator("img").evaluate((img) => img.decode());

  const render = async (pixels, backgroundGold) => {
    await page.locator("#tile").evaluate((tile, { size, gold }) => {
      tile.style.width = `${size}px`;
      tile.style.height = `${size}px`;
      tile.style.background = gold ? "#FDCD03" : "transparent";
    }, { size: pixels, gold: backgroundGold });
    return page.locator("#tile").screenshot({ omitBackground: true });
  };

  const favicon = await render(32, false);
  const apple = await render(180, true);
  const icon192 = await render(192, true);
  const icon512 = await render(512, true);
  const icoSizes = [16, 32, 48];
  const icoImages = await Promise.all(icoSizes.map((size) => render(size, false)));
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
