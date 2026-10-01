import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, waitForBoot, type SepState } from './fixtures';

/*
 * P142: devices (the guard, step G2; owner, 1 Oct 2026). With the guard on, a device pushes to and pulls from GitHub
 * only once it is registered: its GitHub and device details entered and the owner's ID and PIN checked, after which a
 * copy goes to GitHub at once carrying `_device`. A device not registered can only import; a device the owner removes
 * stops syncing and deletes its token the next time it loads the book. The token is locked to the device. With the
 * guard off, sync is exactly as it was.
 *
 * GitHub is stubbed at the route layer, as in P15, by a fake that keeps the last file PUT. The guard (guard.js, step
 * G1) is reached only through its agreed names, so this spec gives the page a stand-in for them: an owner exists →
 * on; the user signed in is the session's; guardAsk('users') lets the owner through and refuses any other ID in a
 * dialog. It is installed before the app's scripts and again after boot (where guard.js is built in, its own
 * functions replace the early copy). The users carry real salted hashes, so guard.js's own boot reads them as users.
 */

const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';
const TOKEN = 'github_pat_P142DESKTOKEN';
const TABLET_TOKEN = 'github_pat_P142TABLETTOKEN';
const UNREG = "This device isn't registered. Register it with the owner present, or import a backup (Settings → Import) to view the data.";

function secret(pin: string) {
  const salt = randomBytes(16), iter = 150000;
  return { alg: 'PBKDF2-SHA256', iter, salt: salt.toString('base64'), hash: pbkdf2Sync(pin, salt, iter, 32, 'sha256').toString('base64'), digits: /^\d+$/.test(pin) };
}
// Made-up people.
const OWNER = { id: 'u-own', name: 'Meera Rao', role: 'owner', active: true, secret: secret('4826'), createdAt: 1, createdBy: 'u-own' };
const SUPER = { id: 'u-sup', name: 'Kiran Das', role: 'supervisor', active: true, secret: secret('7351'), createdAt: 1, createdBy: 'u-own' };

const GUARD_STUB = `(function () {
  function users() { try { return S && Array.isArray(S.users) ? S.users : []; } catch (e) { return []; } }
  function session() { try { return JSON.parse(sessionStorage.getItem('sep_inv_session') || 'null'); } catch (e) { return null; } }
  window.__guardAsked = window.__guardAsked || [];
  window.grdOn = function () { return users().some(function (u) { return u && u.role === 'owner' && u.active !== false; }); };
  window.grdUserId = function () { var s = session(); return s && s.userId != null ? s.userId : null; };
  window.grdUser = function () { var id = window.grdUserId(); return users().find(function (u) { return String(u.id) === String(id); }) || null; };
  window.grdIsOwner = function () { var u = window.grdUser(); return !!(u && u.role === 'owner'); };
  window.guardAsk = function (group, what) {
    if (!window.grdOn()) return Promise.resolve(true);
    var u = window.grdUser();
    if (!u || (group === 'users' && u.role !== 'owner')) {
      return uiAlert({ title: what, body: "Your ID can't " + what.charAt(0).toLowerCase() + what.slice(1) + '. Ask the owner.' }).then(function () { return false; });
    }
    window.__guardAsked.push(group + ': ' + what);
    return Promise.resolve(true);
  };
})();`;

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function book(extra: Record<string, unknown> = {}): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState;
}

/** This device as it was before the page opened: its sync config, a token kept as typed (a build before this one), its
 *  id, who is signed in. Once per tab: a reload keeps what the app made of it. */
async function seedDevice(page: Page, o: { token?: string; devId?: string; session?: string; cfg?: Record<string, unknown> } = {}) {
  await page.addInitScript((a) => {
    if (sessionStorage.getItem('__p142')) return;
    sessionStorage.setItem('__p142', '1');
    localStorage.setItem('sep_inv_github_sync', a.cfg);
    if (a.token) localStorage.setItem('sep_inv_github_token', a.token);
    if (a.devId) localStorage.setItem('sep_inv_device_id', a.devId);
    if (a.session) sessionStorage.setItem('sep_inv_session', JSON.stringify({ userId: a.session, at: Date.now() }));
  }, {
    cfg: JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceName: 'Bench PC', ...(o.cfg || {}) }),
    token: o.token || '', devId: o.devId || '', session: o.session || '',
  });
  await page.addInitScript(src => { (0, eval)(src); }, GUARD_STUB);
}
async function guardAfterBoot(page: Page) { await g(page, GUARD_STUB); }
async function signIn(page: Page, userId: string) {
  await page.evaluate(id => sessionStorage.setItem('sep_inv_session', JSON.stringify({ userId: id, at: Date.now() })), userId);
}
async function open(page: Page, state: SepState) {
  await loadAppWithState(page, state);
  await guardAfterBoot(page);
}

/** GitHub's Contents API for one file: GET answers the last PUT (404 before any), PUT keeps what it was sent. */
class FakeGitHub {
  file: { sha: string; text: string } | null = null;
  puts: Array<{ message: string; content: string; branch: string; sha?: string }> = [];
  auths: string[] = [];
  private n = 0;
  setEnvelope(env: unknown) { this.file = { sha: 'remote' + (++this.n), text: JSON.stringify(env) }; }
  envelope(i = this.puts.length - 1) { return JSON.parse(Buffer.from(this.puts[i].content, 'base64').toString('utf8')); }
  async on(page: Page) {
    await page.route(CONTENTS, async (route) => {
      const req = route.request();
      this.auths.push(req.headers()['authorization'] || '');
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData() || '{}');
        this.puts.push(body);
        this.file = { sha: 'sha' + (++this.n), text: Buffer.from(body.content, 'base64').toString('utf8') };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: this.file.sha } }) });
        return;
      }
      if (!this.file) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ sha: this.file.sha, size: this.file.text.length, content: Buffer.from(this.file.text).toString('base64') }) });
    });
  }
}

function envelopeOf(state: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { app: 'sep-invoicing', schema: 1, savedAt: Date.now() - 60000, device: 'Floor tablet', deviceId: 'dev-floor',
    counts: { invoices: 0, challans: 1, clients: 1, items: 0 }, state, ...extra };
}

const tokenEntries = (p: Page) => p.evaluate(() => [localStorage.getItem('sep_inv_github_token'), localStorage.getItem('sep_inv_github_token_enc')]);
/** Whether the device's key is in its database. */
const keyHeld = (p: Page) => p.evaluate(() => new Promise<boolean>(resolve => {
  const req = indexedDB.open('sep-invoicing-keys', 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('keys'); };
  req.onerror = () => resolve(false);
  req.onsuccess = () => {
    const db = req.result;
    try {
      const r = db.transaction('keys').objectStore('keys').get('github-token');
      r.onsuccess = () => { db.close(); resolve(!!r.result); };
      r.onerror = () => { db.close(); resolve(false); };
    } catch { db.close(); resolve(false); }
  };
}));

test.describe('P142: devices, with the guard off', () => {
  test('a token kept as typed is locked to the device, and push and pull work exactly as before', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    const logs: string[] = [];
    page.on('console', m => logs.push(m.text()));
    await seedDevice(page, { token: TOKEN });
    await open(page, book());

    // The plain entry is gone; the token is kept encrypted, and only this page can read it back.
    await expect.poll(() => tokenEntries(page)).toEqual([null, expect.any(String)]);
    const enc = (await tokenEntries(page))[1]!;
    expect(enc).not.toContain(TOKEN);
    expect(JSON.parse(enc)).toMatchObject({ v: 1, iv: expect.any(String), ct: expect.any(String) });
    expect(await keyHeld(page)).toBe(true);
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);

    // Push, from Home: the token in the header, the copy and its message as they always were.
    await page.locator('#homeSyncCard [data-action="invGhPush"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Pushed to GitHub');
    expect(gh.auths).toEqual(['Bearer ' + TOKEN, 'Bearer ' + TOKEN]);
    expect(gh.puts[0].message).toMatch(/^SEP Invoicing backup — \d+ invoices, \d+ challans \(Bench PC\)$/);
    const env = gh.envelope();
    expect(env).not.toHaveProperty('_device');
    expect(env.device).toBe('Bench PC');
    expect(JSON.stringify(env)).not.toContain(TOKEN);

    // A start reads the locked token back; a pull still sends it.
    await page.reload();
    await waitForBoot(page);
    await guardAfterBoot(page);
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);
    gh.setEnvelope(envelopeOf({ ...book(), clients: [{ id: 9, name: 'PULLED CLIENT', billingMode: 'kg', gstType: 'intra' }] }));
    await openSettingsAt(page, 'sync');
    await expect(page.locator('details[data-sec="sync"] [data-token-state]')).toContainText('Locked to this device');
    await page.locator('#ghPullBtn').click();
    expect(await answerAsk(page, 'ok')).toContain('Replace ALL data');
    await expect(page.locator('.inv-toast')).toContainText('Pulled from GitHub');
    expect(await g(page, 'S.clients[0].name')).toBe('PULLED CLIENT');
    expect(gh.auths.every(a => a === 'Bearer ' + TOKEN)).toBe(true);

    // Never in the book, an export or the console.
    expect(JSON.stringify(await readStoredState(page))).not.toContain(TOKEN);
    await openSettingsAt(page, 'data');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="invExportData"]').click()]);
    expect(await readFile(await download.path(), 'utf8')).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  test('sync works whatever the device list says, registered or not', async ({ page }) => {
    // A book listing this device as removed and another as registered, with no ID on it: the guard is off.
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, devId: 'dev-desk' });
    await open(page, book({ devices: [
      { id: 'dev-desk', name: 'Desk PC', user: 'u-own', registeredAt: 1, registeredBy: 'u-own', removedAt: 2, removedBy: 'u-own', removeReason: 'an old test' },
      { id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', registeredAt: 1, registeredBy: 'u-own' },
    ] }));
    expect(await g(page, 'devSyncBlocked()')).toBe('');
    expect(await g(page, 'devRegistered()')).toBe(false);
    await expect(page.locator('#homeSyncCard [data-action="invGhPush"]')).toBeVisible();
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);
    expect(await g(page, 'ghPushLocked()')).toBe(true);
    expect(gh.envelope()).not.toHaveProperty('_device');
    gh.setEnvelope(envelopeOf(book()));
    await openSettingsAt(page, 'sync');
    await expect(page.locator('[data-sync-blocked]')).toHaveCount(0);
    await expect(page.locator('#ghPullBtn')).toBeEnabled();
    await page.locator('#ghPullBtn').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast')).toContainText('Pulled from GitHub');
    // The device section says the guard is off, and offers nothing to register.
    await openSettingsAt(page, 'devices');
    await expect(page.locator('details[data-sec="devices"]')).toContainText('The guard is off');
    await expect(page.locator('[data-action="invDevRegister"]')).toHaveCount(0);
  });

  test('a device whose key is gone says the token must be entered again, and takes a new one', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN });
    await open(page, book());
    await expect.poll(() => tokenEntries(page)).toEqual([null, expect.any(String)]);
    const before = (await tokenEntries(page))[1];
    // Site data cleared in part: the key's database is gone, the encrypted entry is not.
    await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('sep-invoicing-keys'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }));
    await page.reload();
    await waitForBoot(page);
    await guardAfterBoot(page);
    await expect(page.locator('.inv-notice-bar')).toContainText('The GitHub token on this device could not be read: enter it again');
    expect(await g(page, 'getGhToken()')).toBe('');
    await expect(page.locator('#homeSyncCard [data-card="sync"]')).toHaveCount(0);
    await openSettingsAt(page, 'sync');
    await expect(page.locator('#ghSyncStatus')).toContainText('could not be read: enter it again');
    await expect(page.locator('details[data-sec="sync"] [data-token-state]')).toContainText('Could not be read');

    await page.locator('#setGhToken').fill(TOKEN);
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="sync"]').click();
    await expect(page.locator('.inv-toast')).toContainText('GitHub sync saved');
    const after = await tokenEntries(page);
    expect(after[0]).toBeNull();
    expect(after[1]).not.toBe(before);
    expect(await keyHeld(page)).toBe(true);
    expect(await g(page, 'ghPushLocked()')).toBe(true);
    expect(gh.auths.at(-1)).toBe('Bearer ' + TOKEN);
  });
});

test.describe('P142: devices, with the guard on', () => {
  test('a device not registered: push and pull are refused with the reason, auto-push never arms, and Import works', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, session: 'u-own', cfg: { autoPush: true } });
    await open(page, book({ users: [OWNER, SUPER] }));

    await expect(page.locator('#homeSyncCard')).toContainText("Paused: this device isn't registered");
    await expect(page.locator('#homeSyncCard [data-action="invGhPush"]')).toHaveCount(0);
    await openSettingsAt(page, 'sync');
    await expect(page.locator('[data-sync-blocked]')).toHaveText(new RegExp('^' + UNREG.replace(/[.()?]/g, '\\$&')));
    await expect(page.locator('[data-sum="sync"]')).toContainText("paused: this device isn't registered");
    for (const id of ['#ghPushBtn', '#ghPullBtn']) {
      await expect(page.locator(id)).toBeDisabled();
      await expect(page.locator(id)).toHaveAttribute('title', UNREG);
    }
    // Asked all the same, each says why and reaches nothing.
    expect(await g(page, 'ghPushLocked()')).toBe(false);
    await expect(page.locator('.inv-toast')).toContainText("This device isn't registered");
    expect(await g(page, 'ghPull()')).toBe(false);
    await expect(page.locator('#ghSyncStatus')).toContainText("This device isn't registered");
    expect(gh.auths).toEqual([]);
    // A change never arms auto-push.
    expect(await g(page, "S.company.name = 'CHANGED CO'; saveState()")).toBe(true);
    expect(await g(page, '_ghPushTimer')).toBeNull();

    // Import still takes a backup in, to view the data.
    await openSettingsAt(page, 'data');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="invImportData"]').click();
    const incoming = { ...book({ users: [OWNER, SUPER] }), company: { ...emptyState().company, name: 'IMPORTED CO' } };
    await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast')).toContainText('Data imported');
    expect(await g(page, 'S.company.name')).toBe('IMPORTED CO');
    expect(gh.auths).toEqual([]);
  });

  test('registering asks for the owner (a supervisor is refused), lists the device and pushes a copy that names it', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    const logs: string[] = [];
    page.on('console', m => logs.push(m.text()));
    await seedDevice(page, { token: TOKEN, session: 'u-sup', devId: 'dev-floor' });
    await open(page, book({ users: [OWNER, SUPER] }));
    await openSettingsAt(page, 'devices');
    const sec = page.locator('details[data-sec="devices"]');
    await expect(sec.locator('[data-dev-status="unregistered"]')).toHaveText(UNREG);
    await expect(sec).toContainText('A token kept on a device can be used by anyone who can open this app on it; make one fine-grained token per device');
    // Not the owner: no list, and Register is refused with a word.
    await expect(sec.locator('[data-card="devices"]')).toHaveCount(0);
    await page.locator('#devNameIn').fill('Floor tablet');
    await page.locator('#devUserIn').selectOption('u-sup');
    await sec.locator('[data-action="invDevRegister"]').click();
    expect(await answerAsk(page, 'ok')).toContain("can't register this device");
    expect(await g(page, 'S.devices.length')).toBe(0);
    expect(gh.puts).toHaveLength(0);

    // The owner, present, signs in on the device and registers it.
    await signIn(page, 'u-own');
    await sec.locator('[data-action="invDevRegister"]').click();
    await expect(page.locator('.inv-toast')).toContainText('This device is registered, and a copy went to GitHub');
    expect(await g(page, 'window.__guardAsked')).toContain('users: Register this device');
    const build = await g(page, 'APP_BUILD');
    const row = await g(page, 'S.devices[0]') as Record<string, unknown>;
    expect(row).toMatchObject({ id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', registeredBy: 'u-own', build });
    expect(row.registeredAt).toEqual(expect.any(Number));
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_device_name'))).toBe('Floor tablet');

    // The copy: `_device` beside the book, the message naming the device and its user, the token nowhere.
    expect(gh.puts).toHaveLength(1);
    const env = gh.envelope();
    expect(env._device).toMatchObject({ id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', build, by: 'u-own' });
    expect(gh.puts[0].message).toContain('Floor tablet');
    expect(gh.puts[0].message).toContain('Kiran Das');
    expect(env.device).toBe('Floor tablet');
    expect(env.state.devices[0]).toMatchObject({ id: 'dev-floor', lastPushAt: env._device.at });
    expect(env.state).not.toHaveProperty('_device');
    expect(JSON.stringify(env)).not.toContain(TOKEN);
    // This device keeps the push it carried.
    expect(await g(page, 'S.devices[0].lastPushAt')).toBe(env._device.at);
    await expect.poll(async () => (await readStoredState(page)).devices[0].lastPushAt).toBe(env._device.at);

    // The list: the device, who uses it, when and by whom, its last push, and that it is this one.
    const listed = sec.locator('[data-card="devices"] [data-dev="dev-floor"]');
    await expect(listed).toContainText('Floor tablet');
    await expect(listed).toContainText('Used by Kiran Das');
    await expect(listed).toContainText('by Meera Rao');
    await expect(listed).toContainText('last push just now');
    await expect(listed.locator('.inv-badge')).toHaveText('This device');
    await expect(listed.locator('[data-action="invDevRemove"]')).toHaveCount(0);
    await expect(sec.locator('[data-dev-status="registered"]')).toContainText('Registered');

    // Sync is on: the section says nothing is held, and a later push names the device and who sent it.
    await openSettingsAt(page, 'sync');
    await expect(page.locator('[data-sync-blocked]')).toHaveCount(0);
    await expect(page.locator('#ghPushBtn')).toBeEnabled();
    expect(await g(page, 'ghPushLocked()')).toBe(true);
    expect(gh.puts[1].message).toMatch(/\(Floor tablet · Meera Rao\)$/);
    expect(gh.envelope(1)._device.by).toBe('u-own');
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  test('a device registering beside a newer guarded copy on GitHub joins that copy, never sends its own over it', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    const desk = { id: 'dev-desk', name: 'Desk PC', user: 'u-own', registeredAt: Date.now() - 86400000, registeredBy: 'u-own', build: 'x' };
    // GitHub holds the owner's book: the guard on, the desk registered, a client this phone's book does not have.
    gh.setEnvelope(envelopeOf({ ...book({ users: [OWNER, SUPER], devices: [desk] }), clients: [{ id: 9, name: 'OWNERS CLIENT', billingMode: 'kg', gstType: 'intra' }] },
      { device: 'Desk PC', deviceId: 'dev-desk' }));
    // The phone imported an older backup: the guard on there, the phone not registered, and GitHub's copy not seen.
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-phone', cfg: { deviceName: 'Office phone' } });
    await open(page, book({ users: [OWNER, SUPER], clients: [{ id: 1, name: 'OLD CLIENT', billingMode: 'kg', gstType: 'intra' }] }));
    await openSettingsAt(page, 'devices');
    await page.locator('#devUserIn').selectOption('u-own');
    // Declined: nothing is taken, nothing registered, nothing sent.
    await page.locator('[data-action="invDevRegister"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('GitHub holds a copy this device has not seen');
    expect(await g(page, 'S.clients[0].name')).toBe('OLD CLIENT');
    expect(await g(page, 'S.devices.length')).toBe(0);
    expect(gh.puts).toHaveLength(0);
    // Taken: the phone's book is GitHub's, the phone goes on its list, and it goes back over the copy it took, unasked.
    await page.locator('[data-action="invDevRegister"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-toast')).toContainText('This device is registered in GitHub\'s copy, and it went back to GitHub');
    expect(await g(page, 'S.clients[0].name')).toBe('OWNERS CLIENT');
    expect(await g(page, 'S.devices.map(function (d) { return d.id; })')).toEqual(['dev-desk', 'dev-phone']);
    expect(gh.puts).toHaveLength(1);
    expect(gh.puts[0].sha).toBe('remote1');
    const env = gh.envelope();
    expect(env.state.clients[0].name).toBe('OWNERS CLIENT');
    expect(env._device).toMatchObject({ id: 'dev-phone', name: 'Office phone', user: 'u-own' });
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
  });

  test('beside an unguarded copy on GitHub, registering sends this device\'s book, and the push asks first as always', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    gh.setEnvelope(envelopeOf(book(), { device: 'Old laptop', deviceId: 'dev-old' }));
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-desk', cfg: { sha: 'an-older-sha' } });
    await open(page, book({ users: [OWNER] }));
    await openSettingsAt(page, 'devices');
    await page.locator('[data-action="invDevRegister"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('GitHub already holds a copy this device has not seen');
    await expect(page.locator('.inv-toast')).toContainText('This device is registered. The copy did not reach GitHub');
    expect(await g(page, 'devRegistered()')).toBe(true);
    expect(gh.puts).toHaveLength(0);
  });

  test('a pull takes the book and leaves `_device` beside it', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    const desk = { id: 'dev-desk', name: 'Desk PC', user: 'u-own', registeredAt: Date.now() - 86400000, registeredBy: 'u-own', build: 'x' };
    const floor = { id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', registeredAt: Date.now() - 86400000, registeredBy: 'u-own', build: 'x' };
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-desk' });
    await open(page, book({ users: [OWNER, SUPER], devices: [desk] }));
    expect(await g(page, 'devRegistered()')).toBe(true);
    gh.setEnvelope(envelopeOf({ ...book({ users: [OWNER, SUPER], devices: [desk, floor] }), clients: [{ id: 9, name: 'PULLED CLIENT', billingMode: 'kg', gstType: 'intra' }] },
      { _device: { id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', build: 'x', at: Date.now() - 60000 } }));
    await openSettingsAt(page, 'sync');
    await page.locator('#ghPullBtn').click();
    expect(await answerAsk(page, 'ok')).toContain('Replace ALL data');
    await expect(page.locator('.inv-toast')).toContainText('Pulled from GitHub');
    expect(await g(page, 'S.clients[0].name')).toBe('PULLED CLIENT');
    expect(await g(page, "'_device' in S")).toBe(false);
    expect(await readStoredState(page)).not.toHaveProperty('_device');
    expect(await g(page, 'S.devices.map(function (d) { return d.id; })')).toEqual(['dev-desk', 'dev-floor']);
    // Still registered in the book it took: still syncing.
    expect(await g(page, 'devSyncBlocked()')).toBe('');
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);
  });

  test('the owner removes a device with a reason; it stops syncing, deletes its token and its key, and says why', async ({ page, browser, baseURL }) => {
    const gh = new FakeGitHub();
    const now = Date.now();
    const rows = [
      { id: 'dev-desk', name: 'Desk PC', user: 'u-own', registeredAt: now - 86400000, registeredBy: 'u-own', build: 'x' },
      { id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', registeredAt: now - 86400000, registeredBy: 'u-own', build: 'x', lastPushAt: now - 3600000 },
    ];
    // The owner's desk PC.
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-desk', cfg: { deviceName: 'Desk PC' } });
    await open(page, book({ users: [OWNER, SUPER], devices: rows }));
    await openSettingsAt(page, 'devices');
    const list = page.locator('details[data-sec="devices"] [data-card="devices"]');
    await expect(list.locator('[data-dev="dev-floor"]')).toContainText('last push 1 h ago');
    await expect(list.locator('[data-dev="dev-desk"]')).toContainText('This device');
    // A device does not remove itself.
    await expect(list.locator('[data-dev="dev-desk"] [data-action="invDevRemove"]')).toHaveCount(0);
    await list.locator('[data-dev="dev-floor"] [data-action="invDevRemove"]').click();
    expect(await answerAsk(page, 'ok', 'Tablet lost on the floor')).toContain('Remove Floor tablet?');
    await expect(page.locator('.inv-toast')).toContainText('Removed Floor tablet, and the list went to GitHub');
    expect(await g(page, 'window.__guardAsked')).toContain('users: Remove a device');
    const removed = (await g(page, 'S.devices') as Array<Record<string, unknown>>).find(d => d.id === 'dev-floor')!;
    expect(removed).toMatchObject({ removedBy: 'u-own', removeReason: 'Tablet lost on the floor', removedAt: expect.any(Number) });
    await expect(list.locator('[data-dev="dev-floor"]')).toContainText('Removed');
    await expect(list.locator('[data-dev="dev-floor"]')).toContainText('Tablet lost on the floor');
    await expect(list.locator('[data-dev="dev-floor"] [data-action="invDevRemove"]')).toHaveCount(0);
    expect(gh.envelope().state.devices.find((d: { id: string }) => d.id === 'dev-floor').removedAt).toBe(removed.removedAt);
    const day = await g(page, 'formatDate(isoOf(new Date()))');

    // The floor tablet: another device, registered in its own book, holding its own token.
    const ctx = await browser.newContext({ ...devices['Pixel 5'], baseURL, serviceWorkers: 'block' });
    const tab = await ctx.newPage();
    await gh.on(tab);
    await seedDevice(tab, { token: TABLET_TOKEN, session: 'u-sup', devId: 'dev-floor', cfg: { deviceName: 'Floor tablet' } });
    await open(tab, book({ users: [OWNER, SUPER], devices: rows }));
    expect(await g(tab, 'getGhToken()')).toBe(TABLET_TOKEN);
    await expect.poll(() => keyHeld(tab)).toBe(true);
    // It loads the book from GitHub, and finds itself removed.
    await openSettingsAt(tab, 'sync');
    await tab.locator('#ghPullBtn').click();
    await answerAsk(tab, 'ok');
    await expect(tab.locator('.inv-toast')).toContainText('Pulled from GitHub');
    await expect(tab.locator('.inv-notice-bar')).toContainText('This device was removed by Meera Rao on ' + day + ': Tablet lost on the floor.');
    expect(await g(tab, 'getGhToken()')).toBe('');
    expect(await tokenEntries(tab)).toEqual([null, null]);
    expect(await keyHeld(tab)).toBe(false);
    const putsBefore = gh.puts.length;

    // Its next start: sync stays off, and the reason is still said.
    await tab.reload();
    await waitForBoot(tab);
    await guardAfterBoot(tab);
    await expect(tab.locator('#homeSyncCard')).toContainText('This device was removed by Meera Rao on ' + day + ': Tablet lost on the floor.');
    expect(await g(tab, 'ghPushLocked()')).toBe(false);
    await expect(tab.locator('.inv-toast')).toContainText('This device was removed by Meera Rao');
    await openSettingsAt(tab, 'sync');
    await expect(tab.locator('#ghPushBtn')).toBeDisabled();
    await openSettingsAt(tab, 'devices');
    await expect(tab.locator('[data-dev-status="removed"]')).toContainText('Tablet lost on the floor');
    expect(gh.puts.length).toBe(putsBefore);
    await ctx.close();
  });

  test('a device whose stored book says it was removed forgets its token at the next start', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-desk' });
    await open(page, book({ users: [OWNER, SUPER], devices: [
      { id: 'dev-desk', name: 'Desk PC', user: 'u-own', registeredAt: Date.now() - 86400000, registeredBy: 'u-own', build: 'x' },
    ] }));
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);
    // The book on disk now says so (as another device's copy, taken in, would).
    await g(page, "var r = S.devices[0]; r.removedAt = Date.now(); r.removedBy = 'u-own'; r.removeReason = 'Desk moved to the store room'; persistState()");
    await page.reload();
    await waitForBoot(page);
    await guardAfterBoot(page);
    await expect(page.locator('.inv-notice-bar')).toContainText('This device was removed by Meera Rao');
    await expect(page.locator('.inv-notice-bar')).toContainText('Desk moved to the store room');
    expect(await g(page, 'getGhToken()')).toBe('');
    expect(await tokenEntries(page)).toEqual([null, null]);
    expect(await g(page, 'ghPushLocked()')).toBe(false);
    expect(gh.auths).toEqual([]);
    // A token entered again after it is kept, and the device stays held until it is registered again.
    await g(page, `setGhToken('${TOKEN}')`);
    await page.reload();
    await waitForBoot(page);
    await guardAfterBoot(page);
    expect(await g(page, 'getGhToken()')).toBe(TOKEN);
    expect(await g(page, 'devSyncBlocked()')).toContain('Desk moved to the store room');
    await openSettingsAt(page, 'devices');
    await page.locator('[data-action="invDevRegister"]').click();
    await expect(page.locator('.inv-toast')).toContainText('This device is registered, and a copy went to GitHub');
    expect(await g(page, 'S.devices[0].removedAt')).toBeUndefined();
    expect(gh.envelope()._device).toMatchObject({ id: 'dev-desk' });
  });

  test('turning the guard on offers to register a device that already syncs; until it is, its sync is paused', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, devId: 'dev-desk' });
    await open(page, book());
    // The owner turns the guard on, as guard.js does: the owner's ID made, signed in, saved.
    await signIn(page, 'u-own');
    await g(page, `S.users = ${JSON.stringify([OWNER])}; saveState()`);
    expect(await answerAsk(page, 'cancel')).toContain('Register this device?');
    expect(await g(page, 'ghPushLocked()')).toBe(false);
    await expect(page.locator('.inv-toast')).toContainText("This device isn't registered");
    await expect(page.locator('#homeSyncCard')).toContainText("Paused: this device isn't registered");
    expect(await g(page, '_ghPushTimer')).toBeNull();
    // Asked once: a later save does not ask again.
    await g(page, "S.company.name = 'CHANGED CO'; saveState()");
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    // Register from the card: Settings opens on Devices, and one PIN registers it.
    await page.locator('#homeSyncCard [data-action="invDevGo"]').click();
    await expect(page.locator('details[data-sec="devices"]')).toHaveAttribute('open', '');
    await page.locator('[data-action="invDevRegister"]').click();
    await expect(page.locator('.inv-toast')).toContainText('This device is registered, and a copy went to GitHub');
    expect(gh.envelope()._device).toMatchObject({ id: 'dev-desk', name: 'Bench PC', user: 'u-own' });
    expect(gh.puts[0].message).toContain('Bench PC');
    expect(gh.puts[0].message).toContain('Meera Rao');
  });

  test('accepting the offer registers the device at once and sends the copy', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, devId: 'dev-desk' });
    await open(page, book());
    await signIn(page, 'u-own');
    await g(page, `S.users = ${JSON.stringify([OWNER])}; saveState()`);
    expect(await answerAsk(page, 'ok')).toContain('Register it as Bench PC, used by Meera Rao');
    await expect(page.locator('.inv-toast')).toContainText('This device is registered, and a copy went to GitHub');
    expect(await g(page, 'S.devices.length')).toBe(1);
    expect(await g(page, 'S.devices[0]')).toMatchObject({ id: 'dev-desk', name: 'Bench PC', user: 'u-own', registeredBy: 'u-own' });
    expect(gh.puts).toHaveLength(1);
    expect(gh.envelope()._device).toMatchObject({ id: 'dev-desk', user: 'u-own' });
    await expect(page.locator('#homeSyncCard [data-action="invGhPush"]')).toBeVisible();
  });
});
