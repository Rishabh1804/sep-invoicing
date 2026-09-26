import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, switchTab, readStoredState, type SepState } from './fixtures';

// P53: design system v2.0 foundation — theme follows the phone, three palettes chosen
// per device, the new top bar and bottom bar, and printed documents left on their own faces.

const load = (page: Page) => loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
const css = (page: Page, sel: string, prop: string) =>
  page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);

test.describe('P53: appearance', () => {
  test('with nothing chosen the theme follows the phone, both ways', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await load(page);
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /./);
    await expect(html).toHaveAttribute('data-palette', 'teal');
    expect(await css(page, 'body', 'background-color')).toBe('rgb(13, 18, 19)');
    // No theme class: colour-scheme alone decides every token (the v1.0 `.dark` rules are gone).
    await expect(html).not.toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => css(page, 'body', 'background-color')).toBe('rgb(238, 242, 243)');
  });

  test('Settings → Appearance switches palette and theme at once, keeps them on the device, never on the books', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'appearance');
    await expect(page.locator('[data-sum="appearance"]')).toHaveText('Teal · follows the phone · compact on desktop');
    await page.locator('[data-action="invAppearance"][data-k="palette"][data-v="zinc"]').click();
    await page.locator('[data-action="invAppearance"][data-k="theme"][data-v="dark"]').click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-palette', 'zinc');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-action="invAppearance"][data-k="palette"][data-v="zinc"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-sum="appearance"]')).toHaveText('Zinc & brass · dark · compact on desktop');
    // Applied without a Save, and there is no Save to press.
    await expect(page.locator('[data-action="invSaveSettingsSec"][data-sec="appearance"]')).toHaveCount(0);
    expect(await css(page, '.inv-topbar', 'background-color')).toBe('rgb(21, 25, 29)');
    const ls = await page.evaluate(() => [localStorage.getItem('sep_inv_palette'), localStorage.getItem('sep_inv_theme')]);
    expect(ls).toEqual(['zinc', 'dark']);
    const s = await readStoredState(page) as any;
    for (const k of ['theme', 'palette', 'density', 'appearance']) expect(s).not.toHaveProperty(k);

    // Painted before the app boots on the next open, and System clears the choice.
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    await expect(html).toHaveAttribute('data-palette', 'zinc');
    await openSettingsAt(page, 'appearance');
    await page.locator('[data-action="invAppearance"][data-k="theme"][data-v="system"]').click();
    await expect(html).not.toHaveAttribute('data-theme', /./);
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_theme'))).toBeNull();
  });

  test('text on the accent stays readable in the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await load(page);
    // Teal's dark accent is light, so its text is dark — never the v1.0 hard-coded white.
    expect(await css(page, '.inv-qa-pri', 'color')).toBe('rgb(4, 33, 29)');
    expect(await css(page, '.inv-qa-pri', 'background-color')).toBe('rgb(79, 193, 179)');
  });

  test('the top bar names the screen, and the system bar matches it', async ({ page }) => {
    await load(page);
    await expect(page.locator('#topbarTitle')).toHaveText('Home');
    await switchTab(page, 'pageRegister');
    await expect(page.locator('#topbarTitle')).toHaveText('Register');
    await switchTab(page, 'pageStock');
    await expect(page.locator('#topbarTitle')).toHaveText('Stock');
    await expect(page.locator('.inv-navbar-more')).toHaveClass(/inv-navbar-item-on/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f8fafa');
  });

  test('printed documents keep their own faces: the interface font never reaches paper', async ({ page }) => {
    await load(page);
    const faces = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement).getPropertyValue('--ff-base');
      const doc = document.createElement('div'); doc.className = 'inv-print-invoice'; document.body.appendChild(doc);
      const inv = getComputedStyle(doc).getPropertyValue('--ff-base'); doc.remove();
      return [root, inv];
    });
    expect(faces[0]).toContain('Geist');
    expect(faces[1]).toContain('Inter');
    expect(faces[1]).not.toContain('Geist');
  });
});
