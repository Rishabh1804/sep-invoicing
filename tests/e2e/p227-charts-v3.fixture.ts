import { test, expect, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso } from './fixtures';

// P227 (docs/UI_PASS_3.md §5, §3d, §7c, §20): the chart builders of UI pass 3, on both layouts. Each is drawn on made-up data
// into a box inside the page on show, and read back: the marks the dataviz method draws (bars at most 24 units with a 4-unit
// round data end, square where they stand; lines 2; dots 8 across with a 2-unit ring in the surface colour; hairline solid
// gridlines; text in text tokens), a <title> and a data-read on every datum with a hit area larger than its mark, the table
// behind every chart equal to what is drawn and swapped in place, the keys for two series or more, the series colours by slot
// in both themes, the one blank state for nothing to draw, nothing wider than its box; chartFit's least squares; seriesSlot's
// colours following the thing, never its rank; and nothing in the source reading the retired series tokens. Every name and
// figure is made up.

const ROOT = path.resolve(__dirname, '..', '..');
const ev = <T = any>(page: Page, js: string) => page.evaluate(src => (0, eval)(src), js) as Promise<T>;
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* A book: eight clients, each billed kilos in a known order (client 1 the most), and seven suppliers over two stock lines, each
   billed a known spend (Alpha Metals the most): seriesSlot's rankings over the whole book. */
function book() {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: 'CLIENT ' + String.fromCharCode(65 + i), billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg: 10, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }));
  s.invoices = s.clients.map((c: any, i: number) => {
    const kg = 100 * (8 - i), taxable = kg * 10;
    return { id: 'INV-' + (i + 1), invoiceNumber: String(i + 1).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(i + 1).padStart(5, '0'), date: day(-3), status: 'active', invoiceState: 'filed',
      clientId: c.id, clientName: c.name, clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'P' + i, desc: 'P' + i, hsn: '998873', unit: 'KG', qty: kg, rate: 10, amount: taxable, nosQty: null }],
      taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0, grandTotal: taxable, amountInWords: '',
      challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs() };
  });
  s.invNextNum = 9;
  const sup = ['Alpha Metals', 'Beta Chemicals', 'Gamma Traders', 'Delta Supplies', 'Epsilon Acids', 'Zeta Salts', 'Eta Stores'];
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }, { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', active: true }],
    entries: sup.map((name, i) => ({ id: 'b' + i, itemId: i < 2 ? 'Z' : 'N', kind: 'bill', qty: 10 * (7 - i), price: 100, date: day(-10 - i), billDate: day(-10 - i), supplier: name, billNo: 'B' + i, at: 1 })),
    pastes: [] };
  return s;
}

/* Draws `js` (a builder's call) into a box at the head of the page on show, under a spacer, so the box is read where a screen
   would hold it and the page has somewhere to scroll. Returns the box (the chart's own .inv-chart-box, or the blank state). */
async function draw(page: Page, js: string): Promise<Locator> {
  await page.evaluate(src => {
    let host = document.getElementById('p227');
    if (!host || !host.isConnected) {
      const pg = document.querySelector('.inv-page-active')!;
      host = document.createElement('div');
      host.id = 'p227';
      pg.insertBefore(host, pg.firstChild);
    }
    // A spacer (test-only styling) puts the chart a screen down, so a redraw that moved the page would show.
    host.innerHTML = '<div id="p227Spacer"></div><div class="inv-panel"><div class="inv-panel-body" id="p227Body">' + (0, eval)(src) + '</div></div><div id="p227After"></div>';
    (document.getElementById('p227Spacer') as HTMLElement).style.height = '110vh';
    (document.getElementById('p227After') as HTMLElement).style.height = '110vh';
  }, js);
  return page.locator('#p227Body > *').first();
}

/* What a chart's box holds, for the checks every builder shares. */
async function anatomy(box: Locator) {
  return box.evaluate((b: Element) => {
    const svgBox = (el: Element) => { try { const r = (el as SVGGraphicsElement).getBBox(); return { w: r.width, h: r.height }; } catch { return { w: 0, h: 0 }; } };
    const datums = Array.from(b.querySelectorAll('.inv-chart-draw [data-action="invChartRead"]'));
    const groups = Array.from(b.querySelectorAll('.inv-chart-draw g.inv-chart-datum'));
    const rect = b.getBoundingClientRect();
    const inScroller = (el: Element) => { for (let p = el.parentElement; p && p !== b; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    return {
      datums: datums.length,
      // Every datum carries its figure for a tap and a <title> for a hover (its own, or its mark's).
      unread: datums.filter(d => !(d.getAttribute('data-read') || '').trim()).length,
      untitled: datums.filter(d => !(d.querySelector('title') && (d.querySelector('title')!.textContent || '').trim())).length,
      // A group's hit area is larger than its mark.
      hits: groups.map(g => {
        const hit = g.querySelector(':scope > .inv-chart-hit'), mark = g.querySelector(':scope > :not(title):not(.inv-chart-hit)');
        const h = hit ? svgBox(hit) : { w: 0, h: 0 }, m = mark ? svgBox(mark) : { w: 0, h: 0 };
        return { title: g.firstElementChild!.tagName.toLowerCase() === 'title', hit: h.w * h.h, mark: m.w * m.h };
      }),
      // Nothing past the box's sides (a wide table scrolls inside its own scroller).
      wider: Array.from(b.querySelectorAll('*')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && !inScroller(el) && (r.left < rect.left - 1 || r.right > rect.right + 1);
      }).map(el => el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '')),
      overflow: (b as HTMLElement).scrollWidth - (b as HTMLElement).clientWidth,
      keys: Array.from(b.querySelectorAll('.inv-chart-draw .inv-chart-keys .inv-chart-key')).map(k => (k.textContent || '').trim()),
    };
  });
}
async function expectAnatomy(box: Locator, datums?: number) {
  const a = await anatomy(box);
  if (datums != null) expect(a.datums, 'one readable datum a figure').toBe(datums);
  expect(a.datums).toBeGreaterThan(0);
  expect(a.unread, 'a data-read on every datum').toBe(0);
  expect(a.untitled, 'a <title> on every datum').toBe(0);
  for (const h of a.hits) { expect(h.title, 'the group’s <title> first').toBe(true); expect(h.hit, 'the hit area larger than its mark').toBeGreaterThan(h.mark); }
  expect(a.wider, 'nothing past the box').toEqual([]);
  expect(a.overflow).toBeLessThanOrEqual(1);
  return a;
}

/* The table behind the chart: Table swaps it in for the drawing in place (the page does not move) and back; its rows are
   the data. */
async function tableRows(box: Locator) {
  return box.locator(':scope > .inv-chart-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.children).map(td => (td.textContent || '').trim())));
}
async function expectTable(page: Page, box: Locator, head: string[], rows: string[][]) {
  const btn = box.locator(':scope > .inv-chart-readline > [data-action="invChartTable"]');
  await expect(btn).toHaveText('Table');
  await expect(btn).toHaveClass(/inv-btn-ghost/);
  await expect(btn).toHaveClass(/inv-btn-sm/);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(box.locator(':scope > .inv-chart-table')).toBeHidden();
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' }));
  const y0 = await page.evaluate(() => window.scrollY);
  expect(y0, 'the page is scrolled to the chart').toBeGreaterThan(0);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(box.locator(':scope > .inv-chart-draw')).toBeHidden();
  await expect(box.locator(':scope > .inv-chart-table table.inv-table')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY), 'the swap is in place').toBe(y0);
  expect(await box.locator(':scope > .inv-chart-table thead th').allTextContents()).toEqual(head);
  expect(await tableRows(box)).toEqual(rows);
  // And back, from wherever the table left the button (a long table takes it off a phone's screen, and a tap there would
  // first scroll to it): the page does not move.
  await btn.evaluate(el => (el as HTMLElement).click());
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(box.locator(':scope > .inv-chart-draw')).toBeVisible();
  await expect(box.locator(':scope > .inv-chart-table')).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);
}

/* A tap on a datum writes its figure into the readout. `at`: where inside the datum to tap, as fractions of its box (a group's
   hit area reaches past its mark, so a tap off the mark still reads it). */
async function expectRead(page: Page, box: Locator, datum: Locator, at?: { x: number; y: number }) {
  await datum.evaluate(el => (el as Element).scrollIntoView({ block: 'center' }));
  const read = await datum.getAttribute('data-read');
  if (at) {
    const b = (await datum.boundingBox())!;
    await page.mouse.click(b.x + b.width * at.x, b.y + b.height * at.y);
  } else await datum.click();
  await expect(box.locator('.inv-chart-readout')).toHaveText(read!);
  await expect(datum).toHaveClass(/inv-chart-read-on/);
}

/* A colour the way the page resolves it, in the theme on show. */
const colourOf = (page: Page, token: string) => page.evaluate(t => {
  const d = document.createElement('div');
  d.style.color = 'var(' + t + ')';
  document.getElementById('p227Body')!.appendChild(d);
  const c = getComputedStyle(d).color;
  d.remove();
  return c;
}, token);

export function chartsV3Suite(layout: 'phone' | 'desktop') {
  test.describe(`P227: charts of UI pass 3 (${layout})`, () => {
    test.beforeEach(async ({ page }) => {
      await loadAppWithState(page, book() as any);
      // A document on both layouts (a list-and-pane screen never scrolls on the desktop), drawn once on opening, so the box
      // stays as drawn and the page can be scrolled to it.
      await switchTab(page, 'pageStats');
      await expect(page.locator('body')).toHaveClass(layout === 'desktop' ? /inv-desktop/ : /^(?!.*inv-desktop)/);
    });

    test('chartDiverging: bars up and down from a zero rule, judged by tone, the period to date lighter; read, keyed and tabled', async ({ page }) => {
      const box = await draw(page, `chartDiverging([{ key: '2026-04', label: 'Apr', value: 0.8 }, { key: '2026-05', label: 'May', value: -0.4 }, { key: '2026-06', label: 'Jun', value: 1.2 },
        { key: '2026-07', label: 'Jul', value: null }, { key: '2026-08', label: 'Aug', value: -1.1 }], { unit: 'rate', toDate: 4, ariaLabel: 'Price against cost' })`);
      await expect(box).toHaveClass(/inv-chart-box/);
      await expect(box.locator('.inv-chart-zero')).toHaveCount(1);
      await expect(box.locator('rect.inv-chart-bar.inv-chart-up.inv-chart-ok')).toHaveCount(2);
      await expect(box.locator('rect.inv-chart-bar.inv-chart-down.inv-chart-danger')).toHaveCount(2);
      // A null is a gap: no bar and no datum; its label and its row stay.
      const a = await expectAnatomy(box, 4);
      expect(a.keys).toEqual(['Above zero', 'Below zero']);
      // The period not yet ended: lighter, and its label and read say "to date".
      await expect(box.locator('rect.inv-chart-todate')).toHaveCount(1);
      await expect(box.locator('g.inv-chart-datum').last()).toHaveAttribute('data-read', 'Aug to date: −₹1.10/kg');
      // A positive bar's data end is its top, a negative one's its bottom; each square where it stands.
      const clips = await box.evaluate(b => ({ up: getComputedStyle(b.querySelector('.inv-chart-up')!).clipPath, down: getComputedStyle(b.querySelector('.inv-chart-down')!).clipPath }));
      expect(clips.up).toBe('inset(0px round 4px 4px 0px 0px)');
      expect(clips.down).toBe('inset(0px round 0px 0px 4px 4px)');
      // The hit area is the bar's whole column: a tap above Apr's bar still reads Apr.
      const apr = box.locator('g.inv-chart-datum[data-key="2026-04"]');
      await expect(apr).toHaveAttribute('data-read', 'Apr: +₹0.80/kg');
      await expectRead(page, box, apr, { x: 0.5, y: 0.05 });
      // The table says the sign as the reads do.
      await expectTable(page, box, ['', 'Price against cost'], [['Apr', '+₹0.80/kg'], ['May', '−₹0.40/kg'], ['Jun', '+₹1.20/kg'], ['Jul', '—'], ['Aug to date', '−₹1.10/kg']]);
    });

    test('chartHistogram: counts by bin, the last bin closed, a reference mark inside the frame; read and tabled', async ({ page }) => {
      const box = await draw(page, `chartHistogram([3, 7, 12, 14, 18, 18, 22, 29, 30], { binWidth: 10, unit: 'count', mark: { value: 45, label: 'Terms' }, ariaLabel: 'Days to pay' })`);
      // Bins of [a, b): 30 is the 30–40 bin's, and the bins run on to hold the mark at 45, the last one closed.
      const a = await expectAnatomy(box, 5);
      expect(a.keys).toEqual([]);
      await expect(box.locator('line.inv-chart-mark')).toHaveCount(1);
      await expect(box.locator('.inv-chart-mark-label')).toHaveText('Terms 45');
      const reads = await box.locator('g.inv-chart-datum').evaluateAll(gs => gs.map(g => g.getAttribute('data-read')));
      expect(reads).toEqual(['0–10: 2', '10–20: 4', '20–30: 2', '30–40: 1', '40–50: 0']);
      // The frame counts in whole steps: no gridline labelled with a rounded half.
      const grid = await box.locator('.inv-chart-grid-label').allTextContents();
      expect(grid).toEqual(['4', '3', '2', '1', '0']);
      // A bin with nothing in it is still read (a hit area, no bar).
      await expectRead(page, box, box.locator('g.inv-chart-datum').last(), { x: 0.5, y: 0.5 });
      await expectTable(page, box, ['Range', 'How many'], [['0–10', '2'], ['10–20', '4'], ['20–30', '2'], ['30–40', '1'], ['40–50', '0']]);
    });

    test('chartDots: one dot a row on one scale, marks as rules across the rows; a row is a button that reads out', async ({ page }) => {
      const box = await draw(page, `chartDots([{ key: 1, label: 'ALPHA FORGINGS AND HEAVY ENGINEERING PRIVATE LIMITED', value: 13.2 }, { key: 2, label: 'BETA', value: 9.5, sub: '12% of the plant' },
        { key: 3, label: 'GAMMA', value: 5.4, tone: 'danger' }], { unit: 'rate', marks: [{ value: 5.9, label: 'Variable' }, { value: 7.31, label: 'Full cost' }] })`);
      const a = await expectAnatomy(box, 3);
      expect(a.keys).toEqual(['Variable ₹5.90/kg', 'Full cost ₹7.31/kg']);
      // One scale: every row's track starts and ends at one place, and a mark's rule stands at one x on every row.
      const geo = await box.evaluate(b => Array.from(b.querySelectorAll('.inv-chart-row')).map(r => {
        const t = r.querySelector('.inv-chart-track')!.getBoundingClientRect(), m = r.querySelector('.inv-chart-mark')!.getBoundingClientRect();
        return { left: Math.round(t.left), width: Math.round(t.width), mark: Math.round(m.left) };
      }));
      expect(new Set(geo.map(g => g.left + ':' + g.width + ':' + g.mark)).size).toBe(1);
      await expect(box.locator('button.inv-chart-row')).toHaveCount(3);
      await expect(box.locator('.inv-chart-row').nth(2).locator('circle.inv-chart-pt')).toHaveClass(/inv-chart-danger/);
      await expect(box.locator('.inv-chart-row').first().locator('circle.inv-chart-pt')).toHaveClass(/inv-chart-s1/);
      await expect(box.locator('.inv-chart-scale-ends span')).toHaveText(['₹5.00', '₹15.00']);
      await expectRead(page, box, box.locator('.inv-chart-row').nth(1));
      await expect(box.locator('.inv-chart-readout')).toHaveText('BETA: ₹9.50/kg · 12% of the plant');
      const full = await ev<string[]>(page, `[chartFull(13.2, 'rate'), chartFull(9.5, 'rate'), chartFull(5.4, 'rate')]`);
      await expectTable(page, box, ['', 'Value', ''], [['ALPHA FORGINGS AND HEAVY ENGINEERING PRIVATE LIMITED', full[0], ''], ['BETA', full[1], '12% of the plant'], ['GAMMA', full[2], '']]);
    });

    test('chartScatter: three series at most, each in its slot, with its least-squares line and r; a dot is read through a hit area three times its size', async ({ page }) => {
      const box = await draw(page, `chartScatter([
        { key: 'a', label: 'VAT A1', slot: 1, points: [{ x: 1, y: 3, label: 'Mon' }, { x: 2, y: 5 }, { x: 3, y: 7 }, { x: 4, y: 9 }] },
        { key: 'b', label: 'VAT A2', slot: 2, points: [{ x: 1, y: 9 }, { x: 2, y: 8 }, { x: 4, y: 3 }] },
        { key: 'c', label: 'Barrel', slot: 3, points: [{ x: 3, y: 4 }] },
        { key: 'd', label: 'A fourth', slot: 4, points: [{ x: 2, y: 2 }] }], { xUnit: 'count', yUnit: 'count', fit: true, xLabel: 'Days', yLabel: 'Rounds' })`);
      const a = await expectAnatomy(box, 8);
      // The fourth series is not drawn: three at most.
      // VAT A2's three points: r = −9.667 / √(4.667 × 20.667) = −0.984.
      expect(a.keys).toEqual(['VAT A1 · r 1.00, 4 points', 'VAT A2 · r −0.98, 3 points', 'Barrel']);
      await expect(box.locator('circle.inv-chart-pt.inv-chart-s4')).toHaveCount(0);
      await expect(box.locator('circle.inv-chart-pt.inv-chart-s1')).toHaveCount(4);
      await expect(box.locator('circle.inv-chart-pt.inv-chart-s2')).toHaveCount(3);
      // A line where a series has three points or more; Barrel's one point has none.
      await expect(box.locator('line.inv-chart-fit')).toHaveCount(2);
      await expect(box.locator('line.inv-chart-fit.inv-chart-s1')).toHaveCount(1);
      const r = await box.locator('g.inv-chart-datum').first().evaluate(g => [+g.querySelector('.inv-chart-hit')!.getAttribute('r')!, +g.querySelector('.inv-chart-pt')!.getAttribute('r')!]);
      expect(r).toEqual([12, 4]);
      const mon = box.locator('g.inv-chart-datum').first();
      await expect(mon).toHaveAttribute('data-read', 'VAT A1, Mon: 1, 3');
      await expectRead(page, box, mon, { x: 0.12, y: 0.5 });
      await expectTable(page, box, ['', 'Point', 'Days', 'Rounds'],
        [['VAT A1', 'Mon', '1', '3'], ['VAT A1', '', '2', '5'], ['VAT A1', '', '3', '7'], ['VAT A1', '', '4', '9'], ['VAT A2', '', '1', '9'], ['VAT A2', '', '2', '8'], ['VAT A2', '', '4', '3'], ['Barrel', '', '3', '4']]);
    });

    test('chartHeat: a column a pay week Sunday to Saturday, rows Monday to Saturday, Sunday only where worked; the blue ramp by value, a hatch for no record', async ({ page }) => {
      // Two pay weeks: the Sunday that opens the first and the Saturday that closes the second (made-up days, from today).
      const sun = await ev<string>(page, `(function(){ var d = new Date(localDateStr() + 'T00:00:00'); d.setDate(d.getDate() - d.getDay() - 7); return isoOf(d); })()`);
      const at = (n: number) => ev<string>(page, `isoAddDays('${sun}', ${n})`);
      const days: string[] = [];
      for (let n = 0; n < 14; n++) days.push(await at(n));
      // Week 1: Mon 100 … Sat 600, its Sunday not a working day; week 2: Sunday worked 350, Tuesday no record, the rest 700.
      const cells = days.map((d, n) => n === 0 ? { date: d, state: 'off' } : n < 7 ? { date: d, value: n * 100, state: 'ok' }
        : n === 7 ? { date: d, value: 350, state: 'ok' } : n === 9 ? { date: d, state: 'none' } : { date: d, value: 700, state: 'ok' });
      const box = await draw(page, `chartHeat(${JSON.stringify(cells)}, { unit: 'kg', ariaLabel: 'Plated each day' })`);
      const a = await expectAnatomy(box, 13);
      // Rows: the Sunday row is drawn, since one Sunday was worked; Monday to Saturday always. A week is named by its Saturday,
      // the latest always.
      const sat = await ev<string>(page, `_chartDay('${days[13]}')`);
      await expect(box.locator('svg.inv-chart-heat text.inv-chart-axis')).toHaveText(['S', 'M', 'T', 'W', 'T', 'F', 'S', sat]);
      // Two columns; the unworked Sunday is no cell; the worked one is.
      const xs = await box.locator('g.inv-chart-datum > rect:not(.inv-chart-hit)').evaluateAll(rs => Array.from(new Set(rs.map(r => r.getAttribute('x')))));
      expect(xs).toHaveLength(2);
      await expect(box.locator(`g.inv-chart-datum[data-key="${days[0]}"]`)).toHaveCount(0);
      await expect(box.locator(`g.inv-chart-datum[data-key="${days[7]}"]`)).toHaveCount(1);
      // No record: hatched, read as such.
      const none = box.locator(`g.inv-chart-datum[data-key="${days[9]}"]`);
      await expect(none.locator('rect.inv-chart-cell-none')).toHaveCount(1);
      expect(await none.locator('line.inv-chart-hatch').count()).toBeGreaterThan(2);
      await expect(none).toHaveAttribute('data-read', /: no record$/);
      // The value on the ramp: the largest the darkest step, the smallest the lightest.
      await expect(box.locator(`g.inv-chart-datum[data-key="${days[8]}"] rect`).last()).toHaveClass(/inv-chart-seq7/);
      await expect(box.locator(`g.inv-chart-datum[data-key="${days[1]}"] rect`).last()).toHaveClass(/inv-chart-seq1/);
      expect(a.keys[0]).toMatch(/^0kg.*700kg$/);
      expect(a.keys[1]).toBe('No record');
      await expect(box.locator('.inv-chart-ramp .inv-chart-swatch')).toHaveCount(7);
      await expectRead(page, box, box.locator(`g.inv-chart-datum[data-key="${days[3]}"]`), { x: 0.5, y: 0.5 });
      const rows = await box.evaluate((_b, ds) => ds.map((d: string, n: number) => {
        const w = window as any, name = w._chartDay(d, true);
        if (n === 0) return [name, '—', 'Not a working day'];
        if (n === 9) return [name, '—', 'No record'];
        const v = n < 7 ? n * 100 : n === 7 ? 350 : 700;
        return [name, w.chartFull(v, 'kg'), 'Recorded'];
      }), days);
      await expectTable(page, box, ['Day', 'Value', 'Record'], rows);
    });

    test('chartDumbbell: a rule from a (its mark) to b (a dot in the row’s tone), on one scale; keys for both ends; tabled', async ({ page }) => {
      const box = await draw(page, `chartDumbbell([{ key: 1, label: 'ALPHA', a: 45, b: 34, tone: 'ok' }, { key: 2, label: 'BETA', a: 45, b: 58, tone: 'danger' }, { key: 3, label: 'GAMMA', a: 7, b: null }],
        { unit: 'count', aLabel: 'Terms', bLabel: 'Pays in' })`);
      const a = await expectAnatomy(box, 3);
      expect(a.keys).toEqual(['Terms', 'Pays in']);
      const beta = box.locator('.inv-chart-row').nth(1);
      await expect(beta.locator('line.inv-chart-dumb-rule')).toHaveCount(1);
      await expect(beta.locator('line.inv-chart-dumb-a')).toHaveCount(1);
      await expect(beta.locator('circle.inv-chart-pt')).toHaveClass(/inv-chart-danger/);
      // The rule runs from a to b, the mark at a, the dot at b.
      const g = await beta.evaluate(r => ({ x1: r.querySelector('.inv-chart-dumb-rule')!.getAttribute('x1'), x2: r.querySelector('.inv-chart-dumb-rule')!.getAttribute('x2'),
        a: r.querySelector('.inv-chart-dumb-a')!.getAttribute('x1'), b: r.querySelector('.inv-chart-pt')!.getAttribute('cx') }));
      expect(g.x1).toBe(g.a);
      expect(g.x2).toBe(g.b);
      // A row with no b: its mark only, its figure a dash.
      await expect(box.locator('.inv-chart-row').nth(2).locator('circle')).toHaveCount(0);
      await expect(box.locator('.inv-chart-row').nth(2).locator('.inv-chart-row-val')).toHaveText('—');
      await expectRead(page, box, beta);
      await expect(box.locator('.inv-chart-readout')).toHaveText('BETA: Pays in 58 · Terms 45');
      await expectTable(page, box, ['', 'Terms', 'Pays in'], [['ALPHA', '45', '34'], ['BETA', '45', '58'], ['GAMMA', '7', '—']]);
    });

    test('chartStack100: shares to 100%, the parts a 2-unit surface gap apart, the top part’s end rounded; keyed and tabled as shares', async ({ page }) => {
      const box = await draw(page, `chartStack100(['Tonnage', 'Revenue', 'Nothing'], [{ label: 'ALPHA', values: [60, 30, 0], slot: 1 }, { label: 'BETA', values: [30, 50, 0], slot: 2 }, { label: 'Other', values: [10, 20, 0], slot: 'other' }], { unit: 'kg' })`);
      const a = await expectAnatomy(box, 6);
      expect(a.keys).toEqual(['ALPHA', 'BETA', 'Other']);
      // Each column reaches the full height: its parts and the gaps between them.
      const cols = await box.evaluate(b => {
        const by: Record<string, Array<{ y: number; h: number; up: boolean }>> = {};
        b.querySelectorAll('g.inv-chart-datum').forEach(g => {
          const r = g.querySelector('rect.inv-chart-bar')!;
          (by[g.getAttribute('data-key')!] = by[g.getAttribute('data-key')!] || []).push({ y: +r.getAttribute('y')!, h: +r.getAttribute('height')!, up: r.classList.contains('inv-chart-up') });
        });
        return by;
      });
      expect(Object.keys(cols)).toEqual(['Tonnage', 'Revenue']);
      for (const parts of Object.values(cols)) {
        const top = Math.min(...parts.map(p => p.y)), bottom = Math.max(...parts.map(p => p.y + p.h));
        expect(top).toBeCloseTo(14, 1);         // the 100% line (pad.t)
        expect(bottom).toBeCloseTo(190, 1);     // the baseline (H − pad.b)
        const sorted = parts.slice().sort((p, q) => q.y - p.y);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].y - (sorted[i].y + sorted[i].h)).toBeCloseTo(2, 1);
        expect(parts.filter(p => p.up)).toHaveLength(1);
        expect(sorted[sorted.length - 1].up).toBe(true);
      }
      await expect(box.locator('g.inv-chart-datum').first()).toHaveAttribute('data-read', 'Tonnage, ALPHA: 60.0% (60 kg)');
      await expectRead(page, box, box.locator('g.inv-chart-datum').nth(1), { x: 0.05, y: 0.5 });
      await expectTable(page, box, ['', 'ALPHA', 'BETA', 'Other'], [['Tonnage', '60.0%', '30.0%', '10.0%'], ['Revenue', '30.0%', '50.0%', '20.0%'], ['Nothing', '—', '—', '—']]);
    });

    test('chartRing: one share on a track in the well, its figure in the centre, in its slot or its tone; read and tabled', async ({ page }) => {
      const box = await draw(page, `chartRing(0.24, { slot: 3, sub: 'of the plant', label: 'ALPHA' })`);
      await expectAnatomy(box, 1);
      const arc = box.locator('circle.inv-chart-ring-arc');
      await expect(arc).toHaveClass(/inv-chart-s3/);
      await expect(arc).toHaveAttribute('stroke-dasharray', '24 100');
      await expect(box.locator('text.inv-chart-centre')).toHaveText('24%');
      const track = await box.locator('circle.inv-chart-ring-track').evaluate(c => getComputedStyle(c).stroke);
      expect(track).toBe(await colourOf(page, '--well'));
      expect(await arc.evaluate(c => getComputedStyle(c).stroke)).toBe(await colourOf(page, '--series-3'));
      await expectRead(page, box, box.locator('g.inv-chart-datum'), { x: 0.5, y: 0.5 });
      await expect(box.locator('.inv-chart-readout')).toHaveText('ALPHA: 24.0%');
      await expectTable(page, box, ['', 'Share'], [['ALPHA', '24.0%']]);
      const tone = await draw(page, `chartRing(1, { tone: 'warning' })`);
      await expect(tone.locator('circle.inv-chart-ring-arc')).toHaveClass(/inv-chart-warning/);
      await expect(tone.locator('circle.inv-chart-ring-arc')).not.toHaveAttribute('stroke-dasharray', /./);
    });

    test('the builders that were: chartLine, chartBars, chartPie and chartRankedBars stand in the box with Table, every datum read', async ({ page }) => {
      const data = `[{ label: 'Jul', value: 1200 }, { label: 'Aug', value: 900 }, { label: 'Sep', value: 1500 }]`;
      const full = await ev<string[]>(page, `[chartFull(1200, 'money'), chartFull(900, 'money'), chartFull(1500, 'money')]`);
      let box = await draw(page, `chartLine(${data}, { ariaLabel: 'Revenue', toDate: 2 })`);
      await expectAnatomy(box, 3);
      await expect(box.locator('circle.inv-chart-dot.inv-chart-s1')).toHaveCount(3);
      await expectRead(page, box, box.locator('circle.inv-chart-dot').nth(1));
      await expectTable(page, box, ['', 'Revenue'], [['Jul', full[0]], ['Aug', full[1]], ['Sep to date', full[2]]]);
      box = await draw(page, `chartBars(${data}, { ariaLabel: 'Revenue' })`);
      await expectAnatomy(box, 3);
      await expectRead(page, box, box.locator('rect.inv-chart-bar').first());
      await expectTable(page, box, ['', 'Revenue'], [['Jul', full[0]], ['Aug', full[1]], ['Sep', full[2]]]);
      box = await draw(page, `chartPie([{ label: 'ALPHA', value: 75, slot: 1 }, { label: 'BETA', value: 25, slot: 2 }], { unit: 'count' })`);
      await expectAnatomy(box, 2);
      await expect(box.locator('.inv-chart-wedge.inv-chart-s1')).toHaveCount(1);
      await expect(box.locator('.inv-chart-legend-row .inv-chart-swatch.inv-chart-s2')).toHaveCount(1);
      await expectTable(page, box, ['', 'Value', 'Share'], [['ALPHA', '75', '75.0%'], ['BETA', '25', '25.0%']]);
      box = await draw(page, `chartRankedBars([{ label: 'ALPHA', value: 13, display: '₹13.00/kg' }, { label: 'BETA', value: 5.4, tone: 'danger' }], { unit: 'rate' })`);
      await expectAnatomy(box, 2);
      await expectRead(page, box, box.locator('.inv-chart-ranked-row').first());
      await expect(box.locator('.inv-chart-readout')).toHaveText('ALPHA: ₹13.00/kg');
      // The track in percentages of its own width, never stretched: a true round on the data end, the start square.
      const fill = await box.locator('.inv-chart-ranked-fill').first().evaluate(r => ({ w: r.getAttribute('width'), clip: getComputedStyle(r).clipPath, h: r.getBoundingClientRect().height }));
      expect(fill.w).toBe('100%');
      expect(fill.clip).toBe('inset(0px round 0px 4px 4px 0px)');
      expect(fill.h).toBeLessThanOrEqual(24);
      await expectTable(page, box, ['', 'Value'], [['ALPHA', '₹13.00/kg'], ['BETA', '₹5.40/kg']]);
      // A ranked row that drills through keeps its action and says so.
      box = await draw(page, `chartRankedBars([{ label: 'ALPHA', value: 13, action: 'invStatsClientDrill', clientId: 1 }])`);
      await expect(box.locator('.inv-chart-ranked-row')).toHaveAttribute('data-action', 'invStatsClientDrill');
      await expect(box.locator('.inv-chart-readout')).toHaveText('Tap a row to open it');
    });

    test('the marks: bars at most 24 units, lines 2, dots 8 with a 2-unit ring in the surface colour, hairline solid gridlines, text in text tokens', async ({ page }) => {
      // Three bars on a 480-unit frame have room for 87 each: they stay 24.
      let box = await draw(page, `chartBars([{ label: 'Jul', value: 4 }, { label: 'Aug', value: 7 }, { label: 'Sep', value: 5 }], { unit: 'count' })`);
      const surface = await colourOf(page, '--surface'), border = await colourOf(page, '--border'), text3 = await colourOf(page, '--text-3');
      const bars = await box.locator('rect.inv-chart-bar').evaluateAll(rs => rs.map(r => ({ w: +r.getAttribute('width')!, clip: getComputedStyle(r).clipPath })));
      for (const b of bars) { expect(b.w).toBeLessThanOrEqual(24); expect(b.clip).toBe('inset(0px round 4px 4px 0px 0px)'); }
      const grid = await box.locator('line.inv-chart-grid').evaluateAll(ls => ls.map(l => { const c = getComputedStyle(l); return [c.strokeWidth, c.strokeDasharray, c.stroke]; }));
      for (const g of grid) expect(g).toEqual(['1px', 'none', border]);
      const labels = await box.locator('text.inv-chart-axis, text.inv-chart-grid-label').evaluateAll(ts => ts.map(t => getComputedStyle(t).fill));
      for (const f of labels) expect(f).toBe(text3);
      // Lines and dots; a dot's ring is the surface's colour in either theme (its stroke is painted under its fill, so 4 wide is 2
      // outside).
      box = await draw(page, `chartLines(['A', 'B', 'C'], [{ label: 'One', values: [1, 3, 2] }, { label: 'Two', values: [2, 1, 3] }], { unit: 'count' })`);
      const lines = await box.locator('polyline.inv-chart-path').evaluateAll(ls => ls.map(l => getComputedStyle(l).strokeWidth));
      for (const w of lines) expect(w).toBe('2px');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
        const ring = await colourOf(page, '--surface');
        const dots = await box.locator('circle.inv-chart-pt').evaluateAll(cs => cs.map(c => { const s = getComputedStyle(c); return [c.getAttribute('r'), s.strokeWidth, s.paintOrder, s.stroke]; }));
        for (const d of dots) expect(d, theme).toEqual(['4', '4px', 'stroke', ring]);
      }
      expect(await colourOf(page, '--surface'), 'the dark surface is its own').not.toBe(surface);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      // A pie's wedges stand a ring of the surface apart, round a hole of the surface.
      box = await draw(page, `chartPie([{ label: 'A', value: 3 }, { label: 'B', value: 1 }], { unit: 'count' })`);
      const wedges = await box.locator('.inv-chart-wedge').evaluateAll(ws => ws.map(w => { const s = getComputedStyle(w); return [s.stroke, s.strokeWidth]; }));
      for (const w of wedges) expect(w).toEqual([surface, '2px']);
      expect(await box.locator('.inv-chart-hole').evaluate(h => getComputedStyle(h).fill)).toBe(surface);
      // Grouped and stacked bars: each at most 24; a grouped pair stands apart.
      box = await draw(page, `chartStack(['Jul'], [{ label: 'Due', values: [50] }, { label: 'Paid', values: [30] }], { mode: 'group', unit: 'count' })`);
      const pair = await box.locator('rect.inv-chart-seg').evaluateAll(rs => rs.map(r => ({ x: +r.getAttribute('x')!, w: +r.getAttribute('width')! })));
      for (const p of pair) expect(p.w).toBeLessThanOrEqual(24);
      expect(pair[1].x - (pair[0].x + pair[0].w)).toBeCloseTo(2, 5);
      box = await draw(page, `chartDiverging([{ label: 'A', value: 1 }, { label: 'B', value: -1 }], {})`);
      for (const w of await box.locator('rect.inv-chart-bar').evaluateAll(rs => rs.map(r => +r.getAttribute('width')!))) expect(w).toBeLessThanOrEqual(24);
    });

    test('series by slot (§3d): six slots, Other, the accent for the one against the rest, and a status mark, each its token in both themes', async ({ page }) => {
      const series = [1, 2, 3, 4, 5, 6].map(n => `{ label: 'S${n}', values: [${n}, ${n + 1}], slot: ${n} }`).join(', ') +
        `, { label: 'Rest', values: [1, 2], slot: 'other' }, { label: 'This month', values: [2, 3], slot: 'one' }, { label: 'Good', values: [3, 1], tone: 'ok' }`;
      const box = await draw(page, `chartLines(['A', 'B'], [${series}], { unit: 'count' })`);
      const want: Array<[string, string]> = [1, 2, 3, 4, 5, 6].map(n => [`inv-chart-s${n}`, `--series-${n}`] as [string, string])
        .concat([['inv-chart-other', '--series-other'], ['inv-chart-one', '--accent'], ['inv-chart-ok', '--ok-mark']]);
      const seen: Record<string, string> = {};
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
        for (const [cls, token] of want) {
          const stroke = await box.locator(`polyline.inv-chart-path.${cls}`).first().evaluate(l => getComputedStyle(l).stroke);
          expect(stroke, `${cls} in ${theme}`).toBe(await colourOf(page, token));
          const fill = await box.locator(`circle.inv-chart-pt.${cls}`).first().evaluate(c => getComputedStyle(c).fill);
          expect(fill).toBe(stroke);
          const swatch = await box.locator(`.inv-chart-key .inv-chart-swatch.${cls}`).evaluate(s => getComputedStyle(s).backgroundColor);
          expect(swatch).toBe(stroke);
          if (theme === 'dark' && cls !== 'inv-chart-one') expect(stroke, `${cls} is drawn again for the dark theme`).not.toBe(seen[cls]);
          seen[cls] = stroke;
        }
      }
      // A key for each of two series or more; the keys' words wear text tokens, never the series colour.
      const keyText = await box.locator('.inv-chart-keys').evaluate(k => getComputedStyle(k).color);
      expect(keyText).toBe(await colourOf(page, '--text-2'));
      await expect(box.locator('.inv-chart-key')).toHaveCount(9);
      // One series has no keys in the new builders (its title names it); chartLines and chartStack keep the key they always drew.
      const one = await draw(page, `chartStack100(['A'], [{ label: 'Only', values: [3] }], {})`);
      await expect(one.locator('.inv-chart-keys')).toHaveCount(0);
    });

    test('nothing to draw is the one blank state, small, in the chart’s own words or “Nothing to draw yet”', async ({ page }) => {
      const blank = await ev<Record<string, any>>(page, `(function(){
        var d = document.createElement('div'), one = function(h) { d.innerHTML = h; var b = d.firstElementChild;
          return b && b.classList.contains('inv-blank') ? [b.getAttribute('data-blank'), b.classList.contains('inv-blank-sm'), (b.querySelector('.inv-blank-title') || {}).textContent] : (b ? b.className : null); };
        return { diverging: one(chartDiverging([{ label: 'A', value: null }])), histogram: one(chartHistogram([], { emptyText: 'No cut on record' })), dots: one(chartDots([])),
          scatter: one(chartScatter([{ label: 'a', points: [] }])), heat: one(chartHeat([])), dumbbell: one(chartDumbbell([{ label: 'x', a: null, b: null }])),
          stack100: one(chartStack100(['A'], [{ label: 's', values: [0] }])), ring: one(chartRing(null)), line: one(chartLine([])), bars: one(chartBars([], { emptyText: 'Nothing billed yet' })),
          pie: one(chartPie([])), pieTap: one(chartPieTap([])), ranked: one(chartRankedBars([])), lines: one(chartLines([], [])), stack: one(chartStack(['A'], [{ label: 's', values: [0] }])),
          early: one(chartLine([{ label: 'A', value: 1 }])), earlyLines: one(chartLines(['A'], [{ label: 's', values: [1] }])) };
      })()`);
      const nothing = ['empty', true, 'Nothing to draw yet'];
      for (const k of ['diverging', 'dots', 'scatter', 'heat', 'dumbbell', 'stack100', 'ring', 'line', 'pie', 'pieTap', 'ranked', 'lines', 'stack']) expect(blank[k], k).toEqual(nothing);
      expect(blank.histogram).toEqual(['empty', true, 'No cut on record']);
      expect(blank.bars).toEqual(['empty', true, 'Nothing billed yet']);
      // One point of a trend is not nothing: too little to draw yet.
      expect(blank.early).toEqual(['early', true, 'Need at least two points to show a trend']);
      expect(blank.earlyLines).toEqual(['early', true, 'Need at least two points to show a trend']);
    });

    test('chartFit: least squares, r, the line’s slope and intercept; none under three points or with every point at one x', async ({ page }) => {
      const f = await ev<any>(page, `({ line: chartFit([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }, { x: 4, y: 9 }, { x: 5, y: 11 }]),
        down: chartFit([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }]), two: chartFit([{ x: 1, y: 1 }, { x: 2, y: 2 }]),
        oneX: chartFit([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }]), flat: chartFit([{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }]),
        noisy: chartFit([{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 4 }, { x: 4, y: 3 }, { x: null, y: 9 }, { x: 5, y: Infinity }]) })`);
      expect(f.line).toEqual({ n: 5, r: 1, slope: 2, intercept: 1 });
      expect(f.down).toEqual({ n: 3, r: -1, slope: -2, intercept: 10 });
      expect(f.two).toBeNull();
      expect(f.oneX).toBeNull();
      expect(f.flat).toEqual({ n: 3, r: null, slope: 0, intercept: 4 });
      // Points that are not figures are left out: four remain.
      expect(f.noisy.n).toBe(4);
      expect(f.noisy.slope).toBeCloseTo(0.6, 10);
      expect(f.noisy.r).toBeCloseTo(0.6, 10);
    });

    test('seriesSlot: a colour follows the thing over the whole book, never its rank on one chart, so a filter never repaints the rest', async ({ page }) => {
      const s = await ev<any>(page, `({ clients: [1, 2, 3, 4, 5, 6, 7, 8].map(function(id) { return seriesSlot('client', id); }),
        asText: seriesSlot('client', '3'), lines: ['vat-a1', 'vat-a2', 'barrel', 'pickling'].map(function(l) { return seriesSlot('line', l); }),
        cost: ['labour', 'zinc', 'chem', 'chemicals', 'power', 'other'].map(function(c) { return seriesSlot('cost', c); }),
        areas: ['vat-a1', 'vat-a2', 'barrel', 'pickling-vat', 'pickling-barrel', 'office', 'gate', 'civil', 'flex'].map(function(a) { return seriesSlot('area', a); }),
        bankcat: ['wages', 'supplier', 'wages:cash', 'power', 'gst', 'tax', 'charges', 'reversal', 'other'].map(function(k) { return seriesSlot('bankcat', k); }),
        suppliers: ['Alpha Metals', 'Beta Chemicals', 'Gamma Traders', 'Delta Supplies', 'Epsilon Acids', 'Zeta Salts', 'Eta Stores'].map(function(n) { return seriesSlot('supplier', n); }),
        byId: seriesSlot('supplier', suppOfName('Beta Chemicals').id), stock: [seriesSlot('stock', 'N'), seriesSlot('stock', 'Z'), seriesSlot('stock', 'nope')],
        none: [seriesSlot('client', null), seriesSlot('client', 99), seriesSlot('nokind', 1)], cls: [chartSlotClass(seriesSlot('client', 1)), chartSlotClass(seriesSlot('client', 8))] })`);
      // The six clients with the most kilos plated over the book hold slots 1 to 6; the rest are Other.
      expect(s.clients).toEqual([1, 2, 3, 4, 5, 6, 'other', 'other']);
      expect(s.asText).toBe(3);
      expect(s.lines).toEqual([1, 2, 3, 'other']);
      expect(s.cost).toEqual([1, 2, 3, 3, 4, 5]);
      expect(s.areas).toEqual([1, 2, 3, 4, 4, 5, 5, 6, 'other']);
      // Money out by the bank's category, the same in every range: wages, suppliers, cash wages, electricity, GST, income tax.
      expect(s.bankcat).toEqual([1, 2, 3, 4, 5, 6, 'other', 'other', 'other']);
      // Suppliers by spend over the book, found by name or by id.
      expect(s.suppliers).toEqual([1, 2, 3, 4, 5, 6, 'other']);
      expect(s.byId).toBe(2);
      // Nitric acid's bills (5 suppliers, 10+20+30+40+50 at ₹100) outspend zinc's (60+70): N first.
      expect(s.stock).toEqual([1, 2, 'other']);
      expect(s.none).toEqual(['other', 'other', 'other']);
      expect(s.cls).toEqual(['inv-chart-s1', 'inv-chart-other']);
      // A pie of the clients, and the same pie with the largest filtered out: every other client keeps its colour.
      const pie = (ids: number[]) => `chartPie([${ids.map(id => `{ label: 'C${id}', value: ${10 - id}, slot: seriesSlot('client', ${id}) }`).join(', ')}], { unit: 'count' })`;
      const colours = async (ids: number[]) => {
        const box = await draw(page, pie(ids));
        return box.locator('.inv-chart-legend-row').evaluateAll(rs => Object.fromEntries(rs.map(r => [(r.querySelector('.inv-chart-legend-label')!.textContent || ''), (r.querySelector('.inv-chart-swatch')!.getAttribute('class') || '').replace('inv-chart-swatch ', '')])));
      };
      const all = await colours([1, 2, 3, 4, 5, 6, 7]), less = await colours([2, 3, 4, 5, 6, 7]);
      expect(all.C2).toBe('inv-chart-s2');
      for (const k of Object.keys(less)) expect(less[k], k).toBe(all[k]);
      // Worked out once a book: a new figure is not read until the book is saved, and then it is.
      const before = await ev(page, `(function(){ S.invoices.find(function(i) { return i.clientId === 8; }).items[0].qty = 5000; return seriesSlot('client', 8); })()`);
      expect(before).toBe('other');
      const after = await ev(page, `(function(){ saveState(); return [seriesSlot('client', 8), seriesSlot('client', 1), seriesSlot('client', 6)]; })()`);
      expect(after).toEqual([1, 2, 'other']);
    });

    test('the retired --chart-* tokens are gone: no rule, module or token block defines or reads one; the frame is --plot-*', async () => {
      // Comments aside: a comment may say what was retired.
      const css = fs.readFileSync(path.join(ROOT, 'split', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const js = fs.readdirSync(path.join(ROOT, 'split')).filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(ROOT, 'split', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');
      expect(Array.from(css.matchAll(/--chart-[a-z0-9-]+/g)).map(m => m[0]), 'no --chart- token in the stylesheet').toEqual([]);
      expect(Array.from(js.matchAll(/--chart-[a-z0-9-]+/g)).map(m => m[0]), 'no --chart- token in a module').toEqual([]);
      // The drawing's frame (its heights and its type in viewBox units) is defined once, in the token block, and read.
      const start = css.indexOf('--series-1:');
      const blockStart = css.lastIndexOf(':root {', start), blockEnd = css.indexOf('\n}', start);
      expect(blockStart).toBeGreaterThan(-1);
      const block = css.slice(blockStart, blockEnd), rest = css.slice(0, blockStart) + css.slice(blockEnd);
      const frame = ['--plot-fs-axis', '--plot-fs-centre', '--plot-h', '--plot-h-wide'];
      for (const t of frame) {
        expect(block, t + ' defined in the token block').toMatch(new RegExp(t + '\\s*:'));
        expect(rest, t + ' read by a rule').toMatch(new RegExp('var\\(\\s*' + t + '\\s*\\)'));
      }
      // The old colour classes are drawn by nothing and styled by nothing.
      expect(Array.from(js.matchAll(/inv-chart-c[0-9x]\b|'inv-chart-c' \+|inv-chart-s0\b/g)).map(m => m[0])).toEqual([]);
      expect(Array.from(css.matchAll(/\.inv-chart-c[0-9x]\b|\.inv-chart-s0\b|\.inv-chart-s7\b/g)).map(m => m[0])).toEqual([]);
    });
  });
}
