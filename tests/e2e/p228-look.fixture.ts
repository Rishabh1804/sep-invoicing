import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadAppWithState, openHome, openNeeds, openPulse, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P228, the look (docs/UI_PASS_3.md §3, §3g; owner, 16 Oct 2026: "B with wells"): cards lift off the page, what you press or fill
// sits in a shallow well, text keeps full contrast. Every field, search, segmented track, tick box, switch, meter track and tile in a
// card is a well (its shadows all inset, its fill the well's veil or a tone of it); every card (a panel, a hero, a deck card, the
// phone's bar) lifts (two shadows outside it) with a card's corners and, in dark, a fine edge; the one primary's face runs from the
// accent to a step deeper and lifts further; the series are the validated six in both themes; and the stylesheet carries no
// retired token. The same body runs on the phone and the desktop (p228-look.spec.ts, p228-look.desktop.spec.ts). Paper is
// p228-paper.desktop.spec.ts.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const layers = (sh: string) => (!sh || sh === 'none') ? [] : sh.split(/,(?![^(]*\))/);
const inset = (sh: string) => layers(sh).length > 0 && layers(sh).every(x => /inset/.test(x));
const outer = (sh: string) => layers(sh).length > 0 && layers(sh).every(x => !/inset/.test(x));

/* What the look reads off one element: its shadows, corners, fill and edge. */
async function boxOf(page: Page, sel: string) {
  return page.locator(sel).first().evaluate(el => {
    const cs = getComputedStyle(el);
    return { shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), fill: cs.backgroundColor, image: cs.backgroundImage,
      edge: cs.borderTopColor, edgeW: parseFloat(cs.borderTopWidth) };
  });
}
/* A token's value as the browser resolves it on the root (a length, a colour). */
const token = (page: Page, name: string, prop = 'color') => g(page, `(function () {
  var d = document.createElement('div'); d.style.setProperty(${JSON.stringify(prop)}, 'var(' + ${JSON.stringify(name)} + ')');
  document.body.appendChild(d); var v = getComputedStyle(d).getPropertyValue(${JSON.stringify(prop)}); d.remove(); return v;
})()`) as Promise<string>;

export function lookSuite(layout: 'phone' | 'desktop') {
  test.describe(`P228: the look (${layout})`, () => {
    test('a well: every field, search, segmented track, tick box, switch, meter track and tile in a card sinks, its fill the well', async ({ page }) => {
      await loadAppWithState(page, sweepState());
      const veil = await token(page, '--well', 'background-color');
      const well = async (sel: string, what: string) => {
        const b = await boxOf(page, sel);
        expect(inset(b.shadow), `${what}: every shadow inset (${b.shadow})`).toBe(true);
        return b;
      };
      // Pulse: the period's track, a tile in a card, a meter's bar.
      await openPulse(page);
      const seg = await well('#pageHome .inv-seg', 'the segmented track');
      expect(seg.fill, 'the track is the well').toBe(veil);
      const tile = await well('#homeTiles .inv-tile', 'a tile in a card');
      expect(tile.radius, 'a tile’s corners').toBe(parseFloat(await token(page, '--r-tile', 'border-top-left-radius')));
      expect(tile.fill === veil || /gradient/.test(tile.image), 'a tile is the well, or a well of its tone').toBe(true);
      // A meter is a Small's picture since U2R (§24f: a question's vital at Small), so one question is put on the board at Small.
      await page.evaluate(() => {
        const w = window as any;
        ['desk', 'phone'].forEach((lay: string) => w.wdgItemsPut('home', lay, w.wdgItems('home', lay).map((x: string[]) => x[0] === 'q-clients' ? ['q-clients', 's'] : x)));
        w.renderHome();
      });
      await page.locator('#homeBoard [data-w="q-clients"][data-size="s"]').waitFor();
      const meter = await well('#pageHome svg.inv-meter', 'a meter');
      expect(meter.radius).toBeGreaterThan(0);
      expect(await page.locator('#pageHome .inv-meter-track').first().evaluate(el => getComputedStyle(el).fill)).toBe(veil);
      // The pressed segment is a pill of the card's surface, lifted in the track; the rest are bare.
      const pill = await page.locator('#pageHome .inv-seg-btn[aria-pressed="true"]').first().evaluate(el => {
        const cs = getComputedStyle(el), a = getComputedStyle(el, '::after');
        return { fill: cs.backgroundColor, clip: cs.backgroundClip, h: el.getBoundingClientRect().height, after: a.boxShadow };
      });
      expect(pill.fill).toBe(await token(page, '--surface', 'background-color'));
      expect(pill.clip, 'the pill is clipped inside the segment’s margin').toBe('padding-box');
      expect(layers(pill.after).some(x => !/inset/.test(x)), 'the pill lifts').toBe(true);
      if (layout === 'phone') expect(pill.h, 'still a 44px target').toBeGreaterThanOrEqual(43.5);
      // Create: a field and a search; a dialog's tick box; a switch drawn in place.
      await switchTab(page, 'pageCreate');
      const field = await well('#pageCreate .inv-input', 'a field');
      expect(field.fill).toBe(veil);
      // Every well has a tile's corners since U2R (§24b: a field, the search and a segmented track moved from --r-ctl to --r-tile).
      expect(field.radius).toBe(parseFloat(await token(page, '--r-tile', 'border-top-left-radius')));
      await switchTab(page, 'pageRegister');
      // Measured at rest: focused, a well carries the shared ring outside it as well (§3b).
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const search = await well('#pageRegister .inv-search', 'a search');
      expect(search.fill).toBe(veil);
      await g(page, `document.getElementById('pageRegister').insertAdjacentHTML('beforeend',
        '<label class="inv-field-check" id="p228sw"><input type="checkbox" role="switch" class="inv-switch"> On</label><input type="checkbox" class="inv-check" id="p228tick">')`);
      const tick = await well('#p228tick', 'a tick box');
      expect(tick.fill).toBe(veil);
      const sw = await well('#p228sw .inv-switch', 'a switch');
      expect(sw.radius).toBeGreaterThan(10);
      const knob = await page.locator('#p228sw .inv-switch').evaluate(el => getComputedStyle(el, '::before').boxShadow);
      expect(outer(knob), 'the knob lifts').toBe(true);
      await page.locator('#p228sw').click();
      await expect(page.locator('#p228sw .inv-switch')).toBeChecked();
      // The track changes colour over its transition, so it is read once it has settled.
      const accent = await token(page, '--accent', 'background-color');
      await expect.poll(async () => (await boxOf(page, '#p228sw .inv-switch')).fill, { message: 'on, the track is the accent' }).toBe(accent);
    });

    test('a card lifts with a card’s corners, and in dark it carries its fine edge; the primary’s face deepens and lifts further', async ({ page }) => {
      await loadAppWithState(page, sweepState());
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        const rCard = parseFloat(await token(page, '--r-card', 'border-top-left-radius'));
        const edge = await token(page, '--edge', 'border-top-color');
        // Home's board first (UI pass 3, U2: a widget is a card), then Needs you, its second view.
        await openHome(page);
        await openNeeds(page);
        for (const sel of ['#homeNeeds .inv-hero', '#homeNeeds .inv-deck-item']) {
          const c = await boxOf(page, sel);
          expect(layers(c.shadow).length, `${scheme} ${sel}: two shadows`).toBe(2);
          expect(outer(c.shadow), `${scheme} ${sel}: outside it`).toBe(true);
          expect(c.radius, `${scheme} ${sel}: a card's corners`).toBe(rCard);
        }
        await openHome(page);
        const w = await boxOf(page, '#homeBoard .inv-widget');
        expect(layers(w.shadow).length, `${scheme} a widget: two shadows`).toBe(2);
        expect(outer(w.shadow), `${scheme} a widget: outside it`).toBe(true);
        expect(w.radius, `${scheme} a widget: a card's corners`).toBe(rCard);
        await switchTab(page, 'pageCreate');
        const panel = await boxOf(page, '#pageCreate .inv-panel');
        expect(layers(panel.shadow).length, `${scheme} a panel: two shadows`).toBe(2);
        expect(outer(panel.shadow)).toBe(true);
        expect(panel.radius).toBe(rCard);
        expect(panel.edge, `${scheme} a panel's fine edge`).toBe(edge);
        expect(panel.edgeW).toBe(1);
        if (scheme === 'dark') expect(edge, 'dark: the fine edge is light, so it is seen').toMatch(/^rgba\(237, 240, 243, 0\.08\)$/);
        if (layout === 'phone') {
          const bar = await boxOf(page, '.inv-navbar');
          expect(layers(bar.shadow).length, `${scheme} the bar floats as a card`).toBe(2);
          // The phone's bar has its own corners since U2R (§24b: --r-bar, rounder than a card's).
          const rBar = parseFloat(await token(page, '--r-bar', 'border-top-left-radius'));
          expect(bar.radius).toBe(rBar);
          expect(rBar).toBeGreaterThan(rCard);
        }
        // The one primary: the accent running to a step deeper, lifted further than a card.
        const prim = await boxOf(page, '#pageCreate .inv-btn-primary');
        const acc = await token(page, '--accent'), deep = await token(page, '--accent-deep');
        expect(prim.image, `${scheme} the primary's face`).toBe(`linear-gradient(${acc}, ${deep})`);
        expect(layers(prim.shadow).length).toBe(2);
        expect(prim.radius).toBe(parseFloat(await token(page, '--r-ctl', 'border-top-left-radius')));
        // A secondary lifts; a ghost and a link cast nothing.
        const sec = await page.evaluate(() => {
          const out: Record<string, string> = {};
          for (const k of ['inv-btn inv-btn-secondary', 'inv-btn inv-btn-ghost', 'inv-btn inv-btn-link']) {
            const b = document.createElement('button'); b.className = k; b.textContent = 'x'; document.body.appendChild(b);
            out[k] = getComputedStyle(b).boxShadow; b.remove();
          }
          return out;
        });
        expect(outer(sec['inv-btn inv-btn-secondary'])).toBe(true);
        expect(sec['inv-btn inv-btn-ghost']).toBe('none');
        expect(sec['inv-btn inv-btn-link']).toBe('none');
      }
    });

    test('a toast is a pill on one line, as wide as its words up to the room, and when it wraps every word stays inside its fill', async ({ page }) => {
      await loadAppWithState(page, sweepState());
      const read = (msg: string) => page.evaluate(m => {
        (window as any).showToast(m, 'error');
        const t = document.querySelector('.inv-toast') as HTMLElement;
        const r = t.getBoundingClientRect(), rad = parseFloat(getComputedStyle(t).borderTopLeftRadius);
        const range = document.createRange(); range.selectNodeContents(t);
        const lines = Array.from(range.getClientRects()).filter(q => q.width > 0);
        // A point is in the fill when it is in the box and, in a corner's square, within the corner's circle.
        const inFill = (x: number, y: number) => {
          if (x < r.left - 0.5 || x > r.right + 0.5 || y < r.top - 0.5 || y > r.bottom + 0.5) return false;
          const cx = x < r.left + rad ? r.left + rad : x > r.right - rad ? r.right - rad : x;
          const cy = y < r.top + rad ? r.top + rad : y > r.bottom - rad ? r.bottom - rad : y;
          return Math.hypot(x - cx, y - cy) <= rad + 0.5;
        };
        const out = lines.filter(q => !(inFill(q.left, q.top) && inFill(q.right, q.top) && inFill(q.left, q.bottom) && inFill(q.right, q.bottom)));
        const room = Math.min(window.innerWidth - 24, 30 * parseFloat(getComputedStyle(document.documentElement).fontSize));
        return { w: r.width, h: r.height, rad, lines: new Set(lines.map(q => Math.round(q.top))).size, out: out.length, room };
      }, msg);
      const short = await read('Saved');
      expect(short.lines, 'a short toast is one line').toBe(1);
      expect(short.rad, 'one line: a pill, its corners half its height').toBeGreaterThanOrEqual(short.h / 2 - 1);
      const long = await read('This device has no GitHub sync set up, which carries the job to the office: Settings → Connections → GitHub sync.');
      expect(long.out, 'every line of a toast that wraps is inside its fill').toBe(0);
      if (long.lines > 1) expect(long.w, 'a toast wraps only once it is as wide as the room').toBeGreaterThan(long.room - 2);
    });

    test('the six series and the scale are the validated values in both themes, and no retired token is left in the stylesheet', async ({ page }) => {
      await loadAppWithState(page, sweepState());
      const want: Record<string, [string, string]> = {
        '--series-1': ['rgb(46, 117, 182)', 'rgb(90, 152, 220)'], '--series-2': ['rgb(192, 98, 43)', 'rgb(217, 115, 61)'],
        '--series-3': ['rgb(31, 138, 106)', 'rgb(47, 163, 127)'], '--series-4': ['rgb(168, 124, 0)', 'rgb(184, 137, 15)'],
        '--series-5': ['rgb(194, 80, 138)', 'rgb(208, 106, 156)'], '--series-6': ['rgb(107, 85, 201)', 'rgb(133, 118, 232)'],
        '--series-other': ['rgb(154, 164, 174)', 'rgb(93, 103, 114)'],
        '--seq-1': ['rgb(205, 226, 251)', 'rgb(22, 58, 99)'], '--seq-7': ['rgb(13, 54, 107)', 'rgb(205, 226, 251)'],
      };
      for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
        await page.emulateMedia({ colorScheme: scheme });
        for (const [k, v] of Object.entries(want)) expect(await token(page, k), `${scheme} ${k}`).toBe(v[i]);
      }
      const css = fs.readFileSync(path.join(__dirname, '..', '..', 'split', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, 'the tile’s lift is retired: inside a card a tile is a well').not.toContain('--shadow-tile');
      expect(css, 'the eight chart colours and their frame names are retired: a series is a slot, the frame --plot-*').not.toContain('--chart-');
    });
  });
}
