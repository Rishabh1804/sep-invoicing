import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P156: an entry is checked before it is believed (the intelligence's first step, 6 Oct 2026). The owner's book held a stock
// message an older reader had misread ("VAT A 2" as 2 kg of zinc, "54 LTR use 3+3+9=15" as a count of 3 and a use of 54), and
// the same uses typed by hand beside it. Chemical names and quantities are the shop's (not private); dates are built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function iso(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dmy(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) + '/';
}
const line = (id: string, name: string, key: string, unit: string, basis = 'draw') => ({ id, name, key, unit, basis, aliases: [], active: true, createdAt: 1 });
function withStock(items: any[], entries: any[], pastes: any[] = []): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  // Copies: a test that changes a line (its basis) must not change the next test's.
  s.stock = JSON.parse(JSON.stringify({ items, entries, pastes }));
  return s as SepState;
}

const MSG = () => `Camical use camical stock ${dmy(-4)} ${dmy(-1).slice(0, 8)}

1) ZINK 444 KG  use VAT A 2 / ${dmy(-4)} 150 kg VAT 1 / ${dmy(-1)} 175 kg berral use 75 kg available 44 kg

2) 65 M 54 LTR use 3+3+9=15 available 39 LTR`;
const ZN = line('Z', 'Zinc', 'ZINC', 'kg', 'charge');
const M65 = line('M', '65 M', '65 M', 'L');
const base = (at: number) => ({ source: 'paste', pasteId: 'P1', at, by: 'Owner', sentBy: 'Supervisor' });
/* What the reader before 30 Sep 2026 saved from that message, after the earlier one left zinc at 444 and 65 M at 54. */
function misread(): SepState {
  const at0 = Date.now() - 6 * 86400000, at1 = Date.now() - 86400000;
  const before = [
    { id: 'E0', itemId: 'Z', kind: 'count', qty: 444, date: iso(-5), source: 'paste', pasteId: 'P0', at: at0 },
    { id: 'E1', itemId: 'M', kind: 'count', qty: 54, date: iso(-5), source: 'paste', pasteId: 'P0', at: at0 }
  ];
  const old = [
    { id: 'O1', itemId: 'Z', kind: 'charged', qty: 2, date: iso(-1), seq: 2, days: 1, ...base(at1), raw: 'ZINK 444 KG use VAT A 2 …' },
    { id: 'O2', itemId: 'Z', kind: 'count', qty: 44, date: iso(-1), seq: 3, ...base(at1) },
    { id: 'O3', itemId: 'M', kind: 'count', qty: 3, date: iso(-4), seq: 0, note: 'opening', ...base(at1) },
    { id: 'O4', itemId: 'M', kind: 'received', qty: 12, date: iso(-1), seq: 1, ...base(at1) },
    { id: 'O5', itemId: 'M', kind: 'used', qty: 54, date: iso(-1), from: iso(-4), days: 3, seq: 2, ...base(at1) },
    { id: 'O6', itemId: 'M', kind: 'count', qty: 39, date: iso(-1), seq: 3, ...base(at1) }
  ];
  return withStock([ZN, M65], before.concat(old), [{ id: 'P1', at: at1, by: 'Owner', sentBy: 'Supervisor', from: iso(-4), to: iso(-1), hash: 'h-x', text: MSG() }]);
}

test.describe('P156 stock: an entry is checked before it is believed', () => {
  test('a message an older reader misread is listed with both readings, and read again in place', async ({ page }) => {
    await loadAppWithState(page, misread());
    await g(page, `_stockView = 'check'; switchTab('pageStock')`);
    const row = page.locator('#stockReread [data-paste="P1"]');
    await expect(row).toContainText('Read then: Zinc: charged to bath 2 kg');
    await expect(row).toContainText('Read now: Zinc: charged to bath 400 kg');
    await expect(row).toContainText('65 M: used 15 L');
    await row.locator('[data-action="invStockReread"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#stockReread [data-paste]')).toHaveCount(0);
    const st: any = await readStoredState(page);
    const live = st.stock.entries.filter((e: any) => !e.voided);
    const z = live.filter((e: any) => e.itemId === 'Z' && e.pasteId === 'P1').map((e: any) => e.kind + ' ' + e.qty).sort();
    expect(z).toEqual(['charged 400', 'count 44']);
    const m = live.filter((e: any) => e.itemId === 'M' && e.pasteId === 'P1').map((e: any) => e.kind + ' ' + e.qty).sort();
    expect(m).toEqual(['count 39', 'used 15']);
    // The old reading is kept, voided with its reason; the new keeps the message's own time, so the day's order holds.
    const o1 = st.stock.entries.find((e: any) => e.id === 'O1');
    expect(o1.voided.reason).toMatch(/Read again/);
    const added = st.stock.entries.find((e: any) => e.itemId === 'Z' && e.kind === 'charged' && e.qty === 400);
    expect(added.at).toBe(st.stock.pastes[0].at);
    expect(st.stock.pastes[0].reread.length).toBe(1);
    expect(await g(page, `stockReplay('M').level`)).toBe(39);
    expect(await g(page, `stockReplay('Z').level`)).toBe(44);
  });

  test('a figure the owner voided by hand is not brought back, and a line whose basis changed is not a new reading', async ({ page }) => {
    const s: any = misread();
    // The owner voided the misread zinc charge by hand; 65 M was later moved to "charged", so its use reads as a charge.
    s.stock.entries.find((e: any) => e.id === 'O1').voided = { at: Date.now(), by: 'Owner' };
    s.stock.entries = s.stock.entries.filter((e: any) => e.itemId !== 'M' || e.pasteId !== 'P1').concat([
      { id: 'N5', itemId: 'M', kind: 'used', qty: 15, date: iso(-1), from: iso(-4), days: 3, seq: 2, ...base(Date.now() - 86400000) },
      { id: 'N6', itemId: 'M', kind: 'count', qty: 39, date: iso(-1), seq: 3, ...base(Date.now() - 86400000) }]);
    s.stock.items.find((i: any) => i.id === 'M').basis = 'charge';
    await loadAppWithState(page, s);
    const d: any = await g(page, `(function () { var d = stockRereadDiff(stockData().pastes[0]); return d && { drop: d.drop.map(function (h) { return h.cur.id; }), add: d.add.map(function (e) { return e.itemId + ' ' + e.kind + ' ' + e.qty; }) }; })()`);
    // Zinc's 400 is added (nothing live says it); the voided 2 stays voided and is not dropped twice; 65 M is unchanged.
    expect(d.drop).toEqual([]);
    expect(d.add).toEqual(['Z charged 400']);
  });

  test('a use typed by hand beside the message that holds it is said on the line, on the check and on the To-do', async ({ page }) => {
    const s: any = misread();
    const atHand = Date.now() - 2 * 86400000;
    s.stock.entries.push({ id: 'H1', itemId: 'Z', kind: 'used', qty: 175, date: iso(-1), from: iso(-1), days: 1, source: 'manual', at: atHand, by: 'Owner' });
    await loadAppWithState(page, s);
    const checks: any = await g(page, `stockEntryChecks('Z')`);
    expect(checks.H1.map((c: any) => c.k)).toContain('overlap');
    expect(checks.O1.map((c: any) => c.k)).toContain('typed');
    // The To-do carries one task for all of it, and its button opens the check.
    const task: any = await g(page, `todoAppAll().filter(function (t) { return t.rule === 'stockCheck'; })[0]`);
    expect(task.title).toMatch(/^Check \d+ stock figures$/);
    expect(task.sub).toContain('1 message read differently now');
    await g(page, `todoGo({ kind: 'stockCheck' })`);
    await expect(page.locator('#stockChecks [data-entry="H1"]')).toBeVisible();
    // On its line the entry carries the question and the answer "It is right", which keeps it and stops the asking.
    await g(page, `_stockItemId = 'Z'; stockSetView('item')`);
    const entry = page.locator('#stockEntries [data-entry="H1"]');
    await expect(entry.locator('[data-check="overlap"]')).toBeVisible();
    await entry.locator('[data-action="invStockCheckOk"]').click();
    await expect(entry).toContainText('Checked: kept as entered');
    const st: any = await readStoredState(page);
    expect(st.stock.entries.find((e: any) => e.id === 'H1').checkOk.at).toBeGreaterThan(0);
  });

  test('a count far from the level, a use past zero and a use far above the usual are each asked', async ({ page }) => {
    const ents: any[] = [{ id: 'C0', itemId: 'M', kind: 'count', qty: 100, date: iso(-20), source: 'paste', at: 1 }];
    for (let i = 19; i >= 13; i--) ents.push({ id: 'U' + i, itemId: 'M', kind: 'used', qty: 3, days: 1, date: iso(-i), source: 'paste', at: 2 + (20 - i) });
    ents.push({ id: 'BIG', itemId: 'M', kind: 'used', qty: 40, days: 1, date: iso(-10), source: 'manual', at: 100 });
    ents.push({ id: 'CNT', itemId: 'M', kind: 'count', qty: 5, date: iso(-8), source: 'manual', at: 101 });
    ents.push({ id: 'NEG', itemId: 'M', kind: 'used', qty: 9, days: 1, date: iso(-7), source: 'manual', at: 102 });
    await loadAppWithState(page, withStock([M65], ents));
    const c: any = await g(page, `stockEntryChecks('M')`);
    expect(c.BIG.map((x: any) => x.k)).toContain('large');
    expect(c.CNT.map((x: any) => x.k)).toContain('count');
    expect(c.NEG.map((x: any) => x.k)).toContain('below');
    expect(c.U15).toBeUndefined();
  });

  test('a hand entry that does not fit is said as it is saved, and saved all the same', async ({ page }) => {
    const ents: any[] = [{ id: 'C0', itemId: 'M', kind: 'count', qty: 30, date: iso(-3), source: 'paste', at: 1 },
      { id: 'P', itemId: 'M', kind: 'used', qty: 6, days: 1, date: iso(-2), from: iso(-2), source: 'paste', pasteId: 'X', at: 2 }];
    await loadAppWithState(page, withStock([M65], ents));
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockManual"]').first().click();
    await page.locator('[data-action="invStockMode"][data-mode="used"]').click();
    await page.locator('#stockManDate').fill(iso(-2));
    await page.locator('#stockManDate').dispatchEvent('change');
    await page.locator('[data-stock-qty="M"]').fill('6');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('check it: 65 M: The same 6 L is in the message');
    const st: any = await readStoredState(page);
    expect(st.stock.entries.filter((e: any) => e.source === 'manual' && e.qty === 6).length).toBe(1);
  });

  test('reading again never undoes a correction: a line the owner corrected by hand is left as it is', async ({ page }) => {
    const s: any = misread();
    // The owner corrected the misread 65 M use of 54 to 15 by hand; the zinc line was never touched.
    const o5 = s.stock.entries.find((e: any) => e.id === 'O5');
    o5.voided = { at: Date.now(), by: 'Owner', reason: 'Corrected to 15 L', correctedBy: 'K5' };
    s.stock.entries.push({ ...o5, id: 'K5', qty: 15, source: 'manual', corrects: { id: 'O5', qty: 54 }, voided: undefined });
    await loadAppWithState(page, s);
    const d: any = await g(page, `(function () { var d = stockRereadDiff(stockData().pastes[0]); return { drop: d.drop.map(function (h) { return h.cur.id; }), add: d.add.map(function (e) { return e.itemId + ' ' + e.kind + ' ' + e.qty; }) }; })()`);
    expect(d.drop).toEqual(['O1']);
    expect(d.add).toEqual(['Z charged 400']);
  });

  test('a balance picked at the review is kept on the message and read again the same way; an old message that needed one is left', async ({ page }) => {
    const msg = `Camical use camical stock ${dmy(-1)}\n\n1) A SOLLT 48-12=30 LTR`;
    const ents = [{ id: 'C0', itemId: 'A', kind: 'count', qty: 48, date: iso(-3), source: 'manual', at: 1 },
      { id: 'U', itemId: 'A', kind: 'used', qty: 12, date: iso(-1), days: 1, source: 'paste', pasteId: 'P', at: 2, seq: 2 },
      { id: 'C', itemId: 'A', kind: 'count', qty: 36, date: iso(-1), source: 'paste', pasteId: 'P', at: 2, seq: 3, note: 'message said 30' }];
    const s = withStock([line('A', 'A Salt', 'A SALT', 'L')], ents, [{ id: 'P', at: 2, from: iso(-1), to: iso(-1), hash: 'h', text: msg, choices: { bal0: 'working' } }]);
    await loadAppWithState(page, s);
    expect(await g(page, `stockRereadDiff(stockData().pastes[0])`)).toBeNull();
    await g(page, `delete stockData().pastes[0].choices`);
    expect(await g(page, `stockRereadDiff(stockData().pastes[0])`)).toBeNull();
    // A message saved from the review keeps its choices.
    await g(page, `stockData().pastes = []; stockData().entries = stockData().entries.filter(function (e) { return e.id === 'C0'; })`);
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockPaste"]').first().click();
    await page.locator('#stockPasteText').fill(msg);
    await page.locator('[data-action="invStockRead"]').click();
    await page.locator('[data-action="invStockBal"][data-v="working"]').click();
    await page.locator('[data-action="invStockSavePaste"]').click();
    expect(await g(page, `stockData().pastes[0].choices.bal0`)).toBe('working');
  });

  test('"It is right" on one side of a pair settles the other', async ({ page }) => {
    const d = iso(-1);
    const ents = [{ id: 'C0', itemId: 'M', kind: 'count', qty: 30, date: iso(-3), source: 'paste', at: 1 },
      { id: 'P', itemId: 'M', kind: 'used', qty: 6, days: 1, date: d, source: 'paste', pasteId: 'X', at: 2, checkOk: { at: 1 } },
      { id: 'H', itemId: 'M', kind: 'used', qty: 6, days: 1, date: d, source: 'manual', at: 3 }];
    await loadAppWithState(page, withStock([M65], ents));
    expect(await g(page, `stockEntryChecks('M').H`)).toBeUndefined();
  });

  test('an entry kept as right, and a voided one, are never asked about', async ({ page }) => {
    const s: any = misread();
    s.stock.entries.push({ id: 'H1', itemId: 'Z', kind: 'used', qty: 175, date: iso(-1), source: 'manual', at: Date.now() - 2 * 86400000, checkOk: { at: 1 } });
    s.stock.entries.push({ id: 'H2', itemId: 'Z', kind: 'used', qty: 99, date: iso(-1), source: 'manual', at: Date.now() - 2 * 86400000, voided: { at: 1 } });
    await loadAppWithState(page, s);
    const c: any = await g(page, `stockEntryChecks('Z')`);
    expect(c.H1).toBeUndefined();
    expect(c.H2).toBeUndefined();
    expect(await g(page, `stockChecksAll().some(function (x) { return x.e.id === 'H2'; })`)).toBe(false);
  });
});
