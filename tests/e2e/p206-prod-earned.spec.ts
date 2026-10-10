import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P206: a day's earnings by line, and the comparisons (owner, 10 Oct 2026: "As we are calculating production, why don't we calculate
// the earnings? … we can actually show the info there", and on Floor's day, "corrections and comparisons are missing"). What each
// line earned at its clients' rates on record, against what a kilo costs and against its usual day; the week to the day against
// the four weeks before, a recorded day's average on each side; the day's earnings against the live cost; the work no rate prices
// listed. Made-up clients and parts; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
// The day: the last working day before today (no plating on a Sunday).
const D = (() => { for (let n = -1; ; n--) { const d = shift(todayIso(), n); if (new Date(d + 'T00:00:00').getDay() !== 0) return d; } })();
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), defaultCostPerKg: 8 };
  s.clients = [
    { id: 31, name: 'ORBIT FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 12, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 32, name: 'LUMEN PRESS', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 10, effectiveFrom: '2020-04-01' }], itemRates: [],
      pieceRates: [{ partNumber: 'PLATE 7', gauge: '', rate: 2.5, effectiveFrom: '2020-04-01' }],
      pieceWeights: [{ partNumber: 'PLATE 7', gauge: '', kgPerPiece: 0.2, effectiveFrom: '2020-04-01' }] },
  ];
  const run = (id: string, date: string, time: string, clientId: number | null, part: string, qty: number, unit: string) =>
    ({ id, kind: 'plated', date, time, to: time, line: 'vat-a1', lineSrc: 'written', slot: 'general', ...(clientId != null ? { clientId } : {}), client: clientId ? 'X' : '',
      part, qty, unit, basis: 'hand', src: 'hand', at: 1 });
  const entries: any[] = [
    // The day: 300 kg at ORBIT's ₹12 (₹3,600) and 1,000 of LUMEN's plates at ₹2.50 a piece (₹2,500, 200 kg); 50 pieces with no client.
    run('D1', D, '09:00', 31, 'BRKT 9', 300, 'KG'), run('D2', D, '11:00', 32, 'PLATE 7', 1000, 'NOS'), run('D3', D, '13:00', null, 'MYSTERY', 50, 'NOS'),
  ];
  // Six days before it, the same weekday of each of the six weeks before: 400 kg at ₹12 (₹4,800) a day.
  for (let k = 1; k <= 6; k++) entries.push(run('U' + k, shift(D, -7 * k), '09:00', 31, 'BRKT 9', 400, 'KG'));
  s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  return s;
}
async function floorOn(page: Page, day: string) {
  await switchTab(page, 'pageFloor');
  await page.locator('#flrDate').fill(day);
  await page.locator('#flrDate').dispatchEvent('change');
}

test.describe('P206: a day’s earnings by line, against its usual and its cost', () => {
  test('what a line earned is worked out by line: its runs at their rates, the work no rate prices named', async ({ page }) => {
    await loadAppWithState(page, book());
    const w = await ev(page, `prodDayWorth('${D}', 'vat-a1')`) as any;
    expect(w).toMatchObject({ amount: 6100, runs: 2, unpriced: 50, kg: 500, amountKg: 6100 });
    expect(w.names[0]).toMatchObject({ part: 'MYSTERY', client: 'No client written', pieces: 50 });
    expect(await ev(page, `prodDayWorth('${D}', 'vat-a2').amount`)).toBe(0);
    // Its usual day: the median of its six days before, kilos and earnings.
    expect(await ev(page, `prodLineUsual('vat-a1', '${D}')`)).toMatchObject({ kg: 400, kgDays: 6, worth: 4800, worthDays: 6 });
    // The week to the day against the four before, a recorded day's average on each side.
    const wk = await ev(page, `prodLineWeek('vat-a1', '${D}')`) as any;
    expect(wk.cur.kgDay).toBe(500);
    expect(wk.kgDayBefore).toBe(400);
    expect(wk.kgWeeks).toBe(4);
  });

  test('Floor’s line card says what the line earned, coloured against the cost, set against its usual day', async ({ page }) => {
    await loadAppWithState(page, book());
    await floorOn(page, D);
    const row = page.locator('#flrLines [data-line="vat-a1"] [data-flr-earned]');
    await expect(row.locator('.inv-row-end')).toHaveText('₹6,100');
    await expect(row.locator('.inv-row-end .inv-fig-ok')).toHaveCount(1);
    await expect(row.locator('.inv-row-meta')).toHaveText('₹12.20 a kg, cost ₹8.00 · +27% on a usual day');
    // A role that does not see money reads the kilos against the usual day instead, and no rupee.
    await ev(page, `window.grdSeesMoney = function() { return false; }; renderFloor();`);
    await expect(page.locator('#flrLines [data-flr-earned]')).toHaveCount(0);
    const usual = page.locator('#flrLines [data-line="vat-a1"] [data-flr-usual]');
    await expect(usual.locator('.inv-row-end')).toHaveText('+25%');
    await expect(usual.locator('.inv-row-meta')).toHaveText('a usual day ≈ 400 kg · median of 6 days');
  });

  test('Lines: an Earned tile and change lines against the usual day, the week against the four before, the week’s earnings', async ({ page }) => {
    await loadAppWithState(page, book());
    await floorOn(page, D);
    await page.locator('#flrLines [data-line="vat-a1"] [data-action="invFlrLine"]').first().click();
    const v = page.locator('#prodLinesVerdict');
    await expect(v.locator('.inv-hero-sub')).toContainText('this week 500 kg a day, +25% on the 4 before');
    if (!(await v.evaluate(el => (el as HTMLDetailsElement).open))) await v.locator(':scope > summary').click();
    const earned = v.locator('[data-prod-line-tile="earned"]');
    await expect(earned.locator('.inv-tile-value')).toHaveText('₹6,100');
    await expect(earned.locator('.inv-tile-sub').first()).toHaveText('₹12.20 a kg, cost ₹8.00');
    await expect(earned.locator('[data-tile-delta]')).toHaveText('+27.1% on a usual day');
    await expect(v.locator('[data-prod-line-tile="kg"] [data-tile-delta]')).toHaveText('+25.0% on a usual day');
    // The rounds are the efficiency's: a role that sees money reads the earnings in their place.
    await expect(v.locator('[data-prod-line-tile="rounds"]')).toHaveCount(0);
    // The week, plated: the three lines' earnings a day under the lines.
    const er = page.locator('#prodWeek [data-prod-week-earned]');
    await expect(er).toContainText('₹6,100');
  });

  test('the day: its earnings against the live cost, what was left, the week against the four before, the work not priced', async ({ page }) => {
    await loadAppWithState(page, book());
    await floorOn(page, D);
    const card = page.locator('#flrHeroes [data-card="flr-prod"]');
    await card.locator(':scope > summary').click();
    await expect(card.locator('[data-prod-day-worth] .inv-row-end')).toHaveText('₹6,100.00');
    await expect(card.locator('[data-prod-day-cost] .inv-row-end')).toHaveText('₹4,000.00');
    await expect(card.locator('[data-prod-day-cost] .inv-row-meta')).toHaveText('₹8.00 a kg × 500 kg, the full cost typed');
    await expect(card.locator('[data-prod-day-left] .inv-row-end')).toHaveText('₹2,100.00');
    await expect(card.locator('[data-prod-day-left] .inv-fig-ok')).toHaveCount(1);
    await expect(card.locator('[data-prod-day-week4] .inv-row-end')).toHaveText('+25%');
    await expect(card.locator('[data-prod-day-week4-rs] .inv-row-end')).toHaveText('+27%');
    const np = card.locator('[data-prod-day-unpriced]');
    await expect(np.locator('summary')).toContainText('50 pcs');
    await np.locator('summary').click();
    await expect(np.locator('[data-prod-unpriced]')).toContainText('MYSTERY');
  });
});
