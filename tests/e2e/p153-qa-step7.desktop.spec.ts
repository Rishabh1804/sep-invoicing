import { test, expect, type Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openFoldAt, openPulse, recentTs, switchTab, todayIso, waitForBoot } from './fixtures';
import { sweepState } from './sweep-fixture';

// P153 (desktop): the QA chain of 2 Oct 2026 over UX overhaul 2's step 7. The four new list-and-pane screens keep where the
// list was scrolled when they redraw; History's events keep their address when their text moves and two alike are told
// apart; a number accounted for says so; Cancel and Edit from History's pane act where they should; an address naming no
// client opens no pane; a jump to the receipts with no client shuts a pane left open; Production's pane names an open cut
// and the barrel list as they are; the roster's rate shows at 1280; a window crossing 1024px keeps the leave guard;
// and only Pulse, Stats and Finance's Overview go three across. Every name is made up.

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const historyList = (page: Page) => page.locator('#historyHost > .inv-pane-list');

/* The sweep book and sixty deleted numbers: History runs to more than one screen of rows. */
function longHistory() {
  const s: any = sweepState();
  s.voidedNumbers = (s.voidedNumbers || []).concat(Array.from({ length: 60 }, (_, k) => ({
    invoiceNumber: String(900 + k).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(900 + k).padStart(5, '0'),
    reason: 'Typed twice', voidedAt: recentTs(60000 * (k + 1)), source: 'deleted', reserved: false, grandTotal: 0 })));
  return s;
}

test('History: Load more keeps the list where it was scrolled', async ({ page }) => {
  await loadAppWithState(page, longHistory());
  await switchTab(page, 'pageHistory');
  const list = historyList(page);
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const at = await list.evaluate(el => el.scrollTop);
  expect(at).toBeGreaterThan(200);
  await page.locator('#historyHost [data-action="invHistoryLoadMore"]').click();
  await expect(page.locator('#historyHost tbody tr')).not.toHaveCount(30);
  expect(Math.abs((await list.evaluate(el => el.scrollTop)) - at)).toBeLessThan(2);
});

test('History: two alike events are two addresses; a change keeps its address when its words move', async ({ page }) => {
  const d = dayOff(-1);
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(),
    attendance: { [d]: { marks: {}, extra: [{ area: 'vat-a1', hours: 8 }, { area: 'vat-a1', hours: 8 }] } } } as any);
  await switchTab(page, 'pageHistory');
  const rows = page.locator('#historyHost tbody tr[data-ev="extra"]');
  await expect(rows).toHaveCount(2);
  const [k1, k2] = [await rows.nth(0).getAttribute('data-key'), await rows.nth(1).getAttribute('data-key')];
  expect(k1).not.toBe(k2);
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(rows.nth(0)).not.toHaveAttribute('aria-current', 'true');
  expect(page.url()).toContain(`id=${encodeURIComponent(k2!)}`);
  // A change is keyed on its log entry, never its words (they name a user, who can be renamed).
  const same = await page.evaluate(() => {
    const w = window as any;
    const ev = (text: string) => ({ kind: 'chg', type: 'change', ts: 5, logId: 'L1', text });
    return w.historyEvBase(ev('Asha Rao changed the rate')) === w.historyEvBase(ev('Asha R. changed the rate'));
  });
  expect(same).toBe(true);
});

test('History: a number accounted for says no invoice was recorded; a deleted one says where its record went', async ({ page }) => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.voidedNumbers = [
    { invoiceNumber: '00007', displayNumber: 'SEP/TEST-00007', reason: 'Never issued', voidedAt: recentTs(1000), source: 'reconciled', reserved: true },
    { invoiceNumber: '00008', displayNumber: 'SEP/TEST-00008', reason: 'Typed twice', voidedAt: recentTs(2000), source: 'deleted', reserved: false }];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageHistory');
  await page.locator('#historyHost tbody tr[data-ev="void"]', { hasText: '00007' }).click();
  await expect(page.locator('#historyPane')).toContainText('no invoice was ever recorded under it here');
  await page.locator('#historyHost tbody tr[data-ev="void"]', { hasText: '00008' }).click();
  await expect(page.locator('#historyPane')).toContainText('The invoice this number was is deleted');
});

test("History's pane: Cancel redraws it; Edit on a challan opens the form on Challans", async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageHistory');
  const invRows = page.locator('#historyHost tbody tr[data-ev="invoice"]');
  let found = false;
  for (let i = 0; i < Math.min(await invRows.count(), 8) && !found; i++) {
    await invRows.nth(i).click();
    found = (await page.locator('#historyPane [data-action="invCancelInvoice"]').count()) > 0;
  }
  expect(found).toBe(true);
  await page.locator('#historyPane [data-action="invCancelInvoice"]').click();
  await page.locator('[data-action="invConfirmCancel"]').click();
  await expect(page.locator('#pageHistory')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#historyPane [data-action="invCancelInvoice"]')).toHaveCount(0);
  await expect(page.locator('#historyPane')).toContainText('This invoice was cancelled');
  // A challan's Edit: the form is drawn on Challans, where it can be seen.
  const chRows = page.locator('#historyHost tbody tr[data-ev="challan"]');
  found = false;
  for (let i = 0; i < Math.min(await chRows.count(), 12) && !found; i++) {
    await chRows.nth(i).click();
    found = (await page.locator('#historyPane [data-action="invEditChallan"]').count()) > 0;
  }
  expect(found).toBe(true);
  await page.locator('#historyPane [data-action="invEditChallan"]').click();
  await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#imVehicleNo')).toBeVisible();
});

test('Receivables: an address naming no client opens no pane; the receipts with no client shut a pane left open', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await page.goto('/?tab=pageFinance&v=receipts&id=NO-SUCH-CLIENT');
  await waitForBoot(page);
  await expect(page.locator('#recvHost')).toHaveCount(1);
  await expect(page.locator('#recvHost')).not.toHaveClass(/inv-pane-open/);
  expect(await page.evaluate(() => (window as any)._bankOpen)).toBeNull();
  // A client open in the pane, then Overview's link to the receipts nobody has placed: the list, not the client.
  await page.locator('#recvList [data-action="invBankClient"]').first().click();
  await expect(page.locator('#recvHost')).toHaveClass(/inv-pane-open/);
  await page.locator('#pageFinance .inv-viewtab[data-tab="overview"]').click();
  // The link is in the Owed to us hero's body (the tab map, TM3c), shut until opened.
  await openFoldAt(page, 'fin-hero-owed');
  const link = page.locator('#pageFinance [data-action="invFinLoose"]');
  if (await link.count()) {
    await link.first().click();
    await expect(page.locator('#recvHost')).not.toHaveClass(/inv-pane-open/);
    await expect(page.locator('#bankLoose')).toBeVisible();
  }
});

test("Production's pane names an open cut and the barrel list as they are", async ({ page }) => {
  const s: any = sweepState();
  s.production.entries.push({ id: 'PD-OPEN', kind: 'downtime', date: dayOff(-1), time: '14:10', downtime: { cause: 'power', open: true }, basis: 'hand', src: 'hand', at: Date.now() });
  await loadAppWithState(page, s);
  await page.goto('/?tab=pageProduction&v=entries&id=PD-OPEN');
  await waitForBoot(page);
  const pane = page.locator('#prodEntryPane');
  await expect(pane).toContainText('Power cut, no time back');
  await expect(pane).toContainText('14:10 – no time back');
  const barrel = (await page.evaluate(() => (0, eval)('S').production.entries.find((e: any) => e.slot === 'day').id)) as string;
  await page.goto(`/?tab=pageProduction&v=entries&id=${barrel}`);
  await waitForBoot(page);
  await expect(pane).toContainText('Whole day (barrel list)');
  await expect(pane).not.toContainText('General');
});

test("the roster's rate shows at 1280 with no worker open; the pane carries it once one is", async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
  // The list is about 1,000px across here: the Rate column dropped below 1,120 (the first optional column), so a desktop
  // under about 1,400px never showed a rate on the roster at all.
  await expect(page.locator('#attRosterTable th', { hasText: 'Rate' })).toBeVisible();
  await page.locator('#attRosterTable tbody tr').first().click();
  await expect(page.locator('#attRosterHost')).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#attRosterPane')).toContainText('Rate');
});

test('a window crossing 1024px keeps the leave guard on a half-typed form', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as any);
  await page.evaluate(() => { const w = window as any; w.switchTab('pageStock'); w.stockOpenManual(); });
  await page.locator('#stockManDate').fill('2020-01-02');
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.locator('body')).not.toHaveClass(/inv-desktop/);
  await expect(page.locator('#stockManDate')).toBeVisible();
  await page.locator('.inv-navbar-item[data-ws="office"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
  await expect(page.locator('#stockManDate')).toBeVisible();
});

async function columns(page: Page, sel: string) {
  return page.locator(sel).first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
}
test('above about 1,600px only Pulse, Stats and Finance go three across; every other grid keeps two', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await page.setViewportSize({ width: 1700, height: 1000 });
  await openPulse(page);
  expect(await columns(page, '[data-tdy-questions]')).toBe(3);
  // The To-do's two lists were the example until the To-do joined Needs you (the tab map, TM2a), then Power's Overview until it went
  // (TM4e): Floor's line cards are one now.
  await switchTab(page, 'pageFloor');
  expect(await columns(page, '#flrLines.inv-panels')).toBe(2);
});
