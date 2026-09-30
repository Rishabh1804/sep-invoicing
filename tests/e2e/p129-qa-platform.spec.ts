import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { readFile } from 'node:fs/promises';
import { answerAsk, emptyState, loadAppWithState, openSettingsAt, readStoredState, recentTs, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { imState } from './im-fixture';

// P129: the platform's share of the QA audit of 30 Sep 2026. The four worst findings share one root: the GitHub SHA
// guard asked only when GitHub's copy had moved. It never noticed that this device's own book was a STAND-IN (the stored
// copy would not read, or the database came back empty) or had not reached disk, so a stand-in or a stale book went over
// the only other copy without a question.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const SYNC_KEY = 'sep_inv_github_sync';
const TOKEN_KEY = 'sep_inv_github_token';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';
// A stored copy cut off mid-write: it is there, and it will not parse.
const GARBAGE = '{"company": {"name": "HALF WRITTEN';

async function seedSync(page: Page, cfg: Record<string, unknown> = {}) {
  await page.addInitScript(([syncKey, tokenKey, cfgJson]) => {
    localStorage.setItem(syncKey as string, cfgJson as string);
    localStorage.setItem(tokenKey as string, 'github_pat_TESTTOKEN');
  }, [SYNC_KEY, TOKEN_KEY, JSON.stringify({
    owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json',
    deviceId: 'dev-test', deviceName: 'Test Bench', ...cfg,
  })] as const);
}
const syncCfg = (p: Page) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), SYNC_KEY);

function pulledState(): SepState {
  return { ...emptyState(), clients: [{ id: 9, name: 'PULLED CLIENT', billingMode: 'kg', gstType: 'intra' }] };
}
/** GitHub holds a SEP envelope at `sha` (7 invoices, 3 challans); every PUT is counted and answered with `newSha`. */
async function stubRemote(page: Page, sha: string, newSha = 'pushedsha') {
  let puts = 0;
  const env = {
    app: 'sep-invoicing', schema: 1, savedAt: Date.now() - 60000, device: 'Office desktop', deviceId: 'dev-other',
    counts: { invoices: 7, challans: 3, clients: 1, items: 0 }, state: pulledState(),
  };
  await page.route(CONTENTS, async (route) => {
    if (route.request().method() === 'PUT') {
      puts++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: newSha } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ sha, content: Buffer.from(JSON.stringify(env)).toString('base64') }) });
  });
  return { puts: () => puts };
}

// Every toast shown from here on, kept: a toast leaves by itself, so a retrying "none shown" passes once it has gone.
async function logToasts(page: Page) {
  await g(page, `window.__toasts = []; new MutationObserver(function(ms) { ms.forEach(function(m) { m.addedNodes.forEach(function(n) {
    if (n.classList && n.classList.contains('inv-toast')) window.__toasts.push(n.className + ' ' + n.textContent); }); }); })
    .observe(document.body, { childList: true })`);
}
const toastsShown = async (p: Page) => (await g(p, 'window.__toasts')) as string[];

// The store refuses every write of the state, as a full disk does.
async function breakStateWrites(page: Page) {
  await g(page, `IDBObjectStore.prototype.put = function(v, k) { throw new DOMException('Setting the value of ' + k + ' exceeded the quota.', 'QuotaExceededError'); }`);
}
async function importFile(page: Page, state: unknown) {
  await openSettingsAt(page, 'data');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-action="invImportData"]').click();
  await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state)) });
}
function realBook(): SepState {
  const s = emptyState();
  s.clients = [{ id: 1, name: 'REAL CLIENT', billingMode: 'kg', gstType: 'intra' }];
  (s as any).todo = { tasks: [{ id: 'T1', text: 'Ring the bank', createdAt: recentTs(), doneAt: null }], snoozes: {} };
  return s;
}
/** The book this device keeps, then its stored copy made unreadable, and a reload: the app starts on a stand-in. */
async function standInFromGarbage(page: Page) {
  await loadAppWithState(page, realBook());
  await g(page, `idbPutRaw(${JSON.stringify(GARBAGE)})`);
  await page.reload();
  await waitForBoot(page);
  await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toContainText('does not parse');
}
const widgetQueue = (p: Page) => g(p, `new Promise(function(r) { todoWidgetGet('queue').then(function(q) { r(q || []); }); })`);
const storeKeys = (p: Page) => g(p, `idbOpen().then(function(db) { return new Promise(function(r) {
  var q = db.transaction('state', 'readonly').objectStore('state').getAllKeys(); q.onsuccess = function() { r(q.result); }; }); })`);
const storeGet = (p: Page, key: string) => g(p, `idbOpen().then(function(db) { return new Promise(function(r) {
  var q = db.transaction('state', 'readonly').objectStore('state').get(${JSON.stringify(key)}); q.onsuccess = function() { r(q.result); }; }); })`);

test.describe('P129: a stand-in book never leaves the device as if it were the book (G7-1)', () => {
  test('auto-push is not armed, a silent push is refused, and a push by hand asks, naming both sides', async ({ page }) => {
    await seedSync(page, { autoPush: true, sha: 'remotesha' });
    const remote = await stubRemote(page, 'remotesha');
    await standInFromGarbage(page);
    // The start-up seeds saved (refused) the default book: that armed a push of it over the GitHub copy, whose SHA matched.
    expect(await g(page, '_ghPushTimer')).toBeNull();
    expect(await g(page, 'ghPushLocked({ silent: true })')).toBe(false);
    expect(remote.puts()).toBe(0);
    // Back up now: a question naming this window's stand-in and GitHub's copy, with their counts.
    await page.locator('#homeSyncCard [data-action="invGhPush"]').dispatchEvent('click');
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('stand-in');
    expect(said).toContain('0 invoices');
    expect(said).toContain('7 invoices, 3 challans');
    expect(remote.puts()).toBe(0);
    // Asked and answered, it goes; the SHA is not taken as this device's, so the next push asks again.
    await page.locator('#homeSyncCard [data-action="invGhPush"]').dispatchEvent('click');
    await answerAsk(page, 'ok');
    await expect.poll(() => remote.puts()).toBe(1);
    expect((await syncCfg(page)).sha).toBe('remotesha');
  });

  test("the read banner's export is the stored copy as it is; exporting the stand-in is not a backup", async ({ page }) => {
    await standInFromGarbage(page);
    const [raw] = await Promise.all([page.waitForEvent('download'),
      page.locator('.inv-storage-bar[data-kind="read"] .inv-btn-primary').dispatchEvent('click')]);
    expect(await readFile(await raw.path(), 'utf8')).toBe(GARBAGE);
    // Settings → Export JSON still saves what this window holds (typed work lives only here), named for what it is.
    await openSettingsAt(page, 'data');
    const [mem] = await Promise.all([page.waitForEvent('download'), page.locator('#settingsScrim [data-action="invExportData"]').click()]);
    expect(mem.suggestedFilename()).toContain('stand-in');
    // Neither counts as a backup for the To-do reminder.
    expect(await g(page, 'localStorage.getItem("sep_inv_last_export")')).toBeNull();
  });

  test("the widget's Done taps wait for the real book", async ({ page }) => {
    await standInFromGarbage(page);
    await g(page, `todoWidgetPut('queue', [{ id: 'T1', at: Date.now() }])`);
    await g(page, 'todoWidgetPublish()');
    await g(page, 'todoApplyWidgetQueue()');
    expect(await widgetQueue(page)).toHaveLength(1);
    // The real book comes back (an import of it): the tap lands on it.
    await importFile(page, realBook());
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast-success')).toHaveText('Data imported');
    await g(page, 'todoWidgetPublish()');
    expect(await widgetQueue(page)).toHaveLength(0);
    expect(await g(page, 'S.todo.tasks[0].doneBy')).toBe('widget');
  });
});

test.describe('P129: the way out of an unreadable copy (G7-4)', () => {
  test('an import sets the unreadable copy aside, never over it, and becomes the book', async ({ page }) => {
    await standInFromGarbage(page);
    const incoming = { ...emptyState(), company: { ...emptyState().company, name: 'IMPORTED CO' } };
    await importFile(page, incoming);
    expect(await answerAsk(page, 'ok')).toContain('set aside');
    await expect(page.locator('.inv-toast-success')).toHaveText('Data imported');
    await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toHaveCount(0);
    expect((await readStoredState(page)).company.name).toBe('IMPORTED CO');
    // Moved, not overwritten: the string that would not parse is kept whole under a key of its own.
    const aside = ((await storeKeys(page)) as string[]).filter(k => /^unreadable-/.test(k));
    expect(aside).toHaveLength(1);
    expect(await storeGet(page, aside[0])).toBe(GARBAGE);
    await page.reload();
    await waitForBoot(page);
    expect(await g(page, 'S.company.name')).toBe('IMPORTED CO');
    await expect(page.locator('.inv-storage-bar')).toHaveCount(0);
  });

  test('where nothing can be written, the import says why in the app\'s words, and replaces nothing', async ({ page }) => {
    await loadAppWithState(page, realBook());
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('breakIdb')) return;
      (indexedDB as any).open = function() { const r: any = {}; setTimeout(() => r.onerror && r.onerror(), 0); return r; };
    });
    await g(page, 'sessionStorage.setItem("breakIdb", "1")');
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toContainText('database would not open');
    await importFile(page, { ...emptyState(), company: { ...emptyState().company, name: 'IMPORTED CO' } });
    const toast = page.locator('.inv-toast-error');
    await expect(toast).toContainText('database would not open');
    expect(await toast.textContent()).not.toContain('browser refused');
    expect(await g(page, 'S.company.name')).not.toBe('IMPORTED CO');
  });
});

test.describe('P129: a book the browser threw away (G7-2)', () => {
  test('an empty database on a device that kept its book here is a stand-in, said so, until a pull', async ({ page }) => {
    await seedSync(page, { autoPush: true, sha: 'remotesha' });
    const remote = await stubRemote(page, 'remotesha');
    await page.goto('/');
    await waitForBoot(page);
    expect(await g(page, 'S.clients[0].name = "KEPT CLIENT"; saveState()')).toBe(true);
    expect(await g(page, 'localStorage.getItem("sep_inv_idb_used")')).toBe('1');
    // Evicted under storage pressure: the database is gone and the marker beside it is not.
    await g(page, `new Promise(function(r) { var q = indexedDB.deleteDatabase('sep-invoicing'); q.onsuccess = q.onerror = q.onblocked = function() { r(1); }; })`);
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toContainText('The book this device kept is gone');
    // Nothing is written, and nothing is pushed: this is not a new device's first book.
    expect(await g(page, 'readPersistedStateRaw()')).toBeNull();
    expect(await g(page, '_ghPushTimer')).toBeNull();
    expect(await g(page, 'ghPushLocked({ silent: true })')).toBe(false);
    expect(remote.puts()).toBe(0);
    // The way out: a pull, which lands, and whose SHA this device now holds.
    await openSettingsAt(page, 'sync');
    await page.locator('#ghPullBtn').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast-success')).toHaveText('Pulled from GitHub');
    await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toHaveCount(0);
    expect((await readStoredState(page)).clients[0].name).toBe('PULLED CLIENT');
    expect((await syncCfg(page)).sha).toBe('remotesha');
    await page.reload();
    await waitForBoot(page);
    expect(await g(page, 'S.clients[0].name')).toBe('PULLED CLIENT');
    await expect(page.locator('.inv-storage-bar')).toHaveCount(0);
  });
});

test.describe('P129: the SHA is this device\'s only for a book that reached its disk (G7-3)', () => {
  test('a pull whose save does not land says so and keeps the old SHA', async ({ page }) => {
    await seedSync(page, { sha: 'oldsha' });
    await stubRemote(page, 'remotesha1');
    await loadAppWithState(page, emptyState());
    await breakStateWrites(page);
    await logToasts(page);
    await openSettingsAt(page, 'sync');
    await page.locator('#ghPullBtn').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast-error')).toContainText('NOT saved');
    expect((await toastsShown(page)).filter(t => /inv-toast-success/.test(t))).toEqual([]);
    expect((await syncCfg(page)).sha).toBe('oldsha');
  });

  test('a push after a save that did not land does not take the SHA as this device\'s', async ({ page }) => {
    await seedSync(page, { sha: 'remotesha' });
    const remote = await stubRemote(page, 'remotesha', 'pushedsha');
    await loadAppWithState(page, emptyState());
    await breakStateWrites(page);
    expect(await g(page, 'S.company.name = "UNSAVED CO"; saveState()')).toBe(false);
    await page.locator('#homeSyncCard [data-action="invGhPush"]').dispatchEvent('click');
    await expect.poll(() => remote.puts()).toBe(1);
    await expect(page.locator('.inv-toast')).toContainText('Pushed');
    expect((await syncCfg(page)).sha).toBe('remotesha');
  });

  test('after an import the next push asks: auto-push pauses rather than send the imported book', async ({ page }) => {
    await seedSync(page, { sha: 'remotesha', autoPush: true });
    const remote = await stubRemote(page, 'remotesha');
    await loadAppWithState(page, emptyState());
    await importFile(page, { ...emptyState(), company: { ...emptyState().company, name: 'OLDER BACKUP' } });
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast-success')).toHaveText('Data imported');
    expect((await syncCfg(page)).sha).toBeNull();
    expect(await g(page, 'ghPushLocked({ silent: true })')).toBe(false);
    expect(remote.puts()).toBe(0);
    expect(await g(page, '_ghStatusText')).toContain('Auto-push paused');
  });
});

test('P129: a pull drops the old book\'s selections (G7-9)', async ({ page }) => {
  await seedSync(page);
  await stubRemote(page, 'remotesha1');
  await loadAppWithState(page, emptyState());
  await g(page, '_regSelectMode = true; _regSelected = { "INV-OLD": true }; _imSelected = { "IMI-OLD": true }');
  await openSettingsAt(page, 'sync');
  await page.locator('#ghPullBtn').click();
  await answerAsk(page, 'ok');
  await expect(page.locator('.inv-toast-success')).toHaveText('Pulled from GitHub');
  expect(await g(page, '[_regSelectMode, Object.keys(_regSelected).length, Object.keys(_imSelected).length]')).toEqual([false, 0, 0]);
});

test('P129: Open in Finance from a client being edited asks before the typing goes (G7-5)', async ({ page }) => {
  const s: any = emptyState();
  s.bank = { rows: [{ id: 'R1', date: todayIso(), narration: 'NEFT-TEST CLIENT KG', dr: 0, cr: 500, balance: 500 }], imports: [], parties: {}, opening: {} };
  await loadAppWithState(page, s);
  await switchTab(page, 'pageClients');
  await g(page, 'openClientEdit(1)');
  const go = page.locator('.inv-scrim-dialog [data-client-money] [data-action="invFinGo"]');
  await expect(go).toBeVisible();
  await page.locator('#ceditGstin').fill('20ABCDE1234F1Z5');
  await go.click();
  expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
  await expect(page.locator('#ceditGstin')).toHaveValue('20ABCDE1234F1Z5');
  await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
  await go.click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
});

test('P129: an address naming something that is not a page opens Home, and is not remembered (G7-6)', async ({ page }) => {
  await loadAppWithState(page, emptyState());
  await page.goto('/?tab=topbarTitle');
  await waitForBoot(page);
  await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#topbarTitle')).not.toHaveClass(/inv-page-active/);
  expect(await g(page, 'regFilter.activeTab || "pageHome"')).toBe('pageHome');
  await page.goto('/');
  await waitForBoot(page);
  await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
});

test('P129: with the shared pool full, moving between screens raises no error about view prefs (G7-8)', async ({ page }) => {
  await loadAppWithState(page, emptyState());
  await g(page, `(function() { var orig = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) {
    if (k === 'sep_inv_view_prefs') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    return orig.call(this, k, v); }; })()`);
  await logToasts(page);
  await switchTab(page, 'pageRegister');
  await switchTab(page, 'pageIM');
  await switchTab(page, 'pageHome');
  expect(await toastsShown(page)).toEqual([]);
});

test.describe('P129: a tap on the Windows widget leaves typed work only when told to (G7-10)', () => {
  test('a challan being typed: Stay keeps it, Leave opens the To-do', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imVehicleNo').fill('JH 05 1234');
    await g(page, 'void todoHandleLaunch("open")');
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    await g(page, 'void todoHandleLaunch("open")');
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageTodo')).toHaveClass(/inv-page-active/);
  });

  test('a dialog holding typed work: Keep editing keeps it', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('.inv-page-active [data-action="invAddClient"]').first().click();
    await page.locator('#ceditName').fill('HALF TYPED');
    await g(page, 'void todoHandleLaunch("add")');
    expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
    await expect(page.locator('#ceditName')).toHaveValue('HALF TYPED');
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
  });
});

test('P129: the stylesheet reads tokens where the audit found raw values (G7-11)', async () => {
  const css = readFileSync('split/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // HR-6's exception is 20px icons; a 16px one is a token.
  expect(css.match(/svg\s*\{[^}]*\b16px/g) || []).toEqual([]);
  // A document's frame on screen is the app's hairline.
  expect(css.match(/border:\s*1px solid var\(--border\)/g) || []).toEqual([]);
  // The tax invoice declares its measurements once, in its token block, and every rule after it reads a var().
  const start = css.indexOf('.inv-print-invoice {');
  const rules = css.slice(css.indexOf('}', start) + 1, css.indexOf('.inv-qc-notice'));
  expect(rules).toContain('.inv-pi-sig-grid');
  expect(rules.match(/\b\d+(\.\d+)?px\b/g) || []).toEqual([]);
  const print = css.slice(css.indexOf('@media print'));
  const piPrint = (print.slice(0, print.indexOf('.inv-qc-notice')).match(/\.inv-pi-[^{}]*\{[^}]*\}/g) || []).join('\n');
  expect(piPrint.match(/\b\d+(\.\d+)?px\b/g) || []).toEqual([]);
});

test.describe('P129: on the desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('a screen remembered from another build, or an element that is not a page, opens Home (G7-6)', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    for (const stale of ['topbarTitle', 'pageRetired']) {
      await g(page, `localStorage.setItem('sep_inv_view_prefs', JSON.stringify(Object.assign({}, regFilter, { activeTab: '${stale}' })))`);
      await page.goto('/');
      await waitForBoot(page);
      await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
      expect(await g(page, 'regFilter.activeTab')).toBe('pageHome');
    }
  });

  test('Backspace goes back from the field the app focused on arrival, until something is typed in it (G7-7)', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageRegister');
    const search = page.locator('#regSearch');
    await expect(search).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    // History's search too.
    await switchTab(page, 'pageHistory');
    await expect(page.locator('#pageHistory .inv-search input')).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    // Typed in and emptied again: the field keeps its Backspace.
    await switchTab(page, 'pageRegister');
    await expect(search).toBeFocused();
    await page.keyboard.type('x');
    await page.keyboard.press('Backspace');
    await expect(search).toHaveValue('');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  });
});
