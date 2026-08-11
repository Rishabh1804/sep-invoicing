import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, SepState } from './fixtures';
import { readFile } from 'node:fs/promises';

/*
 * GitHub sync.
 *
 * The API is stubbed at the route layer, so what is under test is the part
 * that can actually be got wrong: the envelope written to the repo, the UTF-8
 * base64 round trip, and the SHA check that stops one device silently
 * overwriting another device's push.
 */

const SYNC_KEY = 'sep_inv_github_sync';
const TOKEN_KEY = 'sep_inv_github_token';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';

function b64ToUtf8(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8');
}

async function seedSync(page: Page, cfg: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([syncKey, tokenKey, cfgJson]) => {
      localStorage.setItem(syncKey as string, cfgJson as string);
      localStorage.setItem(tokenKey as string, 'github_pat_TESTTOKEN');
    },
    [SYNC_KEY, TOKEN_KEY, JSON.stringify({
      owner: 'testowner', repo: 'testrepo', branch: 'main',
      path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Test Bench',
      ...cfg,
    })] as const,
  );
}

/** Remote file absent: the ordinary first-push case. */
async function stubEmptyRemote(page: Page, onPut: (body: Record<string, unknown>) => void) {
  await page.route(CONTENTS, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
      return;
    }
    const body = JSON.parse(req.postData() || '{}');
    onPut(body);
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ content: { sha: 'newsha123' } }),
    });
  });
}

function remoteEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    app: 'sep-invoicing',
    schema: 1,
    savedAt: Date.now() - 60000,
    device: 'Other Device',
    deviceId: 'dev-other',
    counts: { invoices: 7, challans: 3, clients: 2, items: 0 },
    state: {
      ...emptyState(),
      invoices: [],
      clients: [{ id: 9, name: 'PULLED CLIENT', billingMode: 'kg', gstType: 'intra', isActive: true }],
    },
    ...overrides,
  };
}

test.describe('GitHub sync — push', () => {
  test('writes a SEP envelope wrapping the whole state', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    await seedSync(page);
    await stubEmptyRemote(page, (b) => { put = b; });
    await loadAppWithState(page, emptyState());

    await page.locator('[data-action="invGhPush"]').first().click();
    await expect(page.locator('.inv-toast')).toContainText('Pushed to GitHub');

    expect(put).not.toBeNull();
    const body = put as unknown as Record<string, string>;
    expect(body.branch).toBe('main');
    // No file existed, so no sha may be sent.
    expect(body.sha).toBeUndefined();

    const envelope = JSON.parse(b64ToUtf8(body.content));
    expect(envelope.app).toBe('sep-invoicing');
    expect(envelope.schema).toBe(1);
    expect(envelope.device).toBe('Test Bench');
    expect(envelope.state.company.name).toBe('SOMA ELECTRO PRODUCTS');
    expect(envelope.counts).toHaveProperty('invoices');
  });

  test('survives non-Latin-1 text in the state', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    const state = emptyState();
    // btoa() alone throws on this; the encoder has to go through UTF-8 bytes.
    state.clients = [{ id: 1, name: 'श्री क्लाइंट ₹ — Ω', billingMode: 'kg', gstType: 'intra' }];
    await seedSync(page);
    await stubEmptyRemote(page, (b) => { put = b; });
    await loadAppWithState(page, state);

    await page.locator('[data-action="invGhPush"]').first().click();
    await expect(page.locator('.inv-toast')).toContainText('Pushed to GitHub');

    const envelope = JSON.parse(b64ToUtf8((put as unknown as Record<string, string>).content));
    expect(envelope.state.clients[0].name).toBe('श्री क्लाइंट ₹ — Ω');
  });

  test('asks before overwriting a copy this device has not seen', async ({ page }) => {
    let putCount = 0;
    // Stored sha is stale: the remote moved on since this device last synced.
    await seedSync(page, { sha: 'oldsha' });
    await page.route(CONTENTS, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            sha: 'remotesha999',
            content: Buffer.from(JSON.stringify(remoteEnvelope())).toString('base64'),
          }),
        });
        return;
      }
      putCount++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'newsha' } }) });
    });
    await loadAppWithState(page, emptyState());

    // Decline: nothing is written.
    page.once('dialog', (d) => {
      expect(d.message()).toContain('has not seen');
      d.dismiss();
    });
    await page.locator('[data-action="invGhPush"]').first().click();
    await expect(page.locator('#homeSyncCard')).toBeVisible();
    expect(putCount).toBe(0);

    // Accept: the push carries the remote's current sha, not the stale one.
    page.once('dialog', (d) => d.accept());
    await page.locator('[data-action="invGhPush"]').first().click();
    await expect(page.locator('.inv-toast')).toContainText('Pushed to GitHub');
    expect(putCount).toBe(1);
  });

  test('reports an expired token in words rather than a status code', async ({ page }) => {
    await seedSync(page);
    await page.route(CONTENTS, async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Bad credentials' }) });
    });
    await loadAppWithState(page, emptyState());

    await page.locator('[data-action="invGhPush"]').first().click();
    await expect(page.locator('.inv-toast')).toContainText('rejected the token');
  });
});

test.describe('GitHub sync — pull', () => {
  test('replaces local data once confirmed', async ({ page }) => {
    await seedSync(page);
    await page.route(CONTENTS, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          sha: 'remotesha1',
          content: Buffer.from(JSON.stringify(remoteEnvelope())).toString('base64'),
        }),
      });
    });
    await loadAppWithState(page, emptyState());

    await page.locator('[data-action="invOpenSettings"]').first().click();
    page.once('dialog', (d) => {
      expect(d.message()).toContain('Replace ALL data');
      d.accept();
    });
    await page.locator('#ghPullBtn').click();

    await expect(page.locator('.inv-toast')).toContainText('Pulled from GitHub');
    const clients = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!).clients);
    expect(clients[0].name).toBe('PULLED CLIENT');
  });

  test('refuses a file that is not a SEP backup', async ({ page }) => {
    await seedSync(page);
    await page.route(CONTENTS, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          sha: 'x',
          content: Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64'),
        }),
      });
    });
    await loadAppWithState(page, emptyState());

    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('#ghPullBtn').click();
    await expect(page.locator('.inv-toast')).toContainText('not a SEP Invoicing backup');
  });
});

test.describe('GitHub sync — configuration', () => {
  test('settings round-trip the repo details, and the token stays out of the export', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.locator('[data-action="invOpenSettings"]').first().click();

    await page.locator('#setGhOwner').fill('testowner');
    await page.locator('#setGhRepo').fill('testrepo');
    await page.locator('#setGhToken').fill('github_pat_SECRETVALUE');
    await page.locator('[data-action="invSaveSettings"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Settings saved');

    const cfg = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SYNC_KEY);
    expect(cfg.owner).toBe('testowner');
    expect(cfg.repo).toBe('testrepo');

    // Credentials live in their own key, never on the state object.
    const stateRaw = await page.evaluate(() => localStorage.getItem('sep_invoicing_state')!);
    expect(stateRaw).not.toContain('github_pat_SECRETVALUE');

    // And the JSON export is the artifact that actually leaves the device.
    await page.locator('[data-action="invOpenSettings"]').first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-action="invExportData"]').click(),
    ]);
    const contents = await readFile(await download.path(), 'utf8');
    expect(contents).not.toContain('github_pat_SECRETVALUE');
  });

  test('the home card only appears once sync is configured', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await expect(page.locator('#homeSyncCard .inv-sync-card')).toHaveCount(0);

    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('#setGhOwner').fill('testowner');
    await page.locator('#setGhRepo').fill('testrepo');
    await page.locator('#setGhToken').fill('github_pat_TESTTOKEN');
    await page.locator('[data-action="invSaveSettings"]').click();

    await expect(page.locator('#homeSyncCard .inv-sync-card')).toBeVisible();
    await expect(page.locator('#homeSyncCard')).toContainText('testowner/testrepo');
  });

  test('changing the target repo drops the remembered sha', async ({ page }) => {
    await seedSync(page, { sha: 'oldsha' });
    await loadAppWithState(page, emptyState());

    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('#setGhRepo').fill('a-different-repo');
    await page.locator('[data-action="invSaveSettings"]').click();

    // A sha from the old file would let the next push overwrite a file this
    // device has never read.
    const cfg = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SYNC_KEY);
    expect(cfg.sha).toBeNull();
  });
});
