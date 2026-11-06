import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadAppWithState, readStoredState } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';
import { guardBook, lockNow, windowGone, g } from './p140-guard.fixture';
import { FOUR, OLD, withFour, dots, tap } from './p234-sign-in.fixture';

// P234: sign-in and the 4-digit PIN (docs/UI_PASS_3.md §15, §26f; owner, 16 Oct 2026: "4-digit PIN"). The phone: the mark, the
// company, Welcome back, the person remembered with Not you?, four wells, the keypad, Sign in enabled at four digits and never
// sent at the fourth; a wrong PIN red and shaken; a PIN from before typed, then asked to become four digits (Later keeps it);
// the rules for a new PIN; nothing of the book's figures before sign-in; the forms and the PIN asked again in wells; the icons
// the manifest names. Every name is made up.

const ROOT = path.resolve(__dirname, '../..');
/* A PNG's width and height, read from its IHDR. */
function pngSize(file: string) { const b = readFileSync(path.join(ROOT, file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

test.describe('P234: sign-in (phone)', () => {
  test('a PIN is four digits, not one digit four times, a run or a common PIN; the secret says it is four', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    const r = await page.evaluate(() => {
      const w = window as any;
      const bad = ['0000', '5555', '9999', '0123', '3456', '6789', '9876', '5432', '3210', '1212', '1004', '2000', '2580', '6969'];
      return {
        short: w.grdPinProblem('482', '482'), long: w.grdPinProblem('48291', '48291'), letters: w.grdPinProblem('48a9', '48a9'),
        easy: bad.map((p: string) => w.grdPinProblem(p, p)), differ: w.grdPinProblem('4829', '4830'), ok: [w.grdPinProblem('4829', '4829'), w.grdPinProblem('7351')],
      };
    });
    expect(r.short).toBe('A PIN is four digits.');
    expect(r.long).toBe('A PIN is four digits.');
    expect(r.letters).toBe('A PIN is four digits.');
    expect(new Set(r.easy)).toEqual(new Set(['Too easy to guess: not one digit four times, a run like 1234, or a common PIN.']));
    expect(r.differ).toBe('The two entries differ: type the same PIN twice.');
    expect(r.ok).toEqual(['', '']);
    const lens = await page.evaluate(async () => { const w = window as any; return [(await w.grdMakeSecret('4829')).len, (await w.grdMakeSecret('48291637')).len ?? null, (await w.grdMakeSecret('4829')).digits]; });
    expect(lens).toEqual([4, null, true]);
  });

  test('the lock: the mark, the company, Welcome back, the person remembered, four wells, the keypad; Sign in at four digits, never sent at the fourth', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('.inv-guard-mark .inv-ico-mark')).toBeVisible();
    await expect(lock.locator('.inv-guard-eyebrow')).toHaveText('SOMA ELECTRO PRODUCTS');
    await expect(lock.locator('.inv-guard-title')).toHaveText('Welcome back');
    await expect(lock.locator('[data-grd-person="U-own"]')).toContainText('Asha Rao');
    await expect(lock.locator('[data-grd-person="U-own"]')).toContainText('Owner');
    // Four wells, the keypad's twelve keys; the system's keyboard stays down (the keypad types).
    await expect(lock.locator('[data-pin] .inv-pin-well')).toHaveCount(4);
    await expect(lock.locator('#grdPin')).toHaveAttribute('inputmode', 'none');
    await expect(lock.locator('#grdPin')).toHaveAttribute('maxlength', '4');
    await expect(lock.locator('[data-grd-keypad] .inv-key')).toHaveCount(12);
    await expect(lock.locator('[data-grd-keypad] [data-action="invGuardForgot"]')).toHaveText('Forgot your PIN?');
    const go = lock.locator('[data-action="invGuardUnlock"]');
    await expect(go).toHaveText('Sign in');
    await expect(go).toBeDisabled();
    // A key a dot; ⌫ takes one back; Sign in only at four; the fourth digit sends nothing by itself.
    await tap(page, '482');
    expect(await dots(page)).toBe(3);
    await expect(go).toBeDisabled();
    await tap(page, '<');
    expect(await dots(page)).toBe(2);
    await tap(page, '29');
    expect(await dots(page)).toBe(4);
    await expect(go).toBeEnabled();
    await tap(page, '7');   // a fifth digit is no digit
    expect(await dots(page)).toBe(4);
    await page.waitForTimeout(300);
    await expect(lock).toBeVisible();
    // The keys are 44px targets at least, and the wells are wells (a sunk well, not a field's border).
    const sizes = await page.evaluate(() => Array.from(document.querySelectorAll('#guardRoot .inv-key')).map(k => Math.round(k.getBoundingClientRect().height)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    await go.click();
    await expect(lock).toHaveCount(0);
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'AR');
    // Locked again, the person's row says when they were last in.
    await lockNow(page);
    await expect(lock.locator('[data-grd-person="U-own"]')).toContainText(/last in today, \d{1,2}:\d{2} (AM|PM)/);
  });

  test('a wrong PIN: the wells red and shaken (a colour alone under reduced motion), the tries counted, the wells cleared', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    await tap(page, '1357');
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Wrong PIN · 4 tries left');
    await expect(lock.locator('[data-pin]')).toHaveAttribute('data-wrong', '');
    expect(await dots(page)).toBe(0);
    // The well's edge eases into the danger tone (--dur-1): read once it has settled, as CI's runner can read it mid-way.
    const look = () => lock.locator('[data-pin]').evaluate(el => {
      const w = el.querySelector('.inv-pin-well')!, probe = document.createElement('div');
      probe.style.color = 'var(--danger)'; document.body.appendChild(probe);
      const out = { border: getComputedStyle(w).borderTopColor, danger: getComputedStyle(probe).color, anim: getComputedStyle(el.querySelector('.inv-pin-wells')!).animationName };
      probe.remove(); return out;
    });
    await expect.poll(async () => { const l = await look(); return l.border === l.danger; }).toBe(true);
    expect((await look()).anim).toBe('inv-pin-shake');
    // A digit typed again takes the red away.
    await tap(page, '4');
    await expect(lock.locator('[data-pin]')).not.toHaveAttribute('data-wrong', '');
    // Under reduced motion the wells only turn red.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await tap(page, '111');
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Wrong PIN · 3 tries left');
    expect(await lock.locator('.inv-pin-wells').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    // The right PIN opens.
    await tap(page, FOUR.owner);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
  });

  test('Not you? opens the IDs as a sheet; a pick closes it, and Escape shuts it', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    await lock.locator('[data-action="invGuardNotYou"]').click();
    const sheet = lock.locator('[data-grd-sheet]');
    await expect(sheet.locator('[role="radio"]')).toHaveCount(3);
    await expect(sheet.locator('[role="radio"][aria-checked="true"]')).toContainText('Asha Rao');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await lock.locator('[data-action="invGuardNotYou"]').click();
    await sheet.locator('[data-id="U-off"]').click();
    await expect(sheet).toHaveCount(0);
    await expect(lock.locator('[data-grd-person="U-off"]')).toContainText('Chitra Sen');
    await expect(lock.locator('label[for="grdPin"]')).toHaveText('PIN for Chitra Sen');
    // Somebody other than the owner who forgot is sent to the owner.
    await lock.locator('[data-grd-keypad] [data-action="invGuardForgot"]').click();
    await expect(lock.locator('[data-grd-forgot]')).toHaveText('The owner can reset it.');
    await tap(page, FOUR.office);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
  });

  test('a PIN from before is typed, then asked to become four digits: Set takes it, Later keeps the old one until the next sign-in', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-sup');
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('[data-grd-old]')).toHaveText('Your PIN is from before: type it.');
    await expect(lock.locator('#grdPin')).toHaveAttribute('maxlength', '64');
    await expect(lock.locator('[data-grd-keypad]')).toHaveCount(0);
    await lock.locator('#grdPin').fill(OLD.super);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    // Right: the lock stays, asking for four digits; Later signs in on the old one.
    await expect(lock.locator('[data-grd-upgrade]')).toBeVisible();
    await expect(lock.locator('[data-grd-keypad]')).toHaveCount(1);
    await lock.locator('[data-action="invGuardLater"]').click();
    await expect(lock).toHaveCount(0);
    expect((await readStoredState(page)).users.find((u: any) => u.id === 'U-sup').secret.len).toBeUndefined();
    // Asked again at the next sign-in. A PIN too easy is refused; the keypad fills one well group, then the next.
    await lockNow(page);
    await lock.locator('#grdPin').fill(OLD.super);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-upgrade]')).toBeVisible();
    await tap(page, '11111111');
    await lock.locator('[data-action="invGuardUpgrade"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Too easy to guess: not one digit four times, a run like 1234, or a common PIN.');
    await lock.locator('#grdUp1').fill('');
    await lock.locator('#grdUp2').fill('');
    await page.evaluate(() => { const r = document.getElementById('guardRoot')!; delete (r as HTMLElement).dataset.pinAt; });
    await tap(page, '53075307');
    expect(await lock.locator('#grdUp1').inputValue()).toBe('5307');
    expect(await lock.locator('#grdUp2').inputValue()).toBe('5307');
    await lock.locator('[data-action="invGuardUpgrade"]').click();
    await expect(lock).toHaveCount(0);
    await expect(page.locator('.inv-toast')).toContainText('Your PIN is four digits now');
    const st = await readStoredState(page);
    const sup = st.users.find((u: any) => u.id === 'U-sup');
    expect(sup.secret.len).toBe(4);
    // Logged under the person who changed it.
    expect(st.changeLog.some((e: any) => e.coll === 'users' && e.by === 'U-sup')).toBe(true);
    // The old PIN no longer opens; the new one does, in the wells, with no question after it.
    await lockNow(page);
    await expect(lock.locator('[data-grd-old]')).toHaveCount(0);
    await tap(page, '5307');
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
  });

  test('nothing of the book is drawn before sign-in: no money, no count, no figure; the theme can be changed there', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    const text = await lock.innerText();
    expect(text).not.toMatch(/₹|SEP\/TEST|BRKT|Nitric/);
    expect(await lock.locator('[data-prt-light], .inv-mast, .inv-widget, .inv-badge').count()).toBe(0);
    // The theme toggle in the corner: dark, then light again.
    const was = await page.evaluate(() => document.documentElement.dataset.theme || '');
    await lock.locator('[data-action="invGuardTheme"]').click();
    const now = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(now).not.toBe(was);
    await expect(lock.locator('[data-action="invGuardTheme"]')).toHaveAttribute('aria-label', now === 'dark' ? 'Light theme' : 'Dark theme');
  });

  test('Change my PIN and the PIN asked again take four wells and the keypad; the keypad runs on from one well group to the next', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    await tap(page, FOUR.owner);
    await page.locator('#guardRoot [data-action="invGuardUnlock"]').click();
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    await windowGone(page);
    await g(page, "cancelInvoice('INV-1')");
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('[data-pin] .inv-pin-well')).toHaveCount(4);
    await expect(ask.locator('[data-grd-keypad]')).toHaveCount(1);
    await tap(page, FOUR.owner, '[data-grd-ask]');
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
    await page.locator('[data-action="invCloseConfirm"]').last().click();
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardChangePin"]').click();
    const form = page.locator('[data-grd-form="mine"]');
    await expect(form.locator('[data-pin]')).toHaveCount(3);
    await expect(form.locator('.inv-field-hint')).toContainText('Four digits: not one digit four times, a run like 1234, or a common PIN.');
    await tap(page, FOUR.owner + '61486148', '[data-grd-form="mine"]');
    expect(await Promise.all(['#grdCur', '#grdP1', '#grdP2'].map(s => form.locator(s).inputValue()))).toEqual([FOUR.owner, '6148', '6148']);
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form).toHaveCount(0);
    expect(await page.evaluate(async () => { const w = window as any; return w.grdVerify(w.grdUserById('U-own').secret, '6148'); })).toBe(true);
  });

  test('the lock, the PIN from before, its question and the sheet are drawn from the components', async ({ page }) => {
    test.setTimeout(120_000);
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const stops: Stop[] = [];
    const at = async (name: string) => { const s = await sweep(page, name); s.blank = false; stops.push(s); };
    await at('lock, four digits');
    await page.locator('#guardRoot [data-action="invGuardNotYou"]').click();
    await at('lock, the IDs as a sheet');
    await page.locator('#guardRoot [data-grd-sheet] [data-id="U-sup"]').click();
    await at('lock, a PIN from before');
    await page.locator('#grdPin').fill(OLD.super);
    await page.locator('#guardRoot [data-action="invGuardUnlock"]').click();
    await expect(page.locator('[data-grd-upgrade]')).toBeVisible();
    await at('lock, set four digits');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await at('lock, set four digits, dark');
    expect(problems(stops)).toEqual([]);
  });

  test('the icons: the manifest names files that exist at the sizes it says, a maskable one, on the page’s colour', async () => {
    const m = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    expect(m.background_color).toBe('#e1e6eb');
    const pngs = m.icons.filter((i: any) => i.type === 'image/png');
    for (const i of pngs) {
      expect(existsSync(path.join(ROOT, i.src)), i.src).toBe(true);
      const [w, h] = pngSize(i.src);
      expect(`${w}x${h}`, i.src).toBe(i.sizes);
    }
    expect(m.icons.some((i: any) => i.purpose === 'maskable' && i.src !== m.icons.find((x: any) => x.purpose === 'any' && x.sizes === '512x512').src)).toBe(true);
    expect(existsSync(path.join(ROOT, 'favicon.svg'))).toBe(true);
    expect(pngSize('favicon-32.png')).toEqual([32, 32]);
    for (const p of ['zinc', 'teal', 'terracotta']) {
      expect(readFileSync(path.join(ROOT, `icons/icon-${p}.svg`), 'utf8')).toContain('<circle cx="12" cy="12" r="3"/>');
      expect(pngSize(`icons/icon-${p}-192.png`)).toEqual([192, 192]);
      expect(pngSize(`icons/icon-${p}-512.png`)).toEqual([512, 512]);
    }
    // The maskable icon keeps the mark in the middle 80%: its corners are the accent, to the edge.
    const b = readFileSync(path.join(ROOT, 'icon-512-maskable.png'));
    expect(b.length).toBeGreaterThan(1000);
    // Made by the script in the repo from the mark the app draws.
    const tool = readFileSync(path.join(ROOT, 'tools/make-icons.mjs'), 'utf8');
    expect(tool).toContain("state.indexOf('function markSvg')");
  });
});
