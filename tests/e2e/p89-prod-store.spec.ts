import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P89: the production record's own door. Entered by hand, corrected by a new entry that names the old one, voided
// with a reason and never deleted; exported whole as sep-production and merged back by id, never overwritten.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const state = (extra: any = {}) => ({ ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), ...extra } as SepState);

async function openEntries(page: Page) {
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
}

test.describe('P89: the production record', () => {
  test('an empty book says what to do, and every tab draws', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#pageProduction [data-action="invProdPaste"]')).toHaveClass(/inv-btn-primary/);
    for (const tab of ['overview', 'plant', 'lines', 'entries']) {
      await page.locator(`[data-action="invProdTab"][data-tab="${tab}"]`).click();
      await expect(page.locator(`[data-action="invProdTab"][data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#productionContent')).not.toBeEmpty();
    }
  });

  test('by hand, corrected, voided with a reason', async ({ page }) => {
    await loadAppWithState(page, state());
    await openEntries(page);
    await page.locator('#pageProduction [data-action="invProdHand"]').click();
    await page.locator('#prodHandTime').fill('09:20');
    await page.locator('#prodHandLine').selectOption('vat-a2');
    await page.locator('#prodHandClient').selectOption('11');
    await page.locator('#prodHandPart').fill('CLAMP 165X83 (40X6)');
    await page.locator('#prodHandQty').fill('420');
    await page.locator('[data-action="invProdSaveHand"]').click();
    await page.locator('[data-card="prodHandSaved"] [data-action="invProdHandDone"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries).toHaveLength(1);
    const e = s.production.entries[0];
    // The book's own id, not the picker's text; the gauge read from the part; what was not entered is left out.
    expect(e).toMatchObject({ kind: 'plated', date: todayIso(), time: '09:20', line: 'vat-a2', lineSrc: 'set', slot: 'general', clientId: 11,
      part: 'CLAMP 165X83 (40X6)', gauge: '40X6', qty: 420, unit: 'NOS', basis: 'hand', src: 'hand' });
    expect('to' in e).toBe(false);

    // A correction is a new entry naming the one it corrects; both stay.
    await openEntries(page);
    await page.locator(`[data-prod-entry="${e.id}"] [data-action="invProdCorrect"]`).click();
    await page.locator('#prodHandQty').fill('402');
    await page.locator('[data-action="invProdSaveHand"]').click();
    s = await readStoredState(page);
    expect(s.production.entries).toHaveLength(2);
    const fix = s.production.entries[1];
    expect(fix).toMatchObject({ replaces: e.id, qty: 402, basis: 'hand' });
    await openEntries(page);
    await expect(page.locator(`[data-prod-entry="${e.id}"] .inv-row-meta`)).toContainText('corrected');

    // Void asks why, in the app's own dialog; cancel changes nothing, a reason voids it and it stays listed.
    await page.locator(`[data-prod-entry="${fix.id}"] [data-action="invProdVoid"]`).click();
    await answerAsk(page, 'cancel');
    expect((await readStoredState(page)).production.entries[1].voidedAt).toBeUndefined();
    await page.locator(`[data-prod-entry="${fix.id}"] [data-action="invProdVoid"]`).click();
    await answerAsk(page, 'ok', 'typed on the wrong day');
    s = await readStoredState(page);
    expect(s.production.entries).toHaveLength(2);
    expect(s.production.entries[1]).toMatchObject({ voidReason: 'typed on the wrong day' });
    await expect(page.locator(`[data-prod-entry="${fix.id}"]`)).toHaveClass(/inv-row-muted/);
    await expect(page.locator(`[data-prod-entry="${fix.id}"] .inv-row-meta`)).toContainText('void: typed on the wrong day');
  });

  test('export is whole; import merges by id and never overwrites', async ({ page }, info) => {
    const d = todayIso();
    const entries = [
      { id: 'E1', kind: 'plated', date: d, line: 'barrel', slot: 'day', clientId: 12, client: 'DURGA AUTO', part: '0101', qty: 995, unit: 'NOS', basis: 'relay', src: 'paste', at: 1 },
      { id: 'E2', kind: 'pickled', date: d, time: '08:40', clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP(40X6)', basis: 'pickling', src: 'paste', at: 1 },
    ];
    await loadAppWithState(page, state({ production: { entries, pastes: [{ id: 'PP1', hash: 'h1', text: 'x', at: 1 }], photos: [], imports: [], learn: { clients: { NOVAK: 11 }, parts: {} } } }));
    await openEntries(page);
    const dl = page.waitForEvent('download');
    await page.locator('[data-action="invProdExport"]').click();
    const file = await (await dl).path();
    const json = JSON.parse(readFileSync(file, 'utf8'));
    expect(json).toMatchObject({ format: 'sep-production', version: 1 });
    expect(json.entries.map((x: any) => x.id)).toEqual(['E1', 'E2']);
    expect(json.learn.clients).toEqual({ NOVAK: 11 });

    // The same file again adds nothing; a changed copy of a held entry does not overwrite it.
    json.entries[0].qty = 1;
    json.entries.push(
      { id: 'E3', kind: 'plated', date: d, line: 'vat-a1', clientId: 99, client: 'DURGA AUTO', part: '0140', qty: 300, unit: 'NOS', basis: 'register', src: 'photo', at: 2 },
      { id: 'E4', kind: 'pickled', date: d, client: 'SIYA ENTERPRISES', part: 'Buckle hook', qty: 200, unit: 'NOS', at: 2 },
      { id: 'E5', kind: 'plated', date: 'yesterday', qty: 5, unit: 'NOS', at: 2 },
      { id: 'E6', kind: 'plated', date: d, line: 'vat-a9', qty: 5, unit: 'NOS', at: 2 });
    const back = info.outputPath('back.json');
    writeFileSync(back, JSON.stringify(json));
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="invProdImport"]').click();
    await (await chooser).setFiles(back);
    await expect(page.locator('.inv-toast')).toContainText('2 entries added');
    const s = await readStoredState(page);
    const byId = Object.fromEntries(s.production.entries.map((x: any) => [x.id, x]));
    expect(Object.keys(byId).sort()).toEqual(['E1', 'E2', 'E3', 'E4']);
    expect(byId.E1.qty).toBe(995);
    // An id the book holds under another name is found by the name written; a name nobody holds is kept as written.
    expect(byId.E3.clientId).toBe(12);
    expect(byId.E4.clientId).toBeUndefined();
    expect(byId.E4.src).toBe('import');
    expect(s.production.imports).toHaveLength(1);
    expect(s.production.imports[0].counts).toEqual({ entries: 2, skipped: 2, unknownClient: 1, refused: 2 });
    expect(s.production.pastes).toHaveLength(1);
  });

  test('a GitHub pull or an import replacing the whole book does not leave the index stale', async ({ page }) => {
    const d = todayIso();
    await loadAppWithState(page, state({ production: { entries: [{ id: 'E1', kind: 'plated', date: d, line: 'barrel', slot: 'day', clientId: 12, part: '0101', qty: 995, unit: 'NOS', basis: 'relay', at: 1 }], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } }));
    const r = await page.evaluate(() => {
      const ev = (0, eval);
      const before = Object.keys(ev('prodIndex()').byId);
      // What adoptState does: S is replaced wholesale, with no prodTouch().
      ev('S.production = { entries: [{ id: "F1", kind: "pickled", date: "' + new Date().toISOString().slice(0, 10) + '", part: "X", at: 1 }], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } }');
      return { before, after: Object.keys(ev('prodIndex()').byId) };
    });
    expect(r.before).toEqual(['E1']);
    expect(r.after).toEqual(['F1']);
  });
});
