import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadAppWithState, openPulse } from './fixtures';
import { sweepState, sweep, WHITE_CEIL } from './sweep-fixture';

// P180: HR-9, no white (owner, 8 Oct 2026: "In needs you and pulse, the boxes inside the cards are still just white instead of
// colour coded gradients, we will be avoiding pure white everywhere in the app, this should be an HR … Pulse still holds generic
// cards as well, so it looks like a half designed space"). P76's sweep reads every screen, view and dialog, both themes and both
// layouts, for a fill above the ceiling; this file proves that instrument sees the failure, reads the stylesheet for white
// outside paper, measures each palette's surfaces, and holds Today's coding: every box in a card in its own tone and lighter
// than the card, and every Pulse widget a card coded by what it says.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

/* OKLab lightness and WCAG contrast of an rgb()/rgba() string, read in Node. */
const lin = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const rgbOf = (s: string) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => v / 255);
function okL(s: string) {
  const [r, gg, b] = rgbOf(s).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b),
    sh = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b);
  return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * sh;
}
function contrast(a: string, b: string) {
  const lum = (s: string) => { const [r, gg, bb] = rgbOf(s).map(lin); return 0.2126 * r + 0.7152 * gg + 0.0722 * bb; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/* The mean OKLab lightness of the stops of a computed gradient (Chrome writes them as oklab() or rgb()). */
function meanL(img: string) {
  const ls: number[] = [];
  for (const m of img.matchAll(/oklab\(([\d.]+)/g)) ls.push(Number(m[1]));
  for (const m of img.matchAll(/rgba?\([^)]*\)/g)) ls.push(okL(m[0]));
  return ls.reduce((s, v) => s + v, 0) / ls.length;
}

test('the sweep sees white: the surface of 26 Sep and a tick box the browser draws both fail it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await loadAppWithState(page, sweepState());
  expect((await sweep(page, 'Needs you')).white).toEqual([]);
  // The off-white the owner read as white (#f8fafa, L 0.984): every card on the screen is flagged.
  const tag = await page.addStyleTag({ content: ':root, :root[data-palette="teal"] { --c-surface: light-dark(#f8fafa, #131a1b) !important; }' });
  const old = (await sweep(page, 'the old surface')).white;
  expect(old.length).toBeGreaterThan(3);
  expect(old.join(' ')).toMatch(/L 0\.98\d/);
  await tag.evaluate(t => t.remove());
  expect((await sweep(page, 'back')).white).toEqual([]);
  // A tick box the browser paints is white whatever its computed fill says, so one not drawn by the app is flagged by name.
  await g(page, `document.getElementById('homeNeeds').insertAdjacentHTML('afterbegin', '<input type="checkbox" id="p180tick">')`);
  expect((await sweep(page, 'a browser tick')).white).toEqual([expect.stringContaining('the browser’s own tick box')]);
});

test('white is written in the stylesheet only on paper: the printed documents, their previews and a QR', async ({ page }) => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'split', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // What prints, prints on white: @media print is paper as a whole.
  const flat = css.replace(/@media print\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const PAPER = /\.inv-(as-|print-invoice|pi-|qc-|cn-|sr-|rpt-|qt-|ps-|soa-|qr|idc|ck-)/;
  const WHITE = /#fff\b|#ffffff\b|(?<![-\w])white(?![-\w])|rgba?\(\s*255[\s,]+255[\s,]+255/i;
  const bad: string[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(), body = m[2];
    if (WHITE.test(body) && !PAPER.test(sel)) bad.push(sel.slice(0, 80) + ' { ' + (body.match(WHITE) || [''])[0] + ' }');
  }
  expect(bad).toEqual([]);
  await page.goto('about:blank');
});

test('every palette’s light surfaces are tinted under the ceiling, and its text still reads on them', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await loadAppWithState(page, sweepState());
  for (const pal of ['teal', 'zinc', 'terracotta']) {
    const c = await g(page, `(function () {
      document.documentElement.dataset.palette = ${JSON.stringify(pal)};
      var out = {};
      ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'text-1', 'text-2', 'text-3', 'accent'].forEach(function (k) {
        var d = document.createElement('div'); d.style.setProperty('color', 'var(--' + k + ')'); document.body.appendChild(d);
        out[k] = getComputedStyle(d).color; d.remove();
      });
      return out;
    })()`) as Record<string, string>;
    // The surface is the lightest fill there is: tinted, under the ceiling, and still a step above the page.
    expect(okL(c.surface), `${pal} surface`).toBeLessThanOrEqual(WHITE_CEIL);
    expect(okL(c.surface), `${pal} surface over the page`).toBeGreaterThan(okL(c.bg) + 0.015);
    for (const f of ['bg', 'surface-2', 'surface-3', 'border']) expect(okL(c[f]), `${pal} ${f}`).toBeLessThan(okL(c.surface));
    // Text: every tier at 4.5:1 on every surface it sits on (§3.10), the accent on the surface and the page.
    for (const bg of ['bg', 'surface', 'surface-2']) for (const t of ['text-1', 'text-2', 'text-3']) {
      expect(contrast(c[t], c[bg]), `${pal} ${t} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of ['bg', 'surface']) expect(contrast(c.accent, c[bg]), `${pal} accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('Needs you: every box in a card is coded in its own tone and laid lighter on it; none is the plain surface', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await loadAppWithState(page, sweepState());
  const r = await g(page, `(function () {
    var plain = getComputedStyle(document.querySelector('.inv-topbar')).backgroundColor;
    var heroes = Array.prototype.map.call(document.querySelectorAll('#homeNeeds .inv-hero'), function (h) {
      var boxes = Array.prototype.map.call(h.querySelectorAll('.inv-hero-sheet, .inv-deck-item, .inv-hero .inv-tile'), function (b) {
        var cs = getComputedStyle(b);
        return { tone: b.getAttribute('data-tone') || '', img: cs.backgroundImage, color: cs.backgroundColor };
      });
      return { cls: h.className, img: getComputedStyle(h).backgroundImage, boxes: boxes };
    });
    return { plain: plain, heroes: heroes };
  })()`) as any;
  expect(r.heroes.length).toBeGreaterThan(2);
  const cards: any[] = [];
  for (const h of r.heroes) {
    expect(h.img, h.cls).toMatch(/^linear-gradient\(/);
    for (const b of h.boxes) {
      // A box is a gradient of its tone, never the surface laid flat …
      expect(b.img, `${h.cls} › ${b.tone}`).toMatch(/^linear-gradient\(/);
      // … and lighter than the card it is laid on, so it reads as on it.
      expect(meanL(b.img), `${h.cls} › ${b.tone}`).toBeGreaterThan(meanL(h.img));
      if (b.tone) cards.push(b);
    }
  }
  // Cards of one tone share a fill; cards of two tones never do: the colour says the status.
  const byTone: Record<string, Set<string>> = {};
  for (const c of cards) (byTone[c.tone] = byTone[c.tone] || new Set()).add(c.img);
  const tones = Object.keys(byTone);
  expect(tones.length).toBeGreaterThan(1);
  for (const t of tones) expect(byTone[t].size, t).toBe(1);
  expect(new Set(tones.map(t => [...byTone[t]][0])).size).toBe(tones.length);
});

test('Pulse: every widget is a card, coded by the worst of what it holds; no generic panel is left', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await loadAppWithState(page, sweepState());
  // Every widget on, so each is drawn.
  await g(page, `localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom', order: HOME_WIDGETS.map(function (w) { return w[0]; }), hidden: {}, wide: {} }))`);
  await openPulse(page);
  await g(page, `renderHome()`);
  const w = await g(page, `Array.prototype.map.call(document.querySelectorAll('#homeWidgets > [data-home-w]'), function (el) {
    var first = el.firstElementChild;
    return { k: el.dataset.homeW, empty: !first, hero: !!first && first.classList.contains('inv-hero'), coded: !!first && first.classList.contains('inv-coded'),
      panel: !!el.querySelector(':scope > .inv-panel') };
  })`) as any[];
  for (const x of w) {
    if (x.empty) continue;
    expect(x.panel, x.k).toBe(false);
    if (x.k === 'quick') expect(x.coded, x.k).toBe(true);
    else expect(x.hero, x.k).toBe(true);
  }
  expect(w.filter(x => x.hero).length).toBeGreaterThanOrEqual(8);
  // The card is coded by the worst tone among what it holds: Money by its tiles, Attendance by who is on site, the month by its
  // billing and realisation.
  const rank: Record<string, number> = { danger: 3, warning: 2, ok: 1 };
  const worst = (ts: string[]) => ts.filter(t => rank[t]).sort((a, b) => rank[b] - rank[a])[0] || '';
  const toneOf = (cls: string) => (cls.match(/inv-hero-(danger|warning|ok|info|neutral)/) || [, ''])[1];
  const money = await g(page, `({ hero: document.getElementById('homeFin').className,
    tiles: Array.prototype.map.call(document.querySelectorAll('#homeFin [data-home-fin]'), function (t) { return (t.className.match(/inv-tile-(danger|warning|ok)/) || [, ''])[1]; }) })`) as any;
  expect(toneOf(money.hero)).toBe(worst(money.tiles));
  const mtd = await g(page, `({ hero: document.querySelector('[data-card="mtd"]').className,
    rev: document.getElementById('mtdRevenue').closest('.inv-tile').getAttribute('data-tone') || '',
    real: (document.getElementById('mtdPerKgTile').className.match(/inv-tile-(danger|warning|ok)/) || [, ''])[1] })`) as any;
  expect(toneOf(mtd.hero)).toBe(worst([mtd.rev, mtd.real]));
  // The quick actions are tinted, the one primary aside: none is the plain surface.
  const quick = await g(page, `Array.prototype.map.call(document.querySelectorAll('[data-home-w="quick"] .inv-btn-secondary'), function (b) { return getComputedStyle(b).backgroundColor; })`) as string[];
  const surface = await g(page, `(function () { var d = document.createElement('div'); d.style.background = 'var(--surface)'; document.body.appendChild(d); var c = getComputedStyle(d).backgroundColor; d.remove(); return c; })()`) as string;
  expect(quick.length).toBe(5);
  for (const c of quick) expect(c).not.toBe(surface);
});

test('a tick box is the app’s own: tinted unticked, the accent with its tick when ticked, in both themes', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await g(page, `(function () {
      var box = document.createElement('div'); box.innerHTML = '<input type="checkbox" class="inv-check"><input type="checkbox" class="inv-check" checked><label class="inv-field-check"><input type="radio" checked> One</label>';
      document.body.appendChild(box);
      var c = box.querySelectorAll('input'), acc = document.createElement('div'); acc.style.background = 'var(--accent)'; document.body.appendChild(acc);
      var out = { off: getComputedStyle(c[0]).backgroundColor, offApp: getComputedStyle(c[0]).appearance, on: getComputedStyle(c[1]).backgroundColor,
        tick: getComputedStyle(c[1], '::before').content, radio: getComputedStyle(c[2]).appearance, radioOn: getComputedStyle(c[2]).backgroundColor, accent: getComputedStyle(acc).backgroundColor };
      box.remove(); acc.remove();
      return out;
    })()`) as any;
    expect(r.offApp).toBe('none');
    expect(r.radio).toBe('none');
    if (scheme === 'light') expect(okL(r.off)).toBeLessThanOrEqual(WHITE_CEIL);
    expect(r.on).toBe(r.accent);
    expect(r.radioOn).toBe(r.accent);
    expect(r.tick).not.toBe('none');
  }
});
