import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, openSettingsAt, switchTab, waitForBoot, setFilter } from './fixtures';
import { imState } from './im-fixture';

// P100: navigation (UX overhaul 2, step 1; owner, 28 Sep 2026: "Backspace goes back through the screens visited, with a
// trail on screen"). Every screen, view tab and record has an address, every move is a step in the browser's history,
// so the browser's back, the phone's back gesture, Backspace and the top bar's arrow walk one trail. A dialog is a layer
// that back closes; a form holding unsaved work asks before back leaves it. Swiping walks the open workspace's views.

const url = (p: Page) => new URL(p.url());
const where = (p: Page) => { const u = url(p); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };

test.describe('P100: navigation on the phone', () => {
  test('each screen and view tab is a step: back and forward walk them, the address follows', async ({ page }) => {
    await loadAppWithState(page, imState());
    expect(where(page)).toEqual(['pageHome', 'needs']);
    await expect(page.locator('#navBack')).toBeHidden();
    // Office is a step of its own (its first view), then Challans in its tab row.
    await switchTab(page, 'pagePipeline');
    const office = where(page);
    await page.locator('#wsTabs [data-tab="pageIM"]').click();
    await expect.poll(() => where(page)).toEqual(['pageIM', 'awaiting']);
    await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
    await expect.poll(() => where(page)[1]).toMatch(/^invoiced\/\d{4}-\d{2}$/);
    await expect(page.locator('#navBack')).toBeVisible();

    await page.goBack();
    await expect(page.locator('[data-action="invIMTab"][data-tab="awaiting"]')).toHaveAttribute('aria-selected', 'true');
    await page.goBack();
    await expect.poll(() => where(page)).toEqual(office);
    await page.goForward();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    expect(where(page)).toEqual(['pageIM', 'awaiting']);
    // The top bar's arrow is the same step.
    await page.locator('#navBack').click();
    await expect.poll(() => where(page)).toEqual(office);
    // A filter is not a place.
    await page.locator('#wsTabs [data-tab="pageIM"]').click();
    // Under Filter on the phone (the tab map, TM5b): the dialog is a layer, and back passes over it once shut.
    await setFilter(page, '#imStatusFilter', 'pending');
    await page.goBack();
    await expect.poll(() => where(page)).toEqual(office);
  });

  test('an address opens its screen and view, and a reload stays there', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.goto('/?tab=pageFinance&v=gst');
    await waitForBoot(page);
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invFinTab"][data-tab="gst"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'bank']);
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('[data-action="invFinTab"][data-tab="bank"]')).toHaveAttribute('aria-selected', 'true');
    // The trail survives the reload: back still reaches GST.
    await page.goBack();
    await expect(page.locator('[data-action="invFinTab"][data-tab="gst"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('back closes a dialog and stays on the screen; a dialog holding typed work asks first', async ({ page }) => {
    await loadAppWithState(page, imState());
    // Challans, then Clients from Office's tab row: one step between them.
    await switchTab(page, 'pageIM');
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invShowAddClient"], [data-action="invAddClient"]').first().click();
    const dlg = page.locator('.inv-scrim-dialog');
    await expect(dlg).toHaveCount(1);
    await page.goBack();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);

    await page.locator('[data-action="invShowAddClient"], [data-action="invAddClient"]').first().click();
    await page.locator('.inv-scrim-dialog input').first().fill('Typed name');
    await page.goBack();
    await answerAsk(page, 'cancel');          // Keep editing
    await expect(page.locator('.inv-scrim-dialog input').first()).toHaveValue('Typed name');
    await page.goBack();
    await answerAsk(page, 'ok');              // Discard
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
    // Closed by its own button, the dialog's step is passed over: one back reaches the screen before (Challans).
    await page.locator('[data-action="invShowAddClient"], [data-action="invAddClient"]').first().click();
    await page.locator('.inv-scrim-dialog [data-action="invCloseOverlay"], .inv-scrim-dialog .inv-dialog-close').first().click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  });

  test('back on Settings asks in its own words about a section not saved', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await openSettingsAt(page, 'company');
    await page.locator('#setCompName').fill('Another name');
    await page.goBack();
    expect(await answerAsk(page, 'cancel')).toContain('Close without saving?');
    await expect(page.locator('#settingsScrim')).toHaveCount(1);
    await page.goBack();
    await answerAsk(page, 'ok');
    await expect(page.locator('#settingsScrim')).toHaveCount(0);
  });

  test('a form with unsaved work asks before back leaves it', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await expect.poll(() => where(page)).toEqual(['pageIM', 'form']);
    await page.locator('#imVehicleNo').fill('JH 05 1234');
    await page.goBack();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#imAddForm')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageIM', 'form']);
    await page.goBack();
    await answerAsk(page, 'ok');
    await expect(page.locator('#imAddForm')).toBeEmpty();
    expect(where(page)).toEqual(['pageIM', 'awaiting']);
  });

  test('Backspace goes back, but never from a field', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageStats');
    await page.locator('[data-action="invStatsTab"][data-tab="cost"]').click();
    await expect.poll(() => where(page)).toEqual(['pageStats', 'cost']);
    await page.locator('#topbarTitle').click();
    await page.keyboard.press('Backspace');
    // Back to the tab Stats opened on (By client since the tab map, TM2b).
    await expect(page.locator('[data-action="invStatsTab"][data-tab="clients"][aria-selected="true"]')).toHaveCount(1);
    await switchTab(page, 'pageRegister');
    const search = page.locator('#pageRegister input[type="search"], #pageRegister .inv-search input').first();
    await search.fill('x');
    await search.press('Backspace');
    await expect(search).toHaveValue('');
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  });

  test("swiping walks the open workspace's views in its tab row's order, and never crosses to another", async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const swipe = (from: number, to: number) => page.evaluate(([a, b]) => {
      const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
      document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], changedTouches: [t(a)] }));
      document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(b)] }));
    }, [from, to]);
    // Floor's views as its tab row lists them (Day joins them where its page is built).
    const floor: string[] = await page.evaluate(() => (window as any).wsViewsPresent('floor').map((v: any) => v.tab));
    expect(floor.slice(-4)).toEqual(['pageStaff', 'pageProduction', 'pageStock', 'pagePower']);
    await switchTab(page, floor[0]);
    for (const id of floor.slice(1)) {
      await swipe(300, 100);
      await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
    }
    // Past the last view nothing moves: Money is another workspace.
    await swipe(300, 100);
    await page.waitForTimeout(150);
    await expect(page.locator('#pagePower')).toHaveClass(/inv-page-active/);
    await swipe(100, 300);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    // Money has one view: a swipe there goes nowhere.
    await switchTab(page, 'pageFinance');
    await swipe(300, 100);
    await swipe(100, 300);
    await page.waitForTimeout(150);
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  });
});
