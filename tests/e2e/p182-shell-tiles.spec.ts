import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, openPulse, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P182 (owner, 8 Oct 2026): "The bottom bar still doesn't look right. Let's give our tiles elevation as well. Move insights into
// office tab, that way we have 5 icons again, which can be arranged in a better way." The phone bar is five doors, Add the
// centre one, every door one geometry (its mark over its word, the words on one line); the page fades into its own colour under
// the floating bar, so nothing scrolled beneath it shows cut in the gap; a tile is a raised box of its own.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

test.describe('P182: the five doors and the raised tiles (phone)', () => {
  test('five doors, Add the centre one; every mark one size, every word on one line', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const m = await g(page, `(function() {
      var bar = document.querySelector('.inv-navbar').getBoundingClientRect();
      var doors = Array.prototype.slice.call(document.querySelectorAll('.inv-navbar > .inv-navbar-item'));
      return {
        bar: [bar.left, bar.right],
        add: doors.map(function(d) { return d.dataset.action; }).indexOf('invAddOpen'),
        n: doors.length,
        addMid: (function(r) { return (r.left + r.right) / 2; })(document.querySelector('.inv-navbar-add .inv-navbar-mark').getBoundingClientRect()),
        marks: doors.map(function(d) { var r = d.querySelector('.inv-navbar-mark').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), r.top]; }),
        words: doors.map(function(d) {
          var t = Array.prototype.filter.call(d.childNodes, function(n) { return n.nodeType === 3 && n.textContent.trim(); })[0];
          var r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().bottom;
        })
      };
    })()`) as { bar: number[]; add: number; n: number; addMid: number; marks: number[][]; words: number[] };
    expect(m.n).toBe(5);
    expect(m.add).toBe(2);
    expect(Math.abs(m.addMid - (m.bar[0] + m.bar[1]) / 2)).toBeLessThanOrEqual(1);
    expect(new Set(m.marks.map(x => x[0] + 'x' + x[1])).size).toBe(1);
    for (const x of m.marks) expect(Math.abs(x[2] - m.marks[0][2])).toBeLessThanOrEqual(0.5);
    for (const y of m.words) expect(Math.abs(y - m.words[0])).toBeLessThanOrEqual(0.5);
    // The workspace on screen fills its pill; Add fills its own in the accent, the strongest fill.
    const fills = await g(page, `(function() {
      var probe = document.createElement('i'); probe.style.color = 'var(--accent)'; document.body.appendChild(probe);
      var accent = getComputedStyle(probe).color; probe.remove();
      return { accent: accent, add: getComputedStyle(document.querySelector('.inv-navbar-add .inv-navbar-mark')).backgroundColor,
        on: getComputedStyle(document.querySelector('.inv-navbar-item-on .inv-navbar-mark')).backgroundColor,
        off: getComputedStyle(document.querySelector('.inv-navbar-item:not(.inv-navbar-item-on):not(.inv-navbar-add) .inv-navbar-mark')).backgroundColor };
    })()`) as { accent: string; add: string; on: string; off: string };
    expect(fills.add).toBe(fills.accent);
    expect(fills.on).not.toBe('rgba(0, 0, 0, 0)');
    expect(fills.off).toBe('rgba(0, 0, 0, 0)');
  });

  test('under the floating bar the page fades into its own colour, which never prints', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const f = await g(page, `(function() {
      var a = getComputedStyle(document.body, '::after'), bar = document.querySelector('.inv-navbar').getBoundingClientRect();
      return { pos: a.position, bottom: a.bottom, events: a.pointerEvents, img: a.backgroundImage, h: parseFloat(a.height), z: +a.zIndex,
        gap: innerHeight - bar.top, barZ: +getComputedStyle(document.querySelector('.inv-navbar')).zIndex };
    })()`) as { pos: string; bottom: string; events: string; img: string; h: number; z: number; gap: number; barZ: number };
    expect(f.pos).toBe('fixed');
    expect(f.bottom).toBe('0px');
    expect(f.events).toBe('none');
    expect(f.img).toContain('linear-gradient');
    // It reaches above the bar's top, under the bar.
    expect(f.h).toBeGreaterThan(f.gap);
    expect(f.z).toBeLessThan(f.barZ);
    await page.emulateMedia({ media: 'print' });
    expect(await g(page, `getComputedStyle(document.body, '::after').display`)).toBe('none');
  });

  test('on a tablet the bar keeps its width, centred', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await loadAppWithState(page, sweepState());
    const [left, right] = await g(page, `(function() { var r = document.querySelector('.inv-navbar').getBoundingClientRect(); return [r.left, innerWidth - r.right]; })()`) as number[];
    expect(right).toBeGreaterThan(100);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  test('a tile is a raised box of its own; a pressed filter tile is let down', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await openPulse(page);
    const t = await g(page, `(function() {
      var tiles = Array.prototype.slice.call(document.querySelectorAll('#homeTiles .inv-tile')).filter(function(x) { return x.offsetParent; });
      var a = tiles[0].getBoundingClientRect(), b = tiles[1].getBoundingClientRect(), cs = getComputedStyle(tiles[0]);
      var sheet = tiles[0].closest('.inv-hero-sheet'), ss = sheet ? getComputedStyle(sheet) : null;
      return { shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), gap: Math.max(b.left - a.right, b.top - a.bottom),
        sheetFill: ss ? ss.backgroundImage + '|' + ss.backgroundColor : '', sheetBorder: ss ? ss.borderTopStyle : '' };
    })()`) as { shadow: string; radius: number; gap: number; sheetFill: string; sheetBorder: string };
    expect(t.shadow).not.toBe('none');
    expect(t.shadow.split('rgba').length - 1).toBe(2);
    expect(t.radius).toBeGreaterThan(0);
    expect(t.gap).toBeGreaterThanOrEqual(7.5);
    // A sheet holding the strip alone draws no box: the tiles are the boxes.
    expect(t.sheetFill).toBe('none|rgba(0, 0, 0, 0)');
    expect(t.sheetBorder).toBe('none');
    // Stock's tiles filter the lines: pressed, the tile loses its lift and keeps only the accent's line along its foot.
    await switchTab(page, 'pageStock');
    await page.locator('#pageStock .inv-viewtab[data-view="list"]').click();
    const filter = page.locator('#stockTiles button.inv-tile').first();
    await filter.click();
    await expect(page.locator('#stockTiles button.inv-tile[aria-pressed="true"]')).toHaveCount(1);
    const pressed = await page.locator('#stockTiles button.inv-tile[aria-pressed="true"]').evaluate(el => getComputedStyle(el).boxShadow);
    expect(pressed.split('rgba').length + pressed.split('rgb(').length - 2).toBe(1);
    expect(pressed).toContain('inset');
  });
});
