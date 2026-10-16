import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadAppWithState, openPulse, switchTab } from './fixtures';
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
      expect(field.radius).toBe(parseFloat(await token(page, '--r-ctl', 'border-top-left-radius')));
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
        await switchTab(page, 'pageHome');
        for (const sel of ['#homeNeeds .inv-hero', '#homeNeeds .inv-deck-item']) {
          const c = await boxOf(page, sel);
          expect(layers(c.shadow).length, `${scheme} ${sel}: two shadows`).toBe(2);
          expect(outer(c.shadow), `${scheme} ${sel}: outside it`).toBe(true);
          expect(c.radius, `${scheme} ${sel}: a card's corners`).toBe(rCard);
        }
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
          expect(bar.radius).toBe(rCard);
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
