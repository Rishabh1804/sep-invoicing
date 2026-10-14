import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt } from './fixtures';

/*
 * P218: the setup guides (owner, 14 Oct 2026: "These (print, github, etc.) should be knowledge base documents"). The office
 * printer, GitHub sync, a new device and the guard are app guides in the knowledge base, and each Settings section that sets
 * one up opens its guide.
 */

function book() { const s = emptyState(); (s as any).incomingMaterial = noSeedIM(); return s; }

const GUIDES: [string, string][] = [
  ['printer', 'app-printer'], ['sync', 'app-sync'], ['devices', 'app-devices'], ['users', 'app-guard'],
];

test('each setup is a guide in the knowledge base, naming nothing of the shop', async ({ page }) => {
  await loadAppWithState(page, book());
  const got = await page.evaluate(() => (window as any).KB_APP_GUIDES.filter((a: any) => /^app-(printer|sync|devices|guard)$/.test(a.id))
    .map((a: any) => ({ id: a.id, title: a.title, body: a.body, kind: a.kind, src: a.src })));
  expect(got.map((a: any) => a.id).sort()).toEqual(['app-devices', 'app-guard', 'app-printer', 'app-sync']);
  for (const a of got) {
    expect(a.kind).toBe('guide');
    expect(a.src).toBe('build');
    expect(a.title).toMatch(/^Setting up: /);
    // Nothing of the shop in the build: no address, serial or repository.
    expect(a.body).not.toMatch(/\d+\.\d+\.\d+\.\d+|github\.com\/|rishabh/i);
  }
  const printer = got.find((a: any) => a.id === 'app-printer');
  expect(printer.body).toContain('--kiosk-printing');
  expect(printer.body).toContain('Send to office');
  const dev = got.find((a: any) => a.id === 'app-devices');
  expect(dev.body).toContain('Take it and register');
  expect(dev.body).toContain('Who mainly uses it');
});

for (const [sec, id] of GUIDES) {
  test(`Settings → ${sec} opens its guide`, async ({ page }) => {
    await loadAppWithState(page, book());
    await openSettingsAt(page, sec);
    const link = page.locator(`[data-sec="${sec}"] [data-action="invSettingsGuide"][data-id="${id}"]`);
    await expect(link).toBeVisible();
    await expect(link).toContainText('Guide: Setting up');
    await link.click();
    await expect(page.locator('#settingsScrim')).toHaveCount(0);
    await expect(page.locator('#pageKnow')).toBeVisible();
    expect(await page.evaluate(() => new URL(location.href).searchParams.get('id'))).toBe(id);
  });
}

test('an unsaved section asks before the guide opens, and Keep editing stays', async ({ page }) => {
  await loadAppWithState(page, book());
  await openSettingsAt(page, 'printer');
  await page.locator('#setPrtName').fill('A printer');
  await page.locator('#setPrtName').dispatchEvent('input');
  await page.locator('[data-sec="printer"] [data-action="invSettingsGuide"]').click();
  const ask = page.locator('.inv-dialog', { hasText: 'Close without saving?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.locator('#settingsScrim')).toHaveCount(1);
  await expect(page.locator('#setPrtName')).toHaveValue('A printer');
});
