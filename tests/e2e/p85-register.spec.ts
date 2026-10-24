import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P85, the register half: a page of the VAT register read from its rows as written (the clerk types them on Mine; they came
// from photos read by Gemini until the photo reading came out, owner, 13 Oct 2026), the START and END rules, figures added up
// as written, the power log read as cuts, and a cut reported twice counted once.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
function dmy(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

async function boot(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState);
  await switchTab(page, 'pageProduction');
}

test.describe('P85: the register page, read', () => {

  // The real register (photos of 24–26 Sep 2026) has two page shapes and a power log. Made-up clients, the same shapes.
  const read = (page: Page, json: unknown, photoDate: string | null = null) => page.evaluate(({ json, photoDate }) => {
    const ev = (0, eval);
    const rd = ev('prodFromRegisterRead')(json, ev('prodCtx()'), photoDate, {});
    return { page: rd.page, style: rd.style, date: rd.date, runs: rd.runs.map((e: any) => [e.clientId, e.part, e.qty, e.time, e.to]), down: rd.downtime.map((d: any) => [d.date, d.time, d.to, d.open]),
      issues: rd.issues.map((x: any) => x.tone + ':' + x.code), rowIssues: rd.rows.map((r: any) => r.issues.map((x: any) => x.code)), rows: rd.rows.length,
      rounds: rd.runs.map((e: any) => e.rounds) };
  }, { json, photoDate });

  test('a rounds page: figures added up as written, START a round, a blank ditto row not a row', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '9:30 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '9:45 AM', ditto: true, qtyText: '72' },
      { time: '10:00 AM', ditto: true, qtyText: '72+10' },
      { time: '3:00 PM', ditto: true, qtyText: '7+93' },
      { time: '3:15 PM', ditto: true, part: 'LINER', qtyText: '87' },
      { ditto: true }] });
    expect(r.style).toBe('rounds');
    expect(r.rows).toBe(5);                             // the trailing ditto-only row is not read as a round
    expect(r.runs).toEqual([[11, 'CLAMP', 72 + 72 + 82 + 100, '09:30', '15:00'], [11, 'LINER', 87, '15:15', '15:15']]);
    expect(r.rowIssues[0]).toEqual(['start']);
    expect(r.rowIssues.flat()).not.toContain('illegible');
  });

  test('a START / END page: the END carries the batch, a START is never a round of its own', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), weekday: null, line: 'VAT-A2', rows: [
      { time: '9:20 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '3:00 PM', mark: 'END', ditto: true, qtyText: '98×8+1' },
      { time: '4:00 PM', mark: 'END', ditto: true, qtyText: '120x3' },
      { time: '4:00 PM', mark: 'START', customer: 'DURGA AUTO', part: 'TINA(0760)' },
      { time: '4:45 PM', mark: 'END', ditto: true, qtyText: '50+52+30' },
      { time: '4:50 PM', mark: 'END', ditto: true, qtyText: '7 boxes' }] });
    expect(r.style).toBe('startend');
    // 98 × 8 + 1 = 785 and 120 × 3 = 360: not doubled by the START (the first build read 1,930 here).
    expect(r.runs.map((x: any) => [x[0], x[2], x[3], x[4]])).toEqual([[11, 1145, '09:20', '16:00'], [12, 132, '16:00', '16:50']]);
    expect(r.rounds[0]).toEqual([{ time: '3:00 PM', qty: 785, batch: true, written: '98×8+1', rack: 98, n: 8 }, { time: '4:00 PM', qty: 360, batch: true, written: '120x3', rack: 120, n: 3 }]);
    expect(r.rowIssues[5]).toContain('figure');         // "7 boxes" is not a figure it can add up: said, never guessed
  });

  test('a run opening on an END starts where the batch before it ended; with none before it, not known', async ({ page }) => {
    await boot(page);
    // The shape of VAT A2's page of 9 Oct 2026, in made-up names: the second batch is written with its END and no START.
    const r = await read(page, { page: 'production', date: dmy(0), weekday: null, line: 'VAT-A2', rows: [
      { time: '9:15 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '10:30 AM', mark: 'END', ditto: true, qtyText: '2×156+46' },
      { time: '11:45 AM', mark: 'END', customer: 'DURGA AUTO', part: 'TINA(0760)', qtyText: '2×120+10' },
      { time: '11:45 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'SLOT' },
      { time: '2:40 PM', mark: 'END', ditto: true, qtyText: '4×120' }] });
    // It read 11:45 to 11:45, a batch that took no time, while the review said it began where the batch before it ended.
    expect(r.runs.map((x: any) => [x[0], x[2], x[3], x[4]])).toEqual([[11, 358, '09:15', '10:30'], [12, 250, '10:30', '11:45'], [11, 480, '11:45', '14:40']]);
    expect(r.rowIssues[2]).toContain('nostart');
    // With no batch ending above it on the page, when it began is not known, and the review says so in amber.
    const alone = await page.evaluate((json) => {
      const ev = (0, eval), rd = ev('prodFromRegisterRead')(json, ev('prodCtx()'), null, {});
      return { run: [rd.runs[0].time, rd.runs[0].to], tones: rd.rows[0].issues.filter((x: any) => x.code === 'nostart').map((x: any) => x.tone) };
    }, { page: 'production', date: dmy(0), line: 'VAT-A2', rows: [{ time: '10:30 AM', mark: 'END', customer: 'DURGA AUTO', part: 'TINA(0760)', qtyText: '250' }] });
    expect(alone).toEqual({ run: ['10:30', '10:30'], tones: ['amber'] });
    // One START, two batches of different gauges by the owner's rules: two runs, and the second began as the first ended
    // (the owner's 24 Sep page read the 120s as 4:00 to 4:00).
    await page.evaluate(() => (0, eval)('prodData()').gaugeRules.push(
      { id: 'GR-t1', clientId: 11, family: 'CLAMP', racks: [98], gauges: ['25X6', '30X6'] },
      { id: 'GR-t2', clientId: 11, family: 'CLAMP', racks: [120], gauges: ['35X6', '40X6'] }));
    const split = await read(page, { page: 'production', date: dmy(0), line: 'VAT-A2', rows: [
      { time: '9:20 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '3:00 PM', mark: 'END', ditto: true, qtyText: '98×8+1' },
      { time: '4:00 PM', mark: 'END', ditto: true, qtyText: '120x3' }] });
    expect(split.runs.map((x: any) => [x[0], x[2], x[3], x[4]])).toEqual([[11, 785, '09:20', '15:00'], [11, 360, '15:00', '16:00']]);
    expect(split.rowIssues.flat()).not.toContain('nostart');   // its START is written: nothing to ask
  });

  test('a run saved starting at its own END is put right at start-up from the END before it on its page, once', async ({ page }) => {
    const day = todayIso();
    const run = (id: string, from: Record<string, string>, clientId: number, part: string, qty: number, time: string, to: string, rows: string[], extra: Record<string, unknown> = {}) =>
      ({ id, kind: 'plated', date: day, line: 'vat-a2', basis: 'register', ...from, clientId, client: clientId === 11 ? 'NOVA CLAMPS' : 'DURGA AUTO', part, qty, unit: 'NOS',
        time, to, slot: 'general', raw: rows.join('\n'),
        rounds: rows.filter(x => / · END$/.test(x)).map(x => ({ time: x.split(' · ')[0], qty, batch: true })), ...extra });
    const P1 = { src: 'photo', photoId: 'PF-1' }, P2 = { src: 'photo', photoId: 'PF-2' }, P3 = { src: 'photo', photoId: 'PF-3' }, P4 = { src: 'photo', photoId: 'PF-4' }, I1 = { src: 'import', importId: 'PI-1' };
    const entries = [
      run('PE-a', P1, 11, 'CLAMP', 358, '09:15', '10:30', ['9:15 AM · NOVA CLAMPS · CLAMP · START', '10:30 AM · NOVA CLAMPS · CLAMP · 2×156+46 · END']),
      run('PE-b', P1, 12, 'TINA(0760)', 250, '11:45', '11:45', ['11:45 AM · DURGA AUTO · TINA(0760) · 2×120+10 · END']),     // no START written
      run('PE-c', P1, 11, 'SLOT', 480, '11:45', '14:40', ['11:45 AM · NOVA CLAMPS · SLOT · START', '2:40 PM · NOVA CLAMPS · SLOT · 4×120 · END']),
      run('PE-e', { src: 'hand' }, 11, 'CLAMP', 40, '15:00', '15:00', ['3:00 PM · NOVA CLAMPS · CLAMP · 40 · END']),        // typed: the owner's time
      // A file built by the reader, the owner's 24 Sep shape: the 120s split from the 98s' run by their gauge. Written without AM or PM.
      run('PE-f', I1, 11, 'CLAMP', 785, '09:20', '15:00', ['9:20 · NOVA CLAMPS · CLAMP · START', '3:00 · NOVA CLAMPS · CLAMP · 98×8+1 · END']),
      run('PE-g', I1, 11, 'CLAMP', 360, '16:00', '16:00', ['4:00 · NOVA CLAMPS · CLAMP · 120×3 · END']),
      run('PE-h', I1, 12, 'TINA', 115, '16:00', '16:45', ['4:00 · DURGA AUTO · TINA · START', '4:45 · DURGA AUTO · TINA · 2×56+3 · END']),
      run('PE-d', P2, 12, 'TINA(0760)', 90, '12:00', '12:00', ['12:00 PM · DURGA AUTO · TINA(0760) · 90 · END']),           // nothing before it on its page
      run('PE-i', P3, 11, 'CLAMP', 100, '09:00', '10:00', ['9:00 AM · NOVA CLAMPS · CLAMP · START', '10:00 AM · NOVA CLAMPS · CLAMP · 100 · END']),
      run('PE-j', P3, 12, 'TINA', 50, '10:00', '10:30', ['10:30 AM · DURGA AUTO · TINA · 50 · END']),                        // read by the fixed reader
      // "12:45 AM" between 11:30 and 1:05 is noon, as the reader took it.
      run('PE-k', P4, 11, 'CLAMP', 100, '11:30', '12:45', ['11:30 AM · NOVA CLAMPS · CLAMP · START', '12:45 AM · NOVA CLAMPS · CLAMP · 100 · END']),
      run('PE-l', P4, 12, 'TINA', 60, '13:05', '13:05', ['1:05 PM · DURGA AUTO · TINA · 60 · END']),
    ];
    await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(),
      production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } } as SepState);
    const stored = async () => Object.fromEntries(((await readStoredState(page)).production.entries as any[]).map(e => [e.id, [e.time, e.to, e.startWas || '']]));
    const want = { 'PE-a': ['09:15', '10:30', ''], 'PE-b': ['10:30', '11:45', '11:45'], 'PE-c': ['11:45', '14:40', ''], 'PE-e': ['15:00', '15:00', ''],
      'PE-f': ['09:20', '15:00', ''], 'PE-g': ['15:00', '16:00', '16:00'], 'PE-h': ['16:00', '16:45', ''], 'PE-d': ['12:00', '12:00', ''],
      'PE-i': ['09:00', '10:00', ''], 'PE-j': ['10:00', '10:30', ''], 'PE-k': ['11:30', '12:45', ''], 'PE-l': ['12:45', '13:05', '13:05'] };
    await expect.poll(stored).toEqual(want);
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    expect(await stored()).toEqual(want);
  });

  test('the power log is read as cuts; a sheet that is not the register is refused; a day name checks the date', async ({ page }) => {
    await boot(page);
    const d = dmy(0);
    const power = await read(page, { page: 'power', rows: [
      { date: d, event: 'Power cut', time: '11:16 AM' }, { date: d, event: 'Power in', time: '11:21 AM' },
      { date: d, event: 'Power cut', time: '11:26 AM' }, { date: d, event: 'Power in', time: '12:00 PM' },
      { date: d, event: 'Power cut', time: '3:45 PM' }] });
    expect(power.page).toBe('power');
    expect(power.date).toBe(todayIso());
    expect(power.down).toEqual([[todayIso(), '11:16', '11:21', false], [todayIso(), '11:26', '12:00', false], [todayIso(), '15:45', null, true]]);
    const other = await read(page, { page: 'other', rows: [{ customer: 'Worker one', qtyText: '40' }] });
    expect(other.issues).toEqual(['red:page']);
    expect(other.runs).toEqual([]);
    const wrongDay = new Date(todayIso() + 'T00:00:00'); wrongDay.setDate(wrongDay.getDate() + 1);
    const named = await read(page, { page: 'production', date: d, weekday: wrongDay.toLocaleDateString('en-GB', { weekday: 'long' }), line: 'VAT-A1', rows: [{ time: '9:45 AM', customer: 'NOVA CLAMPS', part: 'CLAMP', qtyText: '72' }] });
    expect(named.issues).toContain('amber:weekday');
  });

  test('the power log\'s cuts and the pickling messages\' report of the same cut are counted once', async ({ page }) => {
    await boot(page);
    const d = dmy(0), iso = todayIso();
    const rd = await read(page, { page: 'power', rows: [
      { date: d, event: 'Power cut', time: '11:16 AM' }, { date: d, event: 'Power in', time: '11:21 AM' },
      { date: d, event: 'Power cut', time: '11:26 AM' }, { date: d, event: 'Power in', time: '12:00 PM' }] });
    expect(rd.down).toEqual([[iso, '11:16', '11:21', false], [iso, '11:26', '12:00', false]]);
    // The register's two cuts, saved as the clerk's page saves its power log (one log, `logId`), beside the pickling hand's
    // report of the first.
    await page.evaluate((iso) => { const ev = (0, eval);
      ev('S.production.entries.push({ id: "PM1", kind: "downtime", date: "' + iso + '", time: "11:18", to: "11:22", downtime: { cause: "power" }, basis: "pickling", src: "paste", pasteId: "PP1", at: 1 },' +
        '{ id: "PR1", kind: "downtime", date: "' + iso + '", time: "11:16", to: "11:21", downtime: { cause: "power" }, basis: "register", src: "face", logId: "PL1", at: 2 },' +
        '{ id: "PR2", kind: "downtime", date: "' + iso + '", time: "11:26", to: "12:00", downtime: { cause: "power" }, basis: "register", src: "face", logId: "PL1", at: 3 }); prodTouch()'); }, iso);
    // The day: 11:16–11:22 once (two reports), 11:26–12:00 its own cut though it began ten minutes after the first.
    const day = await page.evaluate((iso) => (0, eval)('prodDowntimeDay("' + iso + '")').map((x: any) => [x.time, x.to, x.min, x.reports]), iso);
    expect(day).toEqual([['11:16', '11:22', 6, 2], ['11:26', '12:00', 34, 1]]);
  });

  test('more of the register as it is kept: VAT-2, racks counted in two goes, 12:45 AM at noon, a figure where the part goes', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), line: 'VAT-2', rows: [
      { time: '11:45 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '4:00 PM', mark: 'END', ditto: true, qtyText: '3+4×156' },
      { time: '4:10 PM', mark: 'END', customer: 'DURGA AUTO', part: 'TINA', qtyText: '25 NOS' },
      { time: '4:20 PM', mark: 'START', ditto: true, part: 'ROD' },
      { time: '4:45 PM', mark: 'END', ditto: true, qtyText: '+16×3' }] });
    expect(r.runs.map((x: any) => [x[0], x[2]])).toEqual([[11, 1092], [12, 25], [12, 48]]);
    expect(r.rowIssues[1]).toContain('grouped');       // said: 7 racks of 156, where plain arithmetic reads 627
    const rounds = await read(page, { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '11:30 AM', customer: 'NOVA CLAMPS', part: 'CLAMP', qtyText: '100' }, { time: '12:45 AM', ditto: true, qtyText: '100' }, { time: '1:05 PM', ditto: true, qtyText: '100' }] });
    expect(rounds.runs[0]).toEqual([11, 'CLAMP', 300, '11:30', '13:05']);
    expect(rounds.rowIssues[1]).toContain('meridiem');
    const power = await read(page, { page: 'power', rows: [{ date: dmy(0), event: 'Power cut', time: '12:05 AM' }, { date: dmy(0), event: 'Power in', time: '1:00 PM' }] });
    expect(power.down).toEqual([[todayIso(), '12:05', '13:00', false]]);
    expect(power.issues).toContain('amber:meridiem');
  });
});
