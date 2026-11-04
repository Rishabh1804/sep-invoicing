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

  test('Enter in a field that finishes its step goes on to the step Next', async ({ page }) => {
    await loadAppWithState(page, stockBook());
    await page.evaluate(() => localStorage.removeItem('sep_inv_stock_by'));
    await openHand(page);
    await page.locator('[data-stock-qty="Q"]').fill('3');
    await page.locator('[data-stock-qty="Q"]').press('Enter');
    await expect(page.locator('#stockBy')).toBeFocused();
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
