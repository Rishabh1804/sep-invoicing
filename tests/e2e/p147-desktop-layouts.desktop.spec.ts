import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, openPulse, switchTab, waitForBoot } from './fixtures';
import { sweepState } from './sweep-fixture';

// P147 (desktop): UX overhaul 2, step 7. Four more screens are a list beside the open record (Finance → Receivables,
// Production → Entries, Staff → Roster, History), each with an address a reload and Back follow; and above about 1,600px
// Home's Pulse, Stats and Finance lay their panels three across, never leaving a blank cell in a strip of tiles.

async function openFinanceTab(page: Page, tab: string) {
  await switchTab(page, 'pageFinance');
  await page.locator(`#pageFinance .inv-viewtab[data-tab="${tab}"]`).click();
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

test('Receivables: a client opens in the pane, not under its row, and the address keeps it', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openFinanceTab(page, 'receipts');
  await expect(page.locator('#recvHost')).toHaveCount(1);
  await expect(page.locator('#recvHost')).not.toHaveClass(/inv-pane-open/);
  const row = page.locator('#recvList [data-recv]').first();
  const id = await row.getAttribute('data-recv');
  await row.locator('[data-action="invBankClient"]').click();
  await expect(page.locator('#recvHost')).toHaveClass(/inv-pane-open/);
  await expect(page.locator(`#recvPane [data-recv-pane="${id}"]`)).toBeVisible();
  await expect(page.locator('#recvPane [data-open-inv]').first()).toBeVisible();
  // The detail is in the pane only: nothing expands under the row, and the row is the current one.
  await expect(page.locator('#recvList .inv-row-children[data-recv], #recvList [data-open-inv]')).toHaveCount(0);
  await expect(row).toHaveAttribute('aria-current', 'true');
  expect(page.url()).toContain(`v=receipts&id=${id}`);
  await page.reload(); await waitForBoot(page);
  await expect(page.locator(`#recvPane [data-recv-pane="${id}"]`)).toBeVisible();
  // Back is the step before the client was opened: the pane shuts and the tab stays.
  await page.goBack();
  await expect(page.locator('#recvHost')).not.toHaveClass(/inv-pane-open/);
  await page.locator('#recvList [data-action="invBankClient"]').first().click();
  await page.locator('#recvPane [data-action="invBankPaneClose"]').click();
  await expect(page.locator('#recvHost')).not.toHaveClass(/inv-pane-open/);
});

test('Production → Entries: an entry opens in the pane with what it holds and what can be done to it', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction .inv-viewtab[data-tab="entries"]').click();
  // The chips stay above the list and the pane, not inside the list's scroller.
  await expect(page.locator('#prodEntriesHost [data-action="invProdFilter"]')).toHaveCount(0);
  // The list's own rows (the loads with the line unknown head the column above it, with their own moves, TM4c).
  const row = page.locator('#prodEntries [data-prod-entry]').first();
  const id = await row.getAttribute('data-prod-entry');
  await row.locator('[data-action="invProdEntryOpen"]').click();
  const pane = page.locator(`#prodEntryPane [data-prod-pane="${id}"]`);
  await expect(pane).toBeVisible();
  await expect(pane.locator('.inv-kv-k').first()).toHaveText('Kind');
  await expect(page.locator(`#prodEntryPane [data-action="invProdVoid"][data-id="${id}"]`)).toBeVisible();
  // A placeholder stamp (the sweep book's at: 1) is not shown as an entry time.
  await expect(page.locator('#prodEntryPane')).not.toContainText('1970');
  expect(page.url()).toContain(`v=entries&id=${id}`);
  await page.reload(); await waitForBoot(page);
  await expect(page.locator(`#prodEntryPane [data-prod-pane="${id}"]`)).toBeVisible();
  await page.locator('#prodEntryPane [data-action="invProdEntryClose"]').click();
  await expect(page.locator('#prodEntriesHost')).not.toHaveClass(/inv-pane-open/);
});

test('Staff → Roster: a worker opens in the pane; a role that may not see wages sees no rate', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
  await expect(page.locator('#attRosterTable thead')).toContainText('Rate');
  const row = page.locator('#attRosterTable tbody tr').first();
  const id = await row.getAttribute('data-id');
  await row.click();
  const pane = page.locator(`#attRosterPane [data-worker-pane="${id}"]`);
  await expect(pane).toBeVisible();
  await expect(pane).toContainText('Rate');
  await expect(page.locator('#attRosterPane')).toContainText('The last 28 days');
  expect(page.url()).toContain(`v=roster&id=${id}`);
  // Edit still opens the worker's sheet.
  await page.locator('#attRosterPane [data-action="invAttEditWorker"]').click();
  await expect(page.locator('.inv-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.inv-dialog')).toHaveCount(0);
  // Without the wages, neither the table nor the pane carries a rate (the guard's "wages" setting).
  await page.evaluate(() => { (window as any).grdSeesWages = () => false; (window as any).renderAttendance(); });
  await expect(page.locator('#attRosterTable thead')).not.toContainText('Rate');
  await expect(page.locator(`#attRosterPane [data-worker-pane="${id}"]`)).not.toContainText('Rate');
});

test('History: an event opens in the pane with the invoice it names, and the way to it', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageHistory');
  const row = page.locator('#historyHost tbody tr[data-ev="invoice"]').first();
  await row.click();
  await expect(page.locator('#historyPane [data-history-pane="invoice"]')).toBeVisible();
  await expect(page.locator('#historyPane [data-action="invHistoryJumpInvoice"]')).toBeVisible();
  await expect(row).toHaveAttribute('aria-current', 'true');
  const key = await row.getAttribute('data-key');
  expect(page.url()).toContain(`id=${key}`);
  // Ctrl+click opens the event in a new window at the same address (search.js reads the row's action).
  expect(await row.evaluate(el => (window as any).srchLocOf(el))).toEqual({ tab: 'pageHistory', v: '', id: key });
  await page.reload(); await waitForBoot(page);
  await expect(page.locator('#historyPane [data-history-pane="invoice"]')).toBeVisible();
  // An event naming no record (a void) opens too, and says where its record went.
  const voidRow = page.locator('#historyHost tbody tr[data-ev="void"]').first();
  if (await voidRow.count()) {
    await voidRow.click();
    await expect(page.locator('#historyPane [data-history-pane="void"]')).toBeVisible();
  }
  // The way to the invoice still goes to Invoices with it open.
  await row.click();
  if (!(await page.locator('#historyHost').getAttribute('class'))!.includes('inv-pane-open')) await row.click();
  await page.locator('#historyPane [data-action="invHistoryJumpInvoice"]').click();
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#regMasterDetail')).toHaveClass(/inv-pane-open/);
});

async function columns(page: Page, sel: string) {
  return page.locator(sel).first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
}
// A strip of tiles in a grid panel ends flush with the strip: an odd last tile takes the row rather than leave a blank cell.
// Measured to the strip's content edge: a strip in a flush panel keeps the panel's padding round its raised tiles (8 Oct 2026).
async function blankCells(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll('.inv-page-active .inv-panels > * .inv-tiles').forEach(t => {
      const tiles = Array.from(t.children) as HTMLElement[];
      if (tiles.length < 2) return;
      const cs = getComputedStyle(t as HTMLElement);
      const box = (t as HTMLElement).getBoundingClientRect(), last = tiles[tiles.length - 1].getBoundingClientRect();
      const right = box.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
      if (last.top > tiles[0].getBoundingClientRect().top + 1 && right - last.right > 4) bad.push((t.closest('[data-card], [id], [data-home-w]') as HTMLElement | null)?.outerHTML.slice(0, 80) || '?');
    });
    return bad;
  });
}

test('above about 1,600px Stats, Finance and Pulse take three columns, at 1280 two, with no blank tile cell', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageStats');
  expect(await columns(page, '#pageStats .inv-panels')).toBe(2);
  await page.setViewportSize({ width: 1700, height: 1000 });
  expect(await columns(page, '#pageStats .inv-panels')).toBe(3);
  expect(await blankCells(page)).toEqual([]);
  await openFinanceTab(page, 'overview');
  expect(await columns(page, '#pageFinance .inv-panels')).toBe(3);
  expect(await blankCells(page)).toEqual([]);
  await openPulse(page);
  await expect(page.locator('#homeWidgets')).toBeVisible();
  expect(await columns(page, '#homeWidgets')).toBe(3);
  expect(await blankCells(page)).toEqual([]);
  // A wide panel still spans the row.
  const wide = page.locator('#pageHome .inv-panels > .inv-panels-wide').first();
  if (await wide.count()) {
    const [w, g] = await Promise.all([wide.evaluate(e => e.getBoundingClientRect().width), wide.evaluate(e => e.parentElement!.getBoundingClientRect().width)]);
    expect(Math.abs(w - g)).toBeLessThan(2);
  }
});
