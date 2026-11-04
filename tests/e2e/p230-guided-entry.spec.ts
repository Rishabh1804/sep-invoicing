import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openStockSpend, toolbarMore } from './fixtures';
import { longBook } from './load-fixture';
import { guardBook, withUsers, unlock, PINS } from './p140-guard.fixture';

// P230 (UI pass 3 §11, U4): every Enter by hand a guided flow, Stock's Spend and prices in a room of its own, two stock lines merged
// into one. Made-up names throughout (HR-10).

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function stockBook(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = { items: [
    { id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', aliases: [], unit: 'L', active: true, createdAt: 1 },
    { id: 'Q', name: 'Q558', key: 'Q558', aliases: [], unit: 'kg', active: true, createdAt: 1 }],
    entries: [{ id: 'SE0', itemId: 'N', kind: 'count', qty: 100, date: todayIso(), seq: 0, at: 1, source: 'manual', by: 'X' },
      { id: 'SE1', itemId: 'Q', kind: 'count', qty: 15, date: todayIso(), seq: 0, at: 1, source: 'manual', by: 'X' }], pastes: [] };
  return s as SepState;
}
async function openHand(page: Page) {
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  await expect(page.locator('[data-flow="stockManual"]')).toBeVisible();
}

test.describe('P230 guided entry: Stock by hand', () => {
  test('numbered steps that lead without hiding: the kinds as tiles, Next on the first not done, each step open in any order', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await page.evaluate(() => localStorage.removeItem('sep_inv_stock_by'));
    await openHand(page);
    const flow = page.locator('[data-flow="stockManual"]');
    const steps = flow.locator('[data-flow-step]');
    await expect(steps).toHaveCount(4);
    // The kind is a row of tiles, each its icon, word and line, the same action the segmented control had.
    const tiles = flow.locator('.inv-kind[data-action="invStockMode"]');
    await expect(tiles).toHaveCount(4);
    await expect(tiles.filter({ hasText: 'Received' })).toContainText('A delivery came in');
    await expect(flow.locator('.inv-kind[data-mode="count"]')).toHaveAttribute('aria-pressed', 'true');
    // What and When are done on opening (a kind and today); the lines are Next; Who waits.
    await expect(flow.locator('[data-flow-step="what"]')).toHaveAttribute('data-state', 'done');
    await expect(flow.locator('[data-flow-step="when"]')).toHaveAttribute('data-state', 'done');
    await expect(flow.locator('[data-flow-step="lines"]')).toHaveAttribute('data-state', 'next');
    await expect(flow.locator('[data-flow-step="lines"] [data-flow-tag]')).toHaveText('Next');
    await expect(flow.locator('[data-flow-step="who"]')).toHaveAttribute('data-state', 'todo');
    await expect(flow.locator('[data-flow-progress]')).toContainText('2 of 4 done');
    // Who can be filled before the lines: every step stays open; Next stays on the lines.
    await flow.locator('#stockBy').fill('Deepak');
    await expect(flow.locator('[data-flow-step="who"]')).toHaveAttribute('data-state', 'done');
    await expect(flow.locator('[data-flow-step="who"] [data-flow-says]')).toHaveText('Deepak');
    await expect(flow.locator('[data-flow-step="lines"]')).toHaveAttribute('data-state', 'next');
    // A line typed: the step says what it holds, the progress is whole.
    await flow.locator('[data-stock-qty="Q"]').fill('25');
    await expect(flow.locator('[data-flow-step="lines"] [data-flow-says]')).toHaveText('Q558 · 25 kg');
    await expect(flow.locator('[data-flow-progress]')).toContainText('Ready to save');
    // A field typed into is never replaced as the flow keeps in step: the same element holds the focus.
    await expect(flow.locator('[data-stock-qty="Q"]')).toBeFocused();
  });

  test('the preview says what Save records, the level before and after, and the checks; the receipt follows the save', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await openHand(page);
    const flow = page.locator('[data-flow="stockManual"]'), pv = flow.locator('[data-flow-preview]');
    await expect(pv).toContainText('What Save records');
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    // A delivery: When is not done until its bill is named.
    await expect(flow.locator('[data-flow-step="when"]')).not.toHaveAttribute('data-state', 'done');
    await flow.locator('#stockManSupplier').fill('Delta Chemicals');
    await flow.locator('#stockManBill').fill('1043');
    await expect(flow.locator('[data-flow-step="when"]')).toHaveAttribute('data-state', 'done');
    await flow.locator('[data-stock-qty="Q"]').fill('25');
    await flow.locator('[data-stock-price="Q"]').fill('55.2');
    await expect(pv).toContainText('Received 25 kg of Q558 from Delta Chemicals, bill 1043');
    await expect(pv).toContainText('₹55.20 a kg before GST');
    await expect(pv).toContainText('The shelf goes from 15 kg to 40 kg');
    // A count far off the level is the app's own check, said before the save as after it.
    await page.locator('[data-action="invStockMode"][data-mode="count"]').click();
    await flow.locator('[data-stock-qty="N"]').fill('40');
    await expect(pv.locator('[data-tone="warning"]').filter({ hasText: 'Nitric acid' })).toContainText('Counted 40 L where the app had 100 L');
    // Nothing was written by the preview.
    expect((await readStoredState(page)).stock.entries.length).toBe(2);
    await page.locator('[data-stock-qty="Q"]').fill('');
    await page.locator('[data-action="invStockSaveManual"]').click();
    const receipt = page.locator('[data-flow-receipt]');
    await expect(receipt).toContainText('Saved: 1 entry · Count on');
    await expect(receipt).toContainText('Counted 40 L of Nitric acid');
    // The form stays for the next: the figure cleared, the day listed under it.
    await expect(flow.locator('[data-stock-qty="N"]')).toHaveValue('');
    await expect(page.locator('#stockDayEntries')).toContainText('Count 40 L');
  });

  test('Enter in the field that finishes its step goes on to the step Next; from any other field, to the next field', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await page.evaluate(() => localStorage.removeItem('sep_inv_stock_by'));
    await openHand(page);
    // Who is the last step and its one field: done, Enter goes to the step Next, the lines, at its first field.
    await page.locator('#stockBy').fill('Deepak');
    await page.locator('#stockBy').press('Enter');
    await expect(page.locator('[data-flow-step="lines"] [data-stock-qty]').first()).toBeFocused();
    // A delivery's quantity finishes the lines step, but its price comes next: Enter stays in the step (Cipher M-1).
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    await page.locator('[data-stock-qty="Q"]').fill('3');
    await page.locator('[data-stock-qty="Q"]').press('Enter');
    await expect(page.locator('[data-stock-price="Q"]')).toBeFocused();
  });

  test('a step’s book opens its guide at the section it names', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await openHand(page);
    const book = page.locator('[data-flow-step="what"] [data-action="invFlowGuide"]');
    await expect(book).toHaveAttribute('data-id', 'app-stock');
    await book.click();
    await expect(page.locator('#pageKnow.inv-page-active')).toBeVisible();
    const u = new URL(page.url());
    expect(u.searchParams.get('id')).toBe('app-stock');
    // The Reader, at the section the step names (kbread.js: its index among the article's sections).
    expect(u.searchParams.get('v')).toMatch(/\/read\/[1-9]\d*$/);
    await expect(page.locator('#pageKnow')).toContainText('Enter by hand');
  });
});

test.describe('P230 Stock: Spend and prices, and two lines that are one', () => {
  test('the phone: Spend and prices is a screen of its own with its way back, its sections cards', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStock');
    await openStockSpend(page);
    expect(new URL(page.url()).searchParams.get('v')).toBe('spend');
    await expect(page.locator('#stockSpend > .inv-panel[data-dash-section]')).toHaveCount(3);
    await expect(page.locator('#stockVerdict')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('#stockVerdict')).toBeVisible();
    // An address opens it, and Home's zinc door lands there.
    await page.goForward();
    await expect(page.locator('#stockSpend')).toBeVisible();
  });

  test('two lines one letter apart are raised to the owner, and merged: entries moved, the name kept as a spelling, the line retired', async ({ page }) => {
    const s: any = stockBook();
    s.stock.items.push({ id: 'NA', name: 'Nitric acd', key: 'NITRIC ACD', aliases: [], unit: 'L', active: true, createdAt: 2 });
    s.stock.items.push({ id: 'NT', name: 'Nitrik acid', key: 'NITRIK ACID', aliases: [], unit: 'L', active: true, createdAt: 3 });
    s.stock.entries.push({ id: 'SE2', itemId: 'NT', kind: 'used', qty: 5, date: todayIso(), seq: 2, at: 2, source: 'paste', by: '' });
    await loadAppWithState(page, s);
    // Nitric acd folds to Nitric acid (ACD is ACID); Nitrik is one letter off. Each pair once, the line with fewer entries to merge.
    const twins: any[] = await g(page, `todoAppAll().filter(function (t) { return t.rule === 'stockTwins'; }).map(function (t) { return t.go; })`);
    expect(twins).toEqual(expect.arrayContaining([{ kind: 'stockMerge', id: 'NA', into: 'N' }, { kind: 'stockMerge', id: 'NT', into: 'N' }]));
    expect(twins.length).toBe(3);   // and Nitric acd against Nitrik acid, one letter apart too
    // Merged from the line's page.
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockOpen"][data-id="NT"]').first().click();
    await page.locator('[data-action="invStockMerge"][data-id="NT"]').click();
    await page.locator('#stockMergeInto').selectOption('N');
    await page.locator('[data-action="invStockMergeDo"]').click();
    const said = await answerAsk(page, 'ok');
    expect(said).toContain('Move 1 entry from Nitrik acid to Nitric acid and keep Nitrik acid as a spelling?');
    const st: any = (await readStoredState(page)).stock;
    const moved = st.entries.find((e: any) => e.id === 'SE2');
    expect(moved).toMatchObject({ itemId: 'N', mergedFrom: 'NT' });
    const gone = st.items.find((i: any) => i.id === 'NT'), kept = st.items.find((i: any) => i.id === 'N');
    expect(gone).toMatchObject({ mergedInto: 'N', active: false });
    expect(gone.retiredAt).toBeGreaterThan(0);
    expect(kept.aliases).toContain('NITRIK ACID');
    expect(kept.mergedFrom).toEqual(['NT']);
    // A message written the old way lands on the line kept; the export carries both fields (sep-stock, read by soma-internal).
    expect(await g(page, `stockFindByKey('NITRIK ACID').id`)).toBe('N');
    const dl = page.waitForEvent('download');
    await g(page, `stockExport()`);
    const file = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    expect(file.items.find((i: any) => i.id === 'NT').mergedInto).toBe('N');
    expect(file.items.find((i: any) => i.id === 'N').mergedFrom).toEqual(['NT']);
    expect(file.entries.find((e: any) => e.id === 'SE2').mergedFrom).toBe('NT');
    // The line kept is the one on screen.
    await expect(page.locator('#stockContent')).toContainText('Nitric acid');
  });

  test('the QA chain: real, different salts are never raised as one; a pair said to differ stays apart; a late entry on a retired line moves', async ({ page }) => {
    const s: any = stockBook();
    s.stock.items.push({ id: 'SN1', name: 'Sodium nitrate', key: 'SODIUM NITRATE', aliases: [], unit: 'kg', active: true, createdAt: 2 },
      { id: 'SN2', name: 'Sodium nitrite', key: 'SODIUM NITRITE', aliases: [], unit: 'kg', active: true, createdAt: 3 },
      { id: 'CA', name: 'Citric acid', key: 'CITRIC ACID', aliases: [], unit: 'L', active: true, createdAt: 4 },
      { id: 'BR', name: 'Brightner', key: 'BRIGHTNER', aliases: [], unit: 'L', active: true, createdAt: 5 },
      { id: 'BR2', name: 'Brigthner', key: 'BRIGTHNER', aliases: [], unit: 'L', active: true, createdAt: 6 });
    await loadAppWithState(page, s);
    const pairs: string[] = await g(page, `stockTwins().map(function (p) { return p.from.name + '|' + p.into.name; })`);
    // Nitrate/nitrite and nitric/citric are other chemicals (Vulcanus M-3); a transposed pair is not one letter either.
    expect(pairs.filter(p => /nitr|citric/i.test(p))).toEqual([]);
    // A pair the owner says differs is kept apart, its task gone.
    await g(page, `stockData().items.push({ id: 'NA', name: 'Nitric acd', key: 'NITRIC ACD', aliases: [], unit: 'L', active: true, createdAt: 7 })`);
    expect(await g(page, `todoAppAll().filter(function (t) { return t.rule === 'stockTwins'; }).length`)).toBe(1);
    await g(page, `stockMergeOpen('NA', 'N')`);
    await page.locator('[data-action="invStockNotTwins"]').click();
    expect(await g(page, `todoAppAll().filter(function (t) { return t.rule === 'stockTwins'; }).length`)).toBe(0);
    expect((await readStoredState(page)).stock.notTwins).toEqual(['N|NA']);
    // A merge done here, then an entry from a device that had not merged naming the retired line: moved to the line kept on the
    // next load (migrateState), keeping where it came from (Vulcanus H-1); and the line's checks see it (the memo's key).
    await g(page, `(function () { var st = stockData(), f = stockItem('NA'), t = stockItem('N'); f.mergedInto = 'N'; f.active = false; f.retiredAt = 1;
      st.entries.push({ id: 'LATE', itemId: 'NA', kind: 'used', qty: 500, date: '${todayIso()}', seq: 2, at: Date.now(), source: 'manual', by: 'B' }); saveState(); })()`);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    const late = (await readStoredState(page)).stock.entries.find((e: any) => e.id === 'LATE');
    expect(late).toMatchObject({ itemId: 'N', mergedFrom: 'NA' });
    expect(await g(page, `Object.keys(stockEntryChecks('N')).indexOf('LATE') >= 0`)).toBe(true);
    // A stored choice and a file's line follow the merge to the line kept.
    expect(await g(page, `stockLive('NA').id`)).toBe('N');
  });

  test('lines of two units are not merged: a figure in litres would read as kilograms', async ({ page }) => {
    const s: any = guardBook();
    s.stock.items.push({ id: 'NK', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'kg', active: true });
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, `stockMergeOpen('NK', 'N')`);
    await page.locator('[data-action="invStockMergeDo"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('set one line’s unit to the other’s first');
    expect((await readStoredState(page)).stock.items.find((i: any) => i.id === 'NK').mergedInto).toBeUndefined();
  });
});

test.describe('P230: every Enter by hand is a flow', () => {
  // Each form of §11a and §26b, opened the way a person opens it (or by its own opener where the door is deep), is numbered steps
  // with at most one Next, a progress line and the preview; the ids the specs and the keyboard read are the form's own (each form's
  // own specs, unchanged, hold its fields).
  async function isFlow(page: Page, name: string) {
    const flow = page.locator(`[data-flow="${name}"]`).first();
    await expect(flow).toBeVisible();
    expect(await flow.locator('[data-flow-step]').count()).toBeGreaterThanOrEqual(2);
    expect(await flow.locator('[data-flow-step][data-state="next"]').count()).toBeLessThanOrEqual(1);
    await expect(flow.locator('[data-flow-progress] [role="meter"]')).toHaveCount(1);
    // What Save records; a form saved as it goes says what the day holds.
    await expect(flow.locator('[data-flow-preview] .inv-flow-pv-head')).toHaveText(name === 'attEdit' ? 'What the day holds' : 'What Save records');
    expect(await flow.locator('[data-flow-step] .inv-flow-title').first().textContent()).toMatch(/\?$/);
  }
  const close = (page: Page) => page.evaluate(() => { document.querySelectorAll('.inv-scrim-dialog').forEach(d => d.remove()); document.body.style.overflow = ''; });
  test('Create, a challan, Production by hand, Plant shut, a cheque, a bill and a hand\u2019s day', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageCreate');
    await isFlow(page, 'createInvoice');
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await isFlow(page, 'challanForm');
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Enter by hand');
    await isFlow(page, 'prodHand');
    await g(page, `plantShutOpen()`);
    await isFlow(page, 'plantShut');
    await close(page);
    await g(page, `bankChequeFormOpen()`);
    await isFlow(page, 'chequeForm');
    await close(page);
    await g(page, `addBill()`);
    await isFlow(page, 'costBill');
    await switchTab(page, 'pageStaff');
    await g(page, `attEditOpen(staffActive()[0].id)`);
    await isFlow(page, 'attEdit');
    // A form that saves each change as it is made never says it is ready to save.
    await expect(page.locator('[data-flow="attEdit"] [data-flow-progress]')).not.toContainText('Ready to save');
  });
});

test.describe('P230 QA chain: production', () => {
  const T = todayIso();
  const CL = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }],
    pieceWeights: [{ partNumber: '9177 4390 3302', gauge: '', kgPerPiece: 0.5, effectiveFrom: '2020-04-01' }] },
    { id: 12, name: 'DURGA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [{ ratePerKg: 12, ratePerPiece: null, effectiveFrom: '2026-04-01' }] }];
  const IM = [{ id: 'IM-P1', clientId: 11, clientName: CL[0].name, challanNo: '901', challanDate: T, vehicleNo: '', createdAt: 1,
    items: [{ id: 'IMI-1', partNumber: '9177 4390 3302', desc: 'ASSY BRACKET', unit: 'NOS', qty: 400, nosQty: 400, rate: 2, amount: 800, invoiced: false }] }];
  const prodBook = () => ({ ...emptyState(), clients: CL, incomingMaterial: IM } as unknown as SepState);

  test('Production by hand: a name with a code is weighed as Save will, as the client’s part on record (Vulcanus M-4)', async ({ page }) => {
    await loadAppWithState(page, prodBook());
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Enter by hand');
    await page.locator('#prodHandClient').selectOption('11');
    await page.locator('#prodHandPart').fill('Assy Bracket 3302');
    await page.locator('#prodHandQty').fill('100');
    const pv = page.locator('[data-flow="prodHand"] [data-flow-preview]');
    await expect(pv).toContainText('It counts as 50 kg plated, weighed by the part’s weight on record');
    // Nothing was learnt by the preview: the name is matched to the part only when the run is saved.
    expect(await g(page, `Object.keys(prodData().learn.parts).length`)).toBe(0);
    // A part with no weight anywhere: the preview names no route Save may not take.
    await page.locator('#prodHandPart').fill('Bush 77');
    await expect(pv).toContainText('Weighed at save, from its challans if any are open');
  });

  test('the register photo: a run struck and cancelled is neither listed nor counted, as Save leaves it out (Vulcanus L-5)', async ({ page }) => {
    const dmy = (iso: string) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y.slice(2); };
    const row = (time: string, customer: string, part: string, qtyText: string, struck: boolean) =>
      ({ time, mark: '', customer, part, dim: '40x6', qtyText, struck, over: '', bracket: false, ditto: false, legible: true, event: '', date: '' });
    const pageRead = { page: 'production', date: dmy(T), weekday: '', line: 'VAT-A1', dayTotal: null,
      rows: [row('9:20 AM', 'Nova clamps', 'CLAMP 165x83', '108', false), row('10:00 AM', 'Durga auto', 'BUSH 77', '50', true)] };
    await loadAppWithState(page, prodBook());
    await page.evaluate(() => { localStorage.setItem('sep_inv_claude_key', 'sk-ant-test'); localStorage.removeItem('sep_inv_prod_photo_read'); });
    await page.route('https://api.anthropic.com/**', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(pageRead) }],
        stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 1500 } }) }));
    await switchTab(page, 'pageProduction');
    await page.setInputFiles('#prodPhotoInput', { name: 'register.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    const pv = page.locator('[data-flow="prodPhoto"] [data-flow-preview]');
    await expect(pv).toContainText('in 2 runs');
    await page.locator('[data-action="invProdStruck"][data-v="cancelled"]').first().click();
    await expect(pv).toContainText('in 1 run');
    await expect(pv).toContainText('1 run struck and cancelled: not saved');
    await expect(pv).not.toContainText('BUSH 77');
  });

  test('Plant shut: why is filled only if wanted, and a day already marked says its reason is cleared (Vulcanus L-4)', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.flowCfg = { holidays: [T], shutWhy: { [T]: 'Diwali' } };
    await loadAppWithState(page, s);
    await g(page, `plantShutOpen('${T}')`);
    const flow = page.locator('[data-flow="plantShut"]');
    await expect(flow.locator('[data-flow-step="why"]')).toHaveAttribute('data-state', 'opt');
    await expect(flow.locator('[data-flow-preview]')).toContainText('its reason Diwali is cleared');
    await flow.locator('#plantShutWhy').fill('Puja');
    await expect(flow.locator('[data-flow-preview]')).toContainText('kept, with the reason given here');
  });

  test('a power cut’s cost is shown only to a role that opens Power and sees money (Iuno H-4)', async ({ page }) => {
    const s: any = guardBook();
    s.production = { entries: [{ id: 'PE-C1', kind: 'downtime', date: T, time: '10:00', to: '10:40', downtime: { cause: 'power' }, basis: 'hand', src: 'hand', at: 1 }] };
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await g(page, `pcsOpen('PE-C1')`);
    await expect(page.locator('[data-flow="pcs"]')).toBeVisible();
    await expect(page.locator('[data-flow="pcs"] [data-flow-preview]')).not.toContainText('What it cost');
    expect(await g(page, `_pcs.costNow`)).toBeNull();
    expect(await g(page, `pcsSeesCost()`)).toBe(false);
  });
});

test.describe('P230 QA chain: money', () => {
  // U4's QA chain (Iuno, Castor): a preview says what Save will do, read by the screen's own functions with the record put in for one
  // reading, never a subtraction; and it never reads Ready to save over what Save refuses. Made-up names and figures (HR-10).
  const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const brow = (id: string, date: string, narration: string, dr: number, cr: number, set?: any) =>
    Object.assign({ id, date, valueDate: date, narration, chq: '', dr, cr, balance: 500000, dayIdx: 1, importId: 'BI-1' }, set ? { set } : {});
  function moneyBook(rows: any[], extra: any = {}): SepState {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [],
      add1: 'PLOT 1', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20', mobile: '' }];
    s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'T/00001', date: day(-20), status: 'active', invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA FORGINGS',
      gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }, items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: 20000, amount: 20000 }],
      taxableValue: 20000, cgstPer: 9, cgstAmt: 1800, sgstPer: 9, sgstAmt: 1800, igstPer: 0, igstAmt: 0, grandTotal: 23600, createdAt: Date.now() - 86400000 }];
    rows.sort((a, b) => a.date < b.date ? -1 : 1);
    s.bank = { rows, imports: [{ id: 'BI-1', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
      parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
    return Object.assign(s, extra);
  }
  const pv = (page: Page, name: string) => page.locator(`[data-flow="${name}"] [data-flow-preview]`);

  test('a cheque the statement already holds as a counted deposit leaves what the client owes as it is (Iuno H-1)', async ({ page }) => {
    // The deposit of cheque 525428 is on the statement two days ago, placed on ALPHA by hand: it counts already.
    await loadAppWithState(page, moneyBook([brow('BK-1', day(-40), 'SMS CHARGES', 1, 0), brow('BK-2', day(-2), 'BY INST 525428 CLEARING', 0, 10000, { clientId: 1 }), brow('BK-3', day(-1), 'SMS CHARGES', 1, 0)]));
    const before: number = await g(page, `bankReceivables().find(function (x) { return x.client.id === 1; }).owed`);
    await g(page, `bankChequeFormOpen(1)`);
    const form = page.locator('[data-cheque-form]');
    await form.locator('#chqAmount').fill('10000');
    await form.locator('#chqNumber').fill('525428');
    await form.locator('#chqReceived').fill(day(-1));
    await expect(pv(page, 'chequeForm')).toContainText('Already in the bank as the deposit of');
    await expect(pv(page, 'chequeForm')).toContainText('does not change');
    // A cheque the statement does not hold yet lowers it, by Receivables' own reading.
    await form.locator('#chqNumber').fill('999001');
    await expect(pv(page, 'chequeForm')).toContainText('→');
    // The readings left nothing behind.
    expect(await g(page, `bankCheques().length`)).toBe(0);
    expect(await g(page, `bankReceivables().find(function (x) { return x.client.id === 1; }).owed`)).toBe(before);
  });

  test('a supplier payment dated before the balance’s day moves nothing, and says so (Iuno H-3)', async ({ page }) => {
    const s: any = moneyBook([brow('BK-1', day(-40), 'SMS CHARGES', 1, 0), brow('BK-2', day(-1), 'SMS CHARGES', 1, 0)]);
    s.suppliers = [{ id: 'SUP-K', name: 'Kappa Traders', names: [], opening: { amount: 5000, date: day(-5), at: 1 }, at: 1 }];
    await loadAppWithState(page, s);
    await g(page, `suppOpen('SUP-K', 'pay')`);
    const f = page.locator('[data-supp-dialog]');
    await f.locator('#suppPayAmount').fill('2000');
    await f.locator('#suppPayDate').fill(day(-10));
    await expect(pv(page, 'suppPay')).toContainText('Owed to them: ₹5,000.00 → ₹5,000.00');
    await expect(pv(page, 'suppPay')).toContainText('the balance already holds it');
    await f.locator('#suppPayDate').fill(day(-1));
    await expect(pv(page, 'suppPay')).toContainText('₹5,000.00 → ₹3,000.00');
    expect(await g(page, `suppPays().length`)).toBe(0);
  });

  test('a bill with a negative part, a blank challan line and a number already taken never read as ready to save (Iuno L-3, L-4, L-5)', async ({ page }) => {
    const s: any = moneyBook([brow('BK-1', day(-40), 'SMS CHARGES', 1, 0), brow('BK-2', day(-1), 'SMS CHARGES', 1, 0)]);
    s.invPrefix = 'T/'; s.invNextNum = 1;   // T/00001 is a live invoice already
    await loadAppWithState(page, s);
    await g(page, `addBill()`);
    const bill = page.locator('[data-flow="costBill"]');
    await bill.locator('#costBillAmount').fill('1000');
    await bill.locator('#costBillArrears').fill('-5');
    await expect(pv(page, 'costBill').locator('[data-tone="danger"]').filter({ hasText: 'below 0' })).toContainText('neither can be below 0');
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('[data-action="invAddChallanLine"]').click();
    await expect(page.locator('[data-flow="challanForm"] [data-flow-step="lines"]')).not.toHaveAttribute('data-state', 'done');
    await expect(pv(page, 'challanForm')).toContainText('is empty: fill it or remove it before Save');
    await switchTab(page, 'pageCreate');
    await expect(pv(page, 'createInvoice').locator('[data-tone="danger"]').filter({ hasText: 'T/00001' })).toContainText('already a live invoice');
  });

  test('a delivery’s price is said to its own places, with what the line comes to (Iuno L-6)', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await openHand(page);
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    await page.locator('[data-stock-qty="Q"]').fill('8');
    await page.locator('[data-stock-price="Q"]').fill('55.125');
    await expect(pv(page, 'stockManual')).toContainText('₹55.125 a kg before GST, ₹441.00 for the line');
  });

  test('a line’s shift: a night line with no times is said before Save refuses it (Castor L-5)', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await g(page, `openSettings('shifts')`);
    const row0 = page.locator('[data-shift-row="0"]');
    await row0.locator('#setShLine0').selectOption('vat-a1');
    await row0.locator('#setShFrom0').fill(todayIso());
    await expect(row0.locator('[data-flow-preview] [data-tone="danger"]')).toContainText('Set when the night starts and ends');
    await row0.locator('#setShStart0').fill('18:00');
    await row0.locator('#setShEnd0').fill('06:00');
    await expect(row0.locator('[data-flow-preview] [data-tone="danger"]')).toHaveCount(0);
  });

  test('a line’s shift: a second schedule for one line from the same day is said before Save refuses it (Castor L-5)', async ({ page }) => {
    const s: any = stockBook();
    s.lineShifts = [{ id: 'ls1', line: 'vat-a1', from: todayIso(), to: '', start: '18:00', end: '06:00', stop: '', breakMin: 45, crew: { 'vat-a1': 4 }, spare: 0, sunday: false, note: '', at: 1 }];
    await loadAppWithState(page, s);
    await g(page, `openSettings('shifts')`);
    const row1 = page.locator('[data-shift-row="1"]');
    await row1.locator('#setShLine1').selectOption('vat-a1');
    await row1.locator('#setShFrom1').fill(todayIso());
    await row1.locator('#setShStart1').fill('18:00');
    await row1.locator('#setShEnd1').fill('06:00');
    await expect(row1.locator('[data-flow-preview] [data-tone="danger"]')).toContainText('has another schedule from');
  });
});
