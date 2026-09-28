import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P83: reading the floor's production messages (prodparse.js). The shapes are
// the pickling hand's, the supervisor's barrel list and roll block, and the
// register as Gemini transcribes it — with made-up clients and parts, since the
// repo is public. The parser is pure: the client list is passed in.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function when(offset: number): { dmy: string; mdy: string; iso: string } {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yy = String(d.getFullYear()).slice(2);
  return { dmy: `${dd}/${mm}/${yy}`, mdy: `${d.getMonth() + 1}/${d.getDate()}/${yy}`, iso: `${d.getFullYear()}-${mm}-${dd}` };
}

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'KESTREL ENGINEERS PVT. LTD.', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 14, name: 'GENERAL FORGE CORPORATION', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const STAFF = [
  { id: 1, name: 'Arun', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
];

async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: STAFF, attendance: {}, incomingMaterial: noSeedIM() } as SepState);
}
/* Every item of a paste, flattened, with its issue codes. */
async function read(page: Page, text: string) {
  return page.evaluate((t) => {
    const ev = (0, eval);
    const msgs = ev('parseProdPaste')(t, ev('prodCtx()'));
    return msgs.map((m: any) => ({
      kind: m.kind, sentOn: m.sentOn, sentAt: m.sentAt, sentBy: m.sentBy, notes: m.read.notes.length,
      items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, time: it.time, to: it.to, clientId: it.clientId, client: it.client,
        part: it.part, gauge: it.gauge, qty: it.qty, unit: it.unit, qtySrc: it.qtySrc, rework: it.rework, line: it.line, lineHint: it.lineHint,
        slot: it.slot, basis: it.basis, codes: it.issues.map((x: any) => x.tone + ':' + x.code) }))
    }));
  }, text);
}

test.describe('P83: production messages', () => {
  test('the pickling hand: a load, its time, the day it was sent', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 9:40 am - Pickler: NOVA CLAMPS
CLAMP133×83(35×6)-774 nos
Pickling Time 9:00AM
${d.dmy}, 11:05 am - Pickler: Durga auto
0140- 300 nos
KESTREL ENGINEERS
WASHER--1,245 nos
Pickling time 10:30
${d.dmy}, 3:00 pm - Pickler: NOVA CLAMPS
CLAMP(40×6)
Pickling time 2:00am`);
    expect(msgs.map(m => m.kind)).toEqual(['pickling', 'pickling', 'pickling']);
    expect(msgs[0].sentOn).toBe(d.iso);
    expect(msgs[0].sentAt).toBe(9 * 60 + 40);
    const [a] = msgs[0].items;
    expect(a).toMatchObject({ kind: 'pickled', date: d.iso, time: '09:00', clientId: 11, part: 'CLAMP133X83(35X6)', gauge: '35X6', qty: 774, unit: 'NOS' });
    expect(a.codes).toEqual([]);
    // Two clients under one time; "1,245" is a thousand, not a list; no AM/PM is read from when it was sent.
    const [b, c] = msgs[1].items;
    expect(b).toMatchObject({ clientId: 12, part: '0140', qty: 300, time: '10:30' });
    expect(c).toMatchObject({ clientId: 13, part: 'WASHER', qty: 1245, time: '10:30' });
    expect(b.codes).toContain('info:meridiem');
    // Since August over half the loads carry no quantity: kept as a load, qty unknown. "2:00am" posted at 3 pm is 2 pm.
    const [e] = msgs[2].items;
    expect(e).toMatchObject({ clientId: 11, part: 'CLAMP(40X6)', gauge: '40X6', qty: null, time: '14:00' });
    expect(e.codes).toContain('amber:meridiem');
  });

  test('incoming material, a slipped PM, sums and rework', async ({ page }) => {
    await load(page);
    const d = when(-2);
    const msgs = await read(page, `${d.dmy}, 9:46 am - Pickler: Incoming Material time 8:45Am
Durga auto
3322(L.Bkt)--500 Nos
And Pickling Time 9:00Am
${d.dmy}, 9:28 am - Pickler: Nova clamps
Clamp--400 nos
Pickling time 9:00pm
${d.dmy}, 12:10 pm - Pickler: GENERAL FORGE
BOLT--1800+450 Nos
RE-PICKLING
Pickling time 12:00pm
${d.dmy}, 4:20 pm - Pickler: Incoming material time 4:15 pm
Kestrel engineers
Nut--20.640kg`);
    const [p, a] = msgs[0].items;
    expect(a).toMatchObject({ kind: 'arrived', time: '08:45', clientId: 12, qty: 500 });
    expect(p).toMatchObject({ kind: 'pickled', time: '09:00', clientId: 12, qty: 500 });
    // "9:00pm" posted at 9:28 in the morning: read as 9 AM, said so.
    expect(msgs[1].items[0]).toMatchObject({ time: '09:00', clientId: 11 });
    expect(msgs[1].items[0].codes).toContain('amber:meridiem');
    // A sum is the working, and "RE-" makes it rework.
    const bolt = msgs[2].items[0];
    expect(bolt).toMatchObject({ clientId: 14, qty: 2250, qtySrc: 'working', unit: 'NOS', rework: true });
    // Material that arrived and was not pickled in the message: arrived, at its time, with no "no time" flag.
    const nut = msgs[3].items[0];
    expect(nut).toMatchObject({ kind: 'arrived', time: '16:15', clientId: 13, qty: 20.64, unit: 'KG' });
    expect(nut.codes).not.toContain('amber:notime');
  });

  test('clients: exact, read as, learnt, and never guessed', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){
      var idx = prodClientIndex(S.clients, { NOVAK: 11 });
      var m = function(t) { var h = prodMatchClient(t, idx); return h ? [h.id, h.how] : null; };
      return { exact: m('Nova Clamps'), words: m('NOVA'), readAs: m('Kestral Engineers'), learnt: m('Novak'),
        short: m('Dura'), firm: m('General Forge Corporation'), nobody: m('Siya Enterprises') };
    })()`);
    expect(r.exact).toEqual([11, 'exact']);
    expect(r.words).toEqual([11, 'exact']);
    expect(r.readAs).toEqual([13, 'read-as']);
    expect(r.learnt).toEqual([11, 'learnt']);
    expect(r.short).toBeNull();           // four letters: no one-letter-off guess
    expect(r.firm).toEqual([14, 'exact']);
    expect(r.nobody).toBeNull();
    // A name nobody holds is red and kept as written; the firm words stay with the name, not the part.
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 10:45 am - Pickler: SIYA ENTERPRISES
Buckle hook--200 nos
Pickling time 10:40am`);
    expect(msgs[0].items[0]).toMatchObject({ clientId: null, client: 'SIYA ENTERPRISES', part: 'Buckle hook', qty: 200 });
    expect(msgs[0].items[0].codes).toContain('red:client');
  });

  test('the supervisor\'s barrel list: plated on the barrel, for the day', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 8:21 pm - Supervisor: ${d.dmy}/berral production
----------------
GENERAL FORGE 90 CD 60 KG
--------------- 3 HOL 45 KG
Durga auto
0101--995 NOS ,96.970Kg`);
    expect(msgs[0].kind).toBe('production');
    const items = msgs[0].items;
    expect(items).toHaveLength(3);
    items.forEach(it => expect(it).toMatchObject({ kind: 'plated', line: 'barrel', slot: 'day', basis: 'relay', date: d.iso }));
    expect(items[0]).toMatchObject({ clientId: 14, part: '90 CD', qty: 60, unit: 'KG' });
    expect(items[1]).toMatchObject({ clientId: 14, part: '3 HOL', qty: 45, unit: 'KG' });
    expect(items[2]).toMatchObject({ clientId: 12, part: '0101', qty: 995, unit: 'NOS' });
    // The older timed log counted barrels, not pieces: listed, never read.
    const old = await read(page, `${d.dmy}, 6:00 pm - Supervisor: berral production
Unlod time 10:00am
90 CD ganral 120k ×4`);
    expect(old[0].items).toHaveLength(0);
    expect(old[0].notes).toBeGreaterThan(0);
  });

  test('power cuts, kinds, and what is dropped', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 11:02 am - Supervisor: Power cut 10:55am
${d.dmy}, 11:20 am - Pickler: Power in 11:15 am
${d.dmy}, 12:10 pm - Pickler: <Media omitted>
${d.dmy}, 12:11 pm - Pickler: This message was deleted
${d.dmy}, 1:02 pm - Supervisor: Camical use ${d.dmy}
Nitric 20 L
${d.dmy}, 1:03 pm - Owner: ok`);
    expect(msgs.map(m => m.kind)).toEqual(['power', 'power', 'stock', 'other']);
    expect(msgs[0].items[0]).toMatchObject({ kind: 'downtime', time: '10:55' });
    // A cut and its "in" arrive as two messages: the cut is left open, and the "in" alone is a note.
    expect(msgs[1].items).toHaveLength(0);
    const one = await read(page, `${d.dmy}, 11:30 am - Pickler: Power cut 10:55am
Power in 11:15am`);
    expect(one[0].items[0]).toMatchObject({ kind: 'downtime', time: '10:55', to: '11:15' });
  });

  test('both export headers, and a message pasted with none', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const ios = await read(page, `[${d.mdy}, 9:40:12 AM] Pickler: NOVA CLAMPS
Liner--600 nos
Pickling Time 9:00AM`);
    expect(ios[0]).toMatchObject({ sentOn: d.iso, sentAt: 9 * 60 + 40, sentBy: 'Pickler' });
    expect(ios[0].items[0]).toMatchObject({ qty: 600, time: '09:00', clientId: 11 });
    const bare = await read(page, `NOVA CLAMPS
Liner--600 nos
Pickling Time 9:00AM`);
    expect(bare[0].sentOn).toBeNull();
    expect(bare[0].items[0].date).toBe(todayIso());
    expect(bare[0].items[0].codes).toContain('amber:nodate');
    // A three-digit hour is a slip, never read as 9.
    const slip = await read(page, `${d.dmy}, 9:40 am - Pickler: NOVA CLAMPS
Liner--600 nos
Pickling Time 109:00AM`);
    expect(slip[0].items[0].time).toBeNull();
    expect(slip[0].items[0].codes).toContain('amber:time');
  });

  test('a roll is attendance; its production block is read here, at the slot above it', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 8:40 pm - Supervisor: ${d.dmy}/ out time
----8:00 PM---
---berral---
1) ARUN
2) BALA
----production----
Durga auto 0101--400 nos`);
    expect(msgs[0].kind).toBe('roll');
    const [it] = msgs[0].items;
    expect(it).toMatchObject({ kind: 'plated', slot: 'ot', basis: 'relay', line: null, lineHint: 'barrel', clientId: 12, qty: 400, to: '20:00' });
    expect(it.codes).toContain('amber:linehint');
  });

  test('the register as Gemini transcribes it', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const json = {
      date: d.dmy, line: 'VAT A1', dayTotal: 1000,
      rows: [
        { time: 'START', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qty: null, start: true },
        { time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', rackSize: 4, rounds: 27, qty: 108 },
        { time: '10:15', customer: null, part: null, ditto: true, rackSize: 4, rounds: 25, qty: 108 },
        { time: '2:30', customer: 'Durga auto', part: '0140', qty: 300, struck: true },
        { time: '3:45', customer: 'Durga auto', part: '0140', qty: 250, over: '205' },
      ],
    };
    const r = await page.evaluate(({ json, iso }) => {
      const ev = (0, eval);
      const pick = (choices: any) => ev('prodFromRegisterRead')(json, ev('prodCtx()'), iso, choices);
      const a = pick({}), b = pick({ struck3: 'cancelled' }), c = pick({ struck3: 'counted' });
      const codes = (x: any) => x.issues.map((i: any) => i.tone + ':' + i.code);
      return {
        date: a.date, line: a.line, runs: a.runs.map((e: any) => ({ clientId: e.clientId, part: e.part, gauge: e.gauge, qty: e.qty, time: e.time, to: e.to, slot: e.slot, n: e.rounds.length })),
        rowCodes: a.rows.map(codes), pageA: codes(a), countedB: b.counted, countedC: c.counted, pageB: codes(b), fpSame: a.fp === b.fp,
      };
    }, { json, iso: d.iso });
    expect(r.date).toBe(d.iso);
    expect(r.line).toBe('vat-a1');
    // One run per customer and part; START takes the next round's figure; ditto carries the part.
    expect(r.runs).toHaveLength(2);
    expect(r.runs[0]).toMatchObject({ clientId: 11, gauge: '40X6', qty: 324, time: '09:20', to: '10:15', slot: 'general', n: 3 });
    expect(r.rowCodes[0]).toContain('info:start');
    // 4 × 25 is 100, and 108 is written: the written figure is used, and the difference said.
    expect(r.rowCodes[2]).toContain('amber:rack');
    // A bare 2:30 on the register is the afternoon.
    expect(r.runs[1]).toMatchObject({ clientId: 12, time: '14:30', to: '15:45' });
    // A struck row is red until counted or cancelled; the day's total is checked against what is counted.
    expect(r.rowCodes[3]).toContain('red:struck');
    expect(r.rowCodes[4]).toContain('info:over');
    expect(r.countedB).toBe(324 + 250);
    expect(r.countedC).toBe(324 + 300 + 250);
    expect(r.pageB).toContain('amber:total');
    expect(r.fpSame).toBe(true);
  });

  test('a roll: work written straight under its slot and line, a client on a line of its own, a figure on the line below', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 5:08 pm - Supervisor: ${d.dmy}/ out time
-----8:00 PM----
1) ARUN
LINER 1000 NOS
---hold night-6:00am---
2) BALA
Nova clamps material
VAT A 2
3301-600 nos
0102-700 nos
Durga auto CLAMP
1360 NOS
------berral---extra--work
Durga--4206-1000 nos`);
    expect(msgs[0].kind).toBe('roll');
    const it = msgs[0].items.map(x => [x.clientId, x.part, x.qty, x.to, x.lineHint || null, x.slot]);
    expect(it).toEqual([
      [null, 'LINER', 1000, '20:00', null, 'ot'],
      [11, '3301', 600, '06:00', 'vat-a2', 'ot'],
      [11, '0102', 700, '06:00', 'vat-a2', 'ot'],
      [12, 'CLAMP', 1360, '06:00', 'vat-a2', 'ot'],
      [12, '4206', 1000, '06:00', 'barrel', 'ot'],
    ]);
  });

  test('a chemical delivery is not incoming material; attached-file lines are not messages; a part only one client sends names it', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: STAFF, attendance: {},
      incomingMaterial: [{ id: 'IM1', challanNo: '1', challanDate: when(-20).iso, clientId: 13, clientName: CLIENTS[2].name, receivedDate: when(-20).iso, createdAt: 1,
        items: [{ id: 'IM1-0', partNumber: 'BIG LINER', desc: 'BIG LINER', unit: 'NOS', qty: 100, rate: 1, amount: 100, invoiced: false }] }] } as SepState);
    const d = when(-1);
    const msgs = await read(page, `${d.dmy}, 4:53 pm - Supervisor: Incoming spray ${d.dmy}
${d.dmy}, 4:54 pm - Pickler: IMG-20260922-WA0002.jpg (file attached)
${d.dmy}, 9:40 am - Pickler: Incoming Material time 9:00Am
Durga auto
0140--300 Nos
${d.dmy}, 10:40 am - Pickler: BIG LINER--200 nos
Pickling time 10:30am`);
    expect(msgs.map(m => m.kind)).toEqual(['other', 'pickling', 'pickling']);
    expect(msgs[1].items[0]).toMatchObject({ kind: 'arrived', clientId: 12, qty: 300 });
    expect(msgs[2].items[0]).toMatchObject({ clientId: 13, part: 'BIG LINER', qty: 200 });
    expect(msgs[2].items[0].codes).toContain('amber:readas');
    expect(msgs[2].items[0].codes).not.toContain('red:client');
  });
});
