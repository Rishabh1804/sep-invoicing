import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, emptyState, answerAsk, openSettingsAt } from './fixtures';
import { PINS, guardBook, withUsers, unlock } from './p140-guard.fixture';

// P146: three doors the review of Direction B found the guard did not cover (1 Oct 2026). Add → File took a backup, a roster
// or the payroll as paid past the permission its own screen's Import asks for; search listed invoices, bank rows and credit
// notes to a role whose screens hide them; and saving Settings → GitHub sync wrote an empty token field over a token not
// read yet. Every name is made up.

const ev = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

async function pickFile(page: Page, name: string, obj: unknown) {
  if (!(await page.locator('[data-add-sheet]').count())) await page.locator('.inv-navbar-add').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="file"]').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(JSON.stringify(obj)) });
}

test('Add → File: a supervisor cannot take a backup or the payroll in; the owner is asked as Settings → Import asks', async ({ page }) => {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  // A backup replaces the book: an import, which a supervisor may not make.
  const backup = { ...emptyState(), company: { ...emptyState().company, name: 'TAKEN OVER CO' } };
  await pickFile(page, 'backup.json', backup);
  expect(await answerAsk(page, 'ok')).toMatch(/import a backup/i);
  expect(await ev(page, 'S.company.name')).not.toBe('TAKEN OVER CO');
  expect(await ev(page, 'S.users.length')).toBe(3);
  // The payroll as paid is a payment, and Staff's Pay is not a supervisor's either.
  await pickFile(page, 'payroll.json', { format: 'sep-payroll-paid', version: 1, months: [] });
  expect(await answerAsk(page, 'ok')).toBeTruthy();
  expect(await ev(page, '(S.payrollPaid || []).length')).toBe(0);
});

test('search: a supervisor finds no invoice, bank row or credit note, and no screen it may not open', async ({ page }) => {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  const kinds = await ev(page, `srchIndex().map(function(e){ return e.kind; })`) as string[];
  for (const k of ['invoice', 'bank', 'cn', 'client', 'challan']) expect(kinds).not.toContain(k);
  expect(kinds).toContain('stock');
  const res = await ev(page, `srchQuery('SEP/TEST-00001').groups.map(function(g){ return g.kind; })`);
  expect(res).toEqual([]);
  const screens = await ev(page, `srchIndex().filter(function(e){ return e.kind === 'screen' && e.go.kind === 'place'; }).map(function(e){ return e.go.loc.tab; })`) as string[];
  for (const t of ['pageRegister', 'pageFinance', 'pageIM']) expect(screens).not.toContain(t);
  // The owner, after the switch, finds them again.
  await ev(page, `grdSessClear()`);
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await unlock(page, 'U-own', PINS.owner);
  expect(await ev(page, `srchQuery('SEP/TEST-00001').groups.map(function(g){ return g.kind; })`)).toEqual(['invoice']);
});

test('Settings → GitHub sync: saving with the token not read yet keeps the stored token', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState() });
  await ev(page, `setGhConfig(Object.assign(getGhConfig(), { owner: 'testowner', repo: 'testrepo' }))`);
  await ev(page, `setGhToken('github_pat_P146KEEP')`);
  await expect.poll(() => ev(page, 'getGhToken()')).toBe('github_pat_P146KEEP');
  // The token in memory not read yet (a slow start): the field is drawn empty.
  await ev(page, `window.__realGet = getGhToken; getGhToken = function() { return ''; }`);
  await openSettingsAt(page, 'sync');
  await expect(page.locator('#setGhToken')).toHaveValue('');
  await page.locator('#setGhAuto').check();
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="sync"]').click();
  await ev(page, `getGhToken = window.__realGet`);
  expect(await ev(page, 'getGhToken()')).toBe('github_pat_P146KEEP');
  // A token typed over it is written.
  await page.locator('#setGhToken').fill('github_pat_P146NEW');
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="sync"]').click();
  await expect.poll(() => ev(page, 'getGhToken()')).toBe('github_pat_P146NEW');
});
