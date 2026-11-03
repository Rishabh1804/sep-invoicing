import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import zlib from 'zlib';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, switchTab, todayIso, toolbarMore, type SepState } from './fixtures';

// P257: photos read by Claude (owner, 3 Nov 2026: "Let's add photos reader along with it, we have 100$ of claude API credit"; the
// key on the owner's devices, Opus 5.5, and three kinds: VAT register pages, the power log, client challans). Anthropic's API is
// faked at the route layer: the request's shape is checked (the key, the browser header, the model, the schema, the image), and
// the answer is a register page, a power log or a challan, each checked by the reader the app always had before anything is
// saved. Every name and figure is made up.

const ANTHROPIC = 'https://api.anthropic.com/**';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PNG2 = Buffer.concat([PNG, Buffer.from([0, 1, 2])]);
const pad = (n: number) => String(n).padStart(2, '0');
const T = todayIso();
const dmy = (iso: string) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y.slice(2); };
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }] },
  { id: 12, name: 'DURGA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [{ ratePerKg: 12, ratePerPiece: null, effectiveFrom: '2026-04-01' }] },
];
const book = (): SepState => ({ ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as unknown as SepState);
const PAGE = { page: 'production', date: dmy(T), weekday: null, line: 'VAT A1', dayTotal: null,
  rows: [{ time: '9:20 AM', mark: null, customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qtyText: '108', struck: null, over: null, bracket: null, ditto: null, legible: null, event: null, date: null }] };
const POWER = { page: 'power', date: dmy(T), weekday: null, line: null, dayTotal: null,
  rows: [{ time: '10:26 AM', event: 'power cut', date: dmy(T) }, { time: '10:36 AM', event: 'power in', date: dmy(T) }] };
const CHALLAN = { challanNo: '0133/26-27', challanDate: dmy(T), clientName: 'Nova Clamps Pvt Ltd', vehicleNo: 'JH 05ZZ 1234',
  items: [{ partNumber: '9105 0000 4705', desc: 'BRACKET', unit: 'KG', qty: 50, nosQty: 200, amount: null }] };
const reply = (obj: unknown, extra: Record<string, unknown> = {}) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 1500 }, ...extra });

/* The app booted with the key on the device and Anthropic answering `answer(n)` on its n-th request; the requests are kept. */
async function boot(page: Page, answer: (n: number) => { status?: number; body: unknown }, state: SepState = book(), key = 'sk-ant-test') {
  await loadAppWithState(page, state);
  await page.evaluate(k => { try { if (k) localStorage.setItem('sep_inv_claude_key', k); localStorage.removeItem('sep_inv_prod_photo_read'); localStorage.removeItem('sep_inv_claude_spent'); } catch (e) { /* none */ } }, key);
  const reqs: Array<{ headers: Record<string, string>; body: any }> = [];
  await page.route(ANTHROPIC, async route => {
    const r = route.request();
    reqs.push({ headers: r.headers(), body: JSON.parse(r.postData() || '{}') });
    const a = answer(reqs.length);
    await route.fulfill({ status: a.status || 200, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  return reqs;
}
const pick = (page: Page, buffer: Buffer, name = 'register.png') => page.setInputFiles('#prodPhotoInput', { name, mimeType: 'image/png', buffer });

test.describe('P257: photos read by Claude', () => {
  test('the key is the device’s: Settings → Connections keeps it off the book, and says what the photos have cost', async ({ page }) => {
    await boot(page, () => ({ body: reply(PAGE) }), book(), '');
    await openSettingsAt(page, 'claudeKey');
    const sec = page.locator('details[data-sec="claudeKey"]');
    await expect(sec).toContainText('Photo reading (Claude)');
    await expect(sec).toContainText('no photo read yet');
    await page.locator('#setClaudeKey').fill('sk-ant-made-up');
    await sec.locator('[data-action="invSaveSettingsSec"]').click();
    expect(await g(page, `localStorage.getItem('sep_inv_claude_key')`)).toBe('sk-ant-made-up');
    expect(JSON.stringify(await readStoredState(page))).not.toContain('sk-ant-made-up');
  });

  test('without a key a photo is not picked: the app says where the key goes', async ({ page }) => {
    const reqs = await boot(page, () => ({ body: reply(PAGE) }), book(), '');
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Read register photo');
    expect(await answerAsk(page, 'cancel')).toContain('Claude key needed');
    expect(reqs.length).toBe(0);
  });

  test('a register page: the request is Opus 5.5 with the browser header, a JSON schema and the image; the runs are checked, then saved from the photo', async ({ page }) => {
    const reqs = await boot(page, () => ({ body: reply(PAGE) }));
    await switchTab(page, 'pageProduction');
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    const r = reqs[0];
    expect(r.headers['x-api-key']).toBe('sk-ant-test');
    expect(r.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(r.headers['anthropic-version']).toBe('2026-10-21');
    expect(r.body.model).toBe('claude-opus-5-5');
    expect(r.body.output_config.format.type).toBe('json_schema');
    expect(r.body.fallbacks).toBe('default');
    const img = r.body.messages[0].content[0];
    expect(img).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    expect(img.source.data.length).toBeGreaterThan(20);
    // Every object of the schema names all its fields and allows no other (structured outputs).
    const walk = (s: any): boolean => !s || typeof s !== 'object' ? true : (s.type === 'object' ? s.additionalProperties === false && JSON.stringify(Object.keys(s.properties).sort()) === JSON.stringify([...s.required].sort()) : true) &&
      Object.values(s.properties || {}).every(walk) && walk(s.items) && (s.anyOf || []).every(walk);
    expect(walk(r.body.output_config.format.schema)).toBe(true);
    await expect(page.locator('[data-prod-run="0"]')).toContainText('NOVA CLAMPS');
    await expect(page.locator('#productionContent')).toContainText('Read by Claude');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const s = await readStoredState(page);
    const e = s.production.entries.find((x: any) => x.kind === 'plated');
    expect(e).toMatchObject({ clientId: 11, qty: 108, date: T, line: 'vat-a1' });
    expect(s.production.photos[0]).toMatchObject({ model: 'claude-opus-5-5', promptVer: 'reg-c1', page: 'production' });
    expect(e.photoId).toBe(s.production.photos[0].id);
    // What the read cost is the device's: 3,000 in and 1,500 out at $4 / $20 a million is 4.2¢.
    expect(await g(page, `phSpent().usd`)).toBeCloseTo(0.042, 6);
    // The same photo again is refused as saved before, read from the draft is not paid twice once saved: a second request.
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoDup')).toContainText('This photo was saved before');
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeDisabled();
  });

  test('the power log: its cuts are read and saved as power cuts from the register', async ({ page }) => {
    await boot(page, () => ({ body: reply(POWER) }));
    await switchTab(page, 'pageProduction');
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoPower')).toContainText('10:26');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.filter((x: any) => x.kind === 'downtime').map((x: any) => [x.time, x.to, x.src])).toEqual([['10:26', '10:36', 'photo']]);
  });

  test('a challan photographed as a register page goes to the challan scanner, which fills the form from the book’s own client and rate; the next photo waits', async ({ page }) => {
    const reqs = await boot(page, n => ({ body: reply(n === 1 ? { ...PAGE, page: 'challan', rows: [] } : n === 2 ? CHALLAN : PAGE) }));
    await switchTab(page, 'pageProduction');
    await page.setInputFiles('#prodPhotoInput', [{ name: 'challan.png', mimeType: 'image/png', buffer: PNG }, { name: 'page.png', mimeType: 'image/png', buffer: PNG2 }]);
    await expect(page.locator('#productionContent')).toContainText('a customer’s challan');
    await page.locator('[data-action="invProdToScanner"]').click();
    await expect.poll(() => g(page, '_challanForm && _challanForm.challanNo')).toBe('0133/26-27');
    const f: any = await g(page, '({ c: _challanForm.clientId, d: _challanForm.challanDate, v: _challanForm.vehicleNo, i: _challanForm.items.map(function(x){ return [x.partNumber, x.unit, x.qty, x.nosQty, x.rate]; }) })');
    expect(f).toEqual({ c: 11, d: T, v: 'JH 05ZZ 1234', i: [['9105 0000 4705', 'KG', 50, 200, 13]] });
    // The challan prompt names no client and asks no rate (HR-10: nothing about a client is in the build).
    expect(reqs[1].body.messages[0].content[1].text).not.toMatch(/NOVA|DURGA|rate:/i);
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#prodPhotoWaiting')).toContainText('1 photo waiting');
    await page.locator('#prodPhotoWaiting [data-action="invProdPhotoNext"]').click();
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    expect(reqs.length).toBe(3);
  });

  test('Challans → More → Scan a challan reads the photo straight into the form', async ({ page }) => {
    await boot(page, () => ({ body: reply(CHALLAN) }));
    await switchTab(page, 'pageIM');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), toolbarMore(page, 'Scan a challan')]);
    await chooser.setFiles({ name: 'challan.png', mimeType: 'image/png', buffer: PNG });
    await expect.poll(() => g(page, '_challanForm && _challanForm.clientId')).toBe(11);
  });

  test('a refused key or a used-up credit is said in the banner and stops the photos waiting', async ({ page }) => {
    const reqs = await boot(page, () => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }));
    await switchTab(page, 'pageProduction');
    await page.setInputFiles('#prodPhotoInput', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG2 }]);
    await expect(page.locator('.inv-notice-bar')).toContainText('Anthropic refused the key');
    expect(reqs.length).toBe(1);
    expect(await g(page, '_prodPhotoQueue.length')).toBe(0);
  });

  test('a decline is said, never read as a page', async ({ page }) => {
    await boot(page, () => ({ body: reply({}, { stop_reason: 'refusal', content: [] }) }));
    await switchTab(page, 'pageProduction');
    await pick(page, PNG);
    await expect(page.locator('.inv-notice-bar')).toContainText('declined');
    await expect(page.locator('#prodPhotoRuns')).toHaveCount(0);
  });

  test('Add has a Photo door that hands the photo to Production’s check', async ({ page }) => {
    await boot(page, () => ({ body: reply(PAGE) }));
    await page.locator('[data-action="invAddOpen"]').first().click();
    await expect(page.locator('[data-action="invAddPhoto"]')).toContainText('read by Claude');
    await page.setInputFiles('#addPhotoInput', { name: 'register.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
  });

  test('an export’s photos: kept for the session with who sent them, offered on the confirmation screen, read in Production when tapped', async ({ page }) => {
    const reqs = await boot(page, () => ({ body: reply(PAGE) }));
    const [y, m, d] = T.split('-');
    const head = (clock: string) => `${d}/${m}/${y}, ${clock} - `;
    const chat = [head('8:35 am') + `Alfa Oraon: ${dmy(T)}/ in time\n-----8:30 am----\nVAT A1\n1) ALFA`,
      head('6:05 pm') + 'Bravo Munda: IMG-20991231-WA0001.jpg (file attached)',
      head('6:06 pm') + 'Bravo Munda: ok sir'].join('\n');
    const zip = zipOf([{ name: 'WhatsApp Chat with Floor.txt', data: chat, deflate: true }, { name: 'IMG-20991231-WA0001.jpg', data: PNG }]);
    const rec: any = await page.evaluate(async b64 => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return (0, eval)('wzImportBuf')(u.buffer, 'export.zip', { guarded: true });
    }, zip.toString('base64'));
    expect(rec.photos).toBe(1);
    const row = page.locator('[data-mc-photos="1"]');
    await expect(row).toContainText('1 photo from the export');
    await expect(row).toContainText('Bravo Munda 1');
    expect(reqs.length).toBe(0);
    await row.locator('[data-action="invMsgMcPhotos"]').click();
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await expect(page.locator('#productionContent')).toContainText('sent by Bravo Munda');
    expect(reqs.length).toBe(1);
    // The photo is the session's: nothing of it is in the book.
    expect(JSON.stringify(await readStoredState(page))).not.toContain('IMG-20991231-WA0001.jpg');
  });

  test('an export’s photos are cut at the book’s last production: an older page is entered already and is not offered', async ({ page }) => {
    const yest = (() => { const x = new Date(T + 'T00:00:00'); x.setDate(x.getDate() - 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); })();
    const before = (() => { const x = new Date(T + 'T00:00:00'); x.setDate(x.getDate() - 3); return x; })();
    const st = book() as any;
    st.relayPastes = [{ id: 'RP-1', at: Date.now(), hash: 'r0', sentBy: 'Alfa Oraon', sentOn: yest, sentAt: 8 * 60, kind: 'in', date: yest, text: 'an older roll' }];
    st.production = { entries: [{ id: 'PE-1', kind: 'plated', date: yest, line: 'vat-a1', clientId: 11, part: 'CLAMP', qty: 100, unit: 'NOS', basis: 'register', at: Date.now() }], pastes: [], photos: [], imports: [], pages: [] };
    await boot(page, () => ({ body: reply(PAGE) }), st);
    const [y, m, d] = T.split('-');
    const ob = { d: pad(before.getDate()), m: pad(before.getMonth() + 1), y: String(before.getFullYear()) };
    const chat = [`${ob.d}/${ob.m}/${ob.y}, 6:05 pm - Bravo Munda: IMG-20991229-WA0001.jpg (file attached)`,
      `${d}/${m}/${y}, 8:35 am - Alfa Oraon: ${dmy(T)}/ in time\n-----8:30 am----\nVAT A1\n1) ALFA`,
      `${d}/${m}/${y}, 6:05 pm - Bravo Munda: IMG-20991231-WA0002.jpg (file attached)`].join('\n');
    const zip = zipOf([{ name: 'WhatsApp Chat with Floor.txt', data: chat }, { name: 'IMG-20991229-WA0001.jpg', data: PNG }, { name: 'IMG-20991231-WA0002.jpg', data: PNG2 }]);
    const rec: any = await page.evaluate(async b64 => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return (0, eval)('wzImportBuf')(u.buffer, 'export.zip', { guarded: true });
    }, zip.toString('base64'));
    expect(rec.photos).toBe(1);
    expect(await g(page, `_wzPhotos.list.map(function(p){ return p.name; })`)).toEqual(['IMG-20991231-WA0002.jpg']);
  });
});

/* A zip written here, as WhatsApp writes its export: each entry stored or deflated, with its CRC (P254's). */
function zipOf(files: Array<{ name: string; data: string | Buffer; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [], central: Buffer[] = [];
  let off = 0;
  for (const f of files) {
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const body = f.deflate ? zlib.deflateRawSync(raw) : raw, name = Buffer.from(f.name, 'utf8'), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(f.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(f.deflate ? 8 : 0, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, body); central.push(ch, name);
    off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}
