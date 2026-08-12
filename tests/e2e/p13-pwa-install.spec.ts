import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

/*
 * PWA install and offline contract.
 *
 * Service workers are blocked in playwright.config.ts, so this does not drive a
 * real offline session — it pins the two things that were actually broken and
 * that a browser checks before it will offer to install:
 *
 *  - the manifest declared no icons at all, so Chrome had nothing meeting its
 *    installability bar even though both PNGs shipped and were being cached;
 *  - the worker's install step put a cross-origin font URL inside the same
 *    atomic addAll() as the local assets, so one CDN failure rejected the
 *    install and the worker never activated.
 */

test.describe('PWA manifest', () => {
  test('declares icons that exist and are the sizes they claim', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();

    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Chrome's installability floor is an icon of at least 192px.
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    // An adaptive-icon entry, or Android letterboxes the icon in a white circle.
    const maskable = manifest.icons.filter((i: { purpose?: string }) =>
      (i.purpose || '').split(/\s+/).includes('maskable'));
    expect(maskable.length).toBeGreaterThan(0);

    // Every declared source has to actually resolve.
    for (const icon of manifest.icons) {
      const iconRes = await request.get('/' + icon.src);
      expect(iconRes.ok(), `${icon.src} should be served`).toBeTruthy();
    }
  });

  test('carries the identity fields an installed app is listed under', async ({ request }) => {
    const manifest = await (await request.get('/manifest.json')).json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
  });

  test('app shortcuts point at tabs the app can actually open', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.json')).json();
    await loadAppWithState(page, emptyState());

    for (const shortcut of manifest.shortcuts || []) {
      const tab = new URL(shortcut.url, 'http://x/').searchParams.get('tab');
      expect(tab, `${shortcut.name} should name a tab`).toBeTruthy();
      await expect(page.locator(`#${tab}`)).toHaveCount(1);
    }
  });

  test('the document links the manifest and declares install metadata', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#/);
    // The standard spelling, not only the Apple-prefixed one.
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  });

  test('a ?tab= launch opens that tab', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => { localStorage.setItem(key as string, value as string); },
      ['sep_invoicing_state', JSON.stringify(emptyState())] as const,
    );
    await page.goto('/?tab=pageStats');
    await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
    await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
    // The query is consumed, so a later refresh is an ordinary load.
    expect(new URL(page.url()).search).toBe('');
  });
});

test.describe('service worker source contract', () => {
  test('navigations are network-first, and the font CSS cannot fail the install', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const src = await res.text();

    // Core same-origin assets stay atomic; the cross-origin font is separate
    // and swallows its own failure.
    expect(src).toContain('CORE_ASSETS');
    expect(src).toContain('OPTIONAL_ASSETS');
    expect(src).toMatch(/OPTIONAL_ASSETS[\s\S]{0,200}cache\.add\([\s\S]{0,60}catch/);
    // The font URL must not be inside the atomic list.
    expect(src).not.toMatch(/CORE_ASSETS\s*=\s*\[[^\]]*fonts\.googleapis/);

    // Navigation handling fetches before it ever consults the cache — the
    // property that keeps Canon 0034's guarantee intact.
    const navFn = src.slice(src.indexOf('async function navigationResponse'));
    const fetchAt = navFn.indexOf('await fetch(req)');
    const matchAt = navFn.indexOf('shell.match');
    expect(fetchAt).toBeGreaterThan(-1);
    expect(matchAt).toBeGreaterThan(fetchAt);

    // Live endpoints are never intercepted.
    expect(src).toContain('generativelanguage.googleapis.com');
    expect(src).toContain('api.github.com');
  });

  test('the cache version was bumped alongside the asset list', async ({ request }) => {
    const src = await (await request.get('/sw.js')).text();
    const match = src.match(/CACHE_NAME\s*=\s*'sep-inv-v(\d+)'/);
    expect(match, 'CACHE_NAME should be a versioned sep-inv-vN string').toBeTruthy();
    expect(Number(match![1])).toBeGreaterThanOrEqual(28);
  });
});
