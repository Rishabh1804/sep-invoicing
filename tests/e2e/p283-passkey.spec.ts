import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, readStoredState, openSettingsAt, answerAsk } from './fixtures';
import { PINS, g, guardBook, lockNow, pickId, unlock, windowGone, withUsers } from './p140-guard.fixture';

// P283: the owner signs in with a passkey (WebAuthn, the device's own fingerprint, face or screen lock), beside the PIN, which
// keeps working as it did. The book keeps only the passkey's public key; each sign-in is a fresh challenge signed on the device
// and checked in the page (guard.js grdPkVerify). Chromium's virtual authenticator (CDP WebAuthn) stands in for the device.
// A passkey binds to a host, never an IP address, so these run on the test server's `localhost` (P280's second origin).
// Every name is made up.

const PORT = Number(process.env.PW_PORT) || 4173;
test.use({ baseURL: `http://localhost:${PORT}` });

/* A platform authenticator that verifies the user, on this page's browser. */
async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
  return { cdp, authenticatorId };
}
/* The guard's book with its three users, the owner signed in by the PIN. */
async function ownerIn(page: Page) {
  const a = await authenticator(page);
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  return a;
}
const owner = async (page: Page) => (await readStoredState(page)).users.find((u: any) => u.id === 'U-own');
const fails = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_guard_fail') || 'null'));
/* Settings → Users & access → Add a passkey for this device, inside the re-ask window. */
async function addPasskey(page: Page) {
  await openSettingsAt(page, 'users');
  const pks = page.locator('[data-grd-pks="U-own"]');
  await pks.locator('[data-action="invGuardPkAdd"]').click();
  await expect(pks.locator('[data-grd-pkrow]')).toHaveCount(1);
  await expect.poll(async () => ((await owner(page)).passkeys || []).length).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsScrim')).toHaveCount(0);
}

test.describe('P283: the passkey', () => {
  test('the owner adds a passkey: the book keeps only its public part; the lock and the re-ask offer it first, and it signs in', async ({ page }) => {
    const { cdp, authenticatorId } = await ownerIn(page);
    expect(await page.evaluate(() => (window as any).grdPkReady())).toBe(true);
    await openSettingsAt(page, 'users');
    // Offered on the owner's own row only; no other user's.
    await expect(page.locator('[data-action="invGuardPkAdd"]')).toHaveCount(1);
    await expect(page.locator('[data-grd-pks="U-own"] [data-action="invGuardPkAdd"]')).toContainText('Add a passkey for this device');
    await page.keyboard.press('Escape');
    await addPasskey(page);
    const u = await owner(page);
    const pk = u.passkeys[0];
    expect(Object.keys(pk).sort()).toEqual(['alg', 'at', 'dev', 'id', 'name', 'pub']);
    expect(pk.alg).toBe(-7);
    expect(pk.dev).toBe(await page.evaluate(() => (window as any).devId()));
    expect(pk.name).toBe(await page.evaluate(() => (window as any).devName()));
    // The public key as SPKI (a P-256 key is 91 bytes), and the id the authenticator holds.
    expect(Buffer.from(pk.pub, 'base64').length).toBe(91);
    const creds = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
    expect(creds).toHaveLength(1);
    expect(Buffer.from(creds[0].credentialId, 'base64').toString('base64url')).toBe(pk.id);
    // No private key material anywhere in the book: not the key the authenticator holds (PKCS#8), nor a piece of it, nor a JWK's d.
    const book = JSON.stringify(await readStoredState(page));
    const priv = Buffer.from(creds[0].privateKey, 'base64');
    for (const enc of ['base64', 'base64url', 'hex'] as const) expect(book).not.toContain(priv.subarray(priv.length - 32).toString(enc).slice(0, 24));
    expect(book).not.toContain(creds[0].privateKey.slice(0, 40));
    expect(book).not.toMatch(/privateKey|"d":/);
    // The change log names it as a count, never the key.
    expect(await page.evaluate(() => JSON.stringify((0, eval)('S').changeLog.slice(-3)))).not.toContain(pk.pub.slice(0, 40));

    // The lock offers the passkey first, the PIN below it; the passkey signs in and clears nothing it should not.
    await lockNow(page);
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('[data-action="invGuardPkUse"]')).toContainText('Use a passkey');
    await expect(lock.locator('[data-action="invGuardPkPin"]')).toHaveText('Use the PIN instead');
    await expect(lock.locator('#grdPin')).toHaveCount(0);
    await lock.locator('[data-action="invGuardPkUse"]').click();
    await expect(lock).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).grdUserId())).toBe('U-own');

    // The re-ask: the passkey first, and the change goes through on it.
    await windowGone(page);
    await g(page, "cancelInvoice('INV-1')");
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('[data-action="invGuardPkAsk"]')).toContainText('Use a passkey');
    await expect(ask.locator('[data-action="invGuardPkPin"]')).toHaveText('Use the PIN instead');
    await ask.locator('[data-action="invGuardPkAsk"]').click();
    await expect(ask).toHaveCount(0);
    await page.locator('[data-action="invConfirmCancel"]').click();
    await expect.poll(async () => (await readStoredState(page)).invoices.find((i: any) => i.id === 'INV-1').status).toBe('cancelled');
    // The re-ask's PIN is still there behind Use the PIN instead.
    await windowGone(page);
    await g(page, "cancelInvoice('INV-2')");
    await ask.locator('[data-action="invGuardPkPin"]').click();
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect(ask).toHaveCount(0);
    await expect(page.locator('[data-action="invConfirmCancel"]')).toBeVisible();
  });

  test('the verifier: a genuine answer passes; a tampered signature, data, challenge or a credential not the user\'s is refused', async ({ page }) => {
    await ownerIn(page);
    await addPasskey(page);
    const r = await page.evaluate(async () => {
      const w = window as any, S = (0, eval)('S');
      const u = S.users.find((x: any) => x.id === 'U-own');
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred: any = await navigator.credentials.get({ publicKey: { challenge, rpId: location.hostname, userVerification: 'required',
        allowCredentials: [{ type: 'public-key', id: w.grdPkUnB64u(u.passkeys[0].id) }] } } as any);
      const a = { id: w.grdPkB64u(cred.rawId), clientDataJSON: new Uint8Array(cred.response.clientDataJSON),
        authenticatorData: new Uint8Array(cred.response.authenticatorData), signature: new Uint8Array(cred.response.signature) };
      const flip = (b: Uint8Array, i: number) => { const c = b.slice(); c[i] ^= 0x01; return c; };
      const other = { ...u, passkeys: [{ ...u.passkeys[0], id: 'QUJDREVGR0hJSktMTU5PUA' }] };
      return {
        genuine: await w.grdPkVerify(u, a, challenge),
        sigTampered: await w.grdPkVerify(u, { ...a, signature: flip(a.signature, a.signature.length - 2) }, challenge),
        counterTampered: await w.grdPkVerify(u, { ...a, authenticatorData: flip(a.authenticatorData, 36) }, challenge),
        rpTampered: await w.grdPkVerify(u, { ...a, authenticatorData: flip(a.authenticatorData, 0) }, challenge),
        clientTampered: await w.grdPkVerify(u, { ...a, clientDataJSON: new TextEncoder().encode(new TextDecoder().decode(a.clientDataJSON).replace('"webauthn.get"', '"webauthn.get" ')) }, challenge),
        otherChallenge: await w.grdPkVerify(u, a, crypto.getRandomValues(new Uint8Array(32))),
        notTheirs: await w.grdPkVerify(other, a, challenge),
        idTampered: await w.grdPkVerify(u, { ...a, id: a.id.slice(0, -2) + (a.id.slice(-2) === 'AA' ? 'AB' : 'AA') }, challenge),
        noUser: await w.grdPkVerify(null, a, challenge),
        junk: await w.grdPkVerify(u, { id: a.id, clientDataJSON: 'x', authenticatorData: null, signature: undefined }, challenge),
      };
    });
    expect(r).toEqual({ genuine: true, sigTampered: false, counterTampered: false, rpTampered: false, clientTampered: false,
      otherChallenge: false, notTheirs: false, idTampered: false, noUser: false, junk: false });
  });

  test('the verifier on keys made in the page: ES256 and RS256 pass; each check refuses its own fault, signed right', async ({ page }) => {
    await ownerIn(page);
    const r = await page.evaluate(async () => {
      const w = window as any, sub = crypto.subtle, enc = new TextEncoder();
      const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; p.forEach(x => { o.set(x, i); i += x.length; }); return o; };
      // r||s → DER, as an authenticator sends it.
      const derInt = (b: Uint8Array) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; let v = b.slice(i); if (v[0] & 0x80) v = cat(new Uint8Array([0]), v); return cat(new Uint8Array([2, v.length]), v); };
      const der = (raw: Uint8Array) => { const body = cat(derInt(raw.slice(0, 32)), derInt(raw.slice(32))); return cat(new Uint8Array([0x30, body.length]), body); };
      const make = async (alg: number) => {
        const kp: any = alg === -7 ? await sub.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
          : await sub.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
        const pub = w.grdB64(new Uint8Array(await sub.exportKey('spki', kp.publicKey)));
        return { kp, user: { id: 'U-x', role: 'owner', passkeys: [{ id: 'cGstdGVzdA', pub, alg, dev: 'dev-x', name: 'A device', at: 1 }] } };
      };
      const sign = async (k: any, alg: number, o: any = {}) => {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const ad = cat(new Uint8Array(await sub.digest('SHA-256', enc.encode(o.rpId ?? location.hostname))), new Uint8Array([o.flags ?? 0x05, 0, 0, 0, 0]));
        const cd = enc.encode(JSON.stringify({ type: o.type ?? 'webauthn.get', challenge: w.grdPkB64u(challenge), origin: o.origin ?? location.origin, crossOrigin: false }));
        const data = cat(ad, new Uint8Array(await sub.digest('SHA-256', cd)));
        const s = new Uint8Array(alg === -7 ? await sub.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.kp.privateKey, data) : await sub.sign({ name: 'RSASSA-PKCS1-v1_5' }, k.kp.privateKey, data));
        return w.grdPkVerify(k.user, { id: 'cGstdGVzdA', clientDataJSON: cd, authenticatorData: ad, signature: alg === -7 ? (o.raw ? s : der(s)) : s }, challenge);
      };
      const es = await make(-7), rs = await make(-257);
      const out: Record<string, boolean> = {};
      for (let i = 0; i < 4; i++) out['es256#' + i] = await sign(es, -7);   // r or s with its top bit set, now and then: padded in DER
      out.rs256 = await sign(rs, -257);
      out.noUV = await sign(es, -7, { flags: 0x01 });
      out.noUP = await sign(es, -7, { flags: 0x04 });
      out.otherHost = await sign(es, -7, { rpId: 'sep.example.com' });
      out.otherOrigin = await sign(es, -7, { origin: 'https://sep.example.com' });
      out.createType = await sign(es, -7, { type: 'webauthn.create' });
      out.rawNotDer = await sign(es, -7, { raw: true });
      out.wrongAlg = await sign({ ...es, user: { ...es.user, passkeys: [{ ...es.user.passkeys[0], alg: -8 }] } }, -7);
      out.keyOfAnother = await sign({ kp: es.kp, user: rs.user }, -7);
      out.der33 = !!w.grdPkDerToRaw(der(new Uint8Array(64).fill(0xff)));
      out.derLong = !!w.grdPkDerToRaw(new Uint8Array([0x30, 0x45, 2, 0x21, ...new Uint8Array(33).fill(1), 2, 0x20, ...new Uint8Array(32).fill(1)]));
      return out;
    });
    expect(r).toEqual({ 'es256#0': true, 'es256#1': true, 'es256#2': true, 'es256#3': true, rs256: true, noUV: false, noUP: false, otherHost: false,
      otherOrigin: false, createType: false, rawNotDer: false, wrongAlg: false, keyOfAnother: false, der33: true, derLong: false });
  });

  test('a cancel says so, leaves the PIN usable and is not counted; a failed check is counted; the PIN signs the owner in', async ({ page }) => {
    const { cdp, authenticatorId } = await ownerIn(page);
    await addPasskey(page);
    await lockNow(page);
    const lock = page.locator('#guardRoot');
    // The device says no (the fingerprint not given): a cancel.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await lock.locator('[data-action="invGuardPkUse"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('The passkey was cancelled. Use the PIN.');
    await expect(lock.locator('#grdPin')).toBeVisible();
    await expect(lock.locator('#grdPin')).toBeEditable();
    expect(await fails(page)).toBeNull();
    // Back to the passkey, with the book holding another key for that id: the answer does not check, and is counted.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
    await lock.locator('[data-action="invGuardPkBack"]').click();
    await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const S = (0, eval)('S');
      S.users.find((x: any) => x.id === 'U-own').passkeys[0].pub = (window as any).grdB64(new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey)));
    });
    await lock.locator('[data-action="invGuardPkUse"]').click();
    await expect(lock.locator('[data-grd-err]')).toHaveText('The passkey did not check · 4 tries left. Use the PIN.');
    expect((await fails(page)).ids['u:U-own'].n).toBe(1);
    await expect(lock.locator('#grdPin')).toBeEditable();
    // The PIN signs the owner in, as it always has, and clears the count.
    await lock.locator('#grdPin').fill(PINS.owner);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await lock.locator('[data-action="invGuardLater"]').click();
    await expect(lock).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).grdUserId())).toBe('U-own');
    expect((await fails(page))?.ids?.['u:U-own']).toBeUndefined();
  });

  test('the supervisor\'s PIN works as before, and holds no passkey; the owner\'s PIN works behind Use the PIN instead', async ({ page }) => {
    await ownerIn(page);
    await addPasskey(page);
    await lockNow(page);
    const lock = page.locator('#guardRoot');
    await pickId(page, 'U-sup');
    await expect(lock.locator('[data-action="invGuardPkUse"]')).toHaveCount(0);
    await expect(lock.locator('#grdPin')).toBeVisible();
    await lock.locator('#grdPin').fill(PINS.super);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await lock.locator('[data-action="invGuardLater"]').click();
    await expect(lock).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).grdUserId())).toBe('U-sup');
    await lockNow(page);
    await pickId(page, 'U-own');
    await lock.locator('[data-action="invGuardPkPin"]').click();
    await unlock(page, 'U-own', PINS.owner);
    expect(await page.evaluate(() => (window as any).grdUserId())).toBe('U-own');
  });

  test('not offered where the device says no, nor on the shared github.io host or an IP address', async ({ page }) => {
    await ownerIn(page);
    await addPasskey(page);
    expect(await page.evaluate(() => (window as any).grdPkSupported())).toBe(true);
    // The host a passkey may bind to.
    expect(await page.evaluate(() => ['localhost', 'sep.example.com', 'rishabh1804.github.io', 'GitHub.io', 'a.b.github.io.', '127.0.0.1', '::1', '[::1]', '']
      .map(h => (window as any).grdPkHostOk(h)))).toEqual([true, true, false, false, false, false, false, false, false]);
    // The availability says no: the lock offers the PIN alone, and Settings no Add.
    await page.evaluate(() => { (window as any).grdPkSupported = () => Promise.resolve(false); });
    await lockNow(page);
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('#grdPin')).toBeVisible();
    await expect(lock.locator('[data-action="invGuardPkUse"]')).toHaveCount(0);
    await expect(lock.locator('[data-action="invGuardPkBack"]')).toHaveCount(0);
    await unlock(page, 'U-own', PINS.owner);
    await openSettingsAt(page, 'users');
    await expect(page.locator('[data-grd-pkrow]')).toHaveCount(1);
    await expect(page.locator('[data-action="invGuardPkAdd"]')).toHaveCount(0);
  });

  test('on an IP address the same browser offers nothing: the host is read off the page', async ({ page }) => {
    await authenticator(page);
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForSelector('body.inv-booted');
    expect(await page.evaluate(() => [location.hostname, (window as any).grdPkHostOk(location.hostname)])).toEqual(['127.0.0.1', false]);
    expect(await page.evaluate(() => (window as any).grdPkSupported())).toBe(false);
  });

  test('removing a passkey takes it out of the book, through a question; the lock then asks the PIN', async ({ page }) => {
    await ownerIn(page);
    await addPasskey(page);
    await openSettingsAt(page, 'users');
    const row = page.locator('[data-grd-pks="U-own"] [data-grd-pkrow]');
    await expect(row).toContainText('this device');
    // Asked first; Cancel keeps it.
    await row.locator('[data-action="invGuardPkRemove"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Remove this passkey?');
    expect((await owner(page)).passkeys).toHaveLength(1);
    await row.locator('[data-action="invGuardPkRemove"]').click();
    expect(await answerAsk(page, 'ok')).toContain('The PIN still works.');
    await expect.poll(async () => (await owner(page)).passkeys).toEqual([]);
    await expect(page.locator('[data-grd-pkrow]')).toHaveCount(0);
    // The device may make one again.
    await expect(page.locator('[data-action="invGuardPkAdd"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await lockNow(page);
    await expect(page.locator('#guardRoot [data-action="invGuardPkUse"]')).toHaveCount(0);
    await expect(page.locator('#guardRoot #grdPin')).toBeVisible();
  });

  test('the book carries passkeys: its guard\'s signature differs on them, and a merge keeps each side\'s added and removed', async ({ page }) => {
    await ownerIn(page);
    const r = await page.evaluate(() => {
      const w = window as any, S = (0, eval)('S');
      const pk = (id: string) => ({ id, pub: 'cHVi', alg: -7, dev: 'dev-' + id, name: 'Device ' + id, at: 1 });
      const base = JSON.parse(JSON.stringify(S));
      base.users.find((u: any) => u.id === 'U-own').passkeys = [pk('A'), pk('B')];
      const mine = JSON.parse(JSON.stringify(base)), theirs = JSON.parse(JSON.stringify(base));
      const own = (b: any) => b.users.find((u: any) => u.id === 'U-own');
      own(mine).passkeys.push(pk('C'));                                            // added here
      own(theirs).passkeys.push(pk('D'));                                          // added there
      own(theirs).passkeys = own(theirs).passkeys.filter((p: any) => p.id !== 'A'); // removed there
      const res = w.mrgMerge(base, mine, theirs, { from: 'Office PC', prefer: 'm' });
      const sigOf = (b: any) => w.grdBookGuardSig(b);
      return { ids: own(res.book).passkeys.map((p: any) => p.id).sort(), held: res.held.length,
        sigDiffers: sigOf(mine) !== sigOf(theirs), sigSame: sigOf(base) === sigOf(JSON.parse(JSON.stringify(base))) };
    });
    expect(r).toEqual({ ids: ['B', 'C', 'D'], held: 0, sigDiffers: true, sigSame: true });
  });
});
