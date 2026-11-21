import { test, expect, Page } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { guardBook, withUsers, unlock, lockNow, PINS, g } from './p140-guard.fixture';

/*
 * P286. When another person signs in, the pages the last person opened are emptied.
 *
 * After Lock now and another role's unlock, every page the last person had opened stayed drawn, hidden, with its
 * rupees: the role could not open the page, and its figures sat in the document all the same. The owner ruled that
 * every page but the one on show is cleared when the person changes (21 Nov 2026). The same person coming back keeps
 * theirs.
 */

const val = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
// The pages not on show that still hold anything, by id.
const drawnHidden = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.inv-page:not(.inv-page-active)'))
    .filter(p => Array.from(p.querySelectorAll(':scope > div')).some(d => d.innerHTML !== '')).map(p => p.id));

async function ownerOpens(page: Page) {
  await unlock(page, 'U-own', PINS.owner);
  for (const id of ['pageRegister', 'pageFinance', 'pageStats', 'pageStock', 'pageHome']) await g(page, `switchTab('${id}')`);
  expect(await drawnHidden(page)).toEqual(expect.arrayContaining(['pageRegister', 'pageFinance', 'pageStats', 'pageStock']));
}

test.describe('P286: another person signing in empties the hidden pages', () => {
  test('another role after the owner: nothing the owner opened is left drawn, and its own pages draw afresh', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await ownerOpens(page);
    // The made-up invoice's number is in the document while the owner's Register is drawn.
    expect(await val(page, `document.getElementById('pageRegister').textContent.indexOf('TEST-00001') >= 0`)).toBe(true);
    await lockNow(page);
    await unlock(page, 'U-sup', PINS.super);
    expect(await drawnHidden(page)).toEqual([]);
    expect(await val(page, `document.body.textContent.indexOf('TEST-00001') >= 0`)).toBe(false);
    // A page the role opens is drawn again from the book.
    await g(page, `switchTab('pageStock')`);
    await expect(page.locator('#pageStock')).toContainText('Nitric acid');
  });

  test('the page the owner was on, which the next role may not open, is emptied too', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, `switchTab('pageRegister')`);
    await lockNow(page);
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('.inv-page-active')).toHaveAttribute('id', 'pageHome');
    expect(await drawnHidden(page)).toEqual([]);
  });

  test('the same person coming back keeps their pages', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await ownerOpens(page);
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    expect(await drawnHidden(page)).toEqual(expect.arrayContaining(['pageRegister', 'pageFinance', 'pageStats', 'pageStock']));
  });

  test('an invoice left half typed is not handed on, and the owner coming back after another finds every page drawn again', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, `switchTab('pageCreate'); invoiceForm.remarks = 'left by the owner'; switchTab('pageHome')`);
    await lockNow(page);
    await unlock(page, 'U-off', PINS.office);
    expect(await val(page, 'invoiceForm.remarks')).toBe('');
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, `switchTab('pageRegister')`);
    await expect(page.locator('#pageRegister')).toContainText('TEST-00001');
    await g(page, `switchTab('pageCreate')`);
    await expect(page.locator('#createFormArea')).not.toBeEmpty();
  });
});
