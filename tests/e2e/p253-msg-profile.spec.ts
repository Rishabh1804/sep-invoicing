import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P253: how each sender sends messages (owner, 31 Oct 2026: "analyse every bit of chat data from the zip that we have and profile
// how they send messages, so that the parser keeps evolving with future uploads of zip files"). The profile is learnt from the
// book's own messages and nobody is written into the code (mpLearn); it moves the sorter's confidence both ways and says why
// (mpConf); a kind's share read with no correction is what the confirmation screen sets against 90% (mpKindConf); and the
// sorter's rules tuned on the export are pinned on made-up messages. Made-up senders, clients and figures, in the shop's shapes.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const at = (iso: string, h: number, m = 0) => new Date(iso + 'T' + pad(h) + ':' + pad(m) + ':00').getTime();

const PICKLER = 'Alfa Oraon', SUPER = 'Bravo Munda', OWNERP = 'Charlie Toppo';
/* A made-up group chat as a zip gives it (sentAt in ms): the pickling hand's loads in the morning, the supervisor's rolls and stock. */
function chat(): any[] {
  const out: any[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = shift(todayIso(), -i);
    out.push({ sentBy: PICKLER, sentOn: d, sentAt: at(d, 9 + (i % 3), 5), text: `DELTA AUTO\nCLAMP 120X80(30X6)-${200 + i} NOS\nPICKLING TIME ${9 + (i % 3)}:00 AM` });
    out.push({ sentBy: SUPER, sentOn: d, sentAt: at(d, 10, 15), text: `${dmy(d)}/ IN TIME\n----8:30 AM----\n----VAT A1----\n1) ALFA\n2) ECHO` });
    if (i <= 6) out.push({ sentBy: SUPER, sentOn: d, sentAt: at(d, 17, 30), text: `${dmy(d)}/ OUT TIME\n----5:00 PM----\nALL OUT\n----VAT A2----\n9101-300 NOS` });
  }
  return out;
}
function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: [{ id: 1, name: 'Alfa Oraon', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }],
    attendance: {}, ...(extra || {}) } as unknown as SepState;
}
async function ingest(page: Page, list: any[]) {
  return ev(page, `(function(){ var r = msgIngest(${JSON.stringify(list)}, 'zip', 'IMP-t'); return r.added.length; })()`);
}

test.describe('P253: the senders\' profile', () => {
  test('learnt from the book alone: safe on an empty book, a memo, extended as messages come and read again on a correction', async ({ page }) => {
    await loadAppWithState(page, book());
    const empty: any = await ev(page, `(function(){ S.messages = []; S.msgProfile = {}; var p = mpLearn(); return { n: p.n, senders: Object.keys(p.senders).length, one: mpSender('${PICKLER}'), html: mpSenderHtml('${PICKLER}') }; })()`);
    expect(empty).toMatchObject({ n: 0, senders: 0, one: null });
    expect(empty.html).toContain('data-blank="early"');
    expect(await ingest(page, chat())).toBe(30);
    const p: any = await ev(page, `(function(){ var s = mpSender('${PICKLER}'), b = mpSender('${SUPER}'); return { s: { n: s.n, top: s.top.kind, kinds: s.kinds, from: s.list[0].hourFrom, to: s.list[0].hourTo, shape: s.list[0].shape, lines: s.list[0].lines },
      b: { n: b.n, kinds: b.kinds, inShape: b.list.find(function(k){ return k.kind === 'in'; }).shape, joined: b.joined, spell: b.spell } }; })()`);
    expect(p.s).toEqual({ n: 12, top: 'pickling', kinds: { pickling: 12 }, from: 9, to: 11, shape: 'words', lines: 3 });
    expect(p.b.n).toBe(18);
    expect(p.b.kinds).toEqual({ 'in': 12, out: 6 });
    expect(p.b.inShape).toBe('date · in time');
    // An out roll carrying its slot's production (a figure in pieces under the line) is a roll with another kind in it.
    expect(p.b.joined).toEqual({ out: 6 });
    expect(Object.keys(p.b.spell['in time'])).toEqual(['IN TIME']);
    // A memo: nothing is read again while the store and the book are as they were.
    const memo: any = await ev(page, `(function(){ var a = mpLearn(); var t = a.at; var b = mpLearn(); return { same: a === b, t: t === b.at, n: b.n }; })()`);
    expect(memo).toEqual({ same: true, t: true, n: 30 });
    // A message added is folded in; the rest is not read again (the profile object stays the same one).
    const d = shift(todayIso(), -13);
    expect(await ingest(page, [{ sentBy: PICKLER, sentOn: d, sentAt: at(d, 10), text: 'DELTA AUTO\nCLAMP 120X80(30X6)-180 NOS\nPICKLING TIME 10:00 AM' }])).toBe(1);
    const ext: any = await ev(page, `(function(){ var before = S.msgProfile; var p = mpLearn(); return { same: before === p, n: p.n, pick: p.senders['${PICKLER.toUpperCase()}'].n }; })()`);
    expect(ext).toEqual({ same: true, n: 31, pick: 13 });
    // A kind set by hand reads the store again: the message counts under its new kind, and as corrected.
    const fx: any = await ev(page, `(function(){ var r = S.messages.find(function(m){ return m.sentBy === '${PICKLER}'; }); r.fix = { kind: 'production', at: Date.now(), by: null }; _bookWrites++;
      var s = mpSender('${PICKLER}'); return { kinds: s.kinds, fixed: s.fixed, share: Math.round(s.fixedShare * 100) }; })()`);
    expect(fx).toEqual({ kinds: { pickling: 12, production: 1 }, fixed: { production: 1 }, share: 8 });
  });

  test('mpConf raises a sender\'s usual kind and lowers one they have never sent, in words; a new sender moves nothing', async ({ page }) => {
    await loadAppWithState(page, book());
    await ev(page, `S.messages = []; S.msgProfile = {}`);
    await ingest(page, chat());
    const d = todayIso();
    const r: any = await ev(page, `(function(){
      var load = { sentBy: '${PICKLER}', sentOn: '${d}', sentAt: ${at(d, 10, 2)}, text: 'DELTA AUTO\\nCLAMP 120X80(30X6)-150 NOS\\nPICKLING TIME 10:00 AM' };
      var roll = { sentBy: '${PICKLER}', sentOn: '${d}', sentAt: ${at(d, 10, 2)}, text: '${dmy(d)}/ IN TIME\\n----8:30 AM----\\n1) ALFA' };
      var odd = { sentBy: '${SUPER}', sentOn: '${d}', sentAt: ${at(d, 3, 0)}, text: 'IN TIME\\n1) ALFA' };
      var fresh = { sentBy: '${OWNERP}', sentOn: '${d}', sentAt: ${at(d, 10)}, text: load.text };
      var base = function(m) { return { kind: 'pickling', conf: 0.8, why: 'production’s reader: pickling' }; };
      return { load: mpConf(load, base()), roll: mpConf(roll, { kind: 'in', conf: 0.95, why: 'a dated roll head' }), odd: mpConf(odd, { kind: 'in', conf: 0.8, why: 'an in/out time heading' }),
        fresh: mpConf(fresh, base()), hand: mpConf(load, { kind: 'stock', conf: 1, why: 'set by hand' }), sorted: msgSort(load) };
    })()`);
    expect(r.load.conf).toBeGreaterThan(0.8);
    expect(r.load.why).toContain('usual for Alfa Oraon');
    expect(r.load.why).toContain('opens as Alfa Oraon usually opens it');
    expect(r.roll.conf).toBeLessThan(0.95);
    expect(r.roll.why).toContain('Alfa Oraon has not sent one before');
    // An in-time roll at 3 AM with no date, from a supervisor whose rolls come at ten and open with a date: lowered twice.
    expect(r.odd.conf).toBeLessThan(0.8);
    expect(r.odd.why).toMatch(/unusual hour for Bravo Munda|opens differently from Bravo Munda/);
    expect(r.fresh).toEqual({ kind: 'pickling', conf: 0.8, why: 'production’s reader: pickling' });
    expect(r.hand.conf).toBe(1);
    // msgSort reads the profile itself once it is loaded.
    expect(r.sorted.kind).toBe('pickling');
    expect(r.sorted.conf).toBeGreaterThan(0.8);
    // Not read, from somebody who nearly always sends one kind: it looks like their usual, and the sorter is less sure it is nothing.
    const other: any = await ev(page, `mpConf({ sentBy: '${PICKLER}', sentOn: '${d}', sentAt: ${at(d, 10)}, text: 'DELTA AUTO 3 BOXES' }, { kind: 'other', conf: 0, why: 'no reader takes it' })`);
    expect(other).toMatchObject({ like: 'pickling' });
    expect(other.why).toContain('Alfa Oraon mostly sends pickling loads');
  });

  test('mpKindConf: the share of a kind read with no correction in 60 days, by sender too, and lowered by often-corrected kinds', async ({ page }) => {
    await loadAppWithState(page, book());
    await ev(page, `S.messages = []; S.msgProfile = {}`);
    await ingest(page, chat());
    const old = shift(todayIso(), -90);
    await ingest(page, [{ sentBy: SUPER, sentOn: old, sentAt: at(old, 10), text: `${dmy(old)}/ IN TIME\n1) ALFA` }]);
    const r: any = await ev(page, `(function(){
      var a = [mpKindConf('in'), mpKindConf('pickling'), mpKindConf('checkin'), mpKindConf('in', '${PICKLER}')];
      // Its text edited on three of the pickling hand's twelve, its kind set by hand on one more: 8 of 12 read with no correction.
      var p = S.messages.filter(function(m){ return m.sentBy === '${PICKLER}'; });
      p.slice(0, 3).forEach(function(m){ m.textWas.push({ text: m.text, at: Date.now(), by: null }); });
      p[3].fix = { kind: 'pickling', at: Date.now(), by: null };
      // The 90-day-old roll is corrected too: it is outside the window and changes nothing.
      S.messages.find(function(m){ return m.sentOn === '${old}'; }).fix = { kind: 'out', at: Date.now(), by: null };
      _bookWrites++;
      var load = { sentBy: '${PICKLER}', sentOn: '${todayIso()}', sentAt: ${at(todayIso(), 10)}, text: 'DELTA AUTO\\nCLAMP 120X80(30X6)-150 NOS\\nPICKLING TIME 10:00 AM' };
      return { a: a, pick: mpKindConf('pickling'), pickBy: mpKindConf('pickling', '${PICKLER}'), inn: mpKindConf('in'), conf: mpConf(load, { kind: 'pickling', conf: 0.8, why: 'w' }) };
    })()`);
    expect(r.a).toEqual([1, 1, null, null]);
    expect(r.pick).toBeCloseTo(8 / 12, 5);
    expect(r.pickBy).toBeCloseTo(8 / 12, 5);
    expect(r.inn).toBe(1);
    // A third of the pickling hand's loads corrected: the profile now lowers what it raised.
    expect(r.conf.why).toContain('Alfa Oraon’s pickling loads are often corrected');
    expect(r.conf.conf).toBeLessThan(0.8);
  });

  test('the sorter\'s tuned rules: what no reader takes is said for what it is, a dated roll however its date is written, a note about a roll, a chemical list with no head', async ({ page }) => {
    await loadAppWithState(page, book());
    const d = shift(todayIso(), -1), dd = dmy(d), [day, mon, yr] = dd.split('/');
    const cases: [string, string, string?][] = [
      ['<album message>', 'other'], ['[Forwarded] <album message>', 'other'], ['This message was deleted', 'other'], ['<document omitted> INVOICE-0001.pdf', 'other'],
      ['Messages and calls are end-to-end encrypted. No one outside of this chat can read them.', 'other'],
      ['<image omitted> 12 nos 2.400 kg', 'other'], [`${dd}/ SUNDAY OF\n------------`, 'other'], ['Accha, shaam ko dekhte hain', 'other'],
      ['NIGHT PRODUCTION\nDELTA AUTO 9101-400 NOS\nECHO PRESS 9102-30 NOS', 'other', 'production'],
      ['DELTA AUTO\nKILO PLATE--11:00AM', 'other', 'pickling'],
      ['Incoming spray ' + dd, 'other', 'stock'],
      ['Naya kamra 12 by 9 feet', 'other'],
    ];
    const r: any = await ev(page, `(${JSON.stringify(cases)}).map(function(c){ var s = msgSort({ text: c[0] }); return [s.kind, s.like || null, s.conf, s.why]; })`);
    r.forEach((s: any, i: number) => { expect(s[0]).toBe(cases[i][1]); expect(s[1]).toBe(cases[i][2] || null); });
    expect(r.map((s: any) => s[3])).toEqual(['a photo album with no words', 'a photo album with no words', 'a deleted message', 'a document (a PDF or a file)', 'the chat’s own notice',
      'a photo’s caption: no reader takes it', 'a dated notice that the plant is off', 'words with no figures: a line of conversation',
      'a production block sent apart from its roll: no reader takes it alone', 'a load and a time, with no “pickling time” written', 'a chemical delivery with no figures', 'no reader takes it']);
    expect(r.slice(0, 5).every((s: any) => s[2] === 0.95)).toBe(true);
    expect(r[8][2]).toBeLessThan(0.5);
    // A roll's date written with spaces, or after a word, is a dated roll; a roll heading inside a short sentence is a note about one.
    const rolls: any = await ev(page, `[msgSort({ text: 'Sunday duty ${day}/ ${mon}/ ${yr}/ IN TIME 6:00 AM\\n1) ALFA' }), msgSort({ text: '${day}/ ${mon}/${yr}/ out time\\n1) ALFA' }),
      msgSort({ text: 'Kal wala date galat tha sahi date ka out time\\n---SUNDAY OF--${dd}/' }), msgSort({ text: 'OUT TIME 5:00 PM\\n01) ALFA\\n02) ECHO' })]`);
    expect(rolls.map((s: any) => [s.kind, s.conf])).toEqual([['in', 0.95], ['out', 0.95], ['out', 0.35], ['out', 0.8]]);
    expect(rolls[2].why).toBe('reads like a note about a roll, not a roll');
    // A chemical use written with no head is stock, and the paste box agrees: relayKind, prodKind and Add all send it to Stock.
    const chem = 'ECHO MIX NIGHT USE 3 KG\nBRIGHTNER 5 LTR\nNITRIC ACID 4 LTR';
    const c: any = await ev(page, `[msgSort({ text: ${JSON.stringify(chem)} }), relayKind(${JSON.stringify(chem)}), prodKind(${JSON.stringify(chem)}), addDescribe(${JSON.stringify(chem)}).where]`);
    expect(c[0]).toMatchObject({ kind: 'stock', why: 'chemicals in kilos and litres, with no head' });
    expect(c.slice(1)).toEqual(['stock', 'stock', 'Stock']);
    // Not chemicals: a pickling load in kilos, the barrel's batch with its unload time, a cash account.
    const not: any = await ev(page, `[relayKind('DELTA AUTO\\nCLAMP 120X80-120 KG'), relayKind('FOXTROT 40 KG 10:30 AM UNLOAD\\nDELTA 35 KG 11:30 AM UNLOAD'), relayKind('HCL 300\\nJAR 120\\nTOTAL 420'), relayKind('NITRIC ACID 25 LTR')]`);
    expect(not).toEqual(['other', 'other', 'other', 'other']);
  });

  test('the same words sent on two days are two messages; the sender\'s card opens from a button', async ({ page }) => {
    await loadAppWithState(page, book());
    const d1 = shift(todayIso(), -2), d2 = shift(todayIso(), -1);
    const text = 'DELTA AUTO\nCLAMP(30X6)\nPICKLING TIME 9:00AM';
    // A paste gives the minute of the day (relaySplit): the same load on two days had keyed alike, and the second was lost.
    const r: any = await ev(page, `(function(){ S.messages = []; S.msgProfile = {};
      var a = { sentBy: '${PICKLER}', sentOn: '${d1}', sentAt: 545, text: ${JSON.stringify(text)} }, b = { sentBy: '${PICKLER}', sentOn: '${d2}', sentAt: 545, text: ${JSON.stringify(text)} };
      var r1 = msgIngest([a, b], 'paste'); var r2 = msgIngest([a], 'paste');
      return [msgKey(a) !== msgKey(b), r1.added.length, r2.added.length, r2.seen]; })()`);
    expect(r).toEqual([true, 2, 0, 1]);
    await ingest(page, chat());
    await ev(page, `(function(){ var b = document.createElement('button'); b.className = 'inv-btn inv-btn-secondary'; b.dataset.action = 'invMsgProfile'; b.dataset.sender = '${SUPER}'; b.id = 'mpTry'; b.textContent = 'Profile'; document.querySelector('.inv-page.active, main, body').appendChild(b); })()`);
    await page.locator('#mpTry').click();
    const card = page.locator('[data-mp-dialog] [data-mp-sender]');
    await expect(card).toBeVisible();
    await expect(card.locator('.inv-panel-title')).toContainText('How Bravo Munda sends messages');
    await expect(card.locator('[data-mp-kind="in"] .inv-row-end')).toHaveText('12');
    await expect(card.locator('[data-mp-kind="in"] .inv-row-meta')).toContainText('opens “date · in time”');
    await expect(card.locator('[data-mp-fixed] .inv-row-end')).toHaveText('0%');
  });
});
