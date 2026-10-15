import { test, expect } from '@playwright/test';
import { emptyState, kbEvery, loadAppWithState, noSeedIM, openSettingsAt } from './fixtures';

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

/* The writing standard (owner, 14 Oct 2026): ASD-STE100 Simplified Technical English, followed 80% of the way. Before the
   rewrite 106 of the guides' 696 sentences ran past 25 words; after it, 7 of 1,211, each a list written out in a sentence. */
test('every app guide is written in Simplified Technical English, 80% of the way', async ({ page }) => {
  await loadAppWithState(page, book());
  const r = await page.evaluate(() => {
    const sents = (b: string) => b.split('\n').map(l => l.replace(/^(#|-|\d+\.)\s+/, '')).join('\n')
      .split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    let all = 0, over25 = 0, over35 = 0, semis = 0;
    for (const a of (window as any).KB_APP_GUIDES) {
      for (const s of sents(a.body)) { const n = s.split(/\s+/).length; all++; if (n > 25) over25++; if (n > 35) over35++; }
      semis += (a.body.match(/;/g) || []).length;
    }
    const w = (window as any).KB_APP_GUIDES.find((a: any) => a.id === 'app-writing');
    return { all, over25, over35, semis, writing: w && w.body };
  });
  expect(r.over35).toBe(0);
  expect(r.over25 / r.all).toBeLessThan(0.02);
  expect(r.semis).toBe(0);
  expect(r.writing).toContain('Simplified Technical English');
  expect(r.writing).toContain('20 words or fewer');
});

test('the Library lists the shop’s own articles first, and the app’s guides after them in one group', async ({ page }) => {
  const s = book();
  (s as any).kb = { articles: [{ id: 'kb-mine-1', kind: 'guide', title: 'Zinc bath top-up', status: 'published', version: 1, versions: [], roles: [], body: 'Add the zinc.', links: [], by: 'Owner', at: Date.now() }], trained: [], paths: [] };
  await loadAppWithState(page, s);
  await page.evaluate(() => (window as any).navApply({ tab: 'pageKnow', v: 'library', id: '' }));
  await kbEvery(page);
  const heads = await page.locator('#kbLibrary .inv-row-group > span:first-child').allTextContents();
  expect(heads[0]).toBe('How-tos');
  expect(heads[heads.length - 1]).toBe('The app’s guides');
  await expect(page.locator('#kbLibrary [data-kb-row="kb-mine-1"]')).toBeVisible();
});
