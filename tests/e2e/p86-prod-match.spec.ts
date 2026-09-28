import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, type SepState } from './fixtures';

// P86: what the production record works out for itself, derived on read and never stored. Which plated figure
// measures a line; the usual line of a part (learnt only from lines written or set); which plating a pickled load
// became; the rack sizes a line runs; the kilograms of a counted part. Made-up clients and parts, fixed past dates
// (the logic is calendar arithmetic, not "today").

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '',
    pieceWeights: [{ partNumber: 'CLAMP 165X83', gauge: '40X6', kgPerPiece: 0.25, effectiveFrom: '2026-01-01' }] },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
let seq = 0;
const E = (o: any) => ({ id: 'E' + (++seq), at: 1, src: 'paste', ...o });
const plated = (date: string, line: string, part: string, qty: number, o: any = {}) =>
  E({ kind: 'plated', date, line, lineSrc: 'written', slot: 'general', clientId: 11, part, gauge: '40X6', qty, unit: 'NOS', basis: 'register', src: 'photo', ...o });
const pickled = (date: string, time: string, part: string, qty: number | null, o: any = {}) =>
  E({ kind: 'pickled', date, time, clientId: 11, part, gauge: '40X6', qty, unit: qty == null ? null : 'NOS', basis: 'pickling', ...o });

async function load(page: Page, entries: any[], extra: any = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), ...extra,
    production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } } as SepState);
}
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

test.describe('P86: matching and learning', () => {
  test('one key for a floor line and a challan line', async ({ page }) => {
    await load(page, []);
    const r = await g(page, `[
      prodKey(11, 'CLAMP 165X83(40X6)', '40X6') === prodChallanKey({ clientId: 11 }, { partNumber: 'CLAMP165×83 (40×6)', desc: '' }),
      prodKey(11, 'CLAMP 165X83 (40X6)', '40X6') === prodKey(11, 'CLAMP 165X83 (35X6)', '35X6'),
      prodFamilyKey(11, 'CLAMP(40X6)', '40X6') === prodFamilyKey(11, 'CLAMP 165X83 (40X6)', '40X6'),
      prodIsGeneric('CLAMP(40X6)'), prodIsGeneric('BOX CLAMP'), prodIsGeneric('0140'), prodIsGeneric('CLAMP 165X83(40X6)')
    ]`);
    expect(r).toEqual([true, false, true, true, true, false, false]);
  });

  test('a line\'s figure: register over relay, hand fills a gap, a correction takes its place, the barrel list over its OT blocks', async ({ page }) => {
    seq = 0;
    const d = '2026-09-15', d2 = '2026-09-16';
    await load(page, [
      plated(d, 'vat-a1', 'CLAMP 165X83', 400),                                                   // E1 register
      plated(d, 'vat-a1', 'CLAMP 165X83', 380, { basis: 'relay', src: 'paste' }),                 // E2 relay: also reported
      plated(d, 'vat-a1', 'CLAMP 165X83', 999, { basis: 'hand', src: 'hand' }),                   // E3 standalone hand: also reported
      plated(d, 'vat-a2', 'CLAMP 165X83', 300, { basis: 'hand', src: 'hand' }),                   // E4 hand, nothing else on A2: counted
      plated(d2, 'vat-a1', 'CLAMP 165X83', 500),                                                  // E5 register
      { ...plated(d2, 'vat-a1', 'CLAMP 165X83', 450, { basis: 'hand', src: 'hand' }), replaces: 'E5' }, // E6 corrects E5
      plated(d, 'barrel', 'CLAMP 165X83', 900, { slot: 'day', basis: 'relay', src: 'paste' }),   // E7 the day's barrel list
      plated(d, 'barrel', 'CLAMP 165X83', 120, { slot: 'ot', basis: 'relay', src: 'paste' }),    // E8 an OT block that day
      plated(d2, 'barrel', 'CLAMP 165X83', 150, { slot: 'ot', basis: 'relay', src: 'paste' }),   // E9 an OT block, no list
      { ...plated(d2, 'vat-a2', 'CLAMP 165X83', 10), voidedAt: 5, voidReason: 'x' },              // E10 void
    ]);
    const r = await g(page, `(function(){ var i = prodIndex(); return { counted: i.counted.map(function(e){return e.id;}).sort(), also: i.also.map(function(e){return e.id;}).sort() }; })()`);
    expect(r.counted).toEqual(['E1', 'E4', 'E6', 'E7', 'E9'].sort());
    expect(r.also).toEqual(['E2', 'E3', 'E8'].sort());
  });

  test('the usual line: five days at 80%, only from lines written or set', async ({ page }) => {
    seq = 0;
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
    const entries = [
      ...days.slice(0, 5).map(d => plated(d, 'vat-a1', 'CLAMP 165X83', 400)),
      plated(days[5], 'vat-a2', 'CLAMP 165X83', 400),
      // A line the app inferred never teaches the pattern: no lineSrc.
      ...days.map(d => plated(d, 'vat-a2', 'CLAMP 133X83', 200, { lineSrc: null })),
      ...days.slice(0, 4).map(d => plated(d, 'barrel', 'CLAMP 105X83', 100)),
    ];
    await load(page, entries);
    const r = await g(page, `[prodUsualLine(prodKey(11, 'CLAMP 165X83', '40X6')), prodUsualLine(prodKey(11, 'CLAMP 133X83', '40X6')), prodUsualLine(prodKey(11, 'CLAMP 105X83', '40X6'))]`);
    expect(r[0]).toMatchObject({ line: 'vat-a1', days: 5, total: 6, kind: 'usual' });
    expect(r[1]).toBeNull();
    expect(r[2]).toMatchObject({ line: 'barrel', days: 4, kind: 'mostly' });
  });

  test('a pickled load and the plating it became', async ({ page }) => {
    seq = 0;
    // Fri 11 Sep and Sat 12 Sep, then Mon 14 Sep.
    await load(page, [
      pickled('2026-09-11', '10:00', 'CLAMP 165X83', 600),                                        // E1
      plated('2026-09-11', 'vat-a1', 'CLAMP 165X83', 200, { time: '09:00' }),                      // E2 before the load: not it
      plated('2026-09-11', 'vat-a1', 'CLAMP 165X83', 400, { time: '11:30' }),                      // E3
      plated('2026-09-12', 'vat-a2', 'CLAMP 165X83', 200, { time: '09:40' }),                      // E4 next working day, before noon
      plated('2026-09-12', 'vat-a2', 'CLAMP 165X83', 999, { time: '14:00' }),                      // E5 the quantity is reached
      pickled('2026-09-12', '15:00', 'CLAMP(40X6)', null),                                         // E6 family only, no quantity
      plated('2026-09-14', 'vat-a1', 'CLAMP 133X83', 300, { time: '10:00' }),                      // E7 Monday before noon, family match
      pickled('2026-09-14', '08:00', 'CLAMP 105X83', 100, { set: { matchIds: ['E2'] } }),          // E8 the owner's own answer
      pickled('2026-09-14', '09:00', 'CLAMP 90X81', 100),                                          // E9 no plating: unknown
    ]);
    const r = await g(page, `(function(){ var m = prodIndex().match; return { a: m.E1, f: m.E6, s: m.E8, n: m.E9,
      la: prodLoadLine(prodIndex().byId.E1), lf: prodLoadLine(prodIndex().byId.E6), ln: prodLoadLine(prodIndex().byId.E9) }; })()`);
    expect(r.a).toMatchObject({ ids: ['E3', 'E4'], split: true, line: null, qty: 600 });
    expect(r.la).toMatchObject({ how: 'split', lines: ['vat-a1', 'vat-a2'] });
    expect(r.f).toMatchObject({ ids: ['E7'], line: 'vat-a1', qty: null });
    expect(r.lf).toMatchObject({ line: 'vat-a1', how: 'plating' });
    expect(r.s).toMatchObject({ ids: ['E2'], set: true });
    expect(r.n).toMatchObject({ ids: [], line: null });
    expect(r.ln).toMatchObject({ line: null, how: 'unknown', hint: null });
    // Nothing inferred is written back.
    const stored = await g(page, `S.production.entries.filter(function(e){ return e.kind === 'pickled'; }).map(function(e){ return e.line || null; })`);
    expect(stored).toEqual([null, null, null, null]);
  });

  test('an unknown load carries its part\'s usual line as a hint, and using it sets the line', async ({ page }) => {
    seq = 0;
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];
    await load(page, [...days.map(d => plated(d, 'vat-a2', 'CLAMP 165X83', 400, { time: '09:00' })), pickled('2026-09-15', '16:00', 'CLAMP 165X83', 200)]);
    const hint = await g(page, `prodLoadLine(prodIndex().byId.E6)`);
    expect(hint).toMatchObject({ how: 'unknown', hint: { line: 'vat-a2', kind: 'usual' } });
    await g(page, `prodUseLine('E6', 'vat-a2')`);
    const e = await g(page, `S.production.entries.find(function(e){ return e.id === 'E6'; })`);
    expect(e).toMatchObject({ line: 'vat-a2', lineSrc: 'set' });
  });

  test('rack sizes: an unseen one is checked, a half rack on A2 only said', async ({ page }) => {
    seq = 0;
    const rounds = (n: number, q: number) => Array.from({ length: n }, () => ({ qty: q }));
    await load(page, [plated('2026-09-10', 'vat-a2', 'CLAMP 165X83', 432, { rounds: rounds(4, 108) })]);
    const r = await page.evaluate(() => {
      const ev = (0, eval);
      const json = { date: '15/09/26', line: 'VAT A2', rows: [
        { time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qty: 108 },
        { time: '10:10', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qty: 54 },
        { time: '11:00', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qty: 180 }] };
      const rd = ev('prodRackCheck')(ev('prodFromRegisterRead')(json, ev('prodCtx()'), '2026-09-15', {}), 'vat-a2');
      const a1 = ev('prodRackCheck')(ev('prodFromRegisterRead')(json, ev('prodCtx()'), '2026-09-15', {}), 'vat-a1');
      return { a2: rd.rows.map((x: any) => x.issues.map((i: any) => i.tone + ':' + i.code)), a1: a1.rows.map((x: any) => x.issues.length) };
    });
    expect(r.a2).toEqual([[], ['info:halfrack'], ['amber:rack']]);
    expect(r.a1).toEqual([0, 0, 0]);   // nothing on record for A1: nothing to check against
  });

  test('kilograms: kg as written, else the client\'s card, else unknown, never 0', async ({ page }) => {
    await load(page, []);
    const r = await g(page, `[
      prodKg({ unit: 'KG', qty: 45 }),
      prodKg({ unit: 'NOS', qty: 400, clientId: 11, date: '2026-09-15', part: 'CLAMP 165X83', gauge: '40X6' }),
      prodKg({ unit: 'NOS', qty: 400, clientId: 11, date: '2026-09-15', part: 'CLAMP 90X81', gauge: '40X6' }),
      prodKg({ unit: 'NOS', qty: null, clientId: 11, part: 'CLAMP 165X83' })
    ]`);
    expect(r[0]).toEqual({ kg: 45, src: 'kg' });
    expect(r[1]).toEqual({ kg: 100, src: 'client card' });
    expect(r[2]).toEqual({ kg: null, src: null });
    expect(r[3]).toEqual({ kg: null, src: null });
  });
});
