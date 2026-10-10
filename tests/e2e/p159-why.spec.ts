import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, type SepState } from './fixtures';

// P159: why it moved (the intelligence's fourth step, 6 Oct 2026). A figure that moved is broken into its causes, each with
// its ₹, and the causes add up to the change exactly. Made-up clients and figures; where the period matters the clock is set.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const clients = [{ id: 1, name: 'ALPHA', billingMode: 'weight', rates: [], isActive: true }, { id: 2, name: 'BETA', billingMode: 'weight', rates: [], isActive: true },
  { id: 3, name: 'GAMMA', billingMode: 'weight', rates: [], isActive: true }];
const inv = (id: string, clientId: number, date: string, kg: number, rate: number) => ({ id, invoiceNumber: id, displayNumber: id, clientId, clientName: clients[clientId - 1].name,
  date, status: 'active', state: 'created', taxableValue: kg * rate, grandTotal: kg * rate, cgst: 0, sgst: 0, igst: 0, createdAt: 1,
  items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: kg, rate, amount: kg * rate }] });
function book(extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = clients;
  return Object.assign(s, extra);
}

test.describe('P159 why it moved', () => {
  test('realisation splits into each client’s own rate and the mix, and the causes add up to the change', async ({ page }) => {
    await loadAppWithState(page, book());
    // Before: ALPHA 100 kg at ₹10, BETA 100 kg at ₹20 (₹15 average). Now: ALPHA 100 kg at ₹9, BETA 300 kg at ₹20 (₹17.25).
    const r: any = await g(page, `(function () {
      var prior = [${JSON.stringify(inv('A0', 1, '2026-01-05', 100, 10))}, ${JSON.stringify(inv('B0', 2, '2026-01-05', 100, 20))}];
      var now = [${JSON.stringify(inv('A1', 1, '2026-02-05', 100, 9))}, ${JSON.stringify(inv('B1', 2, '2026-02-05', 300, 20))}];
      return whyRealisation(now, prior);
    })()`);
    expect(r.R0).toBeCloseTo(15, 6);
    expect(r.R1).toBeCloseTo(17.25, 6);
    const sum = r.causes.reduce((s: number, c: any) => s + c.v, 0);
    expect(sum).toBeCloseTo(2.25, 9);
    const by = (kind: string, name: string) => r.causes.find((c: any) => c.kind === kind && c.name === name);
    expect(by('rate', 'ALPHA').v).toBeCloseTo(-0.25, 9);
    expect(by('rate', 'ALPHA').label).toBe('ALPHA’s own rate, ₹10.00/kg → ₹9.00/kg');
    expect(by('mix', 'ALPHA').v).toBeCloseTo(1.25, 9);
    expect(by('mix', 'BETA').v).toBeCloseTo(1.25, 9);
    expect(by('mix', 'BETA').label).toBe('BETA’s share of the kilos, 50% → 75%, at ₹20.00/kg against ₹15.00/kg on average');
    // BETA's own rate did not move: a cause that is nothing is not listed.
    expect(by('rate', 'BETA')).toBeUndefined();
    expect(r.causes.find((c: any) => c.kind === 'rate' && c.name === 'ALPHA').rs).toBeCloseTo(-100, 6);
  });

  test('a client new to the period, and one gone from it, are said as such', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `whyRealisation([${JSON.stringify(inv('A1', 1, '2026-02-05', 100, 10))}, ${JSON.stringify(inv('C1', 3, '2026-02-05', 100, 30))}],
      [${JSON.stringify(inv('A0', 1, '2026-01-05', 100, 10))}, ${JSON.stringify(inv('B0', 2, '2026-01-05', 100, 20))}])`);
    expect(r.causes.reduce((s: number, c: any) => s + c.v, 0)).toBeCloseTo(r.R1 - r.R0, 9);
    expect(r.causes.find((c: any) => c.kind === 'new').label).toBe('GAMMA, not billed before: 50% of the kilos at ₹30.00/kg');
    expect(r.causes.find((c: any) => c.kind === 'gone').label).toBe('BETA, not billed now: it was 50% of the kilos at ₹20.00/kg');
    expect(await g(page, `whyRealisation([], [${JSON.stringify(inv('A0', 1, '2026-01-05', 100, 10))}]).none`)).toBe('nothing weighed in the period');
  });

  test('contribution splits into price, each cost line and the kilos, and adds up', async ({ page }) => {
    await loadAppWithState(page, book());
    const m: any = await g(page, `(function () {
      // The live cost of each period, stubbed: before ₹12/kg (labour 8, zinc 4), now ₹13/kg (labour 8, zinc 5).
      liveCost = function (from, to, kg) {
        var now = from >= '2026-02-01', rows = [{ key: 'labour', label: 'Labour', perKg: 8, source: 'measured' }, { key: 'zinc', label: 'Zinc', perKg: now ? 5 : 4, source: 'measured' }];
        return { rows: rows, perKg: now ? 13 : 12, measuredShare: 1 };
      };
      whyIsoRange = function (p, off) { return off ? { from: '2026-01-01', to: '2026-01-31' } : { from: '2026-02-01', to: '2026-02-28' }; };
      var real = { R0: 15, R1: 17.25, d: 2.25, K0: 200, K1: 400 };
      return whyMargin('mtd', [], [], real);
    })()`);
    expect(m.C0).toBeCloseTo((15 - 12) * 200, 6);
    expect(m.C1).toBeCloseTo((17.25 - 13) * 400, 6);
    expect(m.causes.reduce((s: number, c: any) => s + c.v, 0)).toBeCloseTo(m.d, 6);
    const k = (kind: string) => m.causes.find((c: any) => c.kind === kind);
    expect(k('price').v).toBeCloseTo(2.25 * 400, 6);
    expect(k('volume').v).toBeCloseTo(3 * 200, 6);
    expect(k('volume').label).toBe('Kilos, 0.2 t → 0.4 t at ₹3.00/kg left before');
    expect(m.causes.filter((c: any) => c.kind === 'cost').map((c: any) => [c.label, c.v])).toEqual([['Zinc, ₹4.00 → ₹5.00/kg', -400]]);
  });

  test('cash: two whole months on the statement, money in by client and out by kind', async ({ page }) => {
    await loadAppWithState(page, book());
    const c: any = await g(page, `(function () {
      finHasBank = function () { return true; };
      finClosedMonths = function () { return ['2026-07', '2026-08']; };
      var row = function (date, cr, dr) { return { date: date, cr: cr, dr: dr }; };
      var cls = [{ row: row('2026-07-10', 1000, 0), cat: 'receipt', clientId: 1 }, { row: row('2026-07-12', 0, 400), cat: 'supplier' },
        { row: row('2026-08-10', 3000, 0), cat: 'receipt', clientId: 1 }, { row: row('2026-08-11', 500, 0), cat: 'receipt', clientId: null },
        { row: row('2026-08-12', 0, 900), cat: 'supplier' }, { row: row('2026-08-20', 0, 100), cat: 'wages' }];
      finCtx = function () { return { cls: cls }; };
      return whyCash();
    })()`);
    expect(c.net0).toBe(600);
    expect(c.net1).toBe(2500);
    expect(c.causes.reduce((s: number, x: any) => s + x.v, 0)).toBeCloseTo(c.d, 6);
    expect(c.causes.map((x: any) => [x.label, x.v])).toEqual([
      ['Received from ALPHA, ₹1,000 → ₹3,000', 2000], ['Paid out, supplier, ₹400 → ₹900', -500],
      ['Receipts with no client, ₹0 → ₹500', 500], ['Paid out, wages, ₹0 → ₹100', -100]]);
  });

  test('Pulse draws the panel (Stats → Overview’s until the tab map), and What changed? names the largest cause', async ({ page }) => {
    // 20 Oct 2026, a Tuesday: seventeen working days into the month, past the early mark.
    await page.clock.install({ time: new Date('2026-10-20T11:00:00+05:30') });
    await loadAppWithState(page, book({ invoices: [inv('A0', 1, '2026-09-05', 100, 10), inv('B0', 2, '2026-09-06', 100, 20),
      inv('A1', 1, '2026-10-05', 100, 9), inv('B1', 2, '2026-10-06', 300, 20)] }));
    await openPulse(page);
    const why = page.locator('#statsWhy');
    await expect(why.locator('[data-why="real"]')).toContainText('₹15.00 → ₹17.25/kg');
    await expect(why.locator('[data-why="real"]')).toContainText('+₹2.25/kg');
    await expect(why.locator('[data-why-cause="mix"]')).toHaveCount(2);
    await expect(why.locator('[data-why-early]')).toHaveCount(0);
    await expect(page.locator('[data-tdy-q="changed"]')).toContainText('Realisation rose ₹2.25/kg against same days last month');
  });

  test('a month under ten working days in is said to be early', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-06T11:00:00+05:30') });
    await loadAppWithState(page, book({ invoices: [inv('A0', 1, '2026-09-02', 100, 10), inv('A1', 1, '2026-10-02', 100, 12)] }));
    await openPulse(page);
    await expect(page.locator('#statsWhy [data-why-early]')).toContainText('5 working days in');
  });
});
