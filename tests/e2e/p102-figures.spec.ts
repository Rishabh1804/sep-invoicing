import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P102: a figure says whether it is good (owner, 29 Sep 2026: "most numbers in our app don't convey any kind of meaning,
// as in is it a good number or is it something of an issue, all are in default black"; the owner chose both options).
// A figure the app can judge is coloured by the status tones, with the words that give its reason beside it; a headline
// figure carries a change line against its benchmark, coloured by whether it moved the good way; a plain count stays
// uncoloured. The rules live in state.js (figToneAgainst, figToneAge, figTonePaysIn, figToneCapacity, figTonePct,
// figDeltaHtml). Names and figures are made up; dates are built from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const monthStart = (back: number) => { const d = new Date(todayIso() + 'T00:00:00'); return iso(new Date(d.getFullYear(), d.getMonth() - back, 1)); };

function inv(n: number, date: string, taxable: number, kg: number) {
  const tax = Math.round(taxable * 0.09 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: kg, rate: taxable / kg, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: taxable + 2 * tax, createdAt: recentTs() };
}
function base(): any {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.defaultCostPerKg = 8.55;
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }];
  return s;
}

test.describe('P102: the rules', () => {
  test('each judgement in one place, at its thresholds', async ({ page }) => {
    await loadAppWithState(page, base() as SepState);
    const r = await ev(page, `JSON.stringify([
      [figToneAgainst(9, 8.55, 5), figToneAgainst(8.3, 8.55, 5), figToneAgainst(5.4, 8.55, 5), figToneAgainst(3, 3.55, 5, true), figToneAgainst(4, 3.55, 5, true), figToneAgainst(5, 0)],
      [figToneAge(30), figToneAge(61), figToneAge(91), figToneAge(null)],
      [figTonePaysIn(30), figTonePaysIn(45), figTonePaysIn(75)],
      [figToneCapacity(85), figToneCapacity(70), figToneCapacity(50)],
      [figTonePct(95, 90, 80), figTonePct(85, 90, 80), figTonePct(60, 90, 80), figTonePct(null, 90, 80)]])`);
    expect(JSON.parse(r as string)).toEqual([
      ['ok', 'warning', 'danger', 'ok', 'danger', null],
      [null, 'warning', 'danger', null],
      ['ok', 'warning', 'danger'],
      ['ok', 'warning', 'danger'],
      ['ok', 'warning', 'danger', null],
    ]);
  });

  test('a change line: level within 2%, the good way ok, the wrong way warning then danger past 10%, a count uncoloured', async ({ page }) => {
    await loadAppWithState(page, base() as SepState);
    const d = await ev(page, `JSON.stringify([
      figDeltaHtml(101, 100, 'Aug', 'up'), figDeltaHtml(120, 100, 'Aug', 'up'), figDeltaHtml(95, 100, 'Aug', 'up'),
      figDeltaHtml(50, 100, 'Aug', 'up'), figDeltaHtml(80, 100, 'Aug', 'down'), figDeltaHtml(120, 100, 'Aug', null), figDeltaHtml(5, 0, 'Aug', 'up')])`);
    expect(JSON.parse(d as string)).toEqual([
      'level with Aug',
      '<span class="inv-fig-ok">+20.0% on Aug</span>',
      '<span class="inv-fig-warning">&minus;5.0% on Aug</span>',
      '<span class="inv-fig-danger">&minus;50.0% on Aug</span>',
      '<span class="inv-fig-ok">&minus;20.0% on Aug</span>',
      '+20.0% on Aug',
      'no figure for Aug',
    ]);
  });
});

test.describe('P102: on the screens', () => {
  // This month so far: ₹10,000 on 5,000 kg (₹2/kg, far under any cost). The same days last month: ₹5,000 on 1,000 kg.
  function monthState() {
    const s = base();
    s.invoices = [inv(1, monthStart(0), 10000, 5000), inv(2, monthStart(1), 5000, 1000)];
    return s as SepState;
  }

  test('Home: every month-to-date tile against the same days last month; realisation against the cost, in its words', async ({ page }) => {
    await loadAppWithState(page, monthState());
    await expect(page.locator('#mtdRevenueDelta .inv-fig-ok')).toHaveText('+100.0% on same days last month');
    await expect(page.locator('#mtdKgDelta .inv-fig-ok')).toHaveText('+400.0% on same days last month');
    // A count of invoices is a fact: its change is said, never coloured.
    await expect(page.locator('#mtdCountDelta')).toHaveText('level with same days last month');
    await expect(page.locator('#mtdCountDelta [class^="inv-fig-"]')).toHaveCount(0);
    await expect(page.locator('#mtdPerKgTile')).toHaveClass(/inv-tile-danger/);
    await expect(page.locator('#mtdPerKgDelta')).toContainText('below cost');
    await expect(page.locator('#mtdPerKgDelta .inv-fig-danger')).toHaveText('−60.0% on same days last month');
  });

  test('Stats: the headline realisation and its change are coloured, gross margin below zero is danger', async ({ page }) => {
    await loadAppWithState(page, monthState());
    await switchTab(page, 'pageStats');
    const head = page.locator('[data-card="headline"]');
    await expect(head.locator('[data-tile="realisation"]')).toHaveClass(/inv-tile-danger/);
    await expect(head.locator('[data-tile="revenue"] .inv-fig-ok')).toBeVisible();
    await expect(head.locator('[data-tile="margin"]')).toHaveClass(/inv-tile-danger/);
  });

  test('Clients → Performance: the latest month realisation against the cost', async ({ page }) => {
    await loadAppWithState(page, monthState());
    await ev(page, `setItemsSubView('performance')`);
    await switchTab(page, 'pageClients');
    const tile = page.locator('#pageClients .inv-tile', { hasText: 'Realisation' });
    await expect(tile.locator('.inv-tile-value .inv-fig-danger')).toHaveText('₹2.00');
    await expect(tile).toContainText('cost ₹8.55/kg');
  });

  test('Money: what is owed is coloured by its age, and days to pay by one and two months', async ({ page }) => {
    const s = base();
    // 11,800 raised 40 days back and paid 20 days later (pays in 20 days); 5,900 raised 100 days back, still open.
    s.invoices = [inv(1, day(-40), 10000, 1000), inv(2, day(-100), 5000, 500)];
    const row = (id: number, date: string, narration: string, dr: number, cr: number, set?: any) =>
      ({ id: 'BK-' + id, date, valueDate: date, narration, chq: '', dr, cr, balance: 250000, dayIdx: id, importId: 'BI', ...(set ? { set } : {}) });
    const rows = [row(1, day(-120), 'SMS CHARGES', 10, 0), row(2, day(-20), 'NEFT-ALPHA FORGINGS', 0, 11800, { cat: 'receipt', clientId: 1 }), row(3, day(-1), 'SMS CHARGES', 10, 0)];
    s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[2].date, rows: 3, added: 3, closing: 250000 }], parties: {}, opening: {}, gstNotes: {} };
    await loadAppWithState(page, s as SepState);
    const owed = page.locator('#homeFin [data-home-fin="Owed to us"]');
    await expect(owed).toHaveClass(/inv-tile-danger/);
    await expect(owed).toContainText('over 90 days');
    await expect(page.locator('#homeFin [data-home-fin="Pays in"]')).toHaveClass(/inv-tile-ok/);
    await ev(page, `finSetTab('receipts')`);
    await switchTab(page, 'pageFinance');
    const recv = page.locator('[data-recv="1"]');
    await expect(recv.locator('.inv-row-end .inv-fig-danger')).toHaveText('₹5,900.00');
    await expect(recv.locator('.inv-row-end')).toContainText('owed, over 90 d');
    await expect(recv.locator('.inv-row-meta .inv-fig-ok')).toHaveText('20 d');
  });

  test('Money: with a receipt not placed, owed over 90 days is amber, and says why', async ({ page }) => {
    const s = base();
    s.invoices = [inv(1, day(-100), 5000, 500)];
    const row = (id: number, date: string, narration: string, dr: number, cr: number) =>
      ({ id: 'BK-' + id, date, valueDate: date, narration, chq: '', dr, cr, balance: 250000, dayIdx: id, importId: 'BI' });
    // A deposit nobody has placed: it may be this client's money, so the debt is not called red yet (owed90's rule).
    const rows = [row(1, day(-120), 'SMS CHARGES', 10, 0), row(2, day(-10), 'NEFT-UNKNOWN TRADERS', 0, 3000), row(3, day(-1), 'SMS CHARGES', 10, 0)];
    s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[2].date, rows: 3, added: 3, closing: 250000 }], parties: {}, opening: {}, gstNotes: {} };
    await loadAppWithState(page, s as SepState);
    const owed = page.locator('#homeFin [data-home-fin="Owed to us"]');
    await expect(owed).toContainText('not placed');
    await expect(owed).toHaveClass(/inv-tile-warning/);
    await expect(owed).not.toHaveClass(/inv-tile-danger/);
  });

  test('Attendance: on site against the rest-day gate', async ({ page }) => {
    const s = base();
    s.staff = [{ id: 1, name: 'Arun', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true },
      { id: 2, name: 'Bala', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true }];
    s.attendance = { [todayIso()]: { marks: { 1: { st: 'P', area: 'barrel' }, 2: { st: 'A' } }, extra: [], note: '' } };
    await loadAppWithState(page, s as SepState);
    await expect(page.locator('#homeAtt [data-att-onsite]')).toHaveClass(/inv-tile-danger/);
  });
});
