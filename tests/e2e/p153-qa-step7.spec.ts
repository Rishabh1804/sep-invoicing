import { test, expect, type Page } from '@playwright/test';
import { answerAsk, loadAppWithState, readStoredState, switchTab, waitForBoot } from './fixtures';
import { sweepState } from './sweep-fixture';
import { PINS, withUsers, unlock, windowGone } from './p140-guard.fixture';
import { openSearch, search } from './p139-search.fixture';

// P153 (phone): the QA chain of 2 Oct 2026 over UX overhaul 2's step 7 and the shell. A swipe is a step of the trail, so
// Back returns to the view it left; Pulse opened from another screen is drawn, where Needs you stayed on screen under an
// address saying Pulse; Production's Enter by hand opens from its own address; and Finance's edits are P1 changes (docs/
// GUARD.md: payments): a receipt placed and a month's GST note ask the PIN once its window has passed, and a role that may
// open Finance but not change payments is told so and never asked. Every name is made up.

const swipeLeft = (page: Page) => page.evaluate(() => {
  const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
  document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)] }));
  document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(100)] }));
});
async function openFinanceTab(page: Page, tab: string) {
  await switchTab(page, 'pageFinance');
  await page.locator(`#pageFinance .inv-viewtab[data-tab="${tab}"]`).click();
}
const loose = (page: Page) => page.locator('#bankLoose select[data-bank-client]');

test.describe('P153: the QA chain over step 7 (phone)', () => {
  test('a swipe is a step of the trail: Back returns to the view it left', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const floor: string[] = await page.evaluate(() => (window as any).wsViewsPresent('floor').map((v: any) => v.tab));
    await switchTab(page, floor[0]);
    await swipeLeft(page);
    await expect(page.locator(`#${floor[1]}`)).toHaveClass(/inv-page-active/);
    await expect.poll(() => page.url()).toContain(`tab=${floor[1]}`);
    await page.goBack();
    await expect(page.locator(`#${floor[0]}`)).toHaveClass(/inv-page-active/);
  });

  test('Pulse opened from another screen is drawn, not Needs you left on screen', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    // Today drawn on Needs you with nothing left to redraw (the start's own save marks it once), then Office, and Pulse from
    // search, with nothing saved between.
    const bar = (ws: string) => page.locator(`.inv-navbar-item[data-ws="${ws}"]`);
    await bar('office').click();
    await bar('today').click();
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await bar('office').click();
    await expect(page.locator('#pageHome')).not.toHaveClass(/inv-page-active/);
    await openSearch(page);
    await search(page, 'pulse');
    await expect(page.locator('#srchList [role="option"]').first()).toContainText('Pulse');
    await page.keyboard.press('Enter');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#homePulse')).toBeVisible();
    await expect(page.locator('#homeNeeds')).toBeHidden();
    await expect(page.locator('[data-tdy-pulse-head]')).toBeVisible();
    expect(page.url()).toContain('v=pulse');
  });

  test("Production's Enter by hand opens from its address", async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await page.goto('/?tab=pageProduction&v=overview/hand');
    await waitForBoot(page);
    await expect(page.locator('#prodHandDate')).toBeVisible();
    await expect(page.locator('#pageProduction .inv-actionbar')).toBeVisible();
  });

  test('a receipt placed and a GST note asked for the PIN past its window; Cancel changes nothing', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await openFinanceTab(page, 'receipts');
    const before = await loose(page).count();
    expect(before).toBeGreaterThan(0);
    const rowId = (await loose(page).first().getAttribute('data-bank-client'))!;
    const pick = page.locator(`#bankLoose select[data-bank-client="${rowId}"]`);
    const client = (await pick.locator('option').nth(1).getAttribute('value'))!;
    await windowGone(page);
    await pick.selectOption(client);
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Place a receipt');
    await ask.locator('[data-action="invGuardAskCancel"]').last().click();
    await expect(ask).toHaveCount(0);
    // Nothing placed, and the picker reads what is stored again.
    await expect(pick).toHaveValue('');
    await expect(loose(page)).toHaveCount(before);
    // Given, the same placement is made.
    await pick.selectOption(client);
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('#grdAskPin').press('Enter');
    await expect(ask).toHaveCount(0);
    await expect(loose(page)).toHaveCount(before - 1);
    // A month's GST note: the form stays as typed while the PIN is asked, and nothing is noted on Cancel.
    await windowGone(page);
    await page.locator('#pageFinance .inv-viewtab[data-tab="gst"]').click();
    const noteBtn = page.locator('[data-action="invFinGstNote"]').first();
    const month = (await noteBtn.getAttribute('data-month'))!;
    await noteBtn.click();
    await page.locator('#finGstNote').fill('Paid from the other account');
    await page.locator(`[data-action="invFinGstSave"][data-month="${month}"]`).click();
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Note a month\'s GST');
    await ask.locator('[data-action="invGuardAskCancel"]').last().click();
    await expect(page.locator('#finGstNote')).toHaveValue('Paid from the other account');
    expect(((await readStoredState(page)).bank.gstNotes || {})[month]).toBeUndefined();
    await page.locator(`[data-action="invFinGstSave"][data-month="${month}"]`).click();
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('#grdAskPin').press('Enter');
    await expect.poll(async () => ((await readStoredState(page)).bank.gstNotes || {})[month]?.note).toBe('Paid from the other account');
  });

  test('a role that may open Finance but not change payments is refused, never asked', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page, { roles: { office: { pages: ['pageHome', 'pageTodo', 'pageFinance'], may: ['billing'], wages: false, finance: true } } });
    await unlock(page, 'U-off', PINS.office);
    await openFinanceTab(page, 'receipts');
    const before = await loose(page).count();
    const pick = loose(page).first();
    const client = (await pick.locator('option').nth(1).getAttribute('value'))!;
    await pick.selectOption(client);
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t place a receipt. Ask the owner.');
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    await expect(loose(page)).toHaveCount(before);
  });
});

// What the builders left to the lead (the QA chain of 2 Oct 2026): an area's complement is a standing norm, set as Settings
// are; a role that sees wages but not money has no bank legs on Pay; the Pulse's payout move needs the wages, and its
// questions read only the tasks the role sees; an "Out time" heading with its time run on is still a heading.
test.describe('P153: what the builders left (phone)', () => {
  const staffRole = { roles: { supervisor: { pages: ['pageHome', 'pageTodo', 'pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower'], may: ['floor'], wages: true, finance: false } } };

  test("an area's complement is the owner's: read-only to a role without Settings, asked of the owner past the window", async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page, staffRole);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="areas"]').click();
    const field = page.locator('[data-area-target]').first();
    await expect(field).toBeDisabled();
    // The setter refuses too, whatever reaches it.
    expect(await page.evaluate(() => (window as any).setAreaTarget('vat-a1', 9))).toBe(false);
    expect(((await readStoredState(page)).areaTargets || {})['vat-a1']).not.toBe(9);
  });

  test('the owner past the window is asked the PIN before a complement changes', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="areas"]').click();
    await windowGone(page);
    const field = page.locator('[data-area-target][data-area="vat-a1"]');
    await expect(field).toBeEnabled();
    await field.fill('7');
    await field.press('Tab');
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Set an area’s complement');
    expect(((await readStoredState(page)).areaTargets || {})['vat-a1']).not.toBe(7);
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('#grdAskPin').press('Enter');
    await expect.poll(async () => ((await readStoredState(page)).areaTargets || {})['vat-a1']).toBe(7);
  });

  test('a role that sees wages but not money has the slips on Pay without the bank’s legs', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page, staffRole);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="pay"]').click();
    await expect(page.locator('#attContent')).toContainText('payout', { ignoreCase: true });
    await expect(page.locator('#payBankWages')).toHaveCount(0);
  });

  test("the Pulse's payout move needs the wages", async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const sat = await page.evaluate(() => { const w = window as any; return w.isoAddDays(w.attWeekStartOf(w.localDateStr()), 6); });
    const owner = await page.evaluate(s => (window as any).advWageMoves({ today: s }).length, sat);
    await withUsers(page, { roles: { office: { pages: ['pageHome', 'pageTodo', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pagePipeline'], may: ['billing'], wages: false, finance: true } } });
    await unlock(page, 'U-off', PINS.office);
    expect(await page.evaluate(s => (window as any).advWageMoves({ today: s }).length, sat)).toBe(0);
    // The owner, with the same book, has the move (a payout is predicted at the week's pace): the test above is not vacuous.
    expect(owner).toBe(1);
  });

  test('an "Out time" heading with its time run on is read as the out-times', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const heads = await page.evaluate(() => {
      const w = window as any, d = new Date(), p = (n: number) => String(n).padStart(2, '0');
      const dmy = p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
      const S = (0, eval)('S'), a = S.staff[0].name.toUpperCase(), b = (S.staff[1] || S.staff[0]).name.toUpperCase();
      const text = dmy + '/ in time\n----8:30 AM---\n---VAT A 1----\n1) ' + a + '\n2) ' + b + '\nOut time5:00 pm\n1) ' + b;
      return w.parseRelayRoll(text, w.relayRoster({}), w.localDateStr()).lines.filter((l: any) => l.role === 'head').map((l: any) => l.read);
    });
    expect(heads).toContain('Out-times from here');
  });
});
