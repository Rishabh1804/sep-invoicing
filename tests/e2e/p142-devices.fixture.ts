import type { Page } from '@playwright/test';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { emptyState, loadAppWithState, noSeedIM, openPulse, type SepState } from './fixtures';

/*
 * P142's fixtures: devices (the guard, step G2). GitHub is stubbed at the route layer, as in P15, by a fake that keeps
 * the last file PUT. The guard (guard.js, step G1) is reached only through its agreed names, so the page gets a stand-in
 * for them: an owner exists → on; the user signed in is the session's; guardAsk('users') lets the owner through and
 * refuses any other ID in a dialog. It is installed before the app's scripts and again after boot (where guard.js is
 * built in, its own functions replace the early copy). The users carry real salted hashes, so guard.js's own start
 * reads them as users.
 */

export const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';
export const TOKEN = 'github_pat_P142DESKTOKEN';
export const TABLET_TOKEN = 'github_pat_P142TABLETTOKEN';
export const UNREG = "This device isn't registered. Register it with the owner present, or import a backup (Settings → Import) to view the data.";

function secret(pin: string) {
  const salt = randomBytes(16), iter = 150000;
  return { alg: 'PBKDF2-SHA256', iter, salt: salt.toString('base64'), hash: pbkdf2Sync(pin, salt, iter, 32, 'sha256').toString('base64'), digits: /^\d+$/.test(pin) };
}
// Made-up people.
export const OWNER = { id: 'u-own', name: 'Meera Rao', role: 'owner', active: true, secret: secret('4826'), createdAt: 1, createdBy: 'u-own' };
export const SUPER = { id: 'u-sup', name: 'Kiran Das', role: 'supervisor', active: true, secret: secret('7351'), createdAt: 1, createdBy: 'u-own' };

export const GUARD_STUB = `(function () {
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

export const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

export function book(extra: Record<string, unknown> = {}): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState;
}

/** This device as it was before the page opened: its sync config, a token kept as typed (a build before this one), its
 *  id, who is signed in. Once per tab: a reload keeps what the app made of it. */
export async function seedDevice(page: Page, o: { token?: string; devId?: string; session?: string; cfg?: Record<string, unknown> } = {}) {
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
export async function guardAfterBoot(page: Page) { await g(page, GUARD_STUB); }
export async function signIn(page: Page, userId: string) {
  await page.evaluate(id => sessionStorage.setItem('sep_inv_session', JSON.stringify({ userId: id, at: Date.now() })), userId);
}
export async function open(page: Page, state: SepState) {
  await loadAppWithState(page, state);
  await guardAfterBoot(page);
  // The sync card is one of Pulse's widgets (Today, DIRECTION_B).
  await openPulse(page);
}

/** GitHub's Contents API for one file: GET answers the last PUT (404 before any), PUT keeps what it was sent. */
export class FakeGitHub {
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

export function envelopeOf(state: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { app: 'sep-invoicing', schema: 1, savedAt: Date.now() - 60000, device: 'Floor tablet', deviceId: 'dev-floor',
    counts: { invoices: 0, challans: 1, clients: 1, items: 0 }, state, ...extra };
}

/** Two devices on the list besides this one's place on it: one registered and pushing, one removed with a long reason. */
export function listedDevices(now = Date.now()) {
  return [
    { id: 'dev-floor', name: 'Floor tablet', user: 'u-sup', registeredAt: now - 5 * 86400000, registeredBy: 'u-own', build: 'x', lastPushAt: now - 3 * 3600000 },
    { id: 'dev-old', name: 'Old office laptop with a long name for its row', user: 'u-own', registeredAt: now - 40 * 86400000, registeredBy: 'u-own', build: 'x',
      removedAt: now - 2 * 86400000, removedBy: 'u-own', removeReason: 'Sold, and its token deleted on GitHub the same day' },
  ];
}

export const tokenEntries = (p: Page) => p.evaluate(() => [localStorage.getItem('sep_inv_github_token'), localStorage.getItem('sep_inv_github_token_enc')]);
/** Whether the device's key is in its database. */
export const keyHeld = (p: Page) => p.evaluate(() => new Promise<boolean>(resolve => {
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
