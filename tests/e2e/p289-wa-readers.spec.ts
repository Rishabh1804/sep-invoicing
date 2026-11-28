import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P289: the WhatsApp readers set against the owner's own export (owner, 25 Nov 2026: "Re-read the WhatsApp texts and make sure
// the parser is working as intended. Some numbering styles don't work, some text formats are not read properly"). Each case is a
// shape the floor sends that had been read wrong or not at all, read as the owner corrected it by hand: a load sent after midnight,
// where a load is going written under its pickling time or to two lines, a second client named mid-message, a part that only
// ever comes from another client, a time written after a part, sizes joined by "=", a numbered barrel list whose times head
// their batches, a roll's numbering marks, a name with its time against it, "EXTRA16", a hand named twice, the work under the
// notes, the stock written into a roll with the night under it, and a power back sent on its own. Made-up names, clients and
// figures: the repo is public.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

function when(offset: number): { dmy: string; iso: string } {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yy = String(d.getFullYear()).slice(2);
  return { dmy: `${dd}/${mm}/${yy}`, iso: `${d.getFullYear()}-${mm}-${dd}` };
}
const D = when(-2), D0 = when(-3);

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'KESTREL INDUSTRIES', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 14, name: 'GENERAL FORGE CORPORATION', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'pickling-vat', onFloor: true, active: true },
  { id: 4, name: 'Echo Tudu', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
  { id: 5, name: 'Foxtrot Hansda', comp: 'monthly', dayRate: 520, area: 'gate', onFloor: true, active: true },
];

async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: STAFF, attendance: {}, incomingMaterial: noSeedIM() } as unknown as SepState);
}
/* A message read by the production readers, as the export sends it: its WhatsApp line, a sender and the minute it was sent. */
async function read(page: Page, text: string, owners?: Record<string, number>) {
  return page.evaluate(([t, own]) => {
    const e = (0, eval), ctx = e('prodCtx()');
    if (own) { ctx.partOwners = {}; Object.keys(own).forEach(p => { ctx.partOwners[e('rateKey')(e('prodPartBase')(p))] = (own as any)[p]; }); }
    return e('parseProdPaste')(t, ctx).map((m: any) => ({
      kind: m.kind, notes: m.read.notes.map((n: any) => n.text),
      items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, time: it.time, to: it.to, client: it.client, clientId: it.clientId, part: it.part,
        qty: it.qty, unit: it.unit, dest: it.dest || null, codes: it.issues.map((x: any) => x.tone + ':' + x.code) }))
    }));
  }, [text, owners || null] as const);
}
async function roll(page: Page, text: string, sentOn: string, sentAt: number) {
  return page.evaluate(([t, on, at]) => {
    const e = (0, eval), r = e('parseRelayRoll')(t, e('relayRoster({})'), on, { sentAt: at });
    const names: Record<string, string> = {};
    (e('S').staff || []).forEach((w: any) => { names[w.id] = w.name.split(' ')[0]; });
    return {
      lines: r.lines.map((l: any) => l.role + ':' + (l.person != null ? names[l.person] : '')),
      issues: r.issues.map((i: any) => i.tone + ':' + i.text),
      days: Object.keys(r.days).sort().map(d => ({ d, people: Object.keys(r.days[d].people).map(id => names[id] + '|' + r.days[d].people[id].st + '|' + (r.days[d].people[id].outMin ?? '')).sort(),
        extra: r.days[d].extra.map((x: any) => [x.kind, x.hours, x.from || '', x.to || '', (x.crew || []).map((c: any) => typeof c === 'number' ? names[c] : String(c).split(' ')[0]).join('+')].join('|')) })),
    };
  }, [text, sentOn, sentAt] as const);
}

test.describe('P289: the WhatsApp readers against the owner’s export', () => {
  test('pickling: sent after midnight, where a load goes, a second client mid-message, a part’s own client, its own time, sizes joined by "="', async ({ page }) => {
    await load(page);
    // Sent at 12:20 AM with no date written: the 7:15 PM load is the evening before.
    let m = await read(page, `${D.dmy}, 12:20 am - Pickler: NOVA CLAMPS\nRING--240 nos\nPickling time 7:15 pm\nFor vat A2`);
    expect(m[0].items).toHaveLength(1);
    expect(m[0].items[0]).toMatchObject({ kind: 'pickled', date: D0.iso, time: '19:15', clientId: 11, part: 'RING', qty: 240, unit: 'NOS', dest: 'vat-a2' });
    expect(m[0].items[0].codes).toContain('amber:evebefore');
    expect(m[0].items[0].codes).not.toContain('amber:later');
    // A date written in the message is the message's day, wherever it was sent.
    m = await read(page, `${D.dmy}, 12:20 am - Pickler: ${D.dmy}\nNOVA CLAMPS\nRING--240 nos\nPickling time 7:15 pm`);
    expect(m[0].items[0].date).toBe(D.iso);

    // "For Barrel" under the pickling time is where the loads above it go, never the next block's; "VAT A1 &A2" is a line, not a part.
    m = await read(page, `${D.dmy}, 10:30 am - Pickler: NOVA CLAMPS\nRING 52×64(20×5)--340 NOS\nPICKLING TIME 7:40 am\nFor Barrel\n\nDURGA AUTO\n7313--45 nos\nPickling time 8:10 am\nVAT A1 &A2\n\nKESTREL\n7314--26 KG\nPickling time 8:50 am\nFOR VAT A1& A2`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.dest])).toEqual([[11, 'RING 52X64(20X5)', 340, 'barrel'], [12, '7313', 45, 'vat-a1'], [13, '7314', 26, 'vat-a1']]);

    // A name with no figure between two loads with theirs heads a client's loads of its own: asked when the book has no such client.
    m = await read(page, `${D.dmy}, 11:02 am - Pickler: KESTREL\n7314--260 nos\nZEPHYR\nHOOK--18 kg\nPickling time 9:50 am\nFor Barrel`);
    expect(m[0].items.map(i => [i.client, i.clientId, i.part, i.qty, i.unit])).toEqual([['KESTREL', 13, '7314', 260, 'NOS'], ['ZEPHYR', null, 'HOOK', 18, 'KG']]);
    expect(m[0].items[1].codes).toContain('red:client');
    // A part the client above has sent stays that client's part ("SLEEVE" under NOVA, with a load under it).
    m = await read(page, `${D.dmy}, 11:02 am - Pickler: NOVA CLAMPS\nRING 52×64(20×5)--150 NOS\nSLEEVE\nRING 48×57(20×5)--95 NOS\nPickling time 9:50 am`, { SLEEVE: 11 });
    expect(m[0].items.every(i => i.clientId === 11)).toBe(true);

    // A load with no client under an incoming head is the part's own client, never carried from the block above.
    m = await read(page, `${D.dmy}, 3:40 pm - Pickler: NOVA CLAMPS\nRING 52×64(20×5)--150 NOS\nPICKLING TIME 12:40 PM\n\nINCOMING MATERIAL TIME 3:20PM\n210 CD--41 KG\n60 CD--23KG`, { '210 CD': 14, '60 CD': 14 });
    const arrived = m[0].items.filter(i => i.kind === 'arrived');
    expect(arrived.map(i => [i.part, i.clientId])).toEqual([['210 CD', 14], ['60 CD', 14]]);
    expect(arrived[0].codes).not.toContain('amber:carried');

    // A time written after the part is the load's own pickling time.
    m = await read(page, `${D.dmy}, 2:00 pm - Pickler: NOVA CLAMPS\nRING--70 nos\nPickling time 12:50pm\n\nNOVA CLAMPS\nBIG RING--1:25PM`);
    expect(m[0].items[1]).toMatchObject({ part: 'BIG RING', time: '13:25', qty: null });
    expect(m[0].items[1].codes).not.toContain('amber:notime');

    // Sizes joined by "=": "52×64=20×5=120"; and a pickling time with its line before it and a load after it.
    m = await read(page, `${D.dmy}, 3:05 pm - Pickler: VAT A 2 PICKLING TIME 2:40 PM NOVA RING 52×64=20×5=120\n48×57=20×5=75`);
    expect(m[0].items[0]).toMatchObject({ clientId: 11, part: 'RING 52X64(20X5)', qty: 120, time: '14:40', dest: 'vat-a2' });
    expect(m[0].items[1]).toMatchObject({ part: '48X57(20X5)', qty: 75 });
    expect(m[0].notes).not.toContain('A pickling time with nothing listed above it');
    // A line written before the load or after a figure with no unit is where it is going, never part of the load.
    m = await read(page, `${D.dmy}, 3:31 pm - Pickler: VAT A 2 NOVA RING 52×64=20×5=120 NOS\n47×53=20×5=90 VAT A 1\nPICKLING TIME 3:10 PM`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.dest])).toEqual([[11, 'RING 52X64(20X5)', 120, 'vat-a2'], [11, '47X53(20X5)', 90, 'vat-a1']]);
  });

  test('the review’s cases: a line for the block under, a weight with decimals, an unmarked time after midnight, a list that writes its times under', async ({ page }) => {
    await load(page);
    // Loads with their line already leave the next "FOR …" under a time to the block below it.
    let m = await read(page, `${D.dmy}, 11:30 am - Pickler: FOR VAT A1\nNOVA CLAMPS\nBOLT--400 NOS\nPICKLING TIME 10:00 AM\nFOR VAT A2\nRING--300 NOS\nPICKLING TIME 11:00 AM`);
    expect(m[0].items.map(i => [i.part, i.dest])).toEqual([["BOLT", "vat-a1"], ["RING", "vat-a2"]]);
    // "HOOK--12.50" is 12.5 kg, never a time.
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: KESTREL\nHOOK--12.50\nPickling time 10:30 am`);
    expect(m[0].items[0]).toMatchObject({ part: 'HOOK', qty: 12.5, unit: 'KG', time: '10:30' });
    // Sent at 12:20 AM, "10:45" with no AM or PM is the evening's 10:45 the day before.
    m = await read(page, `${D.dmy}, 12:20 am - Pickler: NOVA CLAMPS\nRING--130 nos\nPickling time 10:45`);
    expect(m[0].items[0]).toMatchObject({ date: D0.iso, time: '22:45' });
    // A list that writes each unload time under its batch keeps doing so, the first batch loaded the night before.
    m = await read(page, `${D.dmy}, 3:09 pm - Supervisor: ${D.dmy}/ BERRAL PRODUCTION\n8:40 AM UNLOAD\nNOVA CLAMP 115 NOS\n10:05 AM UNLOAD\nKESTREL 47 KG\n11:50 AM UNLOAD\nDURGA 29 KG 1:35 PM UNLOAD`);
    expect(m[0].items.map(i => [i.clientId, i.qty, i.to])).toEqual([[11, 115, '10:05'], [13, 47, '11:50'], [12, 29, '13:35']]);
    // "EXTRA5 PM TO 6 AM": a span with no hours, kept and asked, as with a space.
    const r = await roll(page, `${D.dmy}/ OUT TIME\n----8:00 PM----\n1) ALFA\nEXTRA5 PM TO 6 AM`, D.iso, 600);
    expect(r.issues.some(i => /writes times, not hours/.test(i))).toBe(true);
  });

  test('a numbered barrel list: its numbers are no part, a time alone heads the batches under it', async ({ page }) => {
    await load(page);
    const m = await read(page, `${D.dmy}, 4:05 pm - Supervisor: ${D.dmy}/ BERRAL UPDATED
1) UNLOAD TIME 8:50 AM GENERAL 60 CD 38 KG
2) 11:10 AM UNLOAD
NOVA CLAMP 85 NOS
3) 12:20 PM UNLOAD
KESTREL 64 KG
4) 2:20 PM UNLOAD DURGA 7577-140 NOS`);
    expect(m[0].kind).toBe('production');
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.to])).toEqual([[14, '60 CD', 38, '08:50'], [11, 'CLAMP', 85, '11:10'], [13, '', 64, '12:20'], [12, '7577', 140, '14:20']]);
    expect(m[0].items.some(i => /^\d\)/.test(i.part || ''))).toBe(false);
  });

  test('a roll: its numbering marks, a time against a name, EXTRA16, a hand twice, work under the notes, the night under the stock', async ({ page }) => {
    await load(page);
    const r = await roll(page, `${D.dmy}/ IN TIME
-----6:00 AM----
----VAT A 2-----
1) BRAVO
2) CHARLIE
3) BRAVO
EXTRA6 HOURS
------8:30 AM-----
----VAT A 1-----
01);ALFA
02) ECHO
---GATE----
03) FOXTROT7:00 am
------------------
CHEMICAL USE CHEMICAL STOCK
${D.dmy}/
1) A SOLLT 30-2=28 LTR
2) HCL 260-40=220 LTR
------------------
--8:00 PM TO 6:00 AM-
------NIGHT HOLD------
-----VAT A 2------
1) CHARLIE
2) ECHO
EXTRA 20 HOURS
------WORK-----
GENERAL RING 260 NOS`, D.iso, 600);
    const day = r.days.find(x => x.d === D.iso)!;
    expect(r.issues.filter(i => i.startsWith('red:'))).toEqual([]);
    expect(r.issues.some(i => i.startsWith('amber:Bravo Munda is named twice'))).toBe(true);
    expect(r.lines).toContain('name:Alfa');
    expect(r.lines).toContain('name:Foxtrot');
    // EXTRA6 is 6 hours on the 6 AM block; the night under the stock is read, out at 6 AM the next day, with its 20 hours.
    expect(day.extra).toContain('block|6|06:00|08:30|Bravo+Charlie');
    expect(day.extra.some(x => x.startsWith('block|20|20:00|06:00|Charlie+Echo'))).toBe(true);
    // "GENERAL RING 260 NOS" under the work is a note, never a slot heading.
    expect(r.lines[r.lines.length - 1]).toBe('note:');
  });

  test('the messages’ check: a power back sent on its own closes the cut, the stock in a roll is saved with it', async ({ page }) => {
    await load(page);
    const wa = (at: string, who: string, text: string) => `${D.dmy}, ${at} - ${who}: ${text}`;
    const chat = [
      wa('11:24 am', 'Supervisor', `${D.dmy}/ IN TIME\n-------8:30 AM-----\n----VAT 1-----\n01) ALFA\n02) ECHO\n---GATE---\n03) FOXTROT 7:00AM\n------------------\nCHEMICAL USE CHEMICAL STOCK\n------------------\n1) A SOLLT 30-2=28 LTR\n2) HCL 260-40=220 LTR`),
      wa('10:41 am', 'Pickler', 'Power cut 10:40 am'),
      wa('10:53 am', 'Pickler', 'POWER IN 10:52AM'),
    ].join('\n');
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(chat)}), 'zip', 'IMP-P289'); saveState(); mcOpen({ importId: 'IMP-P289' }); })()`);
    await expect(page.locator('[data-mc]')).toBeVisible();
    // The roll says its stock is saved with it; the power back is a row of its own, ticked with the cut.
    await expect(page.locator(`[data-mc-row][data-kind="in"]`)).toContainText('Chemical stock: 2 lines, saved with the roll');
    const group = page.locator(`[data-action="invMsgMcGroup"][data-key="g:${D.iso}:power"]`);
    await expect(group).toHaveText('Tick the 2 power cut messages of ' + await ev(page, `stockShortDate(${JSON.stringify(D.iso)})`));
    await group.click();
    await expect(group).toHaveText(/^Untick the 2 power cut messages/);
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('3');
    const got = await ev(page, `(function(){
      var items = {}; (S.stock.items || []).forEach(function(i) { items[i.id] = i.name; });
      return {
        cuts: S.production.entries.filter(function(e) { return e.kind === 'downtime'; }).map(function(e) { return [e.date, e.time, e.to, e.downtime && e.downtime.open]; }),
        stock: (S.stock.entries || []).map(function(e) { return [items[e.itemId], e.qty, e.date]; }).sort(),
        status: S.messages.map(function(m) { return m.kind + ':' + m.status; }).sort(),
      };
    })()`) as any;
    expect(got.cuts).toEqual([[D.iso, '10:40', '10:52', false]]);
    expect(got.stock.length).toBeGreaterThanOrEqual(2);
    expect(got.stock.every((x: any) => x[2] === D.iso)).toBe(true);
    expect(got.status).toEqual(['in:saved', 'power:saved', 'power:saved']);
  });
  test('the messages’ check: a power back alone with no cut is not offered; one whose cut was saved before closes it; a roll’s stock saved before is not saved again', async ({ page }) => {
    await load(page);
    const wa = (at: string, who: string, text: string) => `${D.dmy}, ${at} - ${who}: ${text}`;
    // No cut before it, stored or sent: listed, not offered.
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(wa('10:53 am', 'Pickler', 'POWER IN 10:52AM'))}), 'zip', 'IMP-A'); saveState(); mcOpen({ importId: 'IMP-A' }); })()`);
    await expect(page.locator('[data-mc]')).toBeVisible();
    expect(await ev(page, `_mc.read ? Object.keys(_mc.read).map(function(k){ var r = _mc.read[k]; return r.kind + ':' + r.tickable + ':' + (r.blocked || ''); }) : []`)).toEqual(['power:false:No cut before it to close: open it in Messages.']);
    await ev(page, `mcClose ? mcClose() : null`);
    // A cut stored open that day: the power back sent on its own closes it.
    await ev(page, `(function(){ S.production.entries.push({ id: 'PE-CUT', kind: 'downtime', date: ${JSON.stringify(D.iso)}, time: '10:40', to: null, downtime: { open: true }, src: 'paste', basis: 'relay', pasteId: 'PP-CUT', raw: 'Power cut 10:40 am' }); S.production.pastes.push({ id: 'PP-CUT', at: 1, day: ${JSON.stringify(D.iso)}, kind: 'power', text: 'Power cut 10:40 am' }); S.messages = []; saveState(); })()`);
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(wa('10:53 am', 'Pickler', 'POWER IN 10:52AM'))}), 'zip', 'IMP-B'); saveState(); mcOpen({ importId: 'IMP-B' }); })()`);
    await page.locator(`[data-action="invMsgMcGroup"][data-key="g:${D.iso}:power"]`).click();
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('1');
    expect(await ev(page, `(function(){ var c = S.production.entries.find(function(e){ return e.id === 'PE-CUT'; }); return [c.to, c.downtime.open]; })()`)).toEqual(['10:52', false]);
  });

  test('a roll’s stock saved before through Read in Stock, the night under it in its tail, is not saved again', async ({ page }) => {
    await load(page);
    const text = `${D.dmy}/ IN TIME\n-------8:30 AM-----\n----VAT 1-----\n01) ALFA\n------------------\nCHEMICAL USE CHEMICAL STOCK\n1) A SOLLT 30-2=28 LTR\n2) HCL 260-40=220 LTR\n--8:00 PM TO 6:00 AM-\n------NIGHT HOLD------\n1) ECHO\nEXTRA 10 HOURS`;
    // The stock as Read in Stock saved it before 25 Nov 2026: its tail ran to the message's end.
    await ev(page, `(function(){ var full = relayStockTail(${JSON.stringify(text)}, true); S.stock = S.stock || {}; S.stock.pastes = [{ id: 'SP-OLD', hash: stockHash(full), text: full }]; S.stock.entries = [{ id: 'SE-OLD', pasteId: 'SP-OLD', itemId: 'X', kind: 'count', qty: 28, date: ${JSON.stringify(D.iso)} }]; saveState(); })()`);
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(`${D.dmy}, 11:24 am - Supervisor: ` + text)}), 'zip', 'IMP-S'); saveState(); mcOpen({ importId: 'IMP-S' }); })()`);
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('1');
    expect(await ev(page, `S.stock.entries.length`)).toBe(1);
  });

  test('a roll whose stock cannot be saved: the roll is saved, its stock said once and left to Stock', async ({ page }) => {
    await load(page);
    const text = `${D.dmy}/ IN TIME\n-------8:30 AM-----\n----VAT 1-----\n01) ALFA\n------------------\nCHEMICAL USE CHEMICAL STOCK\n1) 30-2=28 LTR\n2) 260-40=220 LTR`;
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(`${D.dmy}, 11:24 am - Supervisor: ` + text)}), 'zip', 'IMP-L'); saveState(); mcOpen({ importId: 'IMP-L' }); })()`);
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('1');
    await expect(page.locator('#mcDoneTiles [data-tile="left"] .inv-tile-value')).toHaveText('0');
    await expect(page.locator('[data-mc-stock-left]')).toContainText('1 roll saved without its chemical stock');
    expect(await ev(page, `(S.stock.entries || []).length`)).toBe(0);
  });

  test('the supervisor’s day on the lines (26 Nov 2026): an opening time a line, several sizes a line, a load’s own time, rounds said; the barrel’s out and in', async ({ page }) => {
    await load(page);
    const vat = `${D.dmy}, 10:10 am - Supervisor: OPENING TIME 7:10 AM PICKLING VAT A 1\nNOVA RING\n52×64(20×5)=120 NOS 48×57=(20×5)=75 NOS 47×53(20×5) 90 NOS \nKESTREL L BKT TIMING 9:05 AM 140NOS \n61×70(25×5)=88 NOS 58×66(25×5) 64 NOS SLEEVE 1 ROUND\n12 MINUTE\n------------------------------------\n\n-----VAT A 2-----\nOPENING TIME 9:40 AM DURGA AUTO \n7313- Z BKT 520 NOS 1ROUND 20 MINUTE`;
    expect(await ev(page, `msgSort({ text: ${JSON.stringify(vat.replace(/^.*?Supervisor: /, ''))} }).kind`)).toBe('production');
    let m = await read(page, vat);
    expect(m[0].kind).toBe('production');
    expect(m[0].items.map(i => [i.kind, i.dest || null, i.time, i.clientId, i.part, i.qty])).toEqual([
      ['plated', null, '07:10', 11, 'RING 52X64(20X5)', 120], ['plated', null, '07:10', 11, 'RING 48X57(20X5)', 75], ['plated', null, '07:10', 11, 'RING 47X53(20X5)', 90],
      ['plated', null, '09:05', 13, 'L BKT', 140], ['plated', null, '07:10', 11, 'SLEEVE 61X70(25X5)', 88], ['plated', null, '07:10', 11, 'SLEEVE 58X66(25X5)', 64],
      ['plated', null, '09:40', 12, '7313- Z BKT', 520]]);
    expect(await ev(page, `parseProdPaste(${JSON.stringify(vat)}, prodCtx())[0].read.items.map(function(i){ return i.line; })`)).toEqual(['vat-a1', 'vat-a1', 'vat-a1', 'vat-a1', 'vat-a1', 'vat-a1', 'vat-a2']);
    expect(m[0].notes).toEqual(['A round takes 12 minutes on VAT A1: said, not counted', 'A round takes 20 minutes on VAT A2: said, not counted']);

    // The barrel's out is its unload, its in the load (counted when it comes out); a client after the figures is that line's.
    const brl = `${D.dmy}, 10:19 am - Supervisor: BERRAL OUT TIME 8:50 AM DURGA AUTO 310 NOS ANCHOR BKT \n60 CD 27 KG 3 HOL 19 KG GENERAL\nIN TIME 9:05 AM\nNOVA C RING 240 NOS 2 BERRAL KESTREL 35 KG`;
    expect(await ev(page, `msgSort({ text: ${JSON.stringify(brl.replace(/^.*?Supervisor: /, ''))} }).kind`)).toBe('production');
    m = await read(page, brl);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.unit, i.to])).toEqual([[12, 'ANCHOR BKT', 310, 'NOS', '08:50'], [14, '60 CD', 27, 'KG', '08:50'], [14, '3 HOL', 19, 'KG', '08:50']]);
    expect(m[0].notes.length).toBeGreaterThan(0);
    expect(m[0].notes.every(n => /^Loaded at 9:05 AM/.test(n))).toBe(true);

    // The review's cases: figures under the out, KGS, an out after an in, an unknown client's loads, an opening time over its line.
    m = await read(page, `${D.dmy}, 11:00 am - Supervisor: BERRAL OUT TIME 8:50 AM\nDURGA AUTO 310 NOS\nIN TIME 9:05 AM\nNOVA 240 NOS\nBERRAL OUT TIME 10:30 AM KESTREL 45 KGS`);
    expect(m[0].items.map(i => [i.clientId, i.qty, i.unit, i.to])).toEqual([[12, 310, 'NOS', '08:50'], [13, 45, 'KG', '10:30']]);
    m = await read(page, `${D.dmy}, 11:00 am - Pickler: NOVA CLAMPS\nRING--774 NOS VAT A2\nPICKLING TIME 9:40 AM`);
    expect(m[0].items[0]).toMatchObject({ part: 'RING', qty: 774, dest: 'vat-a2' });
    m = await read(page, `${D.dmy}, 10:10 am - Supervisor: OPENING TIME 7:10 AM\nVAT A1\nNOVA RING\n52×64(20×5)=120 NOS\nZEPHYR CLAMP\n61×70(25×5)=88 NOS`);
    expect(m[0].items.map(i => [i.time, i.clientId, i.client, i.part, i.qty])).toEqual([['07:10', 11, 'NOVA', 'RING 52X64(20X5)', 120], ['07:10', null, 'ZEPHYR', 'CLAMP 61X70(25X5)', 88]]);
    // An undated roll whose head says "NO EXTRA" is still a roll.
    expect(await ev(page, `relayKind('IN TIME 7:00 NO EXTRA\\n1) ALFA')`)).toBe('in');
  });

  test('the pickling hand’s afternoon (26 Nov 2026): a time heading the loads under it, several loads a line, a client and family between the time and its clock', async ({ page }) => {
    await load(page);
    // A time with nothing listed above it heads the loads under it; its clock may be on the next line. A load before a time on the
    // same line, its figure after the clock, is that time's.
    let m = await read(page, `${D.dmy}, 5:00 pm - Pickler: VAT 2 PICKLING TIME\n4:10 PM\n52×64(20×5) =150 NOS DURGA 77 CD  PICKLING TIME 4:40 PM 400 NOS\n--------VAT A 1-----------\nNOVA PICKLING TIME 11:40 AM\n48×57(20×5)=120 NOS 44×57(20×5)90 NOS PICKLING TIME NOVA RING 1:00 PM 40×57(20×5)60 NOS 36×57(20×5)=75 NOS`);
    expect(m[0].kind).toBe('pickling');
    expect(m[0].items.map(i => [i.clientId ?? null, i.part, i.qty, i.time, i.dest])).toEqual([
      [null, '52X64(20X5)', 150, '16:10', 'vat-a2'], [12, '77 CD', 400, '16:40', 'vat-a2'],
      [11, '48X57(20X5)', 120, '11:40', 'vat-a1'], [11, '44X57(20X5)', 90, '11:40', 'vat-a1'],
      [11, 'RING 40X57(20X5)', 60, '13:00', 'vat-a1'], [11, 'RING 36X57(20X5)', 75, '13:00', 'vat-a1']]);
    expect(m[0].items[0].codes).toContain('red:client');
    expect(m[0].notes).not.toContain('A pickling time with nothing listed above it');
    // Loads before a time on their own line, that time with none of its own, are its loads; "TIMES" is the time; a line and a client
    // after the clock head the loads under it.
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: BARREL PICKLING TIME 9:20 AM\nRING 52×64=20×5=210 NOS\nKESTREL 7314 140 nos HOOK 60 NOS VAT A2 PICKLING TIME 9:05 AM`);
    expect(m[0].items.map(i => [i.clientId ?? null, i.part, i.qty, i.time, i.dest])).toEqual([
      [null, 'RING 52X64(20X5)', 210, '09:20', 'barrel'], [13, '7314', 140, '09:05', 'vat-a2'], [13, 'HOOK', 60, '09:05', 'vat-a2']]);
    m = await read(page, `${D.dmy}, 4:00 pm - Pickler: PICKLING TIME 3:40 PM VAT A 1 DURGA\n7313--95 NOS`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time, i.dest])).toEqual([[12, '7313', 95, '15:40', 'vat-a1']]);
    m = await read(page, `${D.dmy}, 10:00 am - Pickler: PICKLING TIMES 8:45 AM\nNOVA CLAMPS\nRING--100 NOS`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time])).toEqual([[11, 'RING', 100, '08:45']]);
    // Written the old way, the loads above a time are still that time's, and a figure after a figure stays with its load.
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: NOVA CLAMPS\nRING--240 NOS 12 KG\nBOLT--80 NOS\nPICKLING TIME 10:00 AM\nDURGA AUTO\n7313--45 nos\nPICKLING TIME 11:00 AM`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time])).toEqual([[11, 'RING', 240, '10:00'], [11, 'BOLT', 80, '10:00'], [12, '7313', 45, '11:00']]);
    // The review's cases: a time with a load of its own, then a time with none and nothing under it, closes the loads between.
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: NOVA CLAMPS\nPICKLING TIME 9:00 AM RING 50 NOS\nHOOK 40 NOS\nPICKLING TIME 10:00 AM`);
    expect(m[0].items.map(i => [i.part, i.qty, i.time])).toEqual([['RING', 50, '09:00'], ['HOOK', 40, '10:00']]);
    expect(m[0].notes).toEqual([]);
    m = await read(page, `${D.dmy}, 3:31 pm - Pickler: VAT A 2 PICKLING TIME 2:40 PM NOVA RING 52×64=20×5=120\nDURGA AUTO\n7313--45 nos\nPICKLING TIME 3:10 PM`);
    expect(m[0].items.map(i => [i.clientId, i.qty, i.time, i.dest])).toEqual([[11, 120, '14:40', 'vat-a2'], [12, 45, '15:10', null]]);
    // A line after a figure is that load's; "+", "/" and "," join, never make a load; a word between the time and its clock with no
    // client is no family.
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: NOVA CLAMPS\nRING 180 NOS VAT A2 HOOK 40 NOS VAT A1\nBOLT 100 NOS + 50 NOS\nPIN 60 NOS / 2 KG\nRING 52×64 100 NOS, 48×57 80 NOS\nPICKLING TIME 9:00 AM`);
    expect(m[0].items.map(i => [i.part, i.qty, i.dest])).toEqual([['RING', 180, 'vat-a2'], ['HOOK', 40, 'vat-a1'], ['BOLT', 100, null], ['PIN', 60, null], ['RING 52X64', 100, null], ['48X57', 80, null]]);
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: NOVA CLAMPS\nPICKLING TIME AT 9:40 AM 52×64(20×5) 100 NOS`);
    expect(m[0].items.map(i => [i.part, i.time])).toEqual([['52X64(20X5)', '09:40']]);
  });

  test('the floor on 27 Nov 2026: a line written under each load, loads and their line with no time, the night’s work', async ({ page }) => {
    await load(page);
    // A line written under loads with none above them is theirs; one written above a block still heads it.
    let m = await read(page, `${D.dmy}, 10:00 am - Pickler: DURGA AUTO\n7313--40 kg\nFor VAT A2\n7314--25 kg\nFor Barrel\nPickling time 9:40 am`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time, i.dest])).toEqual([[12, '7313', 40, '09:40', 'vat-a2'], [12, '7314', 25, '09:40', 'barrel']]);
    m = await read(page, `${D.dmy}, 11:30 am - Pickler: FOR VAT A1\nNOVA CLAMPS\nBOLT--400 NOS\nFOR VAT A2\nRING--300 NOS\nPICKLING TIME 10:00 AM`);
    expect(m[0].items.map(i => [i.part, i.dest])).toEqual([['BOLT', 'vat-a1'], ['RING', 'vat-a2']]);
    // Loads and the line they go to, no pickling time: the pickling hand's, its time asked.
    const nt = 'KESTREL\nBOLT--800 NOS\nHOOK--90 NOS\nFOR BARREL';
    expect(await ev(page, `msgSort({ text: ${JSON.stringify(nt)} }).kind`)).toBe('pickling');
    m = await read(page, `${D.dmy}, 11:00 am - Pickler: ${nt}`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.dest])).toEqual([[13, 'BOLT', 800, 'barrel'], [13, 'HOOK', 90, 'barrel']]);
    expect(m[0].items.every(i => i.codes.includes('amber:notime'))).toBe(true);
    // The night's work under its dated head: the night's date, overtime, the line asked; a load after the last count takes the
    // figure on the line under it.
    const nw = `---${D0.dmy}/ NIGHT WORK---\n\nNOVA RING 300 NOS DURGA 77 CD  \n2400 NOS`;
    expect(await ev(page, `msgSort({ text: ${JSON.stringify(nw)} }).kind`)).toBe('production');
    m = await read(page, `${D.dmy}, 10:26 am - Supervisor: ${nw}`);
    expect(m[0].kind).toBe('production');
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.date])).toEqual([[11, 'RING', 300, D0.iso], [12, '77 CD', 2400, D0.iso]]);
    expect(m[0].items.every(i => i.codes.includes('amber:noline'))).toBe(true);
    expect(await ev(page, `parseProdPaste(${JSON.stringify(`${D.dmy}, 10:26 am - Supervisor: ${nw}`)}, prodCtx())[0].read.items.map(function(i){ return [i.kind, i.line, i.slot]; })`)).toEqual([['plated', null, 'ot'], ['plated', null, 'ot']]);
    // The review's cases. Words after a line's last count with no bare count under them are no load; a load carried to the count
    // under it keeps the line it was written under; a night head under a day's work makes what follows the night's.
    const lines = (t: string) => ev(page, `parseProdPaste(${JSON.stringify(`${D.dmy}, 10:10 am - Supervisor: ${t}`)}, prodCtx())[0].read.items.map(function(i){ return [i.clientId, i.part, i.qty, i.line, i.slot]; })`);
    expect(await lines('OPENING TIME 7:10 AM VAT A 1\nNOVA RING 300 NOS 2ND ROUND\nNOVA BOLT 100 NOS AT 9:05 AM')).toEqual([[11, 'RING', 300, 'vat-a1', 'day'], [11, 'BOLT', 100, 'vat-a1', 'day']]);
    expect(await lines('OPENING TIME 7:10 AM VAT A 1\nNOVA RING 300 NOS DURGA 77 CD\n2400 NOS\nOPENING TIME 8:00 AM VAT A 2\nKESTREL BOLT 200 NOS')).toEqual([[11, 'RING', 300, 'vat-a1', 'day'], [12, '77 CD', 2400, 'vat-a1', 'day'], [13, 'BOLT', 200, 'vat-a2', 'day']]);
    expect(await lines('OPENING TIME 7:10 AM VAT A 1\nNOVA RING 300 NOS\nNIGHT WORK\nDURGA HOOK 200 NOS')).toEqual([[11, 'RING', 300, 'vat-a1', 'day'], [12, 'HOOK', 200, 'vat-a1', 'ot']]);
    // A roll under a night head stays a roll; a chemical sent to a line is no pickling load.
    expect(await ev(page, `msgSort({ text: ${JSON.stringify(`NIGHT WORK
${D.dmy} OUT TIME 6:00 AM
ALFA
BRAVO
NOVA RING 300 NOS`)} }).kind`)).toBe('out');
    expect(await ev(page, `msgSort({ text: ${JSON.stringify('ZINC 20 KG\nTO VAT A2')} }).kind`)).not.toBe('pickling');
  });

  test('the floor on 28 Nov 2026: a line before or after the clock, a client after the count, a roll’s work read and saved, a time sent alone', async ({ page }) => {
    await load(page);
    // A line after the clock is where the loads go, its load and the loads under it; one between the time's words and its clock too;
    // a client after a load's count is its client.
    let m = await read(page, `${D.dmy}, 9:33 am - Supervisor: PICKLING TIME 7:50 AM VAT A 1 NOVA RING 52×64=20×5=120 NOS\n48×57(20×5)=75 NOS\n----------------------\nVAT A 2 PICKLING TIME 7:50 AM DURGA 7313-400 NOS\nKESTREL HOOK 500 NOS`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time, i.dest])).toEqual([
      [11, 'RING 52X64(20X5)', 120, '07:50', 'vat-a1'], [11, '48X57(20X5)', 75, '07:50', 'vat-a1'],
      [12, '7313', 400, '07:50', 'vat-a2'], [13, 'HOOK', 500, '07:50', 'vat-a2']]);
    m = await read(page, `${D.dmy}, 9:36 am - Supervisor: PICKLING TIME VAT A1 10:05 AM 52×64(20×5)=230 NOS NOVA`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.time, i.dest])).toEqual([[11, '52X64(20X5)', 230, '10:05', 'vat-a1']]);
    // A roll's work: a client and family over sizes heads them, two loads on a line are two, the stock under it is no load.
    const roll = `${D.dmy}/ IN TIME\n-------6:00 AM------\n1) ALFA\n2) BRAVO\n------WORK-------\nNOVA RING\n52×64(20×5)=120 NOS 48×57=(20×5)=75 NOS\n47×53(20×5)=90 NOS\n------------------\nCHEMICAL USE\n1) ZINK 30 KG\n2) HCL 100-20=80 LTR`;
    m = await read(page, `${D.dmy}, 9:18 am - Supervisor: ${roll}`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty])).toEqual([[11, 'RING 52X64(20X5)', 120], [11, 'RING 48X57(20X5)', 75], [11, 'RING 47X53(20X5)', 90]]);
    // The messages' check: the roll's work is saved with the roll; a pickling time sent alone pickles the same hand's incoming loads
    // that no message pickles, to its line, said amber.
    const wa = (at: string, who: string, text: string) => `${D.dmy}, ${at} - ${who}: ${text}`;
    const chat = [
      wa('9:00 am', 'Pickler', 'INCOMING MATERIAL TIME 8:50 AM\nNOVA CLAMPS\nRING--200 NOS\nBOLT--100 NOS'),
      wa('9:20 am', 'Pickler', 'Pickling time 9:15 am\nFor Vat A1'),
      wa('9:40 am', 'Pickler', 'NOVA CLAMPS\nBOLT--100 NOS\nPICKLING TIME 9:35 AM\nFOR BARREL'),
      wa('9:18 am', 'Supervisor', roll),
    ].join('\n');
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(chat)}), 'zip', 'IMP-P289b'); saveState(); mcOpen({ importId: 'IMP-P289b' }); })()`);
    await expect(page.locator('[data-mc]')).toBeVisible();
    await expect(page.locator(`[data-mc-row][data-kind="in"]`)).toContainText('Work: 3 loads, saved with the roll');
    await ev(page, `(function(){ mcShown().forEach(function(r) { if (r.tickable) _mc.tick[r.id] = true; }); mcRedraw(); })()`);
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('4');
    const got = await ev(page, `(function(){
      return {
        pickled: S.production.entries.filter(function(e) { return e.kind === 'pickled'; }).map(function(e) { return [e.part, e.qty, e.time, e.dest || e.line || null]; }).sort(),
        plated: S.production.entries.filter(function(e) { return e.kind === 'plated'; }).map(function(e) { return [e.part, e.qty]; }).sort(),
        status: S.messages.map(function(m) { return m.kind + ':' + m.status; }).sort(),
      };
    })()`) as any;
    expect(got.pickled).toEqual([['BOLT', 100, '09:35', 'barrel'], ['RING', 200, '09:15', 'vat-a1']]);
    expect(got.plated).toEqual([['RING 47X53(20X5)', 90], ['RING 48X57(20X5)', 75], ['RING 52X64(20X5)', 120]]);
    expect(got.status).toEqual(['in:saved', 'pickling:saved', 'pickling:saved', 'pickling:saved']);
  });

  test('the fifth review’s cases (28 Nov 2026): a roll’s family and client, a figure under a family, a time alone by part, a roll’s cut, a line picked', async ({ page }) => {
    await load(page);
    const work = (w: string) => ev(page, `parseProdPaste(${JSON.stringify(`${D.dmy}, 9:18 am - Supervisor: ${D.dmy}/ IN TIME
-------6:00 AM------
1) ALFA
------WORK-------
${w}`)}, prodCtx())[0].read.items.filter(function(i){ return i.kind === 'plated'; }).map(function(i){ return [i.clientId, i.part, i.qty]; })`);
    // A family stops at the next client; a figure under a family is its load; a line of two loads gives the second its client and family.
    expect(await work('NOVA RING\n52×64(20×5)=120 NOS\nDURGA\n7313-400 NOS')).toEqual([[11, 'RING 52X64(20X5)', 120], [12, '7313', 400]]);
    expect(await work('NOVA CLAMP\n1200+240 NOS')).toEqual([[11, 'CLAMP', 1440]]);
    expect(await work('NOVA RING 52×64(20×5)=120 NOS 48×57=(20×5)=75 NOS')).toEqual([[11, 'RING 52X64(20X5)', 120], [11, 'RING 48X57(20X5)', 75]]);
    // A word after a count is a client only by its own name, never a piece of one.
    let m = await read(page, `${D.dmy}, 9:10 am - Pickler: PICKLING TIME 9:00 AM RING 120 NOS CLAMPS`);
    expect(m[0].items[0].clientId ?? null).toBe(null);
    // A time sent alone pickles by part and figure: a load pickled in a message with no client written is not pickled again; the line
    // may follow the clock on its line.
    const paste = [`${D.dmy}, 9:00 am - Pickler: INCOMING MATERIAL TIME 8:50 AM\nNOVA CLAMPS\nRING--200 NOS\nBOLT--100 NOS`,
      `${D.dmy}, 9:20 am - Pickler: Pickling time 9:15 am FOR VAT A1`,
      `${D.dmy}, 9:40 am - Pickler: BOLT--100 NOS\nPICKLING TIME 9:35 AM\nFOR BARREL`].join('\n');
    m = await read(page, paste);
    expect(m[1].items.map(i => [i.part, i.qty, i.time, i.dest, i.codes.includes('amber:fromabove')])).toEqual([['RING', 200, '09:15', 'vat-a1', true]]);
    // A line picked on a night's work written under its line is the one saved.
    const nw = `${D.dmy}, 10:26 am - Supervisor: ---${D0.dmy}/ NIGHT WORK---\nVAT A 1\nNOVA RING 300 NOS`;
    expect(await ev(page, `(function(){ var rv = { msgs: parseProdPaste(${JSON.stringify(nw)}, prodCtx()), choices: {} }; var a = prodReviewResolve(rv).rows[0].line; rv.choices['line0:0'] = 'vat-a2'; return [a, prodReviewResolve(rv).rows[0].line]; })()`)).toEqual(['vat-a1', 'vat-a2']);
    // A cut written in a roll's work is not saved from the roll: the power messages save it.
    const wa = (at: string, who: string, text: string) => `${D.dmy}, ${at} - ${who}: ${text}`;
    const chat = [
      wa('7:05 am', 'Pickler', 'Power cut 7:00 am'),
      wa('7:35 am', 'Pickler', 'POWER IN 7:30AM'),
      wa('9:18 am', 'Supervisor', `${D.dmy}/ IN TIME\n-------6:00 AM------\n1) ALFA\n2) BRAVO\n------WORK-------\nPOWER CUT 7:00 AM TO 7:30 AM\nNOVA RING 300 NOS`),
    ].join('\n');
    await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(chat)}), 'zip', 'IMP-P289c'); saveState(); mcOpen({ importId: 'IMP-P289c' }); })()`);
    await expect(page.locator('[data-mc]')).toBeVisible();
    await ev(page, `(function(){ mcShown().forEach(function(r) { if (r.tickable) _mc.tick[r.id] = true; }); mcRedraw(); })()`);
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"] .inv-tile-value')).toHaveText('3');
    const got = await ev(page, `S.production.entries.map(function(e){ return [e.kind, e.time || null, e.to || null]; }).sort()`) as any;
    expect(got.filter((x: any) => x[0] === 'downtime')).toEqual([['downtime', '07:00', '07:30']]);
    expect(got.filter((x: any) => x[0] === 'plated').length).toBe(1);
  });

  test('the loads a first reading missed (28 Nov 2026): listed beside what was saved, added with one tap, an entry named by hand never offered again', async ({ page }) => {
    const roll = `${D.dmy}/ IN TIME\n-------6:00 AM------\n1) ALFA\n------WORK-------\nNOVA CLAMP 480 NOS RING 90 NOS`;
    const pick = 'NOVA CLAMPS\nRING--200 NOS\nBOLT--100 NOS\nPICKLING TIME 9:00 AM';
    const at = new Date(D.iso + 'T10:00:00').getTime();
    const ent = (id: string, kind: string, part: string, qty: number, pasteId: string) => ({ id, kind, date: D.iso, time: '09:00', clientId: 11, client: 'NOVA', part, qty, unit: 'NOS', basis: 'relay', slot: 'ot', pasteId, at, by: 'Owner' });
    await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: STAFF, attendance: {}, incomingMaterial: noSeedIM(),
      production: { entries: [ent('E1', 'plated', 'CLAMP', 480, 'PPA'), ent('E2', 'pickled', 'R-200 (named by hand)', 200, 'PPB')],
        pastes: [{ id: 'PPA', at, by: 'Owner', sentBy: 'Supervisor', sentOn: D.iso, day: D.iso, kind: 'roll', hash: 'h1', text: roll },
          { id: 'PPB', at, by: 'Owner', sentBy: 'Pickler', sentOn: D.iso, day: D.iso, kind: 'pickling', hash: 'h2', text: pick }] } } as unknown as SepState);
    // Read again: the roll's second load and the pickling message's BOLT are missed; the RING saved under another name is not.
    const found = await ev(page, `prodMissedFind().map(function(x){ return [x.paste.id, x.missed.map(function(i){ return i.part + ' ' + i.qty; })]; })`);
    expect(found).toEqual([['PPA', ['RING 90']], ['PPB', ['BOLT 100']]]);
    await ev(page, `prodMissedOpen()`);
    await expect(page.locator('[data-prod-missed="PPA"]')).toContainText('Saved from it: CLAMP 480');
    await page.locator('[data-action="invProdMissedAdd"][data-id="PPA"]').click();
    await expect(page.locator('[data-prod-missed="PPA"]')).toHaveCount(0);
    const got = await ev(page, `S.production.entries.map(function(e){ return [e.part, e.qty, e.pasteId, !!e.addedLater]; })`);
    expect(got).toEqual([['CLAMP', 480, 'PPA', false], ['R-200 (named by hand)', 200, 'PPB', false], ['RING', 90, 'PPA', true]]);
    expect(await ev(page, `S.production.pastes.length`)).toBe(2);
    // A roll's work: the line written before a load is its line, never part of its name.
    const w = await ev(page, `parseProdPaste(${JSON.stringify(`${D.dmy}, 9:18 am - Supervisor: ${D.dmy}/ IN TIME
-------6:00 AM------
1) ALFA
------WORK-------
VAT 2---NOVA RING 240 NOS
BARREL-- KESTREL 77 CD 45 KG`)}, prodCtx())[0].read.items.map(function(i){ return [i.clientId, i.part, i.qty, i.lineHint]; })`);
    expect(w).toEqual([[11, 'RING', 240, 'vat-a2'], [13, '77 CD', 45, 'barrel']]);
  });

  test('a use message with no numbers (26 Nov 2026): each use a line, read by its bath, one with none of its own taking its line’s', async ({ page }) => {
    await load(page);
    const r = await ev(page, `(function(){ var p = parseStockMessage(${JSON.stringify(`CHEMICAL USE  &  ZINK USE ${D.dmy}/
VAT A 2 ZINK USE 40 KG
VAT A 1 USE ZINK 60 KG
106 SOLLT USE VAT A 1 20KG CYNEDE 4 KG
16 SOLLT 5 KG VAT A 2 BRIGHTNER 1+2= 3 LTR`)});
      return { to: p.to, lines: p.lines.map(function(l){ return [l.name, l.U, l.unit, stockBathsIn(l.raw).join(','), l.issues.map(function(i){ return i.level + ':' + i.code; }).join(',')]; }), unread: p.unread }; })()`) as any;
    expect(r.to).toBe(D.iso);
    expect(r.lines).toEqual([
      ['ZINK', 40, 'kg', 'vat-a2', ''], ['ZINK', 60, 'kg', 'vat-a1', ''], ['106 SOLLT', 20, 'kg', 'vat-a1', ''],
      ['CYNEDE', 4, 'kg', 'vat-a1', 'amber:usebath'], ['16 SOLLT', 5, 'kg', 'vat-a2', 'amber:usebath'], ['BRIGHTNER', 3, 'L', 'vat-a2', '']]);
    expect(r.unread).toEqual([]);
    // A figure with no name of its own stays with the item before it; an add or a balance is not a use; a time of day is no name.
    const r2 = await ev(page, `parseStockMessage(${JSON.stringify(`CHEMICAL USE ${D.dmy}
ZINK USE VAT A1 30 KG + VAT A2 20 KG = 50 KG
ZINK USE VAT A1 40 KG VAT A2 30 KG
ZINK ADD 50 KG
ZINK AVAILABLE 210 KG
BRIGHTNER NIGHT USE 2 LTR MORNING USE 2 LTR`)}).lines.map(function(l){ return [l.name, l.A, l.U, l.C]; })`);
    expect(r2).toEqual([['ZINK', null, 50, null], ['ZINK', null, 70, null], ['ZINK', 50, null, null], ['ZINK', null, null, 210], ['BRIGHTNER', null, 4, null]]);
    // A numbered stock message is read as it was.
    const n = await ev(page, `parseStockMessage('1) BRIGHTNER 80 LTR use 5 LTR available 75 LTR').lines.length`);
    expect(n).toBe(1);
  });
});
