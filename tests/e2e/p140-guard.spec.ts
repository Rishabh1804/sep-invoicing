import { test, expect } from '@playwright/test';
import { loadAppWithState, readStoredState, waitForBoot, answerAsk, openSettingsAt, switchTab } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';
import { PINS, g, guardBook, withUsers, unlock, windowGone, lockNow } from './p140-guard.fixture';

// P140: the guard, step G1 (docs/GUARD.md; owner, 1 Oct 2026: "a security feature that asks for the ID and PIN on
// reopening … don't ask for PIN again until P1 items or settings are changed"). No users, no lock: the app works as it did.
// With users: the lock at a fresh open and after the minutes in the background, nothing of the shell shown or taking input
// under it; a wrong PIN counted down and the device locked out; the PIN asked again before a P1 change outside its window;
// what a role may open and change; Settings → Access → Users & access; the recovery code. Every name is made up.

test.describe('P140: the guard (phone)', () => {
  test('no users, no lock: a book without users boots unlocked and a P1 change asks nothing', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/inv-locked/);
    await expect(page.locator('#guardUserBtn')).toBeHidden();
    expect(await page.evaluate(() => { const w = window as any; return [w.grdOn(), w.grdIsOwner(), w.grdCan('billing'), w.grdSees('pageFinance'), w.grdUserId()]; }))
      .toEqual([false, true, true, true, null]);
    expect(await page.evaluate(() => (window as any).guardAsk('voids', 'void a stock entry'))).toBe(true);
    // A cancel opens its dialog at once, as it always has.
    await g(page, "cancelInvoice('INV-1')");
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    // The book carries the guard's shape, empty: no user, the roles' defaults.
    const st = await page.evaluate(() => { const S = (0, eval)('S'); return { users: S.users, roles: Object.keys(S.guardCfg.roles), lock: S.guardCfg.lockMinutes }; });
    expect(st).toEqual({ users: [], roles: ['owner', 'office', 'supervisor', 'floor'], lock: 15 });
  });

  test('with users: the lock at boot, the shell hidden and inert under it, the remembered user chosen', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await page.evaluate(() => localStorage.setItem('sep_inv_guard_last', 'U-sup'));
    await withUsers(page);
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('.inv-guard-title')).toHaveText('Who is using the app?');
    await expect(lock.locator('[role="radio"]')).toHaveCount(3);
    await expect(lock.locator('[role="radio"][aria-checked="true"]')).toContainText('Birsa Munda');
    await expect(lock.locator('[role="radio"][aria-checked="true"]')).toContainText('Supervisor');
    // An all-digit PIN brings up the number pad; the field never shows what is typed.
    await expect(lock.locator('#grdPin')).toHaveAttribute('type', 'password');
    await expect(lock.locator('#grdPin')).toHaveAttribute('inputmode', 'numeric');
    await expect(lock.locator('#grdPin')).toBeFocused();
    // Nothing of the shell shows, and nothing in it takes a tap or a key.
    await expect(page.locator('body')).toHaveClass(/inv-locked/);
    for (const sel of ['.inv-topbar', '#pageHome', '.inv-navbar', '#mtdRevenue']) await expect(page.locator(sel)).toBeHidden();
    expect(await page.evaluate(() => Array.from(document.body.children).filter(el => el.id !== 'guardRoot' && el.tagName !== 'SCRIPT')
      .every(el => (el as HTMLElement).inert))).toBe(true);
    const door = await page.locator('.inv-navbar [data-ws="office"]').boundingBox();
    await page.mouse.click(door!.x + door!.width / 2, door!.y + door!.height / 2);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Backspace');
    await expect(lock).toBeVisible();
    // The lock is a layer, never an address.
    expect(new URL(page.url()).search).not.toMatch(/guard|lock/);
    // The right PIN opens, and the top bar shows who is signed in.
    await lock.locator('#grdPin').fill(PINS.super);
    await lock.locator('#grdPin').press('Enter');
    await expect(lock).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/inv-locked/);
    await expect(page.locator('#guardUserBtn')).toBeVisible();
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'BM');
    expect(await page.evaluate(() => Array.from(document.body.children).some(el => (el as HTMLElement).inert))).toBe(false);
  });

  test('a wrong PIN counts down the tries; five lock the ID for 30 s, doubling; the right PIN opens and clears it', async ({ page }) => {
    await page.clock.install();
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    const lock = page.locator('#guardRoot'), err = lock.locator('[data-grd-err]'), go = lock.locator('[data-action="invGuardUnlock"]');
    await lock.locator('[data-id="U-own"]').click();
    for (let i = 1; i <= 4; i++) {
      await lock.locator('#grdPin').fill('000000');
      await go.click();
      const left = 5 - i;
      await expect(err).toHaveText(`Wrong PIN. ${left} tr${left === 1 ? 'y' : 'ies'} left.`);
    }
    await lock.locator('#grdPin').fill('000000');
    await go.click();
    await expect(err).toHaveText('Locked for 30 seconds.');
    await expect(go).toBeDisabled();
    // Kept on the device, by the ID they were typed for (P152, QA4-8): the count and the time, and the lock says it counting down.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_guard_fail')!).ids['u:U-own'].n)).toBe(5);
    await page.clock.fastForward(10_000);
    await expect(err).toHaveText(/^Locked for (19|20) seconds\.$/);
    await page.clock.fastForward(21_000);
    await expect(err).toHaveText('');
    await expect(go).toBeEnabled();
    // The next wrong one locks for twice as long.
    await lock.locator('#grdPin').fill('000000');
    await go.click();
    await expect(err).toHaveText('Locked for 60 seconds.');
    await page.clock.fastForward(61_000);
    await expect(go).toBeEnabled();
    await lock.locator('#grdPin').fill(PINS.owner);
    await go.click();
    await expect(lock).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_guard_fail'))).toBeNull();
  });

  test('a reload keeps the session; another tab, and another browser holding the book, ask again', async ({ page, browser }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'AR');
    // A tab opened fresh has a session of its own: it asks, with the last user remembered.
    const tab = await page.context().newPage();
    await tab.goto('/');
    await waitForBoot(tab);
    await expect(tab.locator('#guardRoot')).toBeVisible();
    await expect(tab.locator('#guardRoot [role="radio"][aria-checked="true"]')).toContainText('Asha Rao');
    await tab.close();
    // Another browser holding the same book asks too, with nobody chosen.
    const stored = await readStoredState(page);
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, serviceWorkers: 'block' });
    const p2 = await ctx.newPage();
    await loadAppWithState(p2, stored);
    await expect(p2.locator('#guardRoot')).toBeVisible();
    await expect(p2.locator('#guardRoot [role="radio"][aria-checked="true"]')).toHaveCount(0);
    await ctx.close();
  });

  test('away past the lock minutes, the window asks again, and a form typed before is there after', async ({ page }) => {
    await page.clock.install();
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanNo').fill('7731');
    const vis = (v: string) => page.evaluate(v => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
    }, v);
    // Ten minutes away: still open.
    await vis('hidden');
    await page.clock.fastForward(10 * 60_000);
    await vis('visible');
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    // Sixteen: the lock, over the form as it was.
    await vis('hidden');
    await page.clock.fastForward(16 * 60_000);
    await vis('visible');
    await expect(page.locator('#guardRoot')).toBeVisible();
    await expect(page.locator('#imChallanNo')).toBeHidden();
    await expect(page.locator('#imChallanNo')).toHaveValue('7731');
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imChallanNo')).toBeVisible();
    await expect(page.locator('#imChallanNo')).toHaveValue('7731');
  });

  test('Lock now locks every window of this device', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    const other = await page.context().newPage();
    await other.goto('/');
    await waitForBoot(other);
    await unlock(other, 'U-off', PINS.office);
    await page.locator('#guardUserBtn').click();
    const menu = page.locator('[data-grd-menu]');
    await expect(menu.locator('.inv-dialog-title')).toHaveText('Asha Rao · Owner');
    await expect(menu.locator('.inv-row-title')).toHaveText(['Change my PIN', 'Switch user', 'Lock now']);
    await menu.locator('[data-action="invGuardLockNow"]').click();
    await expect(page.locator('#guardRoot')).toBeVisible();
    await expect(other.locator('#guardRoot')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('sep_inv_session'))).toBeNull();
    expect(await other.evaluate(() => sessionStorage.getItem('sep_inv_session'))).toBeNull();
    // Switch user locks too, with nobody chosen for the next person.
    await unlock(other, 'U-off', PINS.office);
    await other.locator('#guardUserBtn').click();
    await other.locator('[data-grd-menu] [data-action="invGuardSwitch"]').click();
    await expect(other.locator('#guardRoot [role="radio"][aria-checked="true"]')).toHaveCount(0);
    await other.close();
  });

  test('the supervisor is refused Finance, the Register and Pay with a word, may not void, and is never asked a PIN for a stock entry', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page, { askMinutes: 0 });   // every P1 change would ask
    await unlock(page, 'U-sup', PINS.super);
    // Its doors are gone from the bar; a way in by name is refused, and Home opens.
    await expect(page.locator('.inv-navbar [data-tab="pageRegister"]')).toBeHidden();
    await expect(page.locator('.inv-navbar [data-tab="pageIM"]')).toBeHidden();
    await expect(page.locator('.inv-topbar [data-action="invOpenSettings"]')).toBeHidden();
    await g(page, "switchTab('pageFinance')");
    await expect(page.locator('.inv-toast')).toHaveText('Your ID doesn’t open Money');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await g(page, "switchTab('pageRegister')");
    await expect(page.locator('.inv-toast')).toHaveText('Your ID doesn’t open Invoices');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    // An address naming one does the same.
    await page.goto('/?tab=pageStats');
    await waitForBoot(page);
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(page.locator('.inv-toast')).toHaveText('Your ID doesn’t open Stats');
    // Staff opens, without Pay: its tab is gone and the view refused.
    await switchTab(page, 'pageStaff');
    await expect(page.locator('#attToolbar [data-view="pay"]')).toHaveCount(0);
    await g(page, "_attView = 'pay'; renderAttendance()");
    await expect(page.locator('.inv-toast')).toHaveText('Your ID doesn’t open Pay');
    // People opens on Attendance's Day (its Overview went to Floor's, the tab map, TM4b).
    expect(await page.evaluate(() => (window as any)._attView)).toBe('day');
    // Settings are not opened: keys and the token are in them.
    await g(page, 'openSettings()');
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t open Settings. Ask the owner.');
    await expect(page.locator('#settingsScrim')).toHaveCount(0);
    // A stock entry by hand: saved, nothing asked.
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockManual"]').first().click();
    await page.locator('[data-stock-qty="N"]').fill('9');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect.poll(async () => (await readStoredState(page)).stock.entries.length).toBe(2);
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    // A void is not the supervisor's: told so, never asked a PIN, nothing voided.
    await g(page, "stockVoid('c1')");
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t void a stock entry. Ask the owner.');
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    expect((await readStoredState(page)).stock.entries.find((e: any) => e.id === 'c1').voided).toBeUndefined();
  });

  test('the office hand is asked the PIN once to cancel an invoice, and not again within the window', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await windowGone(page);
    await g(page, "cancelInvoice('INV-1')");
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Cancel an invoice');
    await expect(ask).toContainText('Enter your PIN to go on.');
    await expect(ask.locator('#grdAskPin')).toBeFocused();
    await expect(page.locator('[data-action="invConfirmCancel"]')).toHaveCount(0);
    await ask.locator('#grdAskPin').fill(PINS.office);
    await ask.locator('#grdAskPin').press('Enter');
    await expect(ask).toHaveCount(0);
    await page.locator('[data-action="invConfirmCancel"]').click();
    await expect.poll(async () => (await readStoredState(page)).invoices.find((i: any) => i.id === 'INV-1').status).toBe('cancelled');
    // Within the window: the next one opens its dialog at once.
    await g(page, "cancelInvoice('INV-2')");
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
    await expect(ask).toHaveCount(0);
    await page.locator('[data-action="invCloseConfirm"]').last().click();
    // A cancelled question changes nothing: Cancel answers no.
    await windowGone(page);
    await g(page, "cancelInvoice('INV-2')");
    await ask.locator('[data-action="invGuardAskCancel"]').last().click();
    await expect(ask).toHaveCount(0);
    await expect(page.locator('[data-action="invConfirmCancel"]')).toHaveCount(0);
    // The office may not touch rates: refused, never asked.
    await g(page, 'fillPieceRatesFromHistory(1)');
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t fill piece rates from billing. Ask the owner.');
  });

  test('the act asks again once the window has run out, and a dialog left open is never handed to the next person', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    const ask = page.locator('[data-grd-ask]');
    // Opened within the window, confirmed after it: the PIN is asked at the act.
    await g(page, "cancelInvoice('INV-1')");
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
    await windowGone(page);
    await page.locator('[data-action="invConfirmCancel"]').click();
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Cancel an invoice');
    await ask.locator('#grdAskPin').fill(PINS.office);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect.poll(async () => (await readStoredState(page)).invoices.find((i: any) => i.id === 'INV-1').status).toBe('cancelled');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    // A delete half-done, then the window locks: the same person back finds it as left, reason and all.
    await g(page, "deleteInvoice('INV-2')");
    await page.locator('#invDeleteReason').fill('Typed twice');
    await g(page, "grdLock('away')");
    await expect(page.locator('#guardRoot')).toBeVisible();
    await unlock(page, 'U-off', PINS.office);
    await expect(page.locator('#invDeleteReason')).toHaveValue('Typed twice');
    // Somebody else unlocks: the dialog is shut, not handed on, and nothing was deleted.
    await g(page, "grdLock('away')");
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await expect(page.locator('[data-action="invConfirmDelete"]')).toHaveCount(0);
    expect((await readStoredState(page)).invoices.map((i: any) => i.id)).toContain('INV-2');
  });

  test('Turn on the guard shows a recovery code once, and the code resets a forgotten owner PIN', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await openSettingsAt(page, 'users');
    const sec = page.locator('details[data-sec="users"]');
    await expect(sec.locator('[data-sum="users"]')).toHaveText('off · no ID or PIN asked');
    await expect(sec.locator('[data-action="invSaveSettingsSec"]')).toHaveCount(0);
    await sec.locator('[data-action="invGuardOn"]').click();
    const form = page.locator('[data-grd-form="on"]');
    await form.locator('#grdName').fill('Asha Rao');
    await form.locator('#grdP1').fill('48291637');
    await form.locator('#grdP2').fill('48291638');
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form.locator('[data-grd-err]')).toHaveText('The two entries differ: type the same PIN twice.');
    await form.locator('#grdP1').fill('482');
    await form.locator('#grdP2').fill('482');
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form.locator('[data-grd-err]')).toHaveText('A PIN needs 4 characters or more.');
    await form.locator('#grdP1').fill('48291637');
    await form.locator('#grdP2').fill('48291637');
    await form.locator('[data-action="invGuardFormSave"]').click();
    const code = page.locator('[data-grd-recovery]');
    await expect(code).toHaveText(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    const recovery = (await code.innerText()).trim();
    await expect(page.locator('[data-grd-code]')).toContainText('Write this down and keep it off the device');
    await page.locator('[data-grd-code] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
    await expect(code).toHaveCount(0);
    // On, and this window is the owner's; the section now lists the users, the minutes and the roles.
    await expect(sec.locator('[data-sum="users"]')).toHaveText('on · 1 user · lock after 15 min');
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'AR');
    await expect(sec.locator('[data-grd-user]')).toHaveCount(1);
    await expect(sec.locator('[data-grd-roles]')).toBeVisible();
    // Shown once: the code and the PIN are nowhere in the book or on the device.
    const bare = recovery.replace(/-/g, '');
    const stored = JSON.stringify(await readStoredState(page));
    for (const s of [recovery, bare, '48291637']) expect(stored).not.toContain(s);
    const kept = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    for (const s of [recovery, bare, '48291637']) expect(kept).not.toContain(s);
    // Forgotten: the lock's Forgot your PIN? asks the owner for the code.
    await page.locator('[data-action="invCloseSettings"]').click();
    await lockNow(page);
    const lock = page.locator('#guardRoot');
    await lock.locator('[data-action="invGuardForgot"]').click();
    await lock.locator('#grdCode').fill('AAAA-BBBB-CCCC');
    await lock.locator('#grdNew1').fill('7777');
    await lock.locator('#grdNew2').fill('7777');
    await lock.locator('[data-action="invGuardRecover"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Wrong recovery code. 4 tries left.');
    // Case and dashes do not matter.
    await lock.locator('#grdCode').fill(bare.toLowerCase());
    await lock.locator('[data-action="invGuardRecover"]').click();
    await expect(lock).toHaveCount(0);
    // The code is spent: a new one replaces it, shown once.
    const next = (await page.locator('[data-grd-recovery]').innerText()).trim();
    expect(next).not.toBe(recovery);
    await expect(page.locator('[data-grd-code]')).toContainText('The code you used is spent');
    await page.locator('[data-grd-code] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
    // The new PIN opens; the old one does not.
    await lockNow(page);
    await lock.locator('#grdPin').fill('48291637');
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Wrong PIN. 4 tries left.');
    await lock.locator('#grdPin').fill('7777');
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
    // The spent code no longer resets.
    await lockNow(page);
    await lock.locator('[data-action="invGuardForgot"]').click();
    await lock.locator('#grdCode').fill(recovery);
    await lock.locator('#grdNew1').fill('8888');
    await lock.locator('#grdNew2').fill('8888');
    await lock.locator('[data-action="invGuardRecover"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Wrong recovery code. 4 tries left.');
    // Somebody else forgetting is sent to the owner.
  });

  test('a Settings save asks the PIN outside the window, says a wrong one, and asks nothing inside it', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await windowGone(page);
    await openSettingsAt(page, 'rateCheck');
    await page.locator('#setRcPct').fill('12');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="rateCheck"]').click();
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Save rate & weight check');
    await ask.locator('#grdAskPin').fill('111111');
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect(ask.locator('[data-grd-err]')).toHaveText('Wrong PIN. 4 tries left.');
    expect((await readStoredState(page)).rateCheck.pct).toBe(10);
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect(ask).toHaveCount(0);
    await expect.poll(async () => (await readStoredState(page)).rateCheck.pct).toBe(12);
    // Settings stays open under the question, and the next section saves at once.
    await openSettingsAt(page, 'stockAlerts');
    await page.locator('#setStkAmber').fill('8');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="stockAlerts"]').click();
    await expect.poll(async () => (await readStoredState(page)).stockCheck.amberDays).toBe(8);
    await expect(ask).toHaveCount(0);
  });

  test('a user deactivated in one window is locked out of another at its next load of the book', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    const other = await page.context().newPage();
    await other.goto('/');
    await waitForBoot(other);
    await unlock(other, 'U-sup', PINS.super);
    await openSettingsAt(page, 'users');
    const row = page.locator('[data-grd-user="U-sup"]');
    await row.locator('[data-action="invGuardDeactivate"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Deactivate Birsa Munda?');
    await expect(row.locator('.inv-dot')).toHaveText('Inactive');
    await expect(row).toHaveClass(/inv-row-muted/);
    // The other window loads the saved book (the version guard) and checks its session against it.
    await expect(other.locator('#guardRoot')).toBeVisible();
    await expect(other.locator('#guardRoot [data-id="U-sup"]')).toHaveCount(0);
    await expect(other.locator('#guardRoot [role="radio"]')).toHaveCount(2);
    await other.close();
    // Kept, never deleted: reactivated, the user is back on the lock.
    await row.locator('[data-action="invGuardReactivate"]').click();
    await expect(row.locator('.inv-dot')).toHaveText('Active');
    expect((await readStoredState(page)).users.map((u: any) => u.id)).toEqual(['U-own', 'U-sup', 'U-off']);
  });

  test('the PIN is nowhere on the device or in the book except as its salted hash', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await windowGone(page);
    await g(page, "cancelInvoice('INV-1')");
    await page.locator('#grdAskPin').fill(PINS.office);
    await page.locator('[data-action="invGuardAskOk"]').click();
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
    // Change my PIN: the current one, then the new one twice.
    await page.locator('[data-action="invCloseConfirm"]').last().click();
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardChangePin"]').click();
    const form = page.locator('[data-grd-form="mine"]');
    await form.locator('#grdCur').fill('9999');
    await form.locator('#grdP1').fill('mango4471');
    await form.locator('#grdP2').fill('mango4471');
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form.locator('[data-grd-err]')).toHaveText('Wrong PIN. 4 tries left.');
    await form.locator('#grdCur').fill(PINS.office);
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form).toHaveCount(0);
    const pins = [...Object.values(PINS), 'mango4471'];
    const book = await page.evaluate(async () => (await (window as any).readPersistedStateRaw()) as string);
    const device = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    for (const p of pins) { expect(book).not.toContain(p); expect(device).not.toContain(p); }
    // Each secret: PBKDF2-SHA256, its count, a 16-byte salt and a 32-byte hash, all base64.
    const users = JSON.parse(book).users;
    for (const u of users) {
      expect(u.secret.alg).toBe('PBKDF2-SHA256');
      expect(u.secret.iter).toBeGreaterThanOrEqual(150000);
      expect(Buffer.from(u.secret.salt, 'base64')).toHaveLength(16);
      expect(Buffer.from(u.secret.hash, 'base64')).toHaveLength(32);
    }
    // The new PIN is the one that opens.
    await lockNow(page);
    await unlock(page, 'U-off', 'mango4471');
  });

  test('the lock and every guard dialog are drawn from the components: nothing retired, unstyled, cut or too small', async ({ page }) => {
    test.setTimeout(120_000);
    await loadAppWithState(page, guardBook());
    const stops: Stop[] = [];
    const at = async (name: string, open: () => Promise<void>) => { await open(); stops.push(await sweep(page, name)); };
    await at('guard turn on', () => g(page, "grdFormOpen('on')"));
    await g(page, 'closeOverlay()');
    await withUsers(page);
    // The lock hides the page on purpose: a blank page is what it is for.
    await at('lock', async () => { await expect(page.locator('#guardRoot')).toBeVisible(); });
    stops[stops.length - 1].blank = false;
    await page.locator('#guardRoot [data-id="U-own"]').click();
    await at('lock, the owner chosen', async () => { await expect(page.locator('#grdPin')).toBeVisible(); });
    stops[stops.length - 1].blank = false;
    // This book was given its users without a recovery code: the owner's Forgot says so, and offers no fields.
    await page.locator('#guardRoot [data-action="invGuardForgot"]').click();
    await at('lock, no recovery code', async () => { await expect(page.locator('#guardRoot .inv-callout-warning')).toContainText('No recovery code is on record'); });
    stops[stops.length - 1].blank = false;
    await expect(page.locator('#grdCode')).toHaveCount(0);
    // A user who is not the owner is sent to the owner.
    await page.locator('#guardRoot [data-id="U-sup"]').click();
    await page.locator('#guardRoot [data-action="invGuardForgot"]').click();
    await expect(page.locator('#guardRoot [data-grd-forgot]')).toHaveText('Ask the owner to reset it.');
    await unlock(page, 'U-own', PINS.owner);
    await at('user menu', async () => { await page.locator('#guardUserBtn').click(); await expect(page.locator('[data-grd-menu]')).toBeVisible(); });
    await g(page, 'closeOverlay()');
    await windowGone(page);
    await at('pin ask', async () => { await g(page, "cancelInvoice('INV-1')"); await expect(page.locator('[data-grd-ask]')).toBeVisible(); });
    await g(page, 'closeOverlay()');
    for (const [name, js] of [['add user', "grdFormOpen('add')"], ['edit user', "grdFormOpen('edit', 'U-sup')"], ['reset pin', "grdFormOpen('pin', 'U-off')"],
      ['change my pin', "grdFormOpen('mine')"], ['recovery code', "grdShowCode('ABCD-EFGH-JKMN', 'anew')"]]) {
      await at(name, () => g(page, js));
      await g(page, 'closeOverlay()');
    }
    await openSettingsAt(page, 'users');
    stops.push(await sweep(page, 'settings, users & access'));
    expect(problems(stops)).toEqual([]);
  });
});
