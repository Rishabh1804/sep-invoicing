import { expect, type Page } from '@playwright/test';
import { loadAppWithState, emptyState, noSeedIM, todayIso, waitForBoot, switchTab, openHome, withWidgets, answerAsk } from './fixtures';
import { PINS, guardBook, withUsers, unlock, lockNow } from './p140-guard.fixture';

// P240 (UI pass 3, U2R; docs/UI_PASS_3.md §24o, §1a-19), shared by the phone and the desktop: Quick actions at Medium holds what was
// started here and not saved, each with Continue: the invoice typed on Create (its form stays as typed when the app leaves it) and a
// register page typed on Mine and kept on this device, the person's own. With nothing held it says where an unsaved invoice waits. And Home, kept between visits, is drawn
// again for whoever signs in next: the clerk's masthead and board had stayed on screen for the owner, and the owner's for a supervisor
// refused the screen the owner left open. Made-up names; every date from today.

const today = todayIso();
const held = (page: Page) => page.locator('#homeBoard .inv-widget[data-w="quick"] [data-wc-held]');

export async function heldCreate(page: Page) {
  await withWidgets(page, [['quick', 'm']]);
  const s = emptyState();
  await loadAppWithState(page, { ...s, clients: s.clients.map(c => ({ ...c, isActive: true })), incomingMaterial: noSeedIM() });
  await openHome(page);
  const card = page.locator('#homeBoard .inv-widget[data-w="quick"]');
  await expect(card.locator('.inv-widget-cap')).toHaveText('Started here and not saved');
  await expect(held(page)).toHaveCount(1);
  await expect(held(page)).toHaveAttribute('data-wc-held', 'none');
  await expect(held(page)).toContainText('Nothing yet: an invoice left unsaved on Create waits here');

  // An invoice half typed, then left for Home.
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('test client kg');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-action="invEditLinePart"][data-idx="0"]').fill('HELD BRACKET');
  await page.evaluate(() => (window as any).dismissAllAutocomplete());
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('12');
  await openHome(page);
  await expect(held(page)).toHaveCount(1);
  await expect(held(page)).toHaveAttribute('data-wc-held', 'create');
  await expect(held(page)).toContainText('An invoice for TEST CLIENT KG');
  await expect(held(page)).toContainText('1 line · on Create');
  await held(page).locator('[data-action="invSwitchTab"][data-tab="pageCreate"]').click();
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('input[data-action="invEditLinePart"][data-idx="0"]')).toHaveValue('HELD BRACKET');

  // Thrown away (New invoice, asked first): nothing is held, and the card says so again.
  await openHome(page);
  await page.locator('#homeBoard [data-w="quick"] [data-action="invCreateNew"]').first().click();
  expect(await answerAsk(page, 'ok')).toContain('Discard the invoice being typed?');
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await openHome(page);
  await expect(held(page)).toHaveAttribute('data-wc-held', 'none');
}

export async function heldVat(page: Page) {
  await page.clock.install({ time: new Date(today + 'T17:30:00') });
  const s: any = guardBook();
  s.clients = [...s.clients, { id: 11, name: 'NOVA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  await loadAppWithState(page, s);
  // The owner and the register clerk, whose face is the VAT register.
  await page.evaluate(async (pins) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, faces?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, faces ? { faces } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-clk', 'Gita Bose', 'supervisor', pins.super, ['vat'])];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
  await unlock(page, 'U-clk', PINS.super);
  await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();

  // One round of VAT A1 typed and not saved: kept on this phone.
  await page.locator('[data-face-duty="vat"] [data-action="invFaceOpen"]').last().click();
  await expect(page).toHaveURL(/v=vat%2Fvat-a1/);
  await page.locator('#faceVatClient0').selectOption('11');
  await page.locator('#faceVatPart0').fill('CLAMP 165X83(40X6)');
  await page.locator('#faceVatPart0').blur();
  for (const [k, v] of [['time', '09:45'], ['fig', '120']]) {
    const c = page.locator(`[data-face-vat="0"][data-k="${k}"]`);
    await c.fill(v);
    await c.blur();
  }
  await expect(page.locator('[data-face-vat-state]')).toHaveAttribute('data-face-vat-state', 'draft');

  // Quick actions on the clerk's own board, at Medium.
  const putQuick = () => page.evaluate(() => {
    const w = window as any;
    ['desk', 'phone'].forEach(lay => w.wdgItemsPut('home', lay, [['quick', 'm']]));
    if (document.querySelector('#pageHome.inv-page-active')) w.renderHome();
  });
  await putQuick();
  await switchTab(page, 'pageHome');
  await openHome(page);
  await expect(held(page)).toHaveCount(1);
  await expect(held(page)).toHaveAttribute('data-wc-held', 'vat');
  await expect(held(page)).toContainText('The VAT A1 page for today');
  await expect(held(page)).toContainText(/Typed at \d{1,2}:\d{2} [AP]M on this device/);
  await held(page).locator('[data-action="invWdgHeldVat"]').click();
  await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
  await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'form');
  await expect(page).toHaveURL(/v=vat%2Fvat-a1/);
  await expect(page.locator('[data-face-vat="0"][data-k="fig"]')).toHaveValue('120');
  expect(await page.evaluate(() => (0, eval)('faceDayIso()'))).toBe(today);

  // The page is the clerk's: the owner signed in on the same device sees nothing held.
  await lockNow(page);
  await unlock(page, 'U-own', PINS.owner);
  await putQuick();
  await openHome(page);
  await expect(held(page)).toHaveAttribute('data-wc-held', 'none');
}

export async function homeForWhoever(page: Page) {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  await openHome(page);
  await expect(page.locator('#pageHome .inv-mast')).toContainText('Asha');
  await expect(page.locator('#homeBoard [data-w="mtd"]')).toHaveCount(1);
  // The owner leaves Home for Stats, which a supervisor does not open, and locks: the supervisor is refused Stats and lands on Home.
  await switchTab(page, 'pageStats');
  await lockNow(page);
  await unlock(page, 'U-sup', PINS.super);
  await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();
  await expect(page.locator('#pageHome .inv-mast')).toContainText('Birsa');
  await expect(page.locator('#pageHome .inv-mast')).not.toContainText('Asha');
  await expect(page.locator('#homeBoard [data-w="floornow"]')).toHaveCount(1);
  const money = await page.evaluate(() => Array.from(document.querySelectorAll('#homeBoard .inv-widget[data-w]'))
    .map(el => (el as HTMLElement).dataset.w as string).filter(id => { const d = (window as any).wdgDef(id); return !!(d && d.needs && d.needs.money); }));
  expect(money).toEqual([]);
}
