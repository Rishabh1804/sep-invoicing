import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, type SepState } from './fixtures';
import { imState } from './im-fixture';

// P184 desktop: the tab map, step TM1 (docs/TAB_MAP.md §2, §1a-10, §3e). The rail's doors lead to the same rows as the phone's
// bar, History and Knowledge are the top bar's tools, the rail's mark asks before leaving typed work, and one look's pieces
// take the desktop's form: the verdict card open, the filters inline, More on the row as on the phone, a row's second action
// in the pane. Every name is made up.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const on = (p: Page) => g(p, `document.querySelector('.inv-page-active').id`) as Promise<string>;
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
const row = (p: Page) => p.locator('#wsTabs .inv-viewtab');
const own = (p: Page) => p.locator('.inv-page-active .inv-viewtabs:not(#wsTabs) .inv-viewtab:visible');
const rail = (p: Page, ws: string) => p.locator(`#invSidebar [data-ws="${ws}"]`);

const ROWS: Record<string, string[]> = {
  today: ['Needs you', 'Pulse', 'Stats', 'Reports', 'Planner'],
  office: ['Pipeline', 'Challans', 'Invoices', 'Clients', 'Sales'],
  floor: ['Overview', 'People', 'Production', 'Stock', 'Power'],
};
function book(): SepState { return { ...emptyState(), incomingMaterial: noSeedIM() } as SepState; }
async function drawTest(page: Page, html: string) {
  await page.evaluate(h => {
    const act = document.querySelector('.inv-page.inv-page-active')!;
    document.getElementById('p184')?.remove();
    const d = document.createElement('div');
    d.id = 'p184';
    d.innerHTML = h;
    act.prepend(d);
  }, html);
}

test.describe('P184: the tab map on the desktop', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

  test('the rail’s doors lead to the map’s rows; the top bar names the section and the view', async ({ page }) => {
    await loadAppWithState(page, book());
    for (const [ws, labels] of Object.entries(ROWS)) {
      await rail(page, ws).click();
      await expect(row(page)).toHaveText(labels);
      await expect(rail(page, ws)).toHaveAttribute('aria-current', 'true');
    }
    await rail(page, 'today').click();
    await row(page).filter({ hasText: /^Planner$/ }).click();
    await expect(page.locator('#pagePlanner')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#topbarTitle')).toHaveText('Today');
    await expect(page.locator('#topbarCtx')).toContainText('Planner');
    await rail(page, 'office').click();
    await row(page).filter({ hasText: /^Sales$/ }).click();
    await expect(own(page)).toHaveText(['Prospects', 'Quotations']);
    await expect(page.locator('#topbarCtx')).toContainText('Prospects');
    await own(page).filter({ hasText: 'Quotations' }).click();
    await expect(row(page).filter({ hasText: /^Sales$/ })).toHaveAttribute('aria-selected', 'true');
    await row(page).filter({ hasText: /^Clients$/ }).click();
    await expect(own(page)).toHaveText(['Clients', 'Parts', 'Performance']);
    await expect.poll(() => where(page)).toEqual(['pageClients', 'clients']);
  });

  test('History and Knowledge are the top bar’s: no door lit, no row; Ctrl+click opens History in a new window', async ({ page }) => {
    await loadAppWithState(page, book());
    const tools = page.locator('.inv-topbar .inv-btn-ghost:visible');
    expect(await tools.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.action))).toEqual(['invGoHistory', 'invKbHelp', 'invNewWindow']);
    await rail(page, 'money').click();
    await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').click();
    await expect(page.locator('#pageHistory')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#invSidebar [aria-current]')).toHaveCount(0);
    await expect(page.locator('#wsTabs')).toHaveClass(/inv-hidden/);
    await expect(page.locator('#topbarTitle')).toHaveText('History');
    await page.goBack();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(rail(page, 'money')).toHaveAttribute('aria-current', 'true');

    await page.evaluate(() => { const w: any = window; w.__opened = []; w.open = (u: string, t: string) => { w.__opened.push([u, t]); return {}; }; });
    await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').click({ modifiers: ['Control'] });
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    const opened = await page.evaluate(() => (window as any).__opened.map((x: string[]) => new URL(x[0], location.href).searchParams.get('tab')));
    expect(opened).toEqual(['pageHistory']);
  });

  test('the rail’s mark asks before leaving a typed challan', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imVehicleNo').fill('JH 05 1234');
    await page.locator('#invSidebar [data-action="invGoPulse"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    // And the History tool, the same.
    await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    await page.locator('#invSidebar [data-action="invGoPulse"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#homePulse:not(.inv-hidden)')).toBeVisible();
  });
});

test.describe('P184: one look’s pieces on the desktop', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

  test('the verdict card is open on the desktop; the filters are inline with no tokens; More is on the row as on the phone', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const html = await g(page, `uiVerdictHtml({ screen: 'Test', verdict: '3 rows need you', tone: 'danger', key: 'p184d',
      factors: [{ label: 'Late', fig: '2', tone: 'danger' }] }) +
      '<div class="inv-toolbar">' + uiFilterHtml({ key: 'p184', count: 1, controls: '<select class="inv-select" id="p184Sel"><option>All</option></select>' }) +
      uiToolbarMoreHtml([{ label: 'Export', action: 'invSearchOpen', badge: { n: 1, tone: 'info' } }]) + '</div>' +
      uiTokensHtml([{ key: 'Client', value: 'ALPHA', action: 'invP184Clear' }]) + uiRowMoreHtml(['<button class="inv-btn">Void</button>'])`) as string;
    await drawTest(page, html);
    const v = page.locator('#p184 [data-verdict]');
    expect(await v.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(v.locator('.inv-tile')).toBeVisible();
    // Inline: the control itself on the row, no Filter button, no tokens; a row's second action is the pane's.
    await expect(page.locator('#p184 .inv-toolbar > #p184Sel')).toBeVisible();
    await expect(page.locator('#p184 [data-action="invTbFilter"], #p184 .inv-tokens, #p184 [data-row-more]')).toHaveCount(0);
    // More, the same on both layouts (§1a-10): a dialog centred, its pick acting after it shuts.
    await page.locator('#p184 [data-action="invTbMore"]').click();
    const dlg = page.locator('[data-tb-more-dialog]');
    await expect(dlg).toBeVisible();
    await dlg.locator('[data-tb-pick]').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('.inv-dialog-palette')).toBeVisible();
  });

  test('every page declares its kind on the desktop too; an article read in the pane is a work screen', async ({ page }) => {
    await loadAppWithState(page, book());
    const pages: string[] = await g(page, `Array.from(document.querySelectorAll('.inv-page')).map(function (p) { return p.id; })`) as string[];
    for (const id of pages) {
      await g(page, `switchTab(${JSON.stringify(id)})`);
      await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
      const kind = await page.locator(`#${id}`).getAttribute('data-screen');
      expect(['overview', 'work', 'document', 'form'], id).toContain(kind);
      expect(kind, id).toBe(await g(page, `screenKindOf(navLoc())`));
    }
    expect(await g(page, `screenKindOf({ tab: 'pageKnow', v: 'library', id: 'KB-1' })`)).toBe('work');
    expect(await g(page, `screenKindOf({ tab: 'pagePower', v: 'case', id: '' })`)).toBe('document');
    expect(await g(page, `screenKindOf({ tab: 'pageProduction', v: 'entries/hand', id: '' })`)).toBe('form');
    expect(await on(page)).toBeTruthy();
  });
});
