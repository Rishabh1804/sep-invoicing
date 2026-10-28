import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { guardBook, withUsers, unlock, windowGone, PINS } from './p140-guard.fixture';

// P243: Power's figures are the owner's settings (owner, 28 Oct 2026: "yes, ask for PIN"). The options' figures, the load and
// a bill's details saved with no PIN on any role that opened Power, so the restart the owner set could be changed unasked.

const ev = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const book = () => {
  const s: any = guardBook();
  s.power = { cfg: { restart: 250 }, load: {}, items: {} };
  s._powerLoad1 = true;   // the migration that sets the load on a book with a power bill
  s.costBills = [{ id: 'B1', kind: 'power', month: '2026-09', amount: 5000, at: 1 }];
  return s;
};
async function openCfg(page: Page) {
  await switchTab(page, 'pagePower');
  await ev(page, `powerCfgEdit()`);
  await expect(page.locator('#pwc_restart')).toBeVisible();
}

test('the options’ figures ask the owner’s PIN once the window has passed, and save only on it', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  await windowGone(page);
  await openCfg(page);
  await page.locator('#pwc_restart').fill('300');
  await page.locator('[data-action="invPowerCfgSave"]').click();
  // Asked, over the dialog; nothing saved yet.
  const ask = page.locator('[data-grd-ask]');
  await expect(ask).toBeVisible();
  expect(await ev(page, `powerCfg().restart`)).toBe(250);
  await ask.locator('#grdAskPin').fill(PINS.owner);
  await ask.locator('#grdAskPin').press('Enter');
  await expect(ask).toHaveCount(0);
  await expect.poll(() => ev(page, `powerCfg().restart`)).toBe(300);
});

test('a supervisor who opens Power is told the figures are not theirs to change, and nothing is saved', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await openCfg(page);
  const refused = async (what: string) => {
    const box = page.locator('.inv-dialog', { hasText: 'Your ID can’t ' + what });
    await expect(box).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await ev(page, `closeOverlay()`);
  };
  await page.locator('#pwc_restart').fill('900');
  await page.locator('[data-action="invPowerCfgSave"]').click();
  await refused('change the options’ figures');
  expect(await ev(page, `powerCfg().restart`)).toBe(250);
  // The load and a bill's details the same way.
  await ev(page, `powerLoadEdit()`);
  await page.locator('#pwApproved').fill('50');
  await page.locator('[data-action="invPowerLoadSave"]').click();
  await refused('change the connection’s load');
  expect(await ev(page, `powerData().load.approved || null`)).toBeNull();
  await ev(page, `powerBillEdit('B1')`);
  await page.locator('#pwb_penalty').fill('400');
  await page.locator('[data-action="invPowerBillSave"]').click();
  await refused('change a bill’s details');
  expect(await ev(page, `costBills()[0].penalty || null`)).toBeNull();
});
