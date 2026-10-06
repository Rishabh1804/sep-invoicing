import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P157: how sure a finding is (the intelligence's second step, 6 Oct 2026). Measured on the owner's book: the four stock reds
// were read off counts eight days old; "the lowest month in seven" was five working days of it; SSS Mehta's loss was priced at
// a month whose zinc counted a lump charge and a fill at the model; and every self draw was wages, where the owner draws
// through self too. Made-up clients and figures; dates are built from today, or the clock is set.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function iso(n: number, from = todayIso()): string {
  const d = new Date(from + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function book(extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  return Object.assign(s, extra);
}
const line = (id: string, name: string, key: string, unit: string, basis = 'draw') => ({ id, name, key, unit, basis, aliases: [], active: true, createdAt: 1 });
/* Working days back from today, Sundays skipped: a figure that many working days old. */
function workdaysBack(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  while (n > 0) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0) n--; }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('P157 how sure a finding is', () => {
  test('a line out on an old count is said as of that count, and is never red', async ({ page }) => {
    const old = workdaysBack(6), fresh = workdaysBack(0);
    const ents = [
      { id: 'a1', itemId: 'A', kind: 'count', qty: 20, date: iso(-20, old), source: 'paste', at: 1 },
      { id: 'a2', itemId: 'A', kind: 'used', qty: 20, days: 10, date: old, source: 'paste', at: 2 },
      { id: 'a3', itemId: 'A', kind: 'count', qty: 0, date: old, source: 'paste', at: 3 },
      { id: 'b1', itemId: 'B', kind: 'count', qty: 20, date: iso(-20, fresh), source: 'paste', at: 1 },
      { id: 'b2', itemId: 'B', kind: 'used', qty: 20, days: 10, date: fresh, source: 'paste', at: 2 },
      { id: 'b3', itemId: 'B', kind: 'count', qty: 0, date: fresh, source: 'paste', at: 3 }];
    await loadAppWithState(page, book({ stock: { items: [line('A', 'Boric Acid', 'BORIC ACID', 'kg'), line('B', 'B Salt', 'B SALT', 'kg')], entries: ents, pastes: [] } }));
    const t: any = await g(page, `todoAppAll(['stock']).map(function (t) { return { id: t.itemId, tone: t.tone, read: t.toneRead || '', sub: t.sub, how: (t.facts.filter(function (f) { return f[0] === 'How sure'; })[0] || [])[1] || '' }; })`);
    const a = t.find((x: any) => x.id === 'A'), b = t.find((x: any) => x.id === 'B');
    expect(a.tone).toBe('amber');
    expect(a.read).toBe('red');
    expect(a.sub).toMatch(/^Out on .+'s record/);
    expect(a.how).toMatch(/^An old record: nothing recorded since/);
    expect(b.tone).toBe('red');
    expect(b.sub).toMatch(/^Out ·/);
  });

  test('an entry to check on the line is said on its task, and keeps it from red', async ({ page }) => {
    const d = workdaysBack(0);
    const ents = [
      { id: 'c1', itemId: 'A', kind: 'count', qty: 30, date: iso(-6, d), source: 'paste', at: 1 },
      { id: 'c2', itemId: 'A', kind: 'used', qty: 25, days: 1, date: iso(-1, d), source: 'paste', pasteId: 'P', at: 2 },
      { id: 'c3', itemId: 'A', kind: 'used', qty: 25, days: 1, date: d, source: 'manual', at: 3 }];
    await loadAppWithState(page, book({ stock: { items: [line('A', 'Boric Acid', 'BORIC ACID', 'kg')], entries: ents, pastes: [] } }));
    const t: any = await g(page, `todoAppAll(['stock'])[0]`);
    expect(t.tone).toBe('amber');
    expect(t.sub).toContain('entry on this line to check');
  });

  test('a month under ten working days in is early: said, and only to know', async ({ page }) => {
    // The clock is 8 Mar 2027, a Monday: seven working days into the month, under the ten that make it a pattern.
    await page.clock.install({ time: new Date('2027-03-08T11:00:00+05:30') });
    const inv = (id: string, date: string, kg: number, amount: number) => ({ id, invoiceNumber: id, displayNumber: id, clientId: 1, clientName: 'ALPHA', date, status: 'active', state: 'created',
      taxableValue: amount, grandTotal: amount, cgst: 0, sgst: 0, igst: 0, items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: kg, rate: amount / kg, amount }], createdAt: 1 });
    const invoices: any[] = [];
    ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'].forEach((m, i) => invoices.push(inv('M' + i, m + '-10', 1000, 10000)));
    invoices.push(inv('N1', '2027-03-03', 1000, 5000));
    await loadAppWithState(page, book({ invoices, clients: [{ id: 1, name: 'ALPHA', billingMode: 'weight', rates: [], isActive: true }] }));
    const t: any = await g(page, `todoAppAll(['insRealLow'])[0]`);
    expect(t.tone).toBe('info');
    expect(t.sub).toContain('working days into the month');
    expect(t.facts.find((f: any) => f[0] === 'How sure')[1]).toMatch(/^Early/);
  });

  test('below cost is red only where it holds at the lowest variable cost of six months, and says the loss as a range', async ({ page }) => {
    await loadAppWithState(page, book());
    // The margins are stubbed by month: this month's variable cost ₹9, the six months' lowest ₹6.
    const run = (net: number) => g(page, `(function () {
      var last = insMonthsBack(1)[0];
      statsClientMargins = function (a, b, c, p) {
        var v = p.from.slice(0, 7) === last ? 9 : 6, x = { id: 7, name: 'BETA', net: ${net}, kg: 1000, vsVar: ${net} - v };
        return { varKg: v, fullKg: v + 1, kg: 2000, ranked: [x], c: { measuredShare: 0.7 } };
      };
      insActive = function () { return [{ date: '2000-01-01' }].concat(insMonthsBack(6).map(function (m) { return { date: m + '-10' }; })); };
      return todoAppAll(['insBelowVar'])[0];
    })()`);
    const firm: any = await run(5);
    expect(firm.tone).toBe('red');
    expect(firm.sub).toContain('loses at least ₹1,000.00 (at the six months\' lowest, ₹6.00), up to ₹4,000.00');
    const soft: any = await run(7);
    expect(soft.tone).toBe('amber');
    expect(soft.toneRead).toBe('red');
    expect(soft.sub).toContain('below this month\'s cost only, 70% of it measured');
  });

  test('cash drawn is wages up to the week\'s payout and drawings past it; a week not fully recorded is not split', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      payWeek = function (ws) { return ws === '2026-08-02' ? { recordedDays: 6, total: 30000, lab: { hourlessMarks: 0 } } : { recordedDays: 6, total: 30000, lab: { hourlessMarks: 4 } }; };
      var row = function (date, dr) { return { cat: 'wages', cash: true, staffId: null, row: { date: date, dr: dr, cr: 0 } }; };
      var bm = bankCostByMonth([row('2026-08-03', 40000), row('2026-08-10', 25000)]);
      var a = bm.cashWeeks['2026-08-02'], b = bm.cashWeeks['2026-08-09'];
      return { a: [a.wages, a.drawings, a.open], b: [b.wages, b.drawings, b.open], open: bm.months['2026-08'].labour.open > 0 };
    })()`);
    expect(r.a).toEqual([30000, 10000, 0]);
    expect(r.b).toEqual([0, 0, 25000]);
    expect(r.open).toBe(true);
  });

  test('zinc bills stand for its use over 90 days, per kg plated, from the first bill on record', async ({ page }) => {
    const to = todayIso(), inv = (id: string, date: string, kg: number) => ({ id, invoiceNumber: id, displayNumber: id, clientId: 1, clientName: 'ALPHA', date, status: 'active', state: 'created',
      taxableValue: kg * 10, grandTotal: kg * 10, cgst: 0, sgst: 0, igst: 0, items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: kg, rate: 10, amount: kg * 10 }], createdAt: 1 });
    const bills = [
      { id: 'z1', itemId: 'Z', kind: 'bill', qty: 100, price: 400, date: iso(-60, to), source: 'manual', at: 1, supplier: 'S' },
      { id: 'z2', itemId: 'Z', kind: 'bill', qty: 200, price: 450, date: iso(-10, to), source: 'manual', at: 2, supplier: 'S' }];
    await loadAppWithState(page, book({ invoices: [inv('A', iso(-50, to), 20000), inv('B', iso(-5, to), 30000)], clients: [{ id: 1, name: 'ALPHA', billingMode: 'weight', rates: [], isActive: true }],
      stock: { items: [line('Z', 'Zinc', 'ZINC', 'kg', 'charge')], entries: bills, pastes: [] } }));
    const z: any = await g(page, `costZincByBills(localDateStr())`);
    // From the first bill (60 days back), not 90: before it nothing was entered.
    expect(z.from).toBe(iso(-60, to));
    expect(z.amount).toBe(130000);
    expect(z.kg).toBe(50000);
    expect(z.perKg).toBeCloseTo(2.6, 6);
    // A window under 28 days of bills is not read.
    expect(await g(page, `costZincByBills('${iso(-50, to)}')`)).toBeNull();
  });

  test('the usual time of a roll is learnt from WhatsApp\'s send time, never from when it was pasted', async ({ page }) => {
    const pastes: any[] = [];
    for (let i = 1; i <= 5; i++) pastes.push({ id: 'R' + i, kind: 'in', date: workdaysBack(i), text: 'in time', hash: 'h' + i, at: new Date(workdaysBack(i) + 'T13:33:00').getTime() });
    await loadAppWithState(page, book({ relayPastes: pastes }));
    const u: any = await g(page, `tdyUsual('roll-in', localDateStr())`);
    expect(u.seen).toBe(0);
    expect(u.min).toBe(570);
  });
});
