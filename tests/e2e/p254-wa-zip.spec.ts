import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import zlib from 'zlib';
import { PINS, guardBook, unlock, withUsers } from './p140-guard.fixture';
import { answerAsk, bankImportDoor, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P254: the group's WhatsApp export read in the app (owner, 31 Oct 2026: a WhatsApp zip read "like we do here on this chat", for
// the one group chat; the first import "from the last message of each kind the book already holds"). The zip is unpacked (stored
// and deflated entries), its chat picked and read in either phone's format, WhatsApp's own lines and the media dropped, the
// messages cut to those newer than the book's last of their kind, taken into the Messages record and the import recorded. The
// same zip twice adds nothing; a zip with no chat is refused; an .xlsx still goes to the bank. Every name and figure made up.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const parts = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y: y % 100, m, d }; };
const dmy = (iso: string) => { const p = parts(iso); return pad(p.d) + '/' + pad(p.m) + '/' + pad(p.y); };
/* An iPhone's head: month first, in brackets, with seconds, a 12-hour clock. */
const ios = (iso: string, clock: string) => { const p = parts(iso); return `[${p.m}/${p.d}/${pad(p.y)}, ${clock}]`; };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const D3 = shift(todayIso(), -3), D2 = shift(todayIso(), -2), D1 = shift(todayIso(), -1);
const XLSX = path.join(__dirname, '..', 'fixtures', 'bank-sep.xlsx');

/* A zip written here, as WhatsApp and the owner's tool write theirs: each entry stored or deflated, with its CRC. */
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

const ROLL = (iso: string) => `${dmy(iso)}/ in time\n-----8:30 am----\nVAT A1\n1) ALFA\n2) BRAVO`;
const STOCK = (iso: string) => `${dmy(iso)}// camical use\n1) KILO SALT use 5 kg\n2) ROMEO acid use 10 ltr`;
/* The iPhone export: _chat.txt, the export's own head, WhatsApp's lines (one with a sender, its text marked unseen), media, a
   deleted message, a message of several lines and one edited. */
function iosChat(): string {
  return [
    'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.',
    `[7/25/25, 4:56:46 PM] - Alfa Oraon created group “Floor”`,
    `${ios(D3, '8:35:10 AM')} Alfa Oraon: ${ROLL(D3)}`,
    `${ios(D3, '9:00:02 AM')} Bravo Munda: ‎<image omitted>`,
    `${ios(D3, '10:00:00 AM')} Bravo Munda: ok sir`,
    `${ios(D3, '6:10:00 PM')} Alfa Oraon: ${STOCK(D3)}`,
    `${ios(D2, '8:40:00 AM')} Alfa Oraon: ${ROLL(D2)}`,
    `${ios(D2, '5:30:00 PM')} Alfa Oraon: ${STOCK(D2)}`,
    `${ios(D1, '8:31:00 AM')} Alfa Oraon: ${ROLL(D1)}`,
    `${ios(D1, '8:45:00 AM')} Charlie Hansda: line one\nline two\n\nline four ‎<This message was edited>`,
    `${ios(D1, '9:10:00 AM')} Bravo Munda: ‎This message was deleted`,
    `${ios(D1, '9:11:00 AM')} Floor: ‎Bravo Munda added Charlie Hansda`,
  ].join('\n');
}
function iosZip(): Buffer {
  return zipOf([
    { name: '_chat.txt', data: iosChat(), deflate: true },
    { name: '00000012-PHOTO-2026-10-28.jpg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) },
    { name: '00000013-PHOTO-2026-10-28.jpg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]), deflate: true },
  ]);
}
/* The book holds an in-time roll sent on D2 at 8:40 (its paste) and a stock message for D2 (its day only). */
function book(): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(),
    relayPastes: [{ id: 'RP-1', at: Date.now(), hash: 'r0', sentBy: 'Alfa Oraon', sentOn: D2, sentAt: 8 * 60 + 40, kind: 'in', date: D2, text: 'an older paste' }],
    stock: { lines: [], entries: [], pastes: [{ id: 'SP-1', at: Date.now(), by: '', sentBy: 'Alfa Oraon', from: D3, to: D2, hash: 's0', text: 'another stock message' }] },
  } as unknown as SepState;
}
async function addFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer } | string) {
  await page.locator('[data-action="invAddOpen"]').first().click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invAddFile"]').click()]);
  await chooser.setFiles(file as any);
}
async function importBytes(page: Page, buf: Buffer, name: string): Promise<any> {
  return page.evaluate(async ([b64, n]) => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return (0, eval)('wzImportBuf')(u.buffer, n, { guarded: true });
  }, [buf.toString('base64'), name]);
}

test.describe('P254: the WhatsApp export', () => {
  test('the zip is unpacked, stored and deflated alike; the chat is _chat.txt, else WhatsApp Chat….txt, else the largest .txt, never a .md beside one', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await page.evaluate(async ([a, b, c]) => {
      const E = (0, eval), buf = (s: string) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
      const A = buf(a), B = buf(b), C = buf(c), l = E('wzZipList')(A);
      const files = await E('wzUnzip')(A);
      return { media: l.media, texts: l.texts.map((t: any) => t.name), read: files.map((f: any) => [f.name, new TextDecoder().decode(f.bytes).length]),
        chatA: E('wzChatEntry')(l.texts).name, chatB: E('wzChatEntry')(E('wzZipList')(B).texts).name, chatC: E('wzChatEntry')(E('wzZipList')(C).texts).name,
        has: [E('wzHasChat')(A), E('wzHasChat')(B), E('wzHasChat')(C)], kind: E('addFileKind')(A).kind };
    }, [iosZip().toString('base64'),
      zipOf([{ name: 'chat.md', data: '# a long markdown copy of the chat, longer than the text one'.repeat(5) }, { name: 'chat.txt', data: iosChat() }, { name: 'notes.txt', data: 'short' }]).toString('base64'),
      zipOf([{ name: 'big.txt', data: 'x'.repeat(9000) }, { name: 'WhatsApp Chat with Floor.txt', data: iosChat(), deflate: true }]).toString('base64')]);
    // Media beside the chat is counted and never read; the deflated chat comes back whole.
    expect(r.media).toBe(2);
    expect(r.texts).toEqual(['_chat.txt']);
    expect(r.read).toEqual([['_chat.txt', iosChat().length]]);
    expect(r.chatA).toBe('_chat.txt');
    expect(r.chatB).toBe('chat.txt');
    expect(r.chatC).toBe('WhatsApp Chat with Floor.txt');
    expect(r.has).toEqual([true, true, true]);
    expect(r.kind).toBe('wazip');
  });

  test('an iPhone chat is read month-first, its messages whole, WhatsApp’s own lines, media and the deleted dropped', async ({ page }) => {
    await loadAppWithState(page, book());
    const c: any = await ev(page, `wzParseChat(${JSON.stringify(iosChat())})`);
    expect(c.order).toBe('month-first');
    expect(c.msgs).toHaveLength(7);
    expect(c.system).toBe(2);
    expect(c.media).toBe(1);
    expect(c.deleted).toBe(1);
    expect(c.msgs[0]).toMatchObject({ sentBy: 'Alfa Oraon', sentOn: D3, sentAt: 8 * 60 + 35, text: ROLL(D3), edited: false });
    // A message of several lines is one message, its blank line kept; the edited mark is taken off and said.
    const ch = c.msgs.find((m: any) => m.sentBy === 'Charlie Hansda');
    expect(ch).toMatchObject({ text: 'line one\nline two\n\nline four', edited: true, sentOn: D1, sentAt: 8 * 60 + 45 });
    expect(c.msgs.map((m: any) => m.sentBy)).not.toContain('Floor');
    // The paste box's own split agrees on who sent each message, and when (it keeps media, the deleted and the group's own
    // line, which a paste never carries: set aside here).
    const rs: any = await ev(page, `relaySplit(${JSON.stringify(iosChat())}).filter(function (m) { return m.sentBy && m.sentBy !== 'Floor' && !/omitted>$|deleted$/.test(m.text); })`);
    expect(rs.map((m: any) => [m.sentBy, m.sentOn, m.sentAt])).toEqual(c.msgs.map((m: any) => [m.sentBy, m.sentOn, m.sentAt]));
  });

  test('an Android chat is read day-first, 12- or 24-hour, its media lines dropped and a caption kept; the order is decided once for the file', async ({ page }) => {
    await loadAppWithState(page, book());
    const text = [
      '28/10/26, 9:02 am - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
      '28/10/26, 9:03 am - Alfa Oraon added Bravo Munda',
      '28/10/26, 11:32 am - Alfa Oraon: power cut 11:30',
      '28/10/26, 11:40 pm - Bravo Munda: <Media omitted>',
      '28/10/26, 23:05 - Bravo Munda: IMG-20261028-WA0001.jpg (file attached)\nthe new rack',
      '29/10/26, 07:15 - Alfa Oraon changed the subject from "Floor: old" to "Floor"',
      '29/10/26, 07:16 - Charlie Hansda: first line',
      'second line <This message was edited>',
    ].join('\n');
    const c: any = await ev(page, `wzParseChat(${JSON.stringify(text)})`);
    expect(c.order).toBe('day-first');
    expect(c.msgs.map((m: any) => [m.sentBy, m.sentOn, m.sentAt, m.text, m.edited])).toEqual([
      ['Alfa Oraon', '2026-10-28', 11 * 60 + 32, 'power cut 11:30', false],
      ['Bravo Munda', '2026-10-28', 23 * 60 + 5, 'the new rack', false],
      ['Charlie Hansda', '2026-10-29', 7 * 60 + 16, 'first line\nsecond line', true]]);
    expect(c.system).toBe(3);
    expect(c.media).toBe(1);
    // With no day over 12, the order the dates run in decides, once: 3 Apr, 5 Apr, 1 May read day first.
    const amb: any = await ev(page, `wzParseChat('03/04/26, 10:00 - Alfa Oraon: a\\n05/04/26, 10:00 - Alfa Oraon: b\\n01/05/26, 10:00 - Alfa Oraon: c')`);
    expect(amb.order).toBe('day-first');
    expect(amb.msgs.map((m: any) => m.sentOn)).toEqual(['2026-04-03', '2026-04-05', '2026-05-01']);
    // A floor message's own line with a date and a time is not a WhatsApp head: it stays inside its message.
    const inner: any = await ev(page, `wzParseChat('28/10/26, 10:00 - Alfa Oraon: power\\n28/10/26 10:30 power cut')`);
    expect(inner.msgs).toHaveLength(1);
    expect(inner.msgs[0].text).toBe('power\n28/10/26 10:30 power cut');
  });

  test('Add → File takes the zip: only the messages after the book’s last of their kind are taken in, the import recorded; the same zip again adds nothing', async ({ page }) => {
    await loadAppWithState(page, book());
    await addFile(page, { name: 'WhatsApp Chat - Floor.zip', mimeType: 'application/zip', buffer: iosZip() });
    await expect(page.locator('.inv-toast').last()).toContainText('4 new messages taken in · 3 older messages skipped · 3 media files not read');
    const st: any = await readStoredState(page);
    expect(st.msgImports).toHaveLength(1);
    const rec = st.msgImports[0];
    expect(rec).toMatchObject({ file: 'WhatsApp Chat - Floor.zip', first: D3, last: D1, total: 7, added: 4, seen: 0, skippedOld: 3, inBook: 0,
      media: 3, system: 2, deleted: 1, order: 'month-first', none: false });
    expect(rec.id).toMatch(/^WZ-/);
    // The in-time roll of D3, and D2's sent at the very minute of the book's last, are older; D1's is new. Stock is known by
    // its day only, so D2's day is read again; D3's is older. A kind the book holds none of (the chat) is taken whole.
    expect(rec.kinds.in).toMatchObject({ taken: 1, skipped: 2, from: D2, src: 'rolls' });
    expect(rec.kinds.stock).toMatchObject({ taken: 1, skipped: 1, from: D2, src: 'stock' });
    expect(rec.kinds.other).toMatchObject({ taken: 2, skipped: 0, from: null });
    expect(st.messages).toHaveLength(4);
    expect(st.messages.every((m: any) => m.src === 'zip' && m.importId === rec.id)).toBe(true);
    expect(st.messages.map((m: any) => [m.sentOn, m.kind]).sort()).toEqual([[D1, 'in'], [D1, 'other'], [D2, 'stock'], [D3, 'other']].sort());
    expect(st.messages.find((m: any) => m.kind === 'in').text).toBe(ROLL(D1));
    // The same export again: every message is now the book's, so nothing is added and it says so.
    await addFile(page, { name: 'WhatsApp Chat - Floor.zip', mimeType: 'application/zip', buffer: iosZip() });
    expect(await answerAsk(page, 'ok')).toContain('No new message · 7 older messages skipped');
    const st2: any = await readStoredState(page);
    expect(st2.messages).toHaveLength(4);
    expect(st2.msgImports).toHaveLength(2);
    expect(st2.msgImports[1]).toMatchObject({ added: 0, total: 7 });
  });

  test('a book holding no message takes every one and says so; the confirmation screen opens on the import where it is loaded', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as unknown as SepState);
    await page.evaluate(() => { (window as any).mcOpen = (o: any) => { (window as any).__mc = o; }; });
    const rec: any = await importBytes(page, iosZip(), 'export.zip');
    expect(rec).toMatchObject({ added: 7, skippedOld: 0, none: true });
    expect(await page.evaluate(() => (window as any).__mc)).toEqual({ importId: rec.id });
    expect(await ev(page, `wzSaid(${JSON.stringify(rec)})`)).toContain('the book held no messages yet, so every one was taken');
  });

  test('a bare WhatsApp .txt through Add → File is read the same way; a zip with no chat, or a chat with no messages, is refused', async ({ page }) => {
    await loadAppWithState(page, book());
    await addFile(page, { name: 'WhatsApp Chat with Floor.txt', mimeType: 'text/plain', buffer: Buffer.from(iosChat(), 'utf8') });
    await expect(page.locator('.inv-toast').last()).toContainText('4 new messages taken in');
    const st: any = await readStoredState(page);
    expect(st.msgImports[0]).toMatchObject({ file: 'WhatsApp Chat with Floor.txt', chat: 'Floor', media: 1, total: 7 });
    // A zip of photos alone holds no chat: Add names it and takes nothing.
    await addFile(page, { name: 'photos.zip', mimeType: 'application/zip', buffer: zipOf([{ name: 'IMG-1.jpg', data: Buffer.from([1, 2, 3]) }]) });
    expect(await answerAsk(page, 'ok')).toContain('no WhatsApp chat');
    // A zip whose text is no chat is read and refused by the chat's own reader; one over 50 MB is refused before it is read.
    const none: any = await importBytes(page, zipOf([{ name: 'notes.txt', data: 'a shopping list\nmilk' }]), 'notes.zip');
    expect(none).toBeNull();
    expect(await answerAsk(page, 'ok')).toContain('No WhatsApp messages in it');
    const big = page.evaluate(() => (0, eval)('wzImportFile')({ name: 'huge.zip', size: 60 * 1024 * 1024, arrayBuffer: () => Promise.reject(new Error('read')) }));
    expect(await answerAsk(page, 'ok')).toContain('the app reads up to 50 MB');
    expect(await big).toBeNull();
    expect((await readStoredState(page)).msgImports).toHaveLength(1);
  });

  test('the import is the floor’s imports’: an ID that may not import is told so and nothing is read', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page, { roles: { supervisor: { may: ['floor'] } } });
    await unlock(page, 'U-sup', PINS.super);
    await addFile(page, { name: 'export.zip', mimeType: 'application/zip', buffer: iosZip() });
    expect(await answerAsk(page, 'ok')).toContain('can’t import a WhatsApp chat');
    expect((await readStoredState(page)).msgImports || []).toHaveLength(0);
  });

  test('an .xlsx is a zip too, and still goes to the bank; a WhatsApp zip brought to the bank’s Import is taken where it belongs', async ({ page }) => {
    await loadAppWithState(page, book());
    await addFile(page, XLSX);
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await page.waitForFunction(() => (window as any).bankData().rows.length === 8);
    expect((await readStoredState(page)).msgImports || []).toHaveLength(0);
    // The bank's own Import, handed the chat's zip, says what it is and offers Add → File's route.
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), bankImportDoor(page)]);
    await chooser.setFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: iosZip() });
    expect(await answerAsk(page, 'ok')).toContain('the group’s WhatsApp chat, exported');
    await expect(page.locator('.inv-toast').last()).toContainText('4 new messages taken in');
    expect((await readStoredState(page)).msgImports).toHaveLength(1);
  });
});
