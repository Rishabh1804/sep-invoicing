import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, switchTab } from './fixtures';

// P111: the shell's share of the QA sweep of 29 Sep 2026 — the frame every screen sits in.
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const dialogs = (p: Page) => p.locator('.inv-scrim-dialog');

test.describe('P111: Escape closes the top layer, the way Back does', () => {
  // Every dialog but a question ignored Escape: the click-through sweep found five dialogs stacked on the Register
  // with nothing a keyboard could do about them.
  test('a dialog showing something closes at once', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageRegister');
    await page.locator('.inv-page-active [data-action="invCnList"]').click();
    await expect(dialogs(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialogs(page)).toHaveCount(0);
  });

  test('a dialog holding typed work asks first, Keep editing keeps it', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('.inv-page-active [data-action="invAddClient"]').click();
    const field = page.locator('.inv-scrim-dialog input.inv-input').first();
    await field.fill('A NEW CLIENT');
    await page.keyboard.press('Escape');
    expect(await answerAsk(page, 'cancel')).toContain('Discard');
    await expect(field).toHaveValue('A NEW CLIENT');
    await page.keyboard.press('Escape');
    await answerAsk(page, 'ok');
    await expect(dialogs(page)).toHaveCount(0);
  });

  test('a question answers cancel, and the More sheet closes', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const ans = g(page, 'uiConfirm({ title: "Go on?" })');
    await expect(page.locator('[data-ui-ask]')).toBeVisible();
    // With focus outside the question (its own scrim answers Escape only from inside it).
    await g(page, 'document.activeElement && document.activeElement.blur()');
    await page.keyboard.press('Escape');
    expect(await ans).toBe(false);
    await page.locator('.inv-navbar-more').click();
    await expect(page.locator('#moreSheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#moreSheet')).toHaveCount(0);
  });

  test('an open suggestion list closes first, and the form under it stays', async ({ page }) => {
    // The challan form's client search lists active clients; emptyState's carry no isActive (as P12 sets it).
    const st = emptyState();
    st.clients = st.clients.map((c: any) => ({ ...c, isActive: true }));
    await loadAppWithState(page, st);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imChallanClientSearch').fill('TEST');
    const list = page.locator('#imChallanClientResults');
    await expect(list.locator('.inv-menu-item')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(page.locator('#imAddForm')).toBeVisible();
  });
});

test.describe('P111: one screen that cannot be drawn never bricks the app', () => {
  // The shell stays inert until the start finishes, and a launch reopens the screen last shown. The active screen
  // was remembered before it was drawn, so a screen that threw on some data reopened and threw at every launch.
  test('a challan with no lines array loads, and Home draws', async ({ page }) => {
    const st: any = emptyState();
    st.incomingMaterial = [{ id: 'IM-1', clientId: 1, clientName: 'TEST CLIENT KG', challanNo: '77', challanDate: '2026-09-01', status: 'pending' }];
    await loadAppWithState(page, st);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    expect(await g(page, 'Array.isArray(S.incomingMaterial[0].items)')).toBe(true);
    await expect(page.locator('.inv-notice-bar')).toHaveCount(0);
  });

  test('a screen that throws says so, and is not the one reopened', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageRegister');
    await g(page, 'window.renderStats = function() { throw new Error("drawing failed on purpose"); }');
    await g(page, 'switchTab("pageStats")');
    await expect(page.locator('.inv-notice-bar')).toContainText('Stats screen could not be drawn');
    // Remembered is the screen that drew, so a reload opens it rather than the one that threw.
    expect(await g(page, 'regFilter.activeTab')).toBe('pageRegister');
    await switchTab(page, 'pageClients');
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
  });
});
