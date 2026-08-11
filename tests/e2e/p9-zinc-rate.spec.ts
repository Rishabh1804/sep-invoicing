import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P9 assertion: the zinc rate is stored, shown with its age, and refreshable
// from metals.dev with a key the user supplies.
//
// The security property gets a test of its own: the key lives in its own
// localStorage entry, never on the state object, so an exported backup cannot
// carry a credential.

const METALS_KEY = 'sep_inv_metals_key';

function stateWithZinc(
  ratePerKg: number | null, premiumPerKg = 15, updatedAt: number | null = null,
  basis: 'manual' | 'lme' | 'mcx' = 'manual', upliftPct = 10.5,
): SepState {
  const state = emptyState() as SepState & { zinc?: unknown };
  state.zinc = { ratePerKg, premiumPerKg, upliftPct, basis, updatedAt, source: ratePerKg == null ? '' : 'manual' };
  return state as SepState;
}

test.describe('P9: zinc market rate', () => {

  test('shows landed rate as market + premium, with its age', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));

    const card = page.locator('#homeZincCard');
    await expect(card).toContainText('Zinc');
    await expect(card).toContainText('₹415');       // 400 + 15 landed
    await expect(card).toContainText('updated today');
    await expect(page.locator('.inv-zinc-stale')).toHaveCount(0);
  });

  test('flags a rate that has gone stale', async ({ page }) => {
    const tenDaysAgo = Date.now() - 10 * 86400000;
    await loadAppWithState(page, stateWithZinc(400, 15, tenDaysAgo));

    await expect(page.locator('#homeZincCard')).toContainText('10 days ago');
    await expect(page.locator('.inv-zinc-stale')).toBeVisible();
    await expect(page.locator('.inv-zinc-stale')).toContainText('may be out of date');
  });

  test('prompts for setup when no rate is recorded and no key is set', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(null));
    await expect(page.locator('#homeZincCard')).toContainText('No rate recorded');
    // Nothing to press yet — a refresh would only report the missing key.
    await expect(page.locator('[data-action="invRefreshZinc"]')).toHaveCount(0);
  });

  test('with a key but no rate, offers Refresh instead of asking for the key again', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(null));
    await page.evaluate((k) => localStorage.setItem(k, 'TEST-KEY'), METALS_KEY);
    await page.reload();
    await page.waitForSelector('nav.inv-tabs', { state: 'attached' });

    const card = page.locator('#homeZincCard');
    await expect(card).toContainText('Tap Refresh');
    await expect(card).not.toContainText('add a metals.dev API key');
    await expect(page.locator('[data-action="invRefreshZinc"]')).toBeVisible();
  });

  test('that Refresh actually populates an empty card', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(null));
    await page.evaluate((k) => localStorage.setItem(k, 'TEST-KEY'), METALS_KEY);
    await page.reload();
    await page.waitForSelector('nav.inv-tabs', { state: 'attached' });

    await page.route('**/api.metals.dev/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', metals: { zinc: 387.1 } }),
      }));

    await page.locator('[data-action="invRefreshZinc"]').click();
    // 387.10 LME + 10.5% = 427.75 MCX est., + 15 premium = 442.75 landed.
    await expect(page.locator('#homeZincCard')).toContainText('442.75');
  });

  test('refresh without a key tells you to add one rather than failing silently', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));
    await page.locator('[data-action="invRefreshZinc"]').click();
    await expect(page.locator('.inv-toast')).toContainText('metals.dev API key');
  });

  test('refresh reads the live rate and restamps the date', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now() - 10 * 86400000));
    await page.evaluate((k) => localStorage.setItem(k, 'TEST-KEY'), METALS_KEY);

    await page.route('**/api.metals.dev/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', currency: 'INR', unit: 'kg', metals: { zinc: 387.1, copper: 900 } }),
      }));

    await page.locator('[data-action="invRefreshZinc"]').click();

    // metals.dev carries no MCX base metal, so this is LME and gets uplifted:
    // 387.10 + 10.5% = 427.75 MCX est., + 15 premium = 442.75 landed.
    await expect(page.locator('#homeZincCard')).toContainText('442.75');
    await expect(page.locator('#homeZincCard')).toContainText('updated today');
    await expect(page.locator('#homeZincCard')).toContainText('metals.dev');
    // The derivation is spelled out, so an estimate never reads as a quote,
    // and the matched field is named — here the bare `zinc` alias, since this
    // fixture carries no explicit lme_zinc.
    await expect(page.locator('#homeZincCard')).toContainText('MCX est.');
    await expect(page.locator('#homeZincCard')).toContainText('metals.zinc');
  });

  test('prefers an MCX figure over LME when both are offered', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));
    await page.evaluate((k) => localStorage.setItem(k, 'TEST-KEY'), METALS_KEY);

    await page.route('**/api.metals.dev/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // LME runs ~10.5% below MCX once duty and freight are counted; picking
        // the wrong one understates the largest bought-in input by that much.
        body: JSON.stringify({ status: 'success', metals: { lme_zinc: 355.11, mcx_zinc: 392.0 } }),
      }));

    await page.locator('[data-action="invRefreshZinc"]').click();
    // A genuine MCX figure is the Indian price already: no uplift, so
    // 392.00 + 15 = 407.00 landed, and no "est." qualifier.
    await expect(page.locator('#homeZincCard')).toContainText('407.00');
    await expect(page.locator('#homeZincCard')).toContainText('mcx_zinc');
    await expect(page.locator('#homeZincCard')).not.toContainText('MCX est.');
  });

  test('a hand-entered rate is treated as MCX and is never uplifted', async ({ page }) => {
    // basis 'manual' with the real MCX quote the operator read off the market.
    await loadAppWithState(page, stateWithZinc(392, 15, Date.now(), 'manual'));
    const card = page.locator('#homeZincCard');
    await expect(card).toContainText('407.00');   // 392 + 15, uplift not applied
    await expect(card).not.toContainText('MCX est.');
  });

  test('an LME-basis rate shows its full derivation rather than a bare number', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(355.11, 15, Date.now(), 'lme', 10.5));
    const card = page.locator('#homeZincCard');
    // 355.11 + 10.5% = 392.40 MCX est., + 15 = 407.40 landed.
    await expect(card).toContainText('407.40');
    await expect(card).toContainText('LME ₹355.11');
    await expect(card).toContainText('10.5%');
    await expect(card).toContainText('MCX est.');
  });

  test('surfaces the response keys when zinc is absent, instead of a bare failure', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));
    await page.evaluate((k) => localStorage.setItem(k, 'TEST-KEY'), METALS_KEY);

    await page.route('**/api.metals.dev/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', metals: { gold: 1, silver: 2 } }),
      }));

    await page.locator('[data-action="invRefreshZinc"]').click();
    // The diagnostic names what actually came back so the field path is fixable.
    await expect(page.locator('.inv-toast')).toContainText('gold');
  });

  test('relays an API error message rather than swallowing it', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));
    await page.evaluate((k) => localStorage.setItem(k, 'BAD-KEY'), METALS_KEY);

    await page.route('**/api.metals.dev/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'failure', error_code: 1101, error_message: 'Unauthorized. The API Key provided is invalid.' }),
      }));

    await page.locator('[data-action="invRefreshZinc"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Unauthorized');
  });

  test('SECURITY: the API key is never written into exported state', async ({ page }) => {
    await loadAppWithState(page, stateWithZinc(400, 15, Date.now()));
    await page.evaluate((k) => localStorage.setItem(k, 'SECRET-KEY-VALUE'), METALS_KEY);
    await switchTab(page, 'pageClients');

    const stateBlob = await page.evaluate(() => localStorage.getItem('sep_invoicing_state') || '');
    expect(stateBlob).not.toContain('SECRET-KEY-VALUE');
    // It is still there, just in its own entry.
    const stored = await page.evaluate((k) => localStorage.getItem(k), METALS_KEY);
    expect(stored).toBe('SECRET-KEY-VALUE');
  });

});
