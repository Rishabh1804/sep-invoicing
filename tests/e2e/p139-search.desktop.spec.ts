import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { openSearch, search, searchBook, titles } from './p139-search.fixture';

// P139 on the desktop: the keys (UX overhaul 2, step 5) and new windows (step 3). Ctrl K or / searches, N a new invoice,
// C a new challan, G then a letter jumps, J and K walk a list's rows and Enter opens one, Esc shuts the pane, ? lists them;
// none fires from a field being typed in or over a dialog. Ctrl+click or a middle click on a sidebar item, a view tab or a
// row opens that place's address in a new window (window.open is stubbed: the spec reads what it was asked to open).

const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '', u.searchParams.get('id') || '']; };

/* The Register shows the current month until told otherwise: every month, as the operator clears the month filter (the book's
   invoices are dated from yesterday back, which on the 1st is last month). */
async function allMonths(page: Page) {
  await page.locator('#regMonthFilter').fill('');
  await expect(page.locator('#regMonthFilter')).toHaveValue('');
}

/* window.open, stubbed: every address the app asks for, in order. */
async function stubOpen(page: Page) {
  await page.evaluate(() => {
    const w: any = window;
    w.__opened = [];
    w.open = (url: string, target: string) => { w.__opened.push([url, target]); return {}; };
  });
}
const opened = (page: Page) => page.evaluate(() => (window as any).__opened.map((x: string[]) => {
  const u = new URL(x[0], location.href);
  return [u.searchParams.get('tab'), u.searchParams.get('v') || '', u.searchParams.get('id') || '', x[1]];
}));

test.describe('P139: keys and new windows on the desktop', () => {
  test('Ctrl K and / open search, never from a field being typed in; Ctrl K from the field the app put the cursor in', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-search]')).toBeVisible();
    await expect(page.locator('#srchInput')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await page.keyboard.press('/');
    await expect(page.locator('[data-search]')).toBeVisible();
    // / typed in the search itself is a slash, and Ctrl K there opens nothing more.
    await page.keyboard.type('sep/test');
    await expect(page.locator('#srchInput')).toHaveValue('sep/test');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-search]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    // Register's search, typed in: / is a character and Ctrl K is not search's.
    await switchTab(page, 'pageRegister');
    const field = page.locator('#pageRegister .inv-search input').first();
    await field.click();
    await field.pressSequentially('x/');
    await expect(field).toHaveValue('x/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    // Arriving on a screen whose first control is a search, the app puts the cursor in it: Ctrl K, which types nothing, still
    // searches from there while it is empty; / is the field's.
    await field.fill('');
    await switchTab(page, 'pageHistory');
    await switchTab(page, 'pageRegister');
    await expect(field).toBeFocused();
    await page.keyboard.press('/');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await expect(field).toHaveValue('/');
    await field.fill('');
    await switchTab(page, 'pageHistory');
    await switchTab(page, 'pageRegister');
    await expect(field).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-search]')).toBeVisible();
  });

  test('G then a letter jumps, as a step; N is a new invoice and C a new challan; ? lists every key', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('g');
    await page.keyboard.press('r');
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect.poll(() => where(page)[0]).toBe('pageRegister');
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('g');
    await page.keyboard.press('c');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect.poll(() => where(page)).toEqual(['pageIM', 'awaiting', '']);
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('g');
    await page.keyboard.press('m');
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    // Office opens on its first screen this build holds (Pipeline once B5 lands; Challans until then).
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('g');
    await page.keyboard.press('o');
    await expect(page.locator('#pagePipeline.inv-page-active, #pageIM.inv-page-active')).toHaveCount(1);
    // Each jump was a step: back walks them.
    await page.goBack();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    // G and a letter that names nothing, or G alone, does nothing.
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('g');
    await page.keyboard.press('z');
    await page.keyboard.press('r');
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    // N: a new invoice. C: a new challan, its form open.
    await page.keyboard.press('n');
    await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/);
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('c');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imAddForm')).not.toBeEmpty();
    // ?: every key, as rows; Esc closes it. Over a dialog no key fires.
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('?');
    const keys = page.locator('[data-keys-list]');
    await expect(keys).toBeVisible();
    await expect(keys).toContainText('Ctrl K');
    await expect(keys).toContainText('Invoices');
    await expect(keys.locator('.inv-row')).toHaveCount(22);
    await page.keyboard.press('g');
    await page.keyboard.press('r');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await page.keyboard.press('Escape');
    await expect(keys).toHaveCount(0);
  });

  test('J and K walk the rows of Invoices, Enter opens one in the pane, Esc shuts the pane', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await switchTab(page, 'pageRegister');
    await allMonths(page);
    await page.locator('#topbarTitle').click();
    const rows = page.locator('#pageRegister tbody button[data-action="invSelectRegRow"]');
    await expect(rows).toHaveCount(4);
    await page.keyboard.press('j');
    await expect(rows.nth(0)).toBeFocused();
    await page.keyboard.press('j');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('k');
    await expect(rows.nth(0)).toBeFocused();
    const first = await rows.nth(0).getAttribute('data-id');
    await page.keyboard.press('Enter');
    await expect(page.locator('#regMasterDetail')).toHaveClass(/inv-pane-open/);
    await expect.poll(() => where(page)[2]).toBe(first);
    // The pane redraws the list and the cursor stays on the row: J goes on from it.
    await page.keyboard.press('j');
    await expect(page.locator(`#pageRegister tbody button[data-action="invSelectRegRow"]`).nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#regMasterDetail')).not.toHaveClass(/inv-pane-open/);
    // Challans: the same keys.
    await switchTab(page, 'pageIM');
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('j');
    await expect(page.locator('#pageIM tbody button[data-action="invSelectIMRow"]').first()).toBeFocused();
  });

  test('search on the desktop: an invoice opens in the Register\'s pane; Ctrl+Enter or Ctrl+click opens a result in a new window', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await stubOpen(page);
    await openSearch(page);
    await search(page, '834');
    expect((await titles(page, 'invoice'))[0]).toBe('SEP/TEST-00834');
    // Ctrl+click: the place in a new window, and search stays open here.
    await page.locator('#srchList [aria-labelledby="srchG-challan"] [role="option"]').click({ modifiers: ['Control'] });
    await expect(page.locator('[data-search]')).toBeVisible();
    // Ctrl+Enter on the cursor (the invoice): the same.
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('[data-search]')).toBeVisible();
    expect(await opened(page)).toEqual([['pageIM', 'awaiting', 'IM-834', '_blank'], ['pageRegister', '', 'INV-834', '_blank']]);
    await page.keyboard.press('Enter');
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#regMasterDetail')).toHaveClass(/inv-pane-open/);
    await expect.poll(() => where(page)).toEqual(['pageRegister', '', 'INV-834']);
  });

  test('Ctrl+click or a middle click on a sidebar item, a view tab or a row opens it in a new window, and nothing moves here', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await stubOpen(page);
    // The sidebar: a page, and Items and Pay on their view.
    await page.locator('#invSidebar [data-tab="pageRegister"]').click({ modifiers: ['Control'] });
    await page.locator('#invSidebar [data-tab="pageClients"][data-sub="items"]').click({ button: 'middle' });
    await page.locator('#invSidebar [data-tab="pageStaff"][data-sub="pay"]').click({ modifiers: ['Control'] });
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    // A view tab: its page at that view.
    await switchTab(page, 'pageStats');
    await page.locator('[data-action="invStatsTab"][data-tab="cost"]').click({ modifiers: ['Control'] });
    await expect(page.locator('[data-action="invStatsTab"][data-tab="overview"]')).toHaveAttribute('aria-selected', 'true');
    // A row: its record. A challan on its tab and month.
    await switchTab(page, 'pageRegister');
    await allMonths(page);
    await page.locator('#pageRegister tbody tr[data-id="INV-900"] td').nth(2).click({ button: 'middle' });
    await expect(page.locator('#regMasterDetail')).not.toHaveClass(/inv-pane-open/);
    await switchTab(page, 'pageIM');
    await page.locator('#pageIM tbody button[data-action="invSelectIMRow"][data-id="IM-8341"]').click({ modifiers: ['Control'] });
    // The top bar's New window: the place on screen.
    await page.locator('.inv-topbar [data-action="invNewWindow"]').click();
    expect(await opened(page)).toEqual([
      ['pageRegister', '', '', '_blank'], ['pageClients', 'items', '', '_blank'], ['pageStaff', 'pay', '', '_blank'],
      ['pageStats', 'cost', '', '_blank'], ['pageRegister', '', 'INV-900', '_blank'], ['pageIM', 'awaiting', 'IM-8341', '_blank'],
      ['pageIM', 'awaiting', '', '_blank'],
    ]);
    // A plain click still does what it always did.
    await page.locator('#invSidebar [data-tab="pageRegister"]').click();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  });

  test('the New window button is the desktop\'s, and a refused window is said in the app', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await expect(page.locator('.inv-topbar [data-action="invNewWindow"]')).toBeVisible();
    await page.evaluate(() => { (window as any).open = () => null; });
    await page.locator('.inv-topbar [data-action="invNewWindow"]').click();
    await expect(page.locator('.inv-toast')).toContainText('did not open a new window');
  });
});
