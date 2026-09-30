import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, readStoredState, switchTab } from './fixtures';
import { readFileSync } from 'fs';

// P111: the shell's share of the QA sweep of 29 Sep 2026 — the frame every screen sits in.
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const dialogs = (p: Page) => p.locator('.inv-scrim-dialog');

test.describe('P111: Escape closes the top layer, the way Back does', () => {
  // Every dialog but a question ignored Escape: the click-through sweep found five dialogs stacked on the Register
  // with nothing a keyboard could do about them.
  test('a dialog showing something closes at once', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageRegister');
    await page.locator('.inv-page-active [data-action="invCnList"]').click();
    await expect(dialogs(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialogs(page)).toHaveCount(0);
  });

  test('a dialog holding typed work asks first, Keep editing keeps it', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('.inv-page-active [data-action="invAddClient"]').click();
    const field = page.locator('.inv-scrim-dialog input.inv-input').first();
    await field.fill('A NEW CLIENT');
    await page.keyboard.press('Escape');
    expect(await answerAsk(page, 'cancel')).toContain('Discard');
    await expect(field).toHaveValue('A NEW CLIENT');
    await page.keyboard.press('Escape');
    await answerAsk(page, 'ok');
    await expect(dialogs(page)).toHaveCount(0);
  });

  test('a question answers cancel, and the More sheet closes', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const ans = g(page, 'uiConfirm({ title: "Go on?" })');
    await expect(page.locator('[data-ui-ask]')).toBeVisible();
    // With focus outside the question (its own scrim answers Escape only from inside it).
    await g(page, 'document.activeElement && document.activeElement.blur()');
    await page.keyboard.press('Escape');
    expect(await ans).toBe(false);
    await page.locator('.inv-navbar-more').click();
    await expect(page.locator('#moreSheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#moreSheet')).toHaveCount(0);
  });

  test('an open suggestion list closes first, and the form under it stays', async ({ page }) => {
    // The challan form's client search lists active clients; emptyState's carry no isActive (as P12 sets it).
    const st = emptyState();
    st.clients = st.clients.map((c: any) => ({ ...c, isActive: true }));
    await loadAppWithState(page, st);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imChallanClientSearch').fill('TEST');
    const list = page.locator('#imChallanClientResults');
    await expect(list.locator('.inv-menu-item')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(page.locator('#imAddForm')).toBeVisible();
  });
});

test.describe('P111: one screen that cannot be drawn never bricks the app', () => {
  // The shell stays inert until the start finishes, and a launch reopens the screen last shown. The active screen
  // was remembered before it was drawn, so a screen that threw on some data reopened and threw at every launch.
  test('a challan with no lines array loads, and Home draws', async ({ page }) => {
    const st: any = emptyState();
    st.incomingMaterial = [{ id: 'IM-1', clientId: 1, clientName: 'TEST CLIENT KG', challanNo: '77', challanDate: '2026-09-01', status: 'pending' }];
    await loadAppWithState(page, st);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    expect(await g(page, 'Array.isArray(S.incomingMaterial[0].items)')).toBe(true);
    await expect(page.locator('.inv-notice-bar')).toHaveCount(0);
  });

  test('a screen that throws says so, and is not the one reopened', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageRegister');
    await g(page, 'window.renderStats = function() { throw new Error("drawing failed on purpose"); }');
    await g(page, 'switchTab("pageStats")');
    await expect(page.locator('.inv-notice-bar')).toContainText('Stats screen could not be drawn');
    // Remembered is the screen that drew, so a reload opens it rather than the one that threw.
    expect(await g(page, 'regFilter.activeTab')).toBe('pageRegister');
    await switchTab(page, 'pageClients');
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
  });
});

test('a swipe over an open dialog does nothing: the typed form stays', async ({ page }) => {
  await loadAppWithState(page, emptyState());
  await switchTab(page, 'pageClients');
  await page.locator('.inv-page-active [data-action="invAddClient"]').click();
  const field = page.locator('.inv-scrim-dialog input.inv-input').first();
  await field.fill('HALF TYPED');
  await page.evaluate(() => {
    const el = document.querySelector('.inv-scrim-dialog .inv-dialog') as HTMLElement;
    const t = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(100)], bubbles: true }));
  });
  await page.waitForTimeout(200);
  await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
  await expect(field).toHaveValue('HALF TYPED');
});

test.describe('P111: a jump shows what it names, with nothing left over', () => {
  // History's links and the To-do's kept the Register's month, dates and selection, and ignored which Challans tab a
  // challan is under: a link to last quarter's invoice opened on this month and showed nothing.
  const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const old = (() => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - 3); return iso(d); })();
  const today = iso(new Date());
  const line = { partNumber: 'CLAMP 100X83', desc: 'CLAMP 100X83', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null };
  const inv = (id: string, date: string, o: any = {}) => ({ id, invoiceNumber: id.slice(4).padStart(5, '0'), displayNumber: 'SEP/TEST-' + id.slice(4).padStart(5, '0'),
    date, status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '', gstType: 'intra',
    clientAddress: { add1: 'A', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }, items: [line], taxableValue: 130,
    cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '', challanNo: '301',
    challanDate: date, remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime(), ...o });
  const book = () => {
    const s: any = emptyState();
    s.incomingMaterial = [{ id: 'IM-1', clientId: 1, clientName: 'TEST CLIENT KG', challanNo: '301', challanDate: old, createdAt: new Date(old + 'T09:00:00').getTime(),
      items: [{ ...line, id: 'L1' }] }];
    s.invoices = [inv('INV-1', old, { items: [{ ...line, imItemId: 'L1' }], linkedIMIds: ['IM-1'] }), inv('INV-2', today)];
    s.invNextNum = 3;
    return s;
  };

  test("History's invoice link clears the month and the selection", async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageRegister');
    await page.locator('.inv-page-active [data-action="invRegToggleSelect"]').click();
    await page.locator('.inv-page-active [data-action="invRegToggleInv"][data-id="INV-2"]').check();
    expect(await g(page, 'Object.keys(_regSelected).length')).toBe(1);
    await switchTab(page, 'pageHistory');
    await page.locator('.inv-page-active [data-action="invHistoryJumpInvoice"][data-id="INV-1"]').first().click();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#pageRegister [data-action="invViewInvoiceDetail"][data-id="INV-1"]')).toBeVisible();
    expect(await g(page, 'Object.keys(_regSelected).length')).toBe(0);
  });

  test("History's challan link opens the tab and month the challan is under", async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageHistory');
    await page.locator('.inv-page-active [data-action="invHistoryJumpChallan"][data-id="IM-1"]').first().click();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#pageIM [data-action="invIMTab"][data-tab="invoiced"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#pageIM [data-im="IM-1"]').first()).toBeVisible();
  });

  test("a task's challan link shows the challan rather than a refused edit", async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, 'todoGo({ kind: "challan", id: "IM-1" })');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    expect(await g(page, '_challanForm')).toBeNull();
    await expect(page.locator('#pageIM [data-im="IM-1"]').first()).toBeVisible();
  });
});

test("a device whose book is in IndexedDB never works on another copy when the database won't open", async ({ page }) => {
  // The localStorage path took over, the session's work was saved there, and the next start (the database open
  // again) lost it without a word.
  const st: any = emptyState();
  st.clients[0].name = 'KEPT CLIENT';
  await loadAppWithState(page, st);
  await expect.poll(() => g(page, 'localStorage.getItem("sep_inv_idb_used")')).toBe('1');
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('breakIdb')) return;
    (indexedDB as any).open = function() { const r: any = {}; setTimeout(() => r.onerror && r.onerror(), 0); return r; };
  });
  await g(page, 'sessionStorage.setItem("breakIdb", "1")');
  await page.reload();
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await expect(page.locator('.inv-storage-bar[data-kind="read"]')).toContainText('database would not open');
  expect(await g(page, 'saveState()')).toBe(false);
  await g(page, 'sessionStorage.removeItem("breakIdb")');
  await page.reload();
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  expect(await g(page, 'S.clients[0].name')).toBe('KEPT CLIENT');
  await expect(page.locator('.inv-storage-bar')).toHaveCount(0);
});

test("the widget's worker reaches only this app's windows", async () => {
  // Every project on the account is served from one origin: an uncontrolled match returned a sister app's windows too,
  // so a widget tap could focus one and post it this app's message.
  const sw = readFileSync('sw.js', 'utf8');
  const src = sw.slice(sw.indexOf('async function appWindows()'), sw.indexOf('// Open the app on the To-do tab'));
  const self = { registration: { scope: 'https://example.github.io/sep-invoicing/' },
    clients: { matchAll: async () => [{ url: 'https://example.github.io/sep-dashboard/' }, { url: 'https://example.github.io/sep-invoicing/?tab=pageTodo' }] } };
  const appWindows = new Function('self', src + '\nreturn appWindows;')(self);
  expect((await appWindows()).map((c: any) => c.url)).toEqual(['https://example.github.io/sep-invoicing/?tab=pageTodo']);
  expect((sw.match(/clients\.matchAll/g) || []).length).toBe(1);
});

test("a save refused while the window was starting says nothing; one refused after, says so", async ({ page }) => {
  // The quiet branch read "starting" when the refusal came back, which is always after the start: a window whose
  // start-up migration lost to another window's save said "the last change made here was not saved" of no change.
  await loadAppWithState(page, emptyState());
  const refused = (boot: boolean) => g(page, `(function() {
    _diskRev = 'another-window';
    ${boot ? "document.body.classList.remove('inv-booted');" : ''}
    var p = saveState();
    document.body.classList.add('inv-booted');
    return p;
  })()`);
  expect(await refused(true)).toBe(false);
  await expect(page.locator('.inv-notice-bar')).toHaveCount(0);
  expect(await refused(false)).toBe(false);
  await expect(page.locator('.inv-notice-bar')).toContainText('the last change made here was not saved');
});

test('a start that changes nothing writes nothing: the vehicles seed keeps the ten it has', async ({ page }) => {
  // The seed re-appended every vehicle the cap of ten had dropped, so every start rewrote the whole book.
  const st: any = emptyState();
  st.clients[0].recentVehicles = Array.from({ length: 10 }, (_, i) => 'JH 05 A ' + (1000 + i));
  st.incomingMaterial = Array.from({ length: 12 }, (_, i) => ({ id: 'IM-' + i, clientId: 1, clientName: 'TEST CLIENT KG', challanNo: String(100 + i),
    challanDate: '2026-09-' + String(1 + i).padStart(2, '0'), vehicleNo: 'JH 05 B ' + (2000 + i), items: [] }));
  await loadAppWithState(page, st);
  await page.reload();
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await page.waitForTimeout(300);
  expect(await g(page, 'S.clients[0].recentVehicles.length')).toBe(10);
  expect(await g(page, '_storageHealth.lastSaveAt')).toBe(0);
});

test("a Done tapped on the widget survives another window's save made meanwhile", async ({ page }) => {
  const st: any = emptyState();
  st.todo = { tasks: [{ id: 'TD-a', text: 'Count the nitric drums', at: Date.now() }], snoozes: {} };
  await loadAppWithState(page, st);
  // Another window saves while this one is hidden: its copy carries a change this window has not seen.
  await g(page, `(function() {
    var other = JSON.parse(JSON.stringify(S)); other.clients[0].name = 'RENAMED ELSEWHERE';
    return writeGuarded(JSON.stringify(other), _diskRev, 'other-window-rev');
  })()`);
  await g(page, `todoWidgetPut('queue', [{ id: 'TD-a', at: 12345 }])`);
  await g(page, `Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
  await expect.poll(async () => (await readStoredState(page)).todo.tasks[0].doneAt).toBe(12345);
  expect((await readStoredState(page)).clients[0].name).toBe('RENAMED ELSEWHERE');
});

test("the offline shell is the app's own page, and a copy that cannot be stored never serves an old one", async () => {
  const sw = readFileSync('sw.js', 'utf8');
  const src = sw.slice(sw.indexOf('function isShellUrl(url)'), sw.indexOf('async function assetResponse'));
  const self = { registration: { scope: 'https://example.github.io/sep-invoicing/' } };
  const isShellUrl = new Function('self', src + '\nreturn isShellUrl;')(self);
  const is = (u: string) => isShellUrl(new URL(u));
  expect(is('https://example.github.io/sep-invoicing/')).toBe(true);
  expect(is('https://example.github.io/sep-invoicing/?tab=pageTodo&todo=add')).toBe(true);
  expect(is('https://example.github.io/sep-invoicing/index.html')).toBe(true);
  expect(is('https://example.github.io/sep-invoicing/sep-invoicing.html')).toBe(true);
  expect(is('https://example.github.io/sep-invoicing/version.json')).toBe(false);
  expect(is('https://example.github.io/sep-invoicing/docs/test-certificates/cert.html')).toBe(false);
  expect(is('https://example.github.io/sep-dashboard/')).toBe(false);
  // The store is its own try: a put that throws is not the network failing.
  const nav = sw.slice(sw.indexOf('async function navigationResponse'), sw.indexOf('function isShellUrl(url)'));
  expect(nav).toMatch(/try \{ await shell\.put\(SHELL_KEY, fresh\.clone\(\)\); \} catch/);
});

test.describe('P111: GitHub sync keeps what Settings saved', () => {
  const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';
  const seed = (page: Page) => page.addInitScript(() => {
    localStorage.setItem('sep_inv_github_sync', JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main',
      path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Test Bench', autoPush: true }));
    localStorage.setItem('sep_inv_github_token', 'github_pat_TESTTOKEN');
  });

  test('a push that lands after Settings changed the config keeps the change', async ({ page }) => {
    // The push read the config before the network and wrote that copy back after it.
    await seed(page);
    await page.route(CONTENTS, async route => {
      if (route.request().method() === 'GET') { await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' }); return; }
      await new Promise(r => setTimeout(r, 400));
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'newsha123' } }) });
    });
    await loadAppWithState(page, emptyState());
    const pushed = g(page, 'ghPush({ silent: true })');
    await page.waitForTimeout(150);
    await g(page, 'setGhConfig(Object.assign(getGhConfig(), { autoPush: false }))');
    expect(await pushed).toBe(true);
    const cfg: any = await g(page, 'getGhConfig()');
    expect(cfg.autoPush).toBe(false);
    expect(cfg.sha).toBe('newsha123');
  });

  test('Push with the section edited but not saved says so, and sends nothing', async ({ page }) => {
    await seed(page);
    let calls = 0;
    await page.route(CONTENTS, async route => { calls++; await route.fulfill({ status: 404, body: '{}' }); });
    await loadAppWithState(page, emptyState());
    await g(page, 'openSettings("sync")');
    await page.locator('#settingsScrim details[data-sec="sync"] input').first().fill('otherowner');
    await expect(page.locator('#settingsScrim details[data-sec="sync"][data-dirty]')).toHaveCount(1);
    await page.locator('#settingsScrim [data-action="invGhPush"]').first().click();
    await expect(page.locator('.inv-toast')).toContainText('Save the GitHub sync section first');
    expect(calls).toBe(0);
  });
});

test("another window's save made while a dialog is open shows as soon as it closes", async ({ page }) => {
  // The redraw waited while the dialog was open, as it should, and then waited for the next screen.
  await loadAppWithState(page, emptyState());
  await switchTab(page, 'pageClients');
  await page.locator('.inv-page-active [data-action="invAddClient"]').click();
  await g(page, `(function() {
    var other = JSON.parse(JSON.stringify(S)); other.clients[0].name = 'RENAMED ELSEWHERE';
    return writeGuarded(JSON.stringify(other), _diskRev, 'other-window-rev').then(function() { return bookReload('saved'); });
  })()`);
  await expect(page.locator('#pageClients')).not.toContainText('RENAMED ELSEWHERE');
  await page.locator('.inv-scrim-dialog .inv-dialog-close').click();
  await expect(page.locator('#pageClients')).toContainText('RENAMED ELSEWHERE');
});

test('an import draws every screen from the new book, and the same file can be chosen again', async ({ page }) => {
  await loadAppWithState(page, emptyState());
  await switchTab(page, 'pageRegister');
  const next: any = emptyState();
  next.clients.push({ id: 2, name: 'IMPORTED CLIENT', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' });
  const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  next.invoices = [{ id: 'INV-9', invoiceNumber: '00009', displayNumber: 'SEP/TEST-00009', date: today, status: 'active', invoiceState: 'created',
    clientId: 2, clientName: 'IMPORTED CLIENT', gstType: 'intra', items: [], taxableValue: 100, cgstPer: 9, cgstAmt: 9, sgstPer: 9, sgstAmt: 9,
    igstPer: 0, igstAmt: 0, grandTotal: 118, createdAt: Date.now() }];
  next.invNextNum = 10;
  await g(page, 'openSettings("data")');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#settingsScrim [data-action="invImportData"]').click();
  await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)) });
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  expect(await g(page, 'document.getElementById("importFileInput") ? document.getElementById("importFileInput").value : ""')).toBe('');
  await switchTab(page, 'pageRegister');
  await expect(page.locator('#pageRegister select option', { hasText: 'IMPORTED CLIENT' })).toHaveCount(1);
});

test('opening a screen on a touch screen never focuses a field, so no keyboard rises', async ({ page }) => {
  await loadAppWithState(page, emptyState());
  for (const tab of ['pageRegister', 'pageIM', 'pageHistory', 'pageClients']) {
    await switchTab(page, tab);
    const tag = await g(page, 'document.activeElement ? document.activeElement.tagName + "." + (document.activeElement.type || "") : ""');
    expect(tag, tab).not.toMatch(/^(INPUT\.(text|search|number|date|tel)|TEXTAREA)/);
  }
});

test.describe("P111: the To-do's own list", () => {
  const task = (id: string, text: string, o: any = {}) => ({ id, text, due: '', note: '', link: null, createdAt: Date.now(), doneAt: null, ...o });

  test('every done task can be reached, not only the latest fifty', async ({ page }) => {
    const st: any = emptyState();
    st.todo = { tasks: Array.from({ length: 60 }, (_, i) => task('TD-' + i, 'Task ' + i, { doneAt: Date.now() - i * 1000 })), snoozes: {} };
    await loadAppWithState(page, st);
    await switchTab(page, 'pageTodo');
    await page.locator('.inv-page-active [data-action="invTodoFoldDone"][data-v="done"]').click();
    const rows = page.locator('[data-todo-sec="done"] [data-action="invTodoToggle"]');
    await expect(rows.filter({ visible: true })).toHaveCount(30);
    await page.locator('[data-todo-sec="done"] [data-action="invShowMore"]').click();
    await expect(rows.filter({ visible: true })).toHaveCount(60);
  });

  test("Mark done in a task's dialog keeps what was typed there", async ({ page }) => {
    const st: any = emptyState();
    st.todo = { tasks: [task('TD-a', 'Call the supplier')], snoozes: {} };
    await loadAppWithState(page, st);
    await g(page, 'todoOpenEdit("TD-a")');
    await page.locator('#todoText').fill('Call the supplier about the nitric price');
    await page.locator('.inv-scrim-dialog [data-action="invTodoSaveDone"]').click();
    const t: any = await g(page, 'S.todo.tasks[0]');
    expect(t.text).toBe('Call the supplier about the nitric price');
    expect(t.doneAt).toBeTruthy();
  });

  test("a snooze outlives its rule being switched off while another task is snoozed", async ({ page }) => {
    const st: any = emptyState();
    st.todo = { tasks: [], snoozes: { 'zinc': { sig: 'x', until: '', at: Date.now(), rule: 'zinc' } } };
    await loadAppWithState(page, st);
    // Any live task will do for the second snooze; the zinc rule (off by default) must not lose its snooze.
    const key = await g(page, '(todoAppAll()[0] || {}).key || ""');
    test.skip(!key, 'no live task in this book to snooze');
    await g(page, `todoSnooze(${JSON.stringify(key)}, 'sig')`);
    expect(await g(page, 'Object.keys(S.todo.snoozes).sort()')).toContain('zinc');
  });
});

test("the register photo's check has an address of its own, so Back returns to Production", async ({ page }) => {
  await loadAppWithState(page, emptyState());
  await switchTab(page, 'pageProduction');
  const loc: any = await g(page, `(function() { var was = _prodView; _prodView = 'photo'; var l = navLoc(); _prodView = was; return l; })()`);
  expect(loc.v).toMatch(/\/photo$/);
  expect(await g(page, `navLabel(${JSON.stringify(loc)}).sub || navLabel(${JSON.stringify(loc)})`)).toBeTruthy();
  // With no photo in hand (a reload), the address opens the page rather than an empty check.
  await g(page, `navApply(${JSON.stringify(loc)})`);
  expect(await g(page, '_prodView')).toBe('main');
});

test('a bill entered today does not silence "paste the stock message"', async ({ page }) => {
  // A bill records what was paid and moves no level: it is not a stock figure.
  const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const st: any = emptyState();
  st.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] }],
    entries: [{ id: 'E1', itemId: 'N', kind: 'count', qty: 40, date: ago(10), seq: 0, at: Date.now() - 10 * 86400000 },
      { id: 'E2', itemId: 'N', kind: 'bill', qty: 50, date: ago(0), seq: 0, at: Date.now(), price: 30, supplier: 'A SUPPLIER', billNo: 'B-1' }], pastes: [] };
  await loadAppWithState(page, st);
  expect(await g(page, 'TODO_RULE_FNS.paste().length')).toBe(1);
});
