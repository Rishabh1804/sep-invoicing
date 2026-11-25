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
    // Sent at 12:12 AM with no date written: the 6:30 PM load is the evening before.
    let m = await read(page, `${D.dmy}, 12:12 am - Pickler: NOVA CLAMPS\nRING--1000 nos\nPickling time 6:30 pm\nFor vat A2`);
    expect(m[0].items).toHaveLength(1);
    expect(m[0].items[0]).toMatchObject({ kind: 'pickled', date: D0.iso, time: '18:30', clientId: 11, part: 'RING', qty: 1000, unit: 'NOS', dest: 'vat-a2' });
    expect(m[0].items[0].codes).toContain('amber:evebefore');
    expect(m[0].items[0].codes).not.toContain('amber:later');
    // A date written in the message is the message's day, wherever it was sent.
    m = await read(page, `${D.dmy}, 12:12 am - Pickler: ${D.dmy}\nNOVA CLAMPS\nRING--1000 nos\nPickling time 6:30 pm`);
    expect(m[0].items[0].date).toBe(D.iso);

    // "For Barrel" under the pickling time is where the loads above it go, never the next block's; "VAT A1 &A2" is a line, not a part.
    m = await read(page, `${D.dmy}, 10:30 am - Pickler: NOVA CLAMPS\nRING 71×47(30×6)--1600 NOS\nPICKLING TIME 8:30 am\nFor Barrel\n\nDURGA AUTO\n0760--30 nos\nPickling time 9:00 am\nVAT A1 &A2\n\nKESTREL\n4242--50 KG\nPickling time 9:30 am\nFOR VAT A1& A2`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.dest])).toEqual([[11, 'RING 71X47(30X6)', 1600, 'barrel'], [12, '0760', 30, 'vat-a1'], [13, '4242', 50, 'vat-a1']]);

    // A name with no figure between two loads with theirs heads a client's loads of its own: asked when the book has no such client.
    m = await read(page, `${D.dmy}, 11:02 am - Pickler: KESTREL\n7311--4419---800 nos\nZEPHYR\nHOOK--30 kg\nPickling time 10:30 am\nFor Barrel`);
    expect(m[0].items.map(i => [i.client, i.clientId, i.part, i.qty, i.unit])).toEqual([['KESTREL', 13, '7311--4419', 800, 'NOS'], ['ZEPHYR', null, 'HOOK', 30, 'KG']]);
    expect(m[0].items[1].codes).toContain('red:client');
    // A part the client above has sent stays that client's part ("LINER" under NOVA, with a load under it).
    m = await read(page, `${D.dmy}, 11:02 am - Pickler: NOVA CLAMPS\nCLAMP 123×87(30×6)--615 NOS\nLINER\nCLAMP 93×97(30×6)--300 NOS\nPickling time 10:30 am`, { LINER: 11 });
    expect(m[0].items.every(i => i.clientId === 11)).toBe(true);

    // A load with no client under an incoming head is the part's own client, never carried from the block above.
    m = await read(page, `${D.dmy}, 3:00 pm - Pickler: NOVA CLAMPS\nCLAMP 123×87(30×6)--615 NOS\nPICKLING TIME 1:30 PM\n\nINCOMING MATERIAL TIME 2:00PM\n210 CD--94 KG\n60 CD--66KG`, { '210 CD': 14, '60 CD': 14 });
    const arrived = m[0].items.filter(i => i.kind === 'arrived');
    expect(arrived.map(i => [i.part, i.clientId])).toEqual([['210 CD', 14], ['60 CD', 14]]);
    expect(arrived[0].codes).not.toContain('amber:carried');

    // A time written after the part is the load's own pickling time.
    m = await read(page, `${D.dmy}, 1:00 pm - Pickler: NOVA CLAMPS\nRING--200 nos\nPickling time 10:00am\n\nNOVA CLAMPS\nBIG RING--11:00AM`);
    expect(m[0].items[1]).toMatchObject({ part: 'BIG RING', time: '11:00', qty: null });
    expect(m[0].items[1].codes).not.toContain('amber:notime');

    // Sizes joined by "=": "87×83=25×6=400"; and a pickling time with its line before it and a load after it.
    m = await read(page, `${D.dmy}, 11:31 am - Pickler: VAT A 1 PICKLING TIME 11:00 AM NOVA CLAMP 87×83=25×6=400\n103×89=25×6=400`);
    expect(m[0].items[0]).toMatchObject({ clientId: 11, part: 'CLAMP 87X83(25X6)', qty: 400, time: '11:00', dest: 'vat-a1' });
    expect(m[0].items[1]).toMatchObject({ part: '103X89(25X6)', qty: 400 });
    expect(m[0].notes).not.toContain('A pickling time with nothing listed above it');
    // A line written before the load or after a figure with no unit is where it is going, never part of the load.
    m = await read(page, `${D.dmy}, 12:31 pm - Pickler: VAT A 1 NOVA CLAMP 73×88=25×6=860 NOS\n71×81=30×6=410 VAT A 2\nPICKLING TIME 12:00 PM`);
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.dest])).toEqual([[11, 'CLAMP 73X88(25X6)', 860, 'vat-a1'], [11, '71X81(30X6)', 410, 'vat-a2']]);
  });

  test('a numbered barrel list: its numbers are no part, a time alone heads the batches under it', async ({ page }) => {
    await load(page);
    const m = await read(page, `${D.dmy}, 3:09 pm - Supervisor: ${D.dmy}/ BERRAL UPDATED
1) UNLOAD TIME 9:30 AM GENERAL 60 CD  73 KG
2) 10:30 AM UNLOAD
NOVA CLAMP 200 NOS
3) 11:30 AM UNLOAD
KESTREL 120 KG
4) 1:00 PM UNLOAD DURGA 7577-300 NOS`);
    expect(m[0].kind).toBe('production');
    expect(m[0].items.map(i => [i.clientId, i.part, i.qty, i.to])).toEqual([[14, '60 CD', 73, '09:30'], [11, 'CLAMP', 200, '10:30'], [13, '', 120, '11:30'], [12, '7577', 300, '13:00']]);
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
1) A SOLLT 48-4=44 LTR
2) HCL 440-100=340 LTR
------------------
--8:00 PM TO 6:00 AM-
------NIGHT HOLD------
-----VAT A 2------
1) CHARLIE
2) ECHO
EXTRA 20 HOURS
------WORK-----
GENERAL 210 CD 2000 NOS`, D.iso, 600);
    const day = r.days.find(x => x.d === D.iso)!;
    expect(r.issues.filter(i => i.startsWith('red:'))).toEqual([]);
    expect(r.issues.some(i => i.startsWith('amber:Bravo Munda is named twice'))).toBe(true);
    expect(r.lines).toContain('name:Alfa');
    expect(r.lines).toContain('name:Foxtrot');
    // EXTRA6 is 6 hours on the 6 AM block; the night under the stock is read, out at 6 AM the next day, with its 20 hours.
    expect(day.extra).toContain('block|6|06:00|08:30|Bravo+Charlie');
    expect(day.extra.some(x => x.startsWith('block|20|20:00|06:00|Charlie+Echo'))).toBe(true);
    // "GENERAL 210 CD 2000 NOS" under the work is a note, never a slot heading.
    expect(r.lines[r.lines.length - 1]).toBe('note:');
  });

  test('the messages’ check: a power back sent on its own closes the cut, the stock in a roll is saved with it', async ({ page }) => {
    await load(page);
    const wa = (at: string, who: string, text: string) => `${D.dmy}, ${at} - ${who}: ${text}`;
    const chat = [
      wa('11:24 am', 'Supervisor', `${D.dmy}/ IN TIME\n-------8:30 AM-----\n----VAT 1-----\n01) ALFA\n02) ECHO\n---GATE---\n03) FOXTROT 7:00AM\n------------------\nCHEMICAL USE CHEMICAL STOCK\n------------------\n1) A SOLLT 48-4=44 LTR\n2) HCL 440-100=340 LTR`),
      wa('12:49 pm', 'Pickler', 'Power cut 12:48 pm'),
      wa('1:00 pm', 'Pickler', 'POWER IN 12:55PM'),
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
        status: S.messages.filter(function(m) { return m.importId === 'IMP-P289' || true; }).map(function(m) { return m.kind + ':' + m.status; }).sort(),
      };
    })()`) as any;
    expect(got.cuts).toEqual([[D.iso, '12:48', '12:55', false]]);
    expect(got.stock.length).toBeGreaterThanOrEqual(2);
    expect(got.stock.every((x: any) => x[2] === D.iso)).toBe(true);
    expect(got.status).toEqual(['in:saved', 'power:saved', 'power:saved']);
  });
});
