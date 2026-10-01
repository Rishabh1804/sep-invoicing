import { expect, type Page } from '@playwright/test';
import { emptyState, noSeedIM, waitForBoot, todayIso, recentTs } from './fixtures';

// P140's book and helpers, shared by the phone and desktop specs: three made-up users whose secrets are made in the page by
// the guard's own hash, unlocking, Lock now, and the re-ask window put in the past.

// Eight digits: a short PIN can turn up by chance inside a base64 hash or a timestamp, and the specs scan for each.
export const PINS = { owner: '48291637', super: '24681357', office: '73191357' };
export const g = (page: Page, expr: string) => page.evaluate(e => { (0, eval)(e); }, expr);

function inv(n: number) {
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), date: todayIso(),
    status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'BRKT-1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130 }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs() };
}
export function guardBook() {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.invoices = [inv(1), inv(2)];
  s.invNextNum = 3;
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }],
    entries: [{ id: 'c1', itemId: 'N', kind: 'count', qty: 12, date: todayIso(), at: 1 }], pastes: [] };
  return s;
}

/* Three users made in the page by the guard's own hash, saved, and the page reloaded onto the lock. */
export async function withUsers(page: Page, cfg?: Record<string, unknown>) {
  await page.evaluate(async ({ pins, cfg }) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string) =>
      ({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null });
    const S = (0, eval)('S');   // a let binding: not on window
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-sup', 'Birsa Munda', 'supervisor', pins.super),
      await mk('U-off', 'Chitra Sen', 'office', pins.office)];
    if (cfg) Object.assign(S.guardCfg, cfg);
    await w.saveState();
  }, { pins: PINS, cfg });
  await page.reload();
  await waitForBoot(page);
}
export async function unlock(page: Page, id: string, pin: string) {
  const lock = page.locator('#guardRoot');
  await expect(lock).toBeVisible();
  await lock.locator(`[data-action="invGuardPick"][data-id="${id}"]`).click();
  await lock.locator('#grdPin').fill(pin);
  await lock.locator('[data-action="invGuardUnlock"]').click();
  await expect(lock).toHaveCount(0);
}
/* Past the re-ask window: the PIN was last given ten minutes ago. */
export async function windowGone(page: Page) {
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('sep_inv_session')!);
    s.askAt = Date.now() - 10 * 60000;
    sessionStorage.setItem('sep_inv_session', JSON.stringify(s));
    (window as any)._grdGraceUntil = 0;
  });
}
export async function lockNow(page: Page) {
  await page.locator('#guardUserBtn').click();
  await page.locator('[data-grd-menu] [data-action="invGuardLockNow"]').click();
  await expect(page.locator('#guardRoot')).toBeVisible();
}
