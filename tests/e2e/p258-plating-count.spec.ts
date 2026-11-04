import { test, expect, type Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P258 (owner, 4 Nov 2026: a run entered by hand sat under "Also reported, not added" and could not be moved; the day's register runs
// were on the screen twice). A hand run of a client the shift's register never names counts beside it; the owner can count or leave
// out any run, and put it back to the rule; a register run saved from two sources is flagged as a pair until one is voided or both
// kept. Made-up names and figures throughout (HR-10).

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'KESTREL ENGINEERS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
];
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const iso = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const D = iso(-1);
const E = (o: any) => ({ at: 1, unit: 'NOS', basis: 'register', src: 'photo', kind: 'plated', line: 'vat-a1', lineSrc: 'written', slot: 'general', date: D, part: 'BRACKET 77', ...o });
const prod = (entries: any[]) => ({ production: { entries, pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {} } } });
async function load(page: Page, entries: any[]) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), ...prod(entries) } as SepState);
}
const counted = (page: Page) => g(page, `(function(){ var i = prodIndex(); return { counted: i.counted.map(function(e){ return e.id; }).sort(), also: i.also.map(function(e){ return e.id; }).sort() }; })()`);
async function openLines(page: Page) {
  await switchTab(page, 'pageProduction');
  await g(page, `(function(){ _prodDay = ${JSON.stringify(D)}; _prodDayPicked = true; _prodLine = 'vat-a1'; prodSetTab('lines'); renderProduction(); })()`);
}
const runRow = (page: Page, id: string) => page.locator(`#prodRuns [data-prod-entry="${id}"]`);
async function openRow(page: Page, id: string) {
  const row = runRow(page, id);
  if (!(await row.evaluate(el => (el as HTMLDetailsElement).open))) await row.locator('summary').click();
  return row;
}

test.describe('P258: what counts in a day’s plating', () => {
  test('a hand run of a client the register never names counts beside it; one of a client it names stays also reported', async ({ page }) => {
    await load(page, [
      E({ id: 'R1', clientId: 11, qty: 400, time: '09:00', to: '10:00', photoId: 'PH1' }),
      E({ id: 'R2', clientId: 12, qty: 60, time: '10:00', to: '11:00', photoId: 'PH1' }),
      E({ id: 'H1', clientId: 13, qty: 468, time: '14:50', basis: 'hand', src: 'hand' }),   // a client the register never names
      E({ id: 'H2', clientId: 11, qty: 400, time: '15:00', basis: 'hand', src: 'hand' }),   // the register's own client: the same work
      E({ id: 'H3', clientId: null, qty: 50, time: '15:30', basis: 'hand', src: 'hand' }),  // no client: cannot be told apart
    ]);
    expect(await counted(page)).toEqual({ counted: ['H1', 'R1', 'R2'], also: ['H2', 'H3'] });
    await openLines(page);
    // H1 is among the shift's runs, saying why it is added; H2 under Also reported, saying why it is not.
    const also = page.locator('#prodRuns .inv-row-group', { hasText: 'Also reported' });
    await expect(also).toBeVisible();
    const h1 = await openRow(page, 'H1');
    await expect(h1.locator('[data-prod-count-why]')).toContainText('Added beside the register: it holds no run of this client on this shift');
    await expect(h1.locator('[data-action="invProdLeaveOut"]')).toBeVisible();
    const h2 = await openRow(page, 'H2');
    await expect(h2.locator('[data-prod-count-why]')).toContainText('holds a run of this client, so this is taken as the same work');
    await expect(h2.locator('[data-action="invProdCountIt"]')).toBeVisible();
    // A counted register run explains nothing and offers no Count it.
    const r1 = await openRow(page, 'R1');
    await expect(r1.locator('[data-prod-count-why]')).toHaveCount(0);
    await expect(r1.locator('[data-action="invProdCountIt"], [data-action="invProdLeaveOut"]')).toHaveCount(0);
  });

  test('Count it adds a run left out, Leave it out takes one the rule added, Back to the rule undoes either; kept on the entry and in a correction', async ({ page }) => {
    await load(page, [
      E({ id: 'R1', clientId: 11, qty: 400, time: '09:00', to: '10:00', photoId: 'PH1' }),
      E({ id: 'H1', clientId: 13, qty: 468, time: '14:50', basis: 'hand', src: 'hand' }),
      E({ id: 'H2', clientId: 11, qty: 100, time: '15:00', basis: 'hand', src: 'hand' }),
    ]);
    await page.evaluate(() => localStorage.setItem('sep_inv_stock_by', 'Deepak'));
    await openLines(page);
    const before = await g(page, `prodDayLine(${JSON.stringify(D)}, 'vat-a1').nos`);
    expect(before).toBe(868);
    await (await openRow(page, 'H2')).locator('[data-action="invProdCountIt"]').click();
    expect(await counted(page)).toEqual({ counted: ['H1', 'H2', 'R1'], also: [] });
    expect(await g(page, `prodDayLine(${JSON.stringify(D)}, 'vat-a1').nos`)).toBe(968);
    let st = await readStoredState(page);
    const h2 = st.production.entries.find((e: any) => e.id === 'H2');
    expect(h2.countSet.how).toBe('count');
    expect(h2.countSet.by).toBe('Deepak');
    await expect((await openRow(page, 'H2')).locator('[data-prod-count-why]')).toContainText('Added: set by hand, Deepak');
    // Leave it out on the run the rule added.
    await (await openRow(page, 'H1')).locator('[data-action="invProdLeaveOut"]').click();
    expect(await counted(page)).toEqual({ counted: ['H2', 'R1'], also: ['H1'] });
    // Back to the rule on each.
    await (await openRow(page, 'H1')).locator('[data-action="invProdCountRule"]').click();
    await (await openRow(page, 'H2')).locator('[data-action="invProdCountRule"]').click();
    expect(await counted(page)).toEqual({ counted: ['H1', 'R1'], also: ['H2'] });
    st = await readStoredState(page);
    expect(st.production.entries.every((e: any) => !e.countSet)).toBe(true);
    // A correction of a run counted by hand keeps the word on it.
    await (await openRow(page, 'H2')).locator('[data-action="invProdCountIt"]').click();
    await g(page, `prodOpenHand('H2')`);
    await page.locator('#prodHandQty').fill('120');
    await page.locator('[data-action="invProdSaveHand"]').click();
    const r = await g(page, `(function(){ var i = prodIndex(); var c = i.counted.find(function(e){ return e.replaces === 'H2'; }); return c ? c.countSet.how : null; })()`);
    expect(r).toBe('count');
  });

  test('a register run saved from two sources is a pair, flagged on both, in Entries and as a task; void one or keep both', async ({ page }) => {
    await load(page, [
      E({ id: 'A1', clientId: 11, qty: 780, time: '09:15', to: '10:00', photoId: 'PH1' }),
      E({ id: 'A2', clientId: 12, qty: 60, time: '11:00', to: '11:20', photoId: 'PH1' }),
      E({ id: 'B1', clientId: 11, qty: 780, time: '09:15', to: '10:00', pageId: 'PG1', src: 'face', part: 'Z(BKT)' }),
      E({ id: 'B2', clientId: 12, qty: 60, time: '10:00', to: '11:20', pageId: 'PG1', src: 'face', part: 'Z(BKT)' }),
      // Two runs of one figure that do not meet in time, and two rows of one page: never a pair.
      E({ id: 'C1', clientId: 13, qty: 50, time: '09:00', to: '09:30', photoId: 'PH1' }),
      E({ id: 'C2', clientId: 13, qty: 50, time: '13:00', to: '13:30', pageId: 'PG1', src: 'face' }),
      E({ id: 'C3', clientId: 12, qty: 90, time: '14:00', to: '14:20', photoId: 'PH1' }),
      E({ id: 'C4', clientId: 12, qty: 90, time: '14:20', to: '14:40', photoId: 'PH1' }),
    ]);
    const twins = await g(page, `prodIndex().twin`);
    expect(twins).toEqual({ A1: 'B1', B1: 'A1', A2: 'B2', B2: 'A2' });
    // The task names the day and the pieces counted twice.
    const t = await g(page, `(function(){ var t = TODO_RULE_FNS.prodTwice(); return t.map(function(x){ return [x.title, x.facts[2][1]]; }); })()`);
    expect(t.length).toBe(1);
    expect(t[0][0]).toContain('2 register runs saved twice');
    expect(t[0][1]).toBe('840');
    await openLines(page);
    await expect(runRow(page, 'A1').locator('[data-prod-twin-badge]')).toBeVisible();
    await expect(runRow(page, 'C1').locator('[data-prod-twin-badge]')).toHaveCount(0);
    const a1 = await openRow(page, 'A1');
    await expect(a1.locator('[data-prod-twin]')).toContainText('came from the page typed on Mine');
    await expect(a1.locator('[data-prod-twin]')).toContainText('this one from a register photo');
    // Entries: the flag lists the four.
    await g(page, `(function(){ _prodFilter = { kind: '', flag: 'twice', client: '', day: '' }; prodSetTab('entries'); renderProduction(); })()`);
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(4);
    await expect(page.locator('#prodEntriesVerdict')).toContainText('4 saved twice');
    // Void one copy: the pair goes. Keep both on the other: it goes too, and stays apart.
    await g(page, `(function(){ var e = prodIndex().byId.B1; e.voidedAt = Date.now(); e.voidReason = 'saved twice'; prodTouch(); saveState(); })()`);
    expect(await g(page, `prodIndex().twin`)).toEqual({ A2: 'B2', B2: 'A2' });
    await openLines(page);
    await (await openRow(page, 'A2')).locator('[data-action="invProdTwinOk"]').click();
    expect(await g(page, `prodIndex().twin`)).toEqual({});
    expect((await readStoredState(page)).production.entries.find((e: any) => e.id === 'A2').twinOk.id).toBe('B2');
    expect(await g(page, `TODO_RULE_FNS.prodTwice().length`)).toBe(0);
  });
});
