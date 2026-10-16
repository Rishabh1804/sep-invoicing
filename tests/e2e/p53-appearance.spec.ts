import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, switchTab, readStoredState, type SepState } from './fixtures';

// P53: design system v2.0 foundation — theme follows the phone, three palettes chosen
// per device, the new top bar and bottom bar, and printed documents left on their own faces. Zinc & brass is the default since
// UI pass 3 (docs/UI_PASS_3.md §1a-2, §3a); a device that chose a palette keeps it.

const load = (page: Page) => loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
const css = (page: Page, sel: string, prop: string) =>
  page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);

test.describe('P53: appearance', () => {
  test('with nothing chosen the theme follows the phone, both ways', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await load(page);
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /./);
    await expect(html).toHaveAttribute('data-palette', 'zinc');
    expect(await css(page, 'body', 'background-color')).toBe('rgb(14, 17, 20)');
    // No theme class: colour-scheme alone decides every token (the v1.0 `.dark` rules are gone).
    await expect(html).not.toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => css(page, 'body', 'background-color')).toBe('rgb(225, 230, 235)');
  });

  test('Settings → Appearance switches palette and theme at once, keeps them on the device, never on the books', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'appearance');
    await expect(page.locator('[data-sum="appearance"]')).toHaveText('Zinc & brass · follows the phone · compact on desktop');
    await page.locator('[data-action="invAppearance"][data-k="palette"][data-v="teal"]').click();
    await page.locator('[data-action="invAppearance"][data-k="theme"][data-v="dark"]').click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-palette', 'teal');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-action="invAppearance"][data-k="palette"][data-v="teal"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-sum="appearance"]')).toHaveText('Teal · dark · compact on desktop');
    // Applied without a Save, and there is no Save to press.
    await expect(page.locator('[data-action="invSaveSettingsSec"][data-sec="appearance"]')).toHaveCount(0);
    expect(await css(page, '.inv-topbar', 'background-color')).toBe('rgb(19, 26, 27)');
    const ls = await page.evaluate(() => [localStorage.getItem('sep_inv_palette'), localStorage.getItem('sep_inv_theme')]);
    expect(ls).toEqual(['teal', 'dark']);
    const s = await readStoredState(page) as any;
    for (const k of ['theme', 'palette', 'density', 'appearance']) expect(s).not.toHaveProperty(k);

    // Painted before the app boots on the next open, and System clears the choice.
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    await expect(html).toHaveAttribute('data-palette', 'teal');
    await openSettingsAt(page, 'appearance');
    await page.locator('[data-action="invAppearance"][data-k="theme"][data-v="system"]').click();
    await expect(html).not.toHaveAttribute('data-theme', /./);
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_theme'))).toBeNull();
  });

  test('text on the accent stays readable in the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await load(page);
    // Zinc & brass's dark accent is light, so its text is dark — never the v1.0 hard-coded white. The primary's face runs from the
    // accent to a step deeper (UI pass 3, §3b).
    expect(await css(page, '#pageHome .inv-btn-grid .inv-btn-primary', 'color')).toBe('rgb(27, 18, 4)');
    expect(await css(page, '#pageHome .inv-btn-grid .inv-btn-primary', 'background-image')).toBe('linear-gradient(rgb(220, 170, 76), rgb(185, 143, 63))');
  });

  test('the top bar names the workspace, its tab row the screen, and the system bar matches it', async ({ page }) => {
    await load(page);
    await expect(page.locator('#topbarTitle')).toHaveText('Today');
    await switchTab(page, 'pageRegister');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('#wsTabs .inv-viewtab[aria-selected="true"]')).toHaveText('Invoices');
    await switchTab(page, 'pageStock');
    await expect(page.locator('#topbarTitle')).toHaveText('Floor');
    await expect(page.locator('#wsTabs .inv-viewtab[aria-selected="true"]')).toHaveText('Stock');
    await expect(page.locator('.inv-navbar-item[data-ws="floor"]')).toHaveClass(/inv-navbar-item-on/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#eff3f6');
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
