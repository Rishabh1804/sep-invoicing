import { expect, type Page } from '@playwright/test';
import { waitForBoot } from './fixtures';

// P234's users: an owner and an office hand on PINs of four digits (UI pass 3, U8 §15b), and a supervisor whose PIN is from
// before (eight digits, typed). Every name and PIN is made up; none of the PINs is too easy to guess.
export const FOUR = { owner: '4829', office: '7351' };
export const OLD = { super: '24681357' };

/* The users made in the page by the guard's own hash, saved, and the page reloaded onto the lock. `last` is the ID remembered. */
export async function withFour(page: Page, last?: string) {
  await page.evaluate(async ({ four, old, last }) => {
    const w = window as any, S = (0, eval)('S');
    const mk = async (id: string, name: string, role: string, pin: string) =>
      ({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null });
    S.users = [await mk('U-own', 'Asha Rao', 'owner', four.owner), await mk('U-sup', 'Birsa Munda', 'supervisor', old.super),
      await mk('U-off', 'Chitra Sen', 'office', four.office)];
    await w.saveState();
    if (last) localStorage.setItem('sep_inv_guard_last', last); else localStorage.removeItem('sep_inv_guard_last');
  }, { four: FOUR, old: OLD, last });
  await page.reload();
  await waitForBoot(page);
  await expect(page.locator('#guardRoot')).toBeVisible();
}
/* The dots filled in a well group (the input's own value is never read: the dots are what is shown). */
export const dots = (page: Page, sel = '#guardRoot [data-pin]') => page.locator(sel).first().locator('.inv-pin-well.inv-pin-on').count();
/* Digits tapped on the phone's keypad. */
export async function tap(page: Page, digits: string, box = '#guardRoot') {
  for (const d of digits) await page.locator(`${box} [data-grd-keypad] [data-k="${d === '<' ? 'back' : d}"]`).click();
}
