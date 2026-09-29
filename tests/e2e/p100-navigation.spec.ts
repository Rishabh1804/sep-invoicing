import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, openSettingsAt, switchTab, waitForBoot } from './fixtures';
import { imState } from './im-fixture';

// P100: navigation (UX overhaul 2, step 1; owner, 28 Sep 2026: "Backspace goes back through the screens visited, with a
// trail on screen"). Every screen, view tab and record has an address, every move is a step in the browser's history,
// so the browser's back, the phone's back gesture, Backspace and the top bar's arrow walk one trail. A dialog is a layer
// that back closes; a form holding unsaved work asks before back leaves it. Swiping reaches Finance.

const url = (p: Page) => new URL(p.url());
const where = (p: Page) => { const u = url(p); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };

test.describe('P100: navigation on the phone', () => {
  test('each screen and view tab is a step: back and forward walk them, the address follows', async ({ page }) => {
    await loadAppWithState(page, imState());
    expect(where(page)).toEqual(['pageHome', '']);
    await expect(page.locator('#navBack')).toBeHidden();
    await switchTab(page, 'pageIM');
    await expect.poll(() => where(page)).toEqual(['pageIM', 'awaiting']);
    await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
    await expect.poll(() => where(page)[1]).toMatch(/^invoiced\/\d{4}-\d{2}$/);
    await expect(page.locator('#navBack')).toBeVisible();

    await page.goBack();
    await expect(page.locator('[data-action="invIMTab"][data-tab="awaiting"]')).toHaveAttribute('aria-selected', 'true');
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await page.goForward();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    expect(where(page)).toEqual(['pageIM', 'awaiting']);
    // The top bar's arrow is the same step.
    await page.locator('#navBack').click();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    // A filter is not a place.
    await switchTab(page, 'pageIM');
    await page.locator('#imStatusFilter').selectOption('pending');
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
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
    // Closed by its own button, the dialog's step is passed over: one back reaches Home.
    await page.locator('[data-action="invShowAddClient"], [data-action="invAddClient"]').first().click();
    await page.locator('.inv-scrim-dialog [data-action="invCloseOverlay"], .inv-scrim-dialog .inv-dialog-close').first().click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
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
    await expect(page.locator('[data-action="invStatsTab"][data-tab="overview"][aria-selected="true"]')).toHaveCount(1);
    await switchTab(page, 'pageRegister');
    const search = page.locator('#pageRegister input[type="search"], #pageRegister .inv-search input').first();
    await search.fill('x');
    await search.press('Backspace');
    await expect(search).toHaveValue('');
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  });

  test('swiping walks the phone bar and then More in its order, Finance included', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageTodo');
    const swipeLeft = () => page.evaluate(() => {
      const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
      document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)] }));
      document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(100)] }));
    });
    await swipeLeft();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await swipeLeft();
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
  });
});
