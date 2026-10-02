import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { openSearch, search, searchBook, titles } from './p139-search.fixture';
import { pipeState } from './p137-pipeline.fixture';
import { floorBook, openFloor } from './p138-floor-day.fixture';

// P151 on the desktop (the QA chain of 2 Oct 2026): a worker found by search opens in People → Roster's pane (QA3-6); a
// Ctrl+click or a middle click on Direction B's doors opens their place in a new window and leaves this one where it was:
// Today's Pulse (QA3-7), Pipeline's stages, its challans and what is owed, a Floor → Day card (QA3-8); a To-do jump into
// Receivables or Production's entries shows what it names, not a pane left open before (QA1-6). window.open is stubbed: the
// spec reads what it was asked to open. Every name and figure is made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '', u.searchParams.get('id') || '']; };
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

test.describe('P151 on the desktop', () => {
  test('QA3-6: a worker from search opens in People → Roster\'s pane, not Edit worker', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    await search(page, 'ramu');
    expect(await titles(page, 'worker')).toEqual(['Ramu Kumar']);
    await page.keyboard.press('Enter');
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#attRosterHost')).toHaveClass(/inv-pane-open/);
    await expect(page.locator('#attRosterPane [data-worker-pane="1"]')).toBeVisible();
    await expect(page.locator('#attRosterTable tr[data-id="1"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await expect.poll(() => where(page)).toEqual(['pageStaff', 'roster', '1']);
    // A step of its own: back leaves it.
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  });

  test('QA3-7: Ctrl+click Pulse, in the sidebar or the tab row, opens Pulse in a new window', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await stubOpen(page);
    await page.locator('#invSidebar [data-action="invSwitchTab"][data-tab="pageHome"][data-v="pulse"]').click({ modifiers: ['Control'] });
    await page.locator('#wsTabs [data-tab="pageHome"][data-v="pulse"]').click({ button: 'middle' });
    await page.locator('#wsTabs [data-tab="pageHome"][data-v="needs"]').click({ modifiers: ['Control'] });
    expect(await opened(page)).toEqual([['pageHome', 'pulse', '', '_blank'], ['pageHome', 'pulse', '', '_blank'], ['pageHome', 'needs', '', '_blank']]);
    await expect(page.locator('#wsTabs [data-v="needs"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('QA3-8: Pipeline\'s stages, challans and debtors open in a new window, and this one stays', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await switchTab(page, 'pagePipeline');
    await stubOpen(page);
    const stage = (k: string) => page.locator(`#pagePipeline button[data-pipe-stage="${k}"]`);
    await expect(stage('created')).toHaveAttribute('aria-pressed', 'true');
    await stage('dispatched').click({ modifiers: ['Control'] });
    await stage('delivered').click({ button: 'middle' });
    await expect(stage('created')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#pipeList [data-pipe-list="created"]')).toBeVisible();
    // Awaiting's challans: the challan on its tab, this window still on the Pipeline.
    await stage('awaiting').click();
    await page.locator('#pipeList [data-action="invPipeChallan"][data-id="IM-1"]').click({ modifiers: ['Control'] });
    await page.locator('#pipeList [data-action="invPipeChallan"][data-id="IM-3"]').click({ button: 'middle' });
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    // Owed to us: a client's receivables, and the list's own link.
    await stage('owed').click();
    await page.locator('#pipeList [data-pipe-owed="3"]').click({ modifiers: ['Control'] });
    await page.locator('#pipeList .inv-panel-head [data-action="invFinGo"]').click({ modifiers: ['Control'] });
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    expect(await opened(page)).toEqual([
      ['pagePipeline', 'dispatched', '', '_blank'], ['pagePipeline', 'delivered', '', '_blank'],
      ['pageIM', 'awaiting', 'IM-1', '_blank'], ['pageIM', 'awaiting', 'IM-3', '_blank'],
      ['pageFinance', 'receipts', '3', '_blank'], ['pageFinance', 'receipts', '', '_blank'],
    ]);
  });

  test('QA3-8: a Floor → Day card, tile or staffing word opens its screen in a new window; Floor stays', async ({ page }) => {
    await loadAppWithState(page, floorBook());
    await openFloor(page);
    await stubOpen(page);
    await page.locator('#flrLines [data-line="vat-a1"] [data-action="invFlrLine"]').click({ modifiers: ['Control'] });
    await page.locator('#flrTiles [data-flr-tile="power"]').click({ button: 'middle' });
    await page.locator('#flrLines [data-line="vat-a1"] [data-flr-staff]').click({ modifiers: ['Control'] });
    await page.locator('#flrLines [data-line="vat-a2"] [data-flr-extra]').click({ modifiers: ['Control'] });
    await expect(page.locator('#pageFloor')).toHaveClass(/inv-page-active/);
    expect(await opened(page)).toEqual([
      ['pageProduction', 'lines', '', '_blank'], ['pagePower', 'cuts', '', '_blank'],
      ['pageStaff', 'day', '', '_blank'], ['pageStaff', 'areas', '', '_blank'],
    ]);
  });

  test('QA1-6: a To-do jump into Receivables or Production\'s entries shuts a pane left open, and the address follows', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await g(page, `navOpen({ tab: 'pageFinance', v: 'receipts', id: '3' })`);
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'receipts', '3']);
    await g(page, `todoGo({ kind: 'finance', tab: 'receipts', anchor: 'bankLoose' }); navSoon()`);   // a tap's step, taken after it
    expect(await g(page, '_bankOpen')).toBeNull();
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'receipts', '']);
    // A jump naming a client opens it.
    await g(page, `todoGo({ kind: 'finance', tab: 'receipts', client: 2 }); navSoon()`);
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'receipts', '2']);

    await loadAppWithState(page, floorBook());
    await g(page, `navOpen({ tab: 'pageProduction', v: 'entries', id: 'R1' })`);
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'entries', 'R1']);
    await g(page, `todoGo({ kind: 'production', tab: 'entries', flag: 'noclient' }); navSoon()`);
    expect(await g(page, '_prodEntryOpen')).toBeNull();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'entries', '']);
  });
});
