import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P265 (owner, 17 Nov 2026): "[The pickling hand] gives us Pickling data, he should also be able to give us data whether the pickled material is
// going to VAT A1, VAT A2 or one the barrels. That should feed into our data and we can cross check hand written production against
// it, if it starts aligning we can skip one step and get reliable data." The pickling hand's line for a load (`dest`) is kept apart
// from the line read off its plating, and the two are measured against each other. Made-up clients and parts.

const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
function shift(o: number) { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + o); return d; }
const iso = (o: number) => { const d = shift(o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dmy = (o: number) => { const d = shift(o); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };

const load = (id: string, part: string, dest: string | null, day = iso(-1)) => ({ id, kind: 'pickled', date: day, time: '09:00', clientId: 11, client: 'NOVA', part, qty: 300, unit: 'NOS',
  basis: 'pickling', src: 'hand', by: 'T', at: 1, ...(dest ? { dest } : {}) });
const run = (id: string, part: string, line: string, day = iso(-1)) => ({ id, kind: 'plated', date: day, time: '10:00', to: '11:00', slot: 'general', line, lineSrc: 'written',
  clientId: 11, client: 'NOVA', part, qty: 300, unit: 'NOS', basis: 'register', src: 'hand', by: 'T', at: 1 });

async function open(page: Page, entries: any[]) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(),
    production: { entries, pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {}, lines: {} } } } as SepState);
}

test.describe('P265: the pickling hand says where a load is going; the plating says where it went', () => {
  test('the measure: agreeing, not agreeing, not yet found, and a load with no line given', async ({ page }) => {
    await open(page, [
      load('L1', 'BRACKET 7101', 'vat-a1'), run('R1', 'BRACKET 7101', 'vat-a1'),
      load('L2', 'LINER 7202', 'vat-a2'), run('R2', 'LINER 7202', 'vat-a1'),
      load('L3', 'BOLT 7303', 'barrel'),
      load('L4', 'PLATE 7404', null), run('R4', 'PLATE 7404', 'vat-a2'),
    ]);
    const c = await page.evaluate(() => { const r = (window as any).prodDestCheck(56); return { loads: r.loads, given: r.given, matched: r.matched, agree: r.agree, differ: r.differ, unmatched: r.unmatched, differs: r.differs.map((e: any) => e.id), a2: r.byLine['vat-a2'] }; });
    expect(c).toEqual({ loads: 4, given: 3, matched: 2, agree: 1, differ: 1, unmatched: 1, differs: ['L2'], a2: { given: 1, matched: 1, agree: 0 } });
    // His word never becomes the load's line: the line still comes from the plating, and a load with no plating stays unknown.
    const lines = await page.evaluate(() => ['L1', 'L2', 'L3'].map(id => (window as any).prodLoadLine((window as any).prodIndex().byId[id])).map((x: any) => [x.line, x.how]));
    expect(lines).toEqual([['vat-a1', 'plating'], ['vat-a1', 'plating'], [null, 'unknown']]);

    await switchTab(page, 'pageProduction');
    await page.evaluate(d => { (window as any).eval(`_prodDay = '${d}'; _prodDayPicked = true; prodSetTab('lines')`); }, iso(-1));
    await page.locator('[data-action="invProdLine"][data-line="pickling"]').click();
    await expect(page.locator('[data-prod-dest-head]')).toHaveText('1 of 2 agree (50%)');
    await expect(page.locator('#prodDestCheck')).toContainText('3 of 4 loads had a line given');
    await expect(page.locator('#prodLoads [data-prod-dest-differ]')).toHaveText('For VAT A2, plated VAT A1');
    // Entries' flag lists the load that did not agree.
    const flagged = await page.evaluate(() => (window as any).prodIndex().live.filter((e: any) => (window as any).prodEntryFlagged(e, 'destdiffer')).map((e: any) => e.id));
    expect(flagged).toEqual(['L2']);
  });

  test("his message gives the line: on a line of its own for the block, or after a load's figure; a bare BARREL is still a note", async ({ page }) => {
    await open(page, []);
    const text = `${dmy(0)}\nNOVA\nBRACKET 7101-300 NOS\nLINER 7202-200 NOS VAT A2\nFOR VAT A1\nPICKLING TIME 9:00AM\nNOVA\nBOLT 7303-50 KG\nBARREL\nPICKLING TIME 10:00AM\nNOVA\nBOLT 7303-40 KG\nA1 ke liye\nPICKLING TIME 11:00AM`;
    const got = await page.evaluate(t => (window as any).parseProdPaste(t, (window as any).prodCtx())[0].read.items.map((it: any) => [it.kind, it.part, it.qty, it.dest || null]), text);
    expect(got).toEqual([
      ['pickled', 'BRACKET 7101', 300, 'vat-a1'],
      ['pickled', 'LINER 7202', 200, 'vat-a2'],
      ['pickled', 'BOLT 7303', 50, null],
      ['pickled', 'BOLT 7303', 40, 'vat-a1'],
    ]);
    await switchTab(page, 'pageProduction');
    await page.locator('#pageProduction [data-action="invProdPaste"]').first().click();
    await page.locator('#prodPasteText').fill(text);
    await page.locator('[data-action="invProdRead"]').click();
    await expect(page.locator('[data-prod-row="0:1"]')).toContainText('for VAT A2');
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => e.dest || null)).toEqual(['vat-a1', 'vat-a2', null, 'vat-a1']);
  });

  test("the face's message carries it, and reads back to the same line", async ({ page }) => {
    await open(page, []);
    const back = await page.evaluate(() => {
      const w = window as any;
      const msg = w.faceMsgOf([{ kind: 'pickled', date: w.localDateStr(), time: '09:00', clientId: 11, client: 'NOVA', part: 'BRACKET 7101', qty: 300, unit: 'NOS', dest: 'barrel' }]);
      return { msg, items: w.parseProdPaste(msg, w.prodCtx())[0].read.items.map((it: any) => [it.part, it.dest || null]) };
    });
    expect(back.msg).toContain('FOR BARREL');
    expect(back.items).toEqual([['BRACKET 7101', 'barrel']]);
  });

  test('Enter by hand: a load takes Going to, and a correction keeps it', async ({ page }) => {
    await open(page, []);
    await switchTab(page, 'pageProduction');
    await page.evaluate(() => (window as any).prodOpenHand(null));
    await page.locator('[data-action="invProdHandKind"][data-kind="pickled"]').click();
    await page.locator('#prodHandDest').selectOption('vat-a2');
    await page.locator('#prodHandClient').selectOption('11');
    await page.locator('#prodHandPart').fill('LINER 7202');
    await page.locator('#prodHandQty').fill('120');
    await page.locator('[data-action="invProdSaveHand"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.kind, e.dest])).toEqual([['pickled', 'vat-a2']]);
    const id = s.production.entries[0].id;
    await page.evaluate(i => (window as any).prodOpenHand(i), id);
    await expect(page.locator('#prodHandDest')).toHaveValue('vat-a2');
    await page.locator('#prodHandQty').fill('125');
    await page.locator('[data-action="invProdSaveHand"]').click();
    s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.qty, e.dest, !!e.replaces])).toEqual([[120, 'vat-a2', false], [125, 'vat-a2', true]]);
  });
});
