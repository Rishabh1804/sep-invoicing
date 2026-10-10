import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, todayIso, waitForBoot, openSettingsAt } from './fixtures';
import { PINS, guardBook, unlock, lockNow } from './p140-guard.fixture';

// P199: entry faces, the shell (docs/ENTRY_FACES.md, F1; owner, 10 Oct 2026: "develop app faces for each employee to enter data …
// We have guard in place, they will all be using the phone app", "Each their own phone, no one shares any screens"). A face is set on
// a user (the duties they enter); signing in opens it; its door, Mine, is theirs alone; its steps are the day's duties, each opening
// where it is entered; what the person entered that day is listed from the change log; the owner sets the duties and sees the
// screen as theirs. Made-up names; every date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* The owner, a supervisor whose face is the rolls, the stock and the barrel, and the office, each made by the guard's own hash. */
async function withFaces(page: Page) {
  await page.evaluate(async (pins) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, faces?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, faces ? { faces } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-sup', 'Esha Pal', 'supervisor', pins.super, ['roll-in', 'stock', 'barrel', 'roll-out']),
      await mk('U-off', 'Chitra Sen', 'office', pins.office)];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
}

test.describe('P199: entry faces, the shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
    await loadAppWithState(page, guardBook());
    await withFaces(page);
  });

  test('a person with duties signs in to Mine: the day’s duties as steps, each opening where it is entered, and what they entered', async ({ page }) => {
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
    // Mine is the first door on their bar; Add stays a door of its own.
    await expect(page.locator('.inv-navbar > .inv-navbar-item').first()).toHaveAttribute('data-ws', 'mine');
    await expect(page.locator('.inv-navbar-item[data-ws="mine"]')).toHaveClass(/inv-navbar-item-on/);
    const steps = page.locator('[data-face-steps] [data-face-duty]');
    await expect(steps).toHaveCount(4);
    expect(await steps.evaluateAll(els => els.map(e => e.getAttribute('data-face-duty')))).toEqual(['roll-in', 'stock', 'barrel', 'roll-out']);
    // Half past eleven: the in-time roll is late, the barrel not yet, the out-time roll looked for from five; the stock is in (the
    // book's count this morning, entered by hand by nobody with a face).
    await expect(page.locator('[data-face-duty="roll-in"]')).toHaveAttribute('data-state', 'late');
    await expect(page.locator('[data-face-duty="barrel"]')).toHaveAttribute('data-state', 'wait');
    await expect(page.locator('[data-face-duty="roll-out"] .inv-step-meta')).toContainText('After 5 PM');
    await expect(page.locator('[data-face-duty="stock"]')).toHaveAttribute('data-state', 'in');
    await expect(page.locator('[data-face-duty="stock"] .inv-step-meta')).toHaveText('entered by hand');
    await expect(page.locator('#faceVerdict [data-face-in]')).toHaveText('1 of 4 in');
    await expect(page.locator('#faceEntered')).toContainText('Nothing yet on this day');

    // The stock step opens Stock's form by hand on the day; a count saved there is theirs on Mine, and the step names them.
    await page.locator('[data-face-duty="stock"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#pageStock.inv-page-active')).toBeVisible();
    expect(await ev(page, `[_stockView, _stockManual && _stockManual.date]`)).toEqual(['manual', todayIso()]);
    await page.locator('input[data-stock-qty="N"]').fill('15');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await page.locator('.inv-navbar-item[data-ws="mine"]').click();
    await expect(page.locator('[data-face-duty="stock"] .inv-step-meta')).toHaveText('Entered by Esha Pal');
    await expect(page.locator('#faceEntered [data-face-entered]')).toHaveCount(1);
    await expect(page.locator('#faceEntered')).toContainText('stock entry');

    // The owner's Today says who entered it; the owner has no Mine.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('.inv-navbar-item[data-ws="mine"]')).toHaveCount(0);
    await expect(page.locator('[data-tdy-input="stock"] .inv-step-meta')).toContainText('by Esha Pal');
    // A role with no face is refused the screen by its address.
    await page.goto('/?tab=pageFace');
    await waitForBoot(page);
    await expect(page.locator('#pageFace.inv-page-active')).toHaveCount(0);
  });

  test('the owner sets what a person enters and sees their screen; the day steps back and the address carries it', async ({ page }) => {
    await unlock(page, 'U-own', PINS.owner);
    await openSettingsAt(page, 'users');
    const row = page.locator('[data-grd-user="U-sup"]');
    await expect(row).toContainText('enters In-time roll, Stock, Barrel batches, Out-time roll');
    await row.locator('[data-action="invGuardEdit"]').click();
    await page.locator('[data-grd-face="pickling"]').check();
    await page.locator('[data-action="invGuardFormSave"]').click();
    expect((await readStoredState(page)).users.find((u: any) => u.id === 'U-sup').faces).toEqual(['roll-in', 'pickling', 'stock', 'barrel', 'roll-out']);
    // See their screen: Settings shuts, and Mine opens as theirs.
    await page.locator('[data-grd-user="U-sup"] [data-action="invFaceSee"]').click();
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
    await expect(page.locator('#faceVerdict .inv-hero-eyebrow')).toContainText('Esha Pal’s screen, as they see it');
    await expect(page.locator('[data-face-steps] [data-face-duty]')).toHaveCount(5);
    // The day before, by the stepper: the address names it; Today comes back.
    await page.locator('[data-action="invFaceStep"][data-step="-1"]').click();
    await expect(page.locator('#faceDate')).toHaveValue(day(-1));
    await expect.poll(() => page.evaluate(() => location.search)).toContain('d=' + day(-1));
    await page.locator('[data-action="invFaceToday"]').click();
    await expect(page.locator('#faceDate')).toHaveValue(todayIso());
  });
});
