import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P220: the barrel list and the stock messages as the supervisor writes them
// from October 2026 (owner, 15 Oct 2026: "our parser cannot read this message.
// Same for stock messages like these"). A batch a block with its unload time,
// what is loaded for the night, two batches on one line, a barrel counted in
// barrels; a use split by bath or by time of day, a minus typed for "=", a line
// that opens on two figures, and a delivery "<supplier> TO SOMA". Made-up
// clients and supplier: the repo is public.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function when(offset: number): { dmy: string; iso: string } {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yy = String(d.getFullYear()).slice(2);
  return { dmy: `${dd}/${mm}/${yy}`, iso: `${d.getFullYear()}-${mm}-${dd}` };
}

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'KESTREL INDUSTRIES', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 14, name: 'GENERAL FORGE CORPORATION', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 15, name: 'VEGA PRESS METAL', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, attendance: {}, incomingMaterial: noSeedIM(), ...extra } as SepState);
}
async function read(page: Page, text: string) {
  return page.evaluate((t) => {
    const ev = (0, eval);
    return ev('parseProdPaste')(t, ev('prodCtx()')).map((m: any) => ({
      kind: m.kind, notes: m.read.notes.map((n: any) => n.text),
      items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, time: it.time, to: it.to, clientId: it.clientId, part: it.part,
        qty: it.qty, unit: it.unit, line: it.line, codes: it.issues.map((x: any) => x.tone + ':' + x.code) }))
    }));
  }, text);
}
async function line(page: Page, body: string) {
  return page.evaluate((b) => {
    const r = (0, eval)('parseStockLine')(b);
    return { name: r.name, O: r.O, A: r.A, U: r.U, C: r.C, parts: r.useParts && r.useParts.map((p: any) => [p.qty, p.baths.join('+')]),
      codes: r.issues.map((x: any) => x.level + ':' + x.code), unread: r.unread };
  }, body);
}

test.describe('P220: the barrel list and stock messages of October 2026', () => {
  test('a batch a block, its unload time before or after its figures, what is loaded counted when unloaded', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const m = await read(page, `${d.dmy}, 5:11 pm - Supervisor: ${d.dmy}/ BERRAL PRODUCTION
---------------------------------
KESTREL 120 KG 10:15 AM UNLOAD
--------------------------------
KESTREL 90 KG 11:45 AM UNLOAD
---------------------------------
DURGA 7311-260 NOS +7313-450 NOS
1:10 PM UNLOAD
-----------------------------------
DURGA 7314-180 NOS 2:40 PM UNLOAD
------------------------------------
LOADING TIME 4:00 PM 90 CD 70 KG
40 CD 50 KG GENERAL
------------and------------------`);
    expect(m[0].kind).toBe('production');
    const it = m[0].items;
    expect(it.map((x: any) => [x.clientId, x.part, x.qty, x.unit, x.to])).toEqual([
      [13, '', 120, 'KG', '10:15'], [13, '', 90, 'KG', '11:45'],
      [12, '7311', 260, 'NOS', '13:10'], [12, '7313', 450, 'NOS', '13:10'], [12, '7314', 180, 'NOS', '14:40']]);
    it.forEach((x: any) => expect(x).toMatchObject({ kind: 'plated', line: 'barrel', date: d.iso }));
    // Loaded for the night: listed, never counted here (the next list counts it when it comes out).
    expect(m[0].notes.filter((n: string) => /^Loaded at 4 PM/.test(n))).toHaveLength(2);
  });

  test('the date between dashes, two batches on a line, a time on the line under, a misspelt unload, a power cut', async ({ page }) => {
    await load(page);
    const d = when(-2), sent = when(-1);
    const m = await read(page, `${sent.dmy}, 10:35 am - Supervisor: BERRAL PRODUCTION
----------${d.dmy}/----------
GENERAL 90 CD 70 KG
40 CD 65 KG UNLOAD TIMING 10:00 AM
----------------------------------
VEGA PRESS 8257-60 KG KESTREL I BOLLT 50 KG
UNOLD TIMING 11:30 AM
------------------------------------
NOVA LINEAR 600 NOS UNLOAD TIMING
4:00 PM
POWER CUT 1:26 PM
POWER IN 3:03
------------------------------------`);
    const it = m[0].items.filter((x: any) => x.kind === 'plated');
    expect(it.map((x: any) => [x.clientId, x.part, x.qty, x.to, x.date])).toEqual([
      [14, '90 CD', 70, '10:00', d.iso], [14, '40 CD', 65, '10:00', d.iso],
      [15, '8257', 60, '11:30', d.iso], [13, 'I BOLLT', 50, '11:30', d.iso],
      [11, 'LINEAR', 600, '16:00', d.iso]]);
    const cut = m[0].items.find((x: any) => x.kind === 'downtime');
    expect(cut).toMatchObject({ date: d.iso, time: '13:26', to: '15:03' });
  });

  test('a barrel counted in barrels and a client with no figure are asked; the April log is still only listed', async ({ page }) => {
    await load(page);
    const d = when(-1);
    const m = await read(page, `${d.dmy}, 3:07 pm - Supervisor: ${d.dmy}/ BERRAL PRODUCTION
------------------------------------
VEGA PRESS 8257-120 KG UNLOAD TIMING 10:30 PM
KESTREL UNLOAD TIMING 1:00 PM 150 KG
KESTREL UNLOAD TIMING 2:30 PM
DURGA 1 BERRAL+ NOVA 1 BERRAL
UNLOAD TIMING 2:50 PM
------------------------------------`);
    const it = m[0].items;
    expect(it.map((x: any) => [x.clientId, x.qty, x.to])).toEqual([[15, 120, '10:30'], [13, 150, '13:00'], [13, null, '14:30'], [12, null, '14:50'], [11, null, '14:50']]);
    // 10:30 PM on a list sent at 3:07 PM is the morning, said.
    expect(it[0].codes).toContain('amber:meridiem');
    expect(it[2].codes).toContain('amber:noqty');
    expect(it[3].codes).toContain('amber:barrels');
    const old = await read(page, `${d.dmy}, 6:00 pm - Supervisor: berral production
Unlod time 10:00am
90 CD ganral 120k ×4`);
    expect(old[0].items).toHaveLength(0);
    expect(old[0].notes.length).toBeGreaterThan(0);
  });

  test('stock lines: a use by bath with its total, by time of day, a minus typed for "=", a name before two figures', async ({ page }) => {
    await load(page);
    expect(await line(page, '106 70 KG USE V A 1 30 KG +V A 2 20 KG= 50 KG 70-50=20 KG AVAILABLE'))
      .toMatchObject({ name: '106', O: 70, U: 50, C: 20, parts: [[30, 'vat-a1'], [20, 'vat-a2']], codes: [], unread: [] });
    expect(await line(page, 'BRIGHTNER USE V A1 3 LTR VA2  4LTR EVENING VA 1 2 LTR=9LTR USE 92-9=83 LTR AVAILABLE'))
      .toMatchObject({ name: 'BRIGHTNER', O: 92, U: 9, C: 83, parts: [[3, 'vat-a1'], [4, 'vat-a2'], [2, 'vat-a1']], codes: [] });
    expect(await line(page, 'BRIGHTNER NIGHT USE 2 LTR +MORNING USE 2 LTR +DAY USE 3+2=TOTAL 9 LTR USE 83-9=74 LTR'))
      .toMatchObject({ name: 'BRIGHTNER', O: 83, U: 9, C: 74, codes: [] });
    expect(await line(page, 'A SOLLT 17-3-14 LTR')).toMatchObject({ name: 'A SOLLT', O: 17, U: 3, C: 14, codes: ['amber:typo'] });
    expect(await line(page, 'NITRIC ACID ADD 30+22=52-6=46 LTR')).toMatchObject({ O: 22, A: 30, U: 6, C: 46, codes: [] });
    expect(await line(page, 'HCL ADD 600-200=400 LTR')).toMatchObject({ A: 600, U: 200, C: 400, codes: [] });
    expect(await line(page, 'SPRAY 10-2=8 NOS')).toMatchObject({ O: 10, U: 2, C: 8 });
    // A date after the heading or before it: the message's day either way.
    const d = when(-1);
    const r = await g(page, `(function(){
      var a = parseStockMessage('CHEMICAL USE CHEMICAL STOCK\\n${d.dmy}/\\n\\n01) ZINK 00 KG\\n\\n02) 65 M 36-3=33 LTR');
      var b = parseStockMessage('${d.dmy}/CHEMICAL USE CHEMICAL STOCK\\n\\n1) ZINK 00 KG');
      return [a.to, a.lines.length, a.lines[1].name, b.to, b.lines.length];
    })()`);
    expect(r).toEqual([d.iso, 2, '65 M', d.iso, 1]);
  });

  test('"106" finds 106 Salt; a delivery "<supplier> TO SOMA" is received, and the stock message after it does not count it again', async ({ page }) => {
    const d = when(-1);
    await load(page, { stock: { items: [
      { id: 'SI1', name: '106 Salt', key: '106 SALT', aliases: [], unit: 'kg', basis: 'draw', active: true },
      { id: 'SI2', name: 'HCL', key: 'HCL', aliases: [], unit: 'L', basis: 'draw', active: true },
      { id: 'SI3', name: 'Nitric Acid', key: 'NITRIC ACID', aliases: [], unit: 'L', basis: 'draw', active: true }], entries: [], pastes: [] } } as any);
    const del = `${d.dmy}, 12:38 pm - Supervisor: ${d.dmy}/ KESAR CHEM TO SOMA HCL 600 LTR
NITRIC ACID 30 LTR`;
    expect(await g(page, `[relayKind(${JSON.stringify(del.split(': ').slice(1).join(': '))}), parseProdPaste(${JSON.stringify(del)}, prodCtx())[0].kind]`)).toEqual(['stock', 'stock']);
    const saved = await page.evaluate((t) => {
      const ev = (0, eval);
      const p = ev('parseStockMessage')(t); p.text = t;
      const res = ev('resolveStockParse')(p, {});
      const c = ev('stockCommitPaste')(p, res, { by: 'Owner', sentBy: 'Supervisor' });
      const st = ev('S').stock;
      return { supplier: p.supplier, lines: p.lines.map((l: any) => [l.name, l.A, l.unit]), made: c.entries,
        recd: st.entries.map((e: any) => [e.itemId, e.kind, e.qty, e.supplier]), pos: st.items.map((i: any) => i.lastPos == null ? null : i.lastPos) };
    }, del);
    expect(saved.supplier).toBe('KESAR CHEM');
    expect(saved.lines).toEqual([['HCL', 600, 'L'], ['NITRIC ACID', 30, 'L']]);
    expect(saved.recd).toEqual([['SI2', 'received', 600, 'KESAR CHEM'], ['SI3', 'received', 30, 'KESAR CHEM']]);
    expect(saved.pos).toEqual([null, null, null]);   // a delivery's order says nothing of a line's place
    const stock = `${d.dmy}, 6:55 pm - Supervisor: CHEMICAL USE CHEMICAL STOCK
${d.dmy}/
04) 106 70 KG USE V A 1 30 KG +V A 2 20 KG= 50 KG 70-50=20 KG AVAILABLE

11) NITRIC ACID ADD 30+22=52-6=46 LTR

15) HCL ADD 600-200=400 LTR`;
    const after = await page.evaluate((t) => {
      const ev = (0, eval);
      const p = ev('parseStockMessage')(t); p.text = t;
      const res = ev('resolveStockParse')(p, {});
      return res.lines.map((r: any) => ({ item: r.item && r.item.id, via: r.via, kinds: r.entries.map((e: any) => e.kind + ':' + e.qty),
        codes: r.issues.map((x: any) => x.level + ':' + x.code) }));
    }, stock);
    expect(after[0]).toMatchObject({ item: 'SI1', via: 'chosen', kinds: ['count:70', 'used:30', 'used:20', 'count:20'] });
    expect(after[0].codes).toContain('amber:readas');
    // The opening was before the delivery on record: the shelf with it in is 22 + 30 = 52, so the counts do not argue.
    expect(after[1].kinds).toEqual(['count:52', 'used:6', 'count:46']);
    expect(after[1].codes).toContain('amber:received-twice');
    expect(after[2].kinds).toEqual(['used:200', 'count:400']);
    expect(after[2].codes).toContain('amber:received-twice');
    const checks = await page.evaluate((t) => {
      const ev = (0, eval);
      // Nitric stood at 34 L before the delivery (the owner's book, 13 Oct): 34 + 30 = 64, counted 52 the same evening.
      ev('S').stock.entries.push({ id: 'SE0', itemId: 'SI3', kind: 'count', qty: 34, date: ev('isoAddDays')(ev('localDateStr')(), -3), at: 1, by: 'Owner' });
      const p = ev('parseStockMessage')(t); p.text = t;
      ev('stockCommitPaste')(p, ev('resolveStockParse')(p, {}), { by: 'Owner', sentBy: 'Supervisor' });
      return ['SI2', 'SI3'].map((id) => Object.values(ev('stockEntryChecks')(id)).flat().map((c: any) => c.k));
    }, stock);
    expect(checks).toEqual([[], []]);   // nothing to check: no count against the level, no delivery missing
  });

  test('the message of 16 Oct: a use told by time of day with no "+", the shelf after a delivery, ACD for acid', async ({ page }) => {
    await load(page);
    // A time of day between two figures inside a use starts the next part: the parts add to the total written, no footing error.
    expect(await line(page, 'BRIGHTNER USE NIGHT 2 LTR DAY 2+3=7 LTR USE 74-7=67 LTR')).toMatchObject({ O: 74, A: null, U: 7, C: 67, codes: [] });
    expect(await line(page, '65 M USE MORNING 2 LTR DAY 3LTR =5 ) 30-5=25 LTR')).toMatchObject({ name: '65 M', O: 30, U: 5, C: 25, codes: [] });
    expect(await line(page, '65 R USE MORNING 1 LTR DAY 2 LTR =3 )24-3=21 LTR')).toMatchObject({ O: 24, U: 3, C: 21, codes: [] });
    expect(await line(page, 'NITRIC ACD USE NIGHT 2 LTR DAY 4 LTR =6 LTR 38-6=32 LTR')).toMatchObject({ O: 38, U: 6, C: 32, codes: [] });
    expect(await line(page, 'A SOLLT USE DAY 4 LTR ) 14-4=10 LTR')).toMatchObject({ O: 14, U: 4, C: 10, codes: [] });
    expect(await line(page, 'HCL USE DAY 200 LTR 400-200=200 LTR')).toMatchObject({ O: 400, U: 200, C: 200, codes: [] });
    // "ADD 5 … =4) 5-4=1": the 5 the use is taken from is the shelf with the delivery in; the opening was before it.
    expect(await line(page, 'Q558 ADD 5 KG USE NIGHT 2 KG DAY 2 KG =4) 5-4=1 KG')).toMatchObject({ name: 'Q558', O: 0, A: 5, U: 4, C: 1, codes: ['amber:withadd'] });
    // A real opening beside a delivery still adds up as before.
    expect(await line(page, 'NITRIC ACID ADD 30+22=52-6=46 LTR')).toMatchObject({ A: 30, O: 22, U: 6, C: 46, codes: [] });
    // ACD is ACID: the line is Nitric Acid, not a new one.
    expect(await g(page, `stockKey('NITRIC ACD')`)).toBe(await g(page, `stockKey('NITRIC ACID')`));
  });
});
