// The app's icon, favicon and splash icon, made from the mark the app draws (markSvg in split/state.js) in each palette's light
// accent (split/styles.css). UI pass 3, U8 (docs/UI_PASS_3.md §15d, §26f). No dependency beyond the Playwright the tests use:
// each SVG is drawn in its Chromium and screenshotted at the size the manifest names. Run from the repo's root:
//   node tools/make-icons.mjs          (PW_CHROMIUM_PATH is read, as playwright.config.ts reads it)
// Writes icons/icon-<palette>.svg, -192.png, -512.png (appearance.js swaps them per palette), and at the root icon-192.png,
// icon-512.png (the default palette, purpose any), icon-512-maskable.png (the mark inside the middle 80%), favicon.svg and
// favicon-32.png. The PNGs are committed; this is run again only when the mark or a palette's accent changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const state = readFileSync('split/state.js', 'utf8');
const styles = readFileSync('split/styles.css', 'utf8');
// The mark's hexagon, as markSvg draws it (a 24 grid, set at 10,10 inside a 44 tile with corners of 14).
const hex = /var hex = '([^']+)';/.exec(state.slice(state.indexOf('function markSvg')))[1];
const pal = name => {
  const block = styles.slice(styles.indexOf(`[data-palette="${name}"]`));
  const m = /--c-accent: light-dark\((#[0-9a-f]{6}),[^;]*; --c-on-accent: light-dark\((#[0-9a-f]{6}),/.exec(block);
  return { accent: m[1], on: m[2] };
};
const PALETTES = ['zinc', 'teal', 'terracotta'];
const DEFAULT = 'zinc';

/* The tile as the app draws it: corners of 14 in 44, the hexagon and its hole drawn in the on-accent line. */
function tileSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="512" height="512"><title>SEP Invoicing</title>` +
    `<rect width="44" height="44" rx="14" fill="${c.accent}"/><g transform="translate(10 10)" fill="none" stroke="${c.on}" stroke-width="1.75" ` +
    `stroke-linecap="round" stroke-linejoin="round"><path d="${hex}"/><circle cx="12" cy="12" r="3"/></g></svg>`;
}
/* Maskable: the accent to every edge, the mark inside the middle 80% (a launcher crops to a circle or a squircle). */
function maskSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="512" height="512"><title>SEP Invoicing</title>` +
    `<rect width="44" height="44" fill="${c.accent}"/><g transform="translate(22 22) scale(1.1) translate(-12 -12)" fill="none" stroke="${c.on}" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round"><path d="${hex}"/><circle cx="12" cy="12" r="3"/></g></svg>`;
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file, size + 'px');
}
for (const p of PALETTES) {
  const c = pal(p), svg = tileSvg(c);
  writeFileSync(`icons/icon-${p}.svg`, svg + '\n');
  await png(svg, 192, `icons/icon-${p}-192.png`);
  await png(svg, 512, `icons/icon-${p}-512.png`);
}
const d = pal(DEFAULT);
writeFileSync('favicon.svg', tileSvg(d) + '\n');
await png(tileSvg(d), 32, 'favicon-32.png');
await png(tileSvg(d), 192, 'icon-192.png');
await png(tileSvg(d), 512, 'icon-512.png');
await png(maskSvg(d), 512, 'icon-512-maskable.png');
await browser.close();
