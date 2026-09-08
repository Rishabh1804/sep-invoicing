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
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
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
    expect(Number(match![1])).toBeGreaterThanOrEqual(29);
  });

  test('the offline shell survives a worker update', async ({ request }) => {
    const src = await (await request.get('/sw.js')).text();

    // The shell cache carried the version suffix, so every bump deleted the
    // only offline copy: the navigation that triggers an update is served by
    // the OLD worker into the OLD cache, and the new worker's activate step
    // then dropped it. Unversioned, the entry outlives the worker that wrote it.
    expect(src).toMatch(/SHELL_CACHE\s*=\s*'sep-inv-shell'/);
    expect(src).toContain("KEEP_CACHES = [CACHE_NAME, SHELL_CACHE]");

    // The one upgrade that crosses the rename copies the legacy entry across
    // before the old caches are deleted.
    const activate = src.slice(src.indexOf("addEventListener('activate'"));
    const migrateAt = activate.indexOf('migrateLegacyShell(');
    const deleteAt = activate.indexOf('caches.delete');
    expect(migrateAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(migrateAt);
    expect(src).toMatch(/LEGACY_SHELL_PREFIX\s*=\s*'sep-inv-shell-v'/);
  });

  test('the update poll is never answered from the cache', async ({ request }) => {
    const src = await (await request.get('/sw.js')).text();
    // A cache-first answer here would hand the app its own stale stamp
    // forever, so the worker steps aside for this one path before the
    // asset branch can claim it.
    const fetchFn = src.slice(src.indexOf("addEventListener('fetch'"));
    const bypassAt = fetchFn.indexOf('UPDATE_MANIFEST');
    const assetAt = fetchFn.indexOf('assetResponse(');
    expect(bypassAt).toBeGreaterThan(-1);
    expect(assetAt).toBeGreaterThan(bypassAt);
    expect(src).toMatch(/UPDATE_MANIFEST\s*=\s*'\/version\.json'/);
  });
});

/*
 * Build identity and the update prompt.
 *
 * A network-first worker makes every fresh OPEN current, but an installed app
 * resumed from recents never navigates, so nothing told an open page a build
 * had shipped. build.sh stamps the document and writes the same stamp to
 * version.json; the page re-reads it on becoming visible and offers a reload.
 */
test.describe('build stamp and update check', () => {
  async function servedBuild(request: Parameters<Parameters<typeof test>[1]>[0]['request']): Promise<string> {
    const html = await (await request.get('/')).text();
    const m = html.match(/<meta name="app-build" content="([0-9a-f]{8})">/);
    expect(m, 'the built document should carry an 8-hex build stamp').toBeTruthy();
    return m![1];
  }

  test('the document and version.json carry the same stamp', async ({ request }) => {
    const build = await servedBuild(request);
    const res = await request.get('/version.json');
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).build).toBe(build);
  });

  test('Settings shows the build the device is running', async ({ page, request }) => {
    const build = await servedBuild(request);
    await loadAppWithState(page, emptyState());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('.inv-build-id')).toHaveText(build);
    await expect(page.locator('[data-action="invCheckUpdate"]')).toHaveCount(1);
  });

  test('no banner while the server serves the same build', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const result = await page.evaluate(() => (window as any).checkForUpdate(true));
    expect(result).toBe('current');
    await expect(page.locator('.inv-update-bar')).toHaveCount(0);
  });

  test('a newer build on the server raises the banner, and Later silences that build only', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.route('**/version.json', route => route.fulfill({ json: { build: 'cafef00d' } }));

    const result = await page.evaluate(() => (window as any).checkForUpdate(true));
    expect(result).toBe('newer');
    const bar = page.locator('.inv-update-bar');
    await expect(bar).toHaveCount(1);
    await expect(bar.locator('[data-action="invReloadForUpdate"]')).toBeVisible();

    await bar.locator('[data-action="invDismissUpdate"]').click();
    await expect(bar).toHaveCount(0);

    // The same build does not nag again on the next passive check…
    await page.evaluate(() => { (window as any)._updateCheckedAt = 0; });
    await page.evaluate(() => (window as any).checkForUpdate(false));
    await expect(page.locator('.inv-update-bar')).toHaveCount(0);

    // …but a build after it does.
    await page.unroute('**/version.json');
    await page.route('**/version.json', route => route.fulfill({ json: { build: 'deadbeef' } }));
    await page.evaluate(() => { (window as any)._updateCheckedAt = 0; });
    await page.evaluate(() => (window as any).checkForUpdate(false));
    await expect(page.locator('.inv-update-bar')).toHaveAttribute('data-build', 'deadbeef');
  });

  test('Reload on the banner reloads the page', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.route('**/version.json', route => route.fulfill({ json: { build: 'cafef00d' } }));
    await page.evaluate(() => (window as any).checkForUpdate(true));
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('[data-action="invReloadForUpdate"]').click(),
    ]);
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
  });

  test('coming back into view re-checks', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.route('**/version.json', route => route.fulfill({ json: { build: 'cafef00d' } }));
    await page.evaluate(() => {
      (window as any)._updateCheckedAt = 0;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.inv-update-bar')).toHaveCount(1);
  });

  test('a device that cannot reach the server is told so, not told it is current', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.route('**/version.json', route => route.abort());
    const result = await page.evaluate(() => (window as any).checkForUpdate(true));
    expect(result).toBe('unknown');
    await expect(page.locator('.inv-update-bar')).toHaveCount(0);
  });
});
