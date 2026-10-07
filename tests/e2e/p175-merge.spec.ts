import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, openSettingsAt, todayIso, recentTs, type SepState } from './fixtures';

// P175 (owner, 7 Oct 2026: "start with 3 and 4", G4 of docs/GUARD.md): a push or a pull merges this device's book with
// GitHub's against the copy both last saw. A change on one side is taken; both changing one thing keeps one and holds the
// other for the owner; nothing is lost. GitHub is stubbed at the route; names are made up.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';

function client(id: number, name: string, extra: any = {}) {
  return Object.assign({ id, name, billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [] }, extra);
}
function inv(id: string, num: string) {
  return { id, invoiceNumber: num, displayNumber: 'T/' + num, date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: 'ALPHA',
    items: [], taxableValue: 100, grandTotal: 118, createdAt: recentTs() };
}
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = [];
  s.clients = [client(1, 'ALPHA', { phone: '1111' }), client(2, 'BETA'), client(3, 'GAMMA')];
  s.invNextNum = 10;
  return s;
}
async function seedSync(page: Page, sha: string) {
  await page.addInitScript(([cfg]) => {
    localStorage.setItem('sep_inv_github_sync', cfg as string);
    localStorage.setItem('sep_inv_github_token', 'github_pat_TESTTOKEN');
  }, [JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Bench', sha })] as const);
}
function envelope(state: any) {
  return { app: 'sep-invoicing', schema: 1, savedAt: Date.now() - 60000, device: 'Office PC', deviceId: 'dev-other', counts: {}, state };
}

test('the merge itself: each side\'s change taken, both changing one thing held, removals, numbers, the higher series', async ({ page }) => {
  await loadAppWithState(page, book());
  const r: any = await ev(page, `(function() {
    var base = JSON.parse(JSON.stringify(S));
    var mine = JSON.parse(JSON.stringify(S)), theirs = JSON.parse(JSON.stringify(S));
    mine.clients.push({ id: 4, name: 'DELTA', billingMode: 'weight', isActive: true });       // added here
    theirs.clients.push({ id: 5, name: 'EPSILON', billingMode: 'weight', isActive: true });   // added there
    mine.clients[0].phone = '2222'; theirs.clients[0].phone = '3333';                         // both changed one field
    theirs.clients[0].gstin = '20AAAAA0000A1Z5';                                              // and another only there
    theirs.clients = theirs.clients.filter(function(c) { return c.id !== 2; });               // removed there, untouched here
    mine.clients = mine.clients.filter(function(c) { return c.id !== 3; });                   // removed here...
    theirs.clients.find(function(c) { return c.id === 3; }).name = 'GAMMA WORKS';             // ...changed there
    mine.invNextNum = 12; theirs.invNextNum = 11;
    mine.invoices = [${JSON.stringify(inv('INV-A', '00010'))}];
    theirs.invoices = [${JSON.stringify(inv('INV-B', '00010'))}];
    var res = mrgMerge(base, mine, theirs, { from: 'Office PC', prefer: 'm' });
    return { clients: res.book.clients.slice().sort(function(a, b) { return a.id - b.id; }).map(function(c) { return [c.id, c.name, c.phone || null, c.gstin || null]; }),
      next: res.book.invNextNum, invs: res.book.invoices.map(function(i) { return i.id; }), taken: res.taken,
      held: res.held.map(function(h) { return [h.why, h.field || null, h.kept.v === undefined ? 'gone' : h.kept.v, h.other.v === undefined ? 'gone' : (typeof h.other.v === 'object' ? 'record' : h.other.v)]; }) };
  })()`);
  expect(r.clients).toEqual([[1, 'ALPHA', '2222', '20AAAAA0000A1Z5'], [3, 'GAMMA WORKS', null, null], [4, 'DELTA', null, null], [5, 'EPSILON', null, null]]);
  expect(r.next).toBe(12);
  expect(r.invs).toEqual(['INV-A', 'INV-B']);
  expect(r.held).toContainEqual(['both', 'phone', '2222', '3333']);
  expect(r.held.some((h: any) => h[0] === 'removed')).toBe(true);
  expect(r.held.filter((h: any) => h[0] === 'number').length).toBeGreaterThan(0);
  expect(r.taken).toBeGreaterThan(0);
});

test('a push that finds GitHub moved merges and pushes both devices\' work; the base follows', async ({ page }) => {
  await seedSync(page, 'basesha');
  let remote: any = null, put: any = null;
  await page.route(CONTENTS, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ sha: 'remotesha', content: Buffer.from(JSON.stringify(envelope(remote))).toString('base64') }) });
      return;
    }
    put = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'pushedsha' } }) });
  });
  await loadAppWithState(page, book());
  await ev(page, `mrgBasePut(JSON.stringify(S), 'basesha')`);
  remote = await ev(page, `JSON.parse(JSON.stringify(S))`);
  remote.clients.push(client(9, 'FROM OFFICE'));
  await ev(page, `S.clients.push({ id: 8, name: 'FROM PHONE', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [] }); saveState()`);
  await ev(page, `ghPush()`);
  await expect.poll(() => put).not.toBeNull();
  expect(put.sha).toBe('remotesha');
  const pushed = JSON.parse(Buffer.from(put.content, 'base64').toString('utf8'));
  expect(pushed.state.clients.map((c: any) => c.name).sort()).toEqual(['ALPHA', 'BETA', 'FROM OFFICE', 'FROM PHONE', 'GAMMA']);
  await expect.poll(async () => (await ev(page, `mrgBaseGet().then(function(b) { return b && b.sha; })`))).toBe('pushedsha');
  const st: any = await readStoredState(page);
  expect(st.clients.length).toBe(5);
  expect(st.changeLog.some((e: any) => /^merged with Office PC: 1 change taken$/.test(e.label || ''))).toBe(true);
});

test('a pull merges, holds what both changed for the owner, and the owner settles it', async ({ page }) => {
  await seedSync(page, 'basesha');
  let remote: any = null;
  await page.route(CONTENTS, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ sha: 'remotesha', content: Buffer.from(JSON.stringify(envelope(remote))).toString('base64') }) });
  });
  await loadAppWithState(page, book());
  await ev(page, `mrgBasePut(JSON.stringify(S), 'basesha')`);
  // GitHub's copy is the same book as it was, changed on the other device.
  remote = await ev(page, `JSON.parse(JSON.stringify(S))`);
  remote.clients[1].name = 'BETA LTD';
  remote.clients.push(client(9, 'FROM OFFICE'));
  await ev(page, `S.clients[1].name = 'BETA WORKS'; S.clients.push({ id: 8, name: 'FROM PHONE', billingMode: 'weight', isActive: true }); saveState()`);
  await openSettingsAt(page, 'sync');
  await page.locator('[data-action="invGhPull"]').click();
  await expect(page.locator('[data-mrg-count]')).toContainText('1 change held for the owner');
  const names: any = await ev(page, `S.clients.map(function(c) { return c.name; })`);
  expect(names).toEqual(['ALPHA', 'BETA WORKS', 'GAMMA', 'FROM PHONE', 'FROM OFFICE']);
  // The To-do raises it; the owner uses the one held.
  const t: any = await ev(page, `todoAppAll().filter(function(t) { return t.rule === 'mergeHeld'; }).map(function(t) { return t.tone; })`);
  expect(t).toEqual(['amber']);
  await page.locator('[data-action="invMrgOpen"]').click();
  const dlg = page.locator('[data-mrg-held]');
  await expect(dlg.locator('[data-held]')).toHaveCount(1);
  await expect(dlg).toContainText('held: BETA LTD');
  await dlg.locator('[data-action="invMrgUse"]').click();
  await expect(dlg.locator('.inv-empty')).toContainText('Nothing is held');
  const st: any = await readStoredState(page);
  expect(st.clients.find((c: any) => c.id === 2).name).toBe('BETA LTD');
  expect(st.mergeHeld[0].status).toBe('used');
  expect(await ev(page, `getGhConfig().sha`)).toBe('remotesha');
});

test('without a base there is nothing to merge from: the old question is asked', async ({ page }) => {
  await seedSync(page, 'basesha');
  await page.route(CONTENTS, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ sha: 'remotesha', content: Buffer.from(JSON.stringify(envelope(book()))).toString('base64') }) });
  });
  await loadAppWithState(page, book());
  const merged: any = await ev(page, `ghMergeRemote(getGhConfig(), { sha: 'remotesha' }).then(function(m) { return m; })`);
  expect(merged).toBeNull();
});
