import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P99 (owner, 29 Sep 2026): Stock → Overview → Price trend, on Zinc, draws the market beside the bills: every day a
// Refresh kept, landed as a bill is priced (LME × (1 + uplift) + premium), and each bill by supplier. Each supplier's
// price over the market (weighted by kilos), whether each bill was bought near the 30-day low or high, and a bill with no
// LME for its day looked up on metals.dev. The frame hugs the prices rather than starting at zero.

const iso = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// LME (INR/kg) on the ten days before today: up to 320, then back down to 300.
const LME = [300, 304, 308, 312, 316, 320, 316, 310, 304, 300];
function state(): SepState {
  const lmeHistory: Record<string, number> = {};
  LME.forEach((v, k) => { lmeHistory[iso(-10 + k)] = v; });
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    zinc: { ratePerKg: 300, premiumPerKg: 15, upliftPct: 10, basis: 'lme', updatedAt: Date.now(), source: 'metals.dev · metals.zinc', lmeHistory },
    stock: {
      items: [
        { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] },
        { id: 'C', name: 'Caustic soda', key: 'CAUSTIC SODA', unit: 'kg', basis: 'draw', aliases: [] },
      ],
      entries: [
        // Alpha on day −9: LME 304 → market 349.40, paid 352 → +2.60. Too few market days before it to judge timing.
        { id: 'a1', itemId: 'Z', kind: 'bill', qty: 1000, price: 352, date: iso(-9), supplier: 'Alpha Metals', billNo: 'A/1', at: 1 },
        // Beta on day −4: LME 316 → 362.60, paid 356 → −6.60; the market that day near its 30-day high.
        { id: 'b1', itemId: 'Z', kind: 'bill', qty: 500, price: 356, date: iso(-4), supplier: 'Beta Zinc', billNo: 'B/1', at: 2 },
        // Alpha on day −1: LME 300 → 345, paid 350 → +5; the market at its 30-day low.
        { id: 'a2', itemId: 'Z', kind: 'bill', qty: 1000, price: 350, date: iso(-1), supplier: 'Alpha Metals', billNo: 'A/2', at: 3 },
        // Gamma, forty days back: no LME on record for that day.
        { id: 'g1', itemId: 'Z', kind: 'bill', qty: 200, price: 340, date: iso(-40), supplier: 'Gamma', billNo: 'G/1', at: 4 },
        { id: 'c1', itemId: 'C', kind: 'bill', qty: 50, price: 60, date: iso(-5), supplier: 'Chem', at: 5 },
      ],
      pastes: [],
    },
  } as unknown as SepState;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);

test.describe('P99: zinc, the market against bills', () => {
  test('each bill is set against the landed market on its day; suppliers are weighted by kilos; timing is read', async ({ page }) => {
    await loadAppWithState(page, state());
    const t = await g(page, `(function(){ var T = zincTrend(null); return {
      bills: T.bills.map(function(b){ return [b.supplier, b.market, b.over, b.timing ? b.timing.band : null]; }),
      sup: T.suppliers.map(function(s){ return [s.name, s.n, s.kg, s.avg, s.over]; }),
      now: T.now.landed, noMarket: T.noMarket, market: T.market.length }; })()`);
    expect(t.bills).toEqual([
      ['Gamma', null, null, null],
      ['Alpha Metals', 349.4, 2.6, null],
      ['Beta Zinc', 362.6, -6.6, 'high'],
      ['Alpha Metals', 345, 5, 'low'],
    ]);
    expect(t.sup).toEqual([
      ['Alpha Metals', 2, 2000, 351, 3.8],
      ['Beta Zinc', 1, 500, 356, -6.6],
      ['Gamma', 1, 200, 340, null],
    ]);
    expect(t).toMatchObject({ now: 345, noMarket: 1, market: 10 });
    // A range drops what is before it.
    expect(await g(page, `zincTrend('${iso(-5)}').bills.length + '|' + zincTrend('${iso(-5)}').market.length`)).toBe('2|5');
  });

  test('the frame hugs the prices: four round steps around the data, never from zero', async ({ page }) => {
    await loadAppWithState(page, state());
    // 22 across: a quarter is 5.5, so steps of 10 from 340.
    expect(await g(page, `JSON.stringify(chartFitRange(345, 367))`)).toBe('{"lo":340,"hi":380}');
    // 60 across: steps of 20; 340 + 4 × 20 reaches past 400.
    expect(await g(page, `JSON.stringify(chartFitRange(340, 400))`)).toBe('{"lo":340,"hi":420}');
    expect(await g(page, `JSON.stringify(chartNiceRange(345, 367))`)).toBe('{"lo":0,"hi":400}');
  });

  test('Stock → Overview on Zinc: tiles, the chart, suppliers lowest and highest, a supplier opens its bills, the range', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    const panel = page.locator('#dashPrice');
    await page.locator('#dashPriceLine').selectOption('C');
    await expect(panel.locator('.inv-panel-title')).toHaveText('Price trend');
    await page.locator('#dashPriceLine').selectOption('Z');
    await expect(panel.locator('.inv-panel-title')).toHaveText('Price trend: market against bills');
    await expect(panel.locator('.inv-tile').nth(0)).toContainText('345.00');
    await expect(panel.locator('.inv-tile').nth(1)).toContainText('350.00');
    // (2.60 × 1000 + 5 × 1000 − 6.60 × 500) ÷ 2500 = 1.72 over.
    await expect(panel.locator('.inv-tile').nth(2)).toContainText('+₹1.72');
    await expect(panel.locator('.inv-chart-keys')).toContainText('Market, landed');
    await expect(panel.locator('.inv-chart-keys')).toContainText('Alpha Metals');
    // The lowest gridline is not ₹0.
    const grid = await panel.locator('.inv-chart-grid-label').allInnerTexts();
    expect(grid[grid.length - 1]).not.toBe('₹0.00');
    await expect(panel.locator('[data-zinc-timing]')).toContainText('1 bought near the low, 0 in the middle, 1 near the high');
    await expect(panel).toContainText('₹5.00 a kg under the last bill');

    await expect(panel.locator('[data-zinc-supplier="Alpha Metals"] .inv-dot')).toHaveText('Highest');
    await expect(panel.locator('[data-zinc-supplier="Beta Zinc"] .inv-dot')).toHaveText('Lowest');
    await expect(panel.locator('[data-zinc-supplier="Gamma"] .inv-dot')).toHaveText('No market');
    await panel.locator('[data-zinc-supplier="Alpha Metals"] [data-action="invDashZincSupplier"]').click();
    const bills = page.locator('#dashPrice [data-zinc-bill]');
    await expect(bills).toHaveCount(2);
    await expect(bills.first()).toContainText('A/2');
    await expect(bills.first()).toContainText('near its 30-day low');
    await expect(bills.first().locator('.inv-row-end')).toHaveText('+₹5.00');

    // 3M drops nothing here; a range still redraws the panel on its own.
    await page.locator('#dashPrice [data-action="invDashZincRange"][data-range="3M"]').click();
    await expect(page.locator('#dashPrice [data-action="invDashZincRange"][data-range="3M"]')).toHaveAttribute('aria-pressed', 'true');
    // Back to another line: the ordinary chart.
    await page.locator('#dashPriceLine').selectOption('C');
    await expect(page.locator('#dashPrice .inv-panel-title')).toHaveText('Price trend');
    await expect(page.locator('#dashPriceChart')).toContainText('Caustic soda');
  });

  test('a bill with no LME for its day is looked up on metals.dev and kept', async ({ page }) => {
    await loadAppWithState(page, state());
    await page.evaluate(() => localStorage.setItem('sep_inv_metals_key', 'test-key'));
    const toz = (inrKg: number) => inrKg * 0.0125 / 32.1507466;
    await page.route('https://api.metals.dev/v1/timeseries**', route => {
      const end = new URL(route.request().url()).searchParams.get('end_date')!;
      route.fulfill({ json: { status: 'success', currency: 'USD', unit: 'toz', rates: {
        [end]: { date: end, currencies: { INR: 0.0125, USD: 1 }, metals: { zinc: toz(290) } } } } });
    });
    await switchTab(page, 'pageStock');
    await page.locator('#dashPriceLine').selectOption('Z');
    await expect(page.locator('#dashPrice')).toContainText('1 bill has no LME on record');
    await page.locator('#dashPrice [data-action="invDashZincLookup"]').click();
    // 290 × 1.1 + 15 = 334; Gamma paid 340.
    await expect(page.locator('#dashPrice [data-zinc-supplier="Gamma"] .inv-num')).toHaveText('+₹6.00');
    await expect(page.locator('#dashPrice [data-action="invDashZincLookup"]')).toHaveCount(0);
    expect(await g(page, `S.zinc.lmeHistory['${iso(-40)}']`)).toBe(290);
  });

  // metals.dev refusing (a spent key) or unreachable (no signal): the reason is said, nothing is kept, the bill still
  // counts as having no market, and Look up LME is offered again for another try.
  for (const [how, reply, said] of [
    ['refuses', { json: { status: 'failure', error_message: 'API key is invalid' } }, 'metals.dev: API key is invalid.'],
    ['is unreachable', null, 'metals.dev:'],
  ] as const) {
    test(`a lookup metals.dev ${how} says so, keeps nothing, and can be tried again`, async ({ page }) => {
      await loadAppWithState(page, state());
      await page.evaluate(() => localStorage.setItem('sep_inv_metals_key', 'test-key'));
      let asked = 0;
      await page.route('https://api.metals.dev/v1/timeseries**', route => { asked++; return reply ? route.fulfill(reply as any) : route.abort('internetdisconnected'); });
      await switchTab(page, 'pageStock');
      await page.locator('#dashPriceLine').selectOption('Z');
      await page.locator('#dashPrice [data-action="invDashZincLookup"]').click();
      await expect(page.locator('.inv-toast')).toContainText(said);
      expect(asked).toBe(1);
      expect(await g(page, `S.zinc.lmeHistory['${iso(-40)}'] === undefined`)).toBe(true);
      await expect(page.locator('#dashPrice [data-zinc-supplier="Gamma"] .inv-dot')).toHaveText('No market');
      await expect(page.locator('#dashPrice [data-action="invDashZincLookup"]')).toBeEnabled();
    });
  }

  test('with no metals.dev key the panel says where to add one, and offers no lookup', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await page.locator('#dashPriceLine').selectOption('Z');
    await expect(page.locator('#dashPrice [data-zinc-nomarket]')).toContainText('add a metals.dev key in Settings → Connections');
    await expect(page.locator('#dashPrice [data-action="invDashZincLookup"]')).toHaveCount(0);
  });
});
