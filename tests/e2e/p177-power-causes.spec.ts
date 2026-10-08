import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P177: why a power cut came and what brought the power back (powercause.js; owner, 8 Oct 2026: "If we enter a power cut and
// save it without giving an out time, there is no option readily available to fill in in time and the reason + solution. For
// reasons and solutions, start remembering them and present them as a list … store them in uniform format, no matter how the
// input text is. Use the intelligence system to tie this to the plant and present it in a visual form."). Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The `n`th working day (Sundays not counted) back from today: a different day for each `n`, so two cuts never land on one. */
function wday(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  for (let k = 0; k < n;) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0) k++; }
  return isoOf(d);
}
/** A cut: open when it has no time back. `dt` adds to its downtime (a reason, a fix, where it hit). */
const cut = (id: string, date: string, time: string, to?: string, dt: any = {}, more: any = {}) => ({ id, kind: 'downtime', date, time, ...(to ? { to } : {}),
  downtime: { cause: 'power', ...(to ? {} : { open: true }), ...dt }, basis: 'relay', src: 'paste', at: 1, ...more });
const reason = (id: string, name: string, scope: string, aliases: string[] = []) => ({ id, kind: 'reason', name, aliases, scope, at: 1, by: 'Owner' });
const fix = (id: string, name: string) => ({ id, kind: 'fix', name, aliases: [], at: 1, by: 'Owner' });
const unit = (id: string, name: string, station: string) => ({ id, name, station, kind: 'rectifier', kgRound: 25, status: 'run', since: wday(60), reason: '', condition: 'fair' });

function book(entries: any[] = [], causes: any[] = [], extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  s.power = { causes };
  return Object.assign(s, extra) as SepState;
}
const dlg = (p: Page) => p.locator('[data-pcs-dialog]');
const stored = async (p: Page) => (await readStoredState(p)) as any;
const entry = (s: any, id: string) => s.production.entries.find((e: any) => e.id === id);

test('a cut saved with no time back is completed where it is shown: the time, why it went and what brought it back, each written one way', async ({ page }) => {
  const d = wday(1);
  await loadAppWithState(page, book([cut('C1', d, '14:10')]));
  await switchTab(page, 'pagePower');
  // Overview leads with what is left to complete.
  await expect(page.locator('#pcsComplete [data-pcs-cut="C1"]')).toContainText('no time back');
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  await page.locator('#pcsComplete [data-pcs-cut="C1"] [data-action="invPcsOpen"]').click();
  await expect(dlg(page)).toBeVisible();
  // The list starts from nothing and says so.
  await expect(dlg(page).locator('[data-pcs-chips="reason"] [data-pcs-empty]')).toBeVisible();
  await dlg(page).locator('#pcsTo').fill('14:45');
  await dlg(page).locator('#pcsReason').fill('TRANSFORMER TRIPPED at jbvnl sub station');
  await expect(dlg(page).locator('[data-pcs-read="reason"] [data-pcs-state="new"]')).toContainText('Transformer tripped at JBVNL substation');
  await dlg(page).locator('[data-action="invPcsScope"][data-scope="grid"]').click();
  await dlg(page).locator('#pcsFix').fill('waited for the supply');
  await expect(dlg(page).locator('[data-pcs-read="fix"] [data-pcs-state="new"]')).toContainText('Waited for the supply');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);

  const s = await stored(page);
  const e = entry(s, 'C1');
  expect(e.to).toBe('14:45');
  expect(e.downtime).toMatchObject({ open: false, closedHow: 'hand', where: 'all' });
  const r = s.power.causes.find((c: any) => c.id === e.downtime.reason), f = s.power.causes.find((c: any) => c.id === e.downtime.fix);
  // One way of writing it, the spelling typed kept beside it.
  expect(r).toMatchObject({ kind: 'reason', name: 'Transformer tripped at JBVNL substation', scope: 'grid', aliases: ['TRANSFORMER TRIPPED at jbvnl sub station'] });
  expect(f).toMatchObject({ kind: 'fix', name: 'Waited for the supply' });
  // Power reads the cut closed, at its own length, with its reason; nothing is left to complete.
  const c = await g(page, `powerCuts().find(function (c) { return c.ids.indexOf('C1') >= 0; })`);
  expect(c).toMatchObject({ open: false, min: 35, reason: r.id, fix: f.id });
  await expect(page.locator('#pcsComplete')).toHaveCount(0);
  expect(await g(page, `TODO_RULE_FNS.powerComplete()`)).toEqual([]);
});

test('the same reason typed another way is read as the one on the list; Keep as new makes another; the chips lead with the most used', async ({ page }) => {
  const R = reason('R1', 'Transformer tripped at JBVNL substation', 'grid'), Q = reason('R2', 'Rectifier breaker trip', 'plant');
  await loadAppWithState(page, book([
    cut('C1', wday(5), '10:00', '10:30', { reason: 'R1', setAt: 1 }), cut('C2', wday(4), '11:00', '11:20', { reason: 'R1', setAt: 1 }),
    cut('C3', wday(3), '12:00', '12:10', { reason: 'R2', setAt: 1 }), cut('C4', wday(2), '15:00'), cut('C5', wday(1), '16:00')], [R, Q]));
  await g(page, `pcsOpen('C4')`);
  // The list as chips, the most used first.
  await expect(dlg(page).locator('[data-pcs-chips="reason"] [data-action="invPcsPick"]')).toHaveText([/Transformer tripped/, /Rectifier breaker trip/]);
  // A typing slip, a word's ending and the words in another order: the one on the list, said, never taken unseen.
  await dlg(page).locator('#pcsReason').fill('transfromer trip at substation');
  await expect(dlg(page).locator('[data-pcs-read="reason"] [data-pcs-state="near"]')).toContainText('Read as Transformer tripped at JBVNL substation');
  await dlg(page).locator('#pcsTo').fill('15:30');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  let s = await stored(page);
  expect(entry(s, 'C4').downtime.reason).toBe('R1');
  expect(s.power.causes.filter((c: any) => c.kind === 'reason')).toHaveLength(2);
  expect(s.power.causes.find((c: any) => c.id === 'R1').aliases).toEqual(['transfromer trip at substation']);

  // The same words in another case are known outright.
  await g(page, `pcsOpen('C5')`);
  await dlg(page).locator('#pcsReason').fill('RECTIFIER BREAKER TRIPPED');
  await expect(dlg(page).locator('[data-pcs-read="reason"] [data-pcs-state="known"]')).toContainText('Saved as Rectifier breaker trip');
  // Fewer words, all of them in a longer one: offered, and kept apart when it is another reason.
  await dlg(page).locator('#pcsReason').fill('tripped transformer');
  await expect(dlg(page).locator('[data-pcs-read="reason"] [data-pcs-state="near"]')).toContainText('Transformer tripped at JBVNL substation');
  await dlg(page).locator('[data-action="invPcsKeepNew"][data-kind="reason"]').click();
  await expect(dlg(page).locator('[data-pcs-read="reason"] [data-pcs-state="new"]')).toContainText('Tripped transformer');
  await dlg(page).locator('[data-action="invPcsScope"][data-scope="plant"]').click();
  await dlg(page).locator('#pcsTo').fill('16:25');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  s = await stored(page);
  const made = s.power.causes.find((c: any) => c.id === entry(s, 'C5').downtime.reason);
  expect(made).toMatchObject({ name: 'Tripped transformer', scope: 'plant' });
  expect(made.id).not.toBe('R1');
});

test('a fix brought back with the reason before leads its chips, and where the reason hit is where the cut is taken to have hit', async ({ page }) => {
  const units = { units: [unit('U1', 'Rectifier 1', 'vat-a1')], log: [] };
  await loadAppWithState(page, book([
    cut('C1', wday(6), '10:00', '10:20', { reason: 'R1', fix: 'F2', unitId: 'U1', where: 'vat-a1', setAt: 1 }),
    cut('C2', wday(5), '10:00', '10:15', { reason: 'R1', fix: 'F2', unitId: 'U1', where: 'vat-a1', setAt: 1 }),
    cut('C3', wday(4), '11:00', '11:40', { reason: 'R2', fix: 'F1', where: 'all', setAt: 1 }),
    cut('C4', wday(4), '14:00', '14:50', { reason: 'R2', fix: 'F1', where: 'all', setAt: 1 }),
    cut('C5', wday(3), '15:00', '15:50', { reason: 'R2', fix: 'F1', where: 'all', setAt: 1 }),
    cut('C6', wday(1), '12:00')],
  [reason('R1', 'Rectifier breaker trip', 'plant'), reason('R2', 'Feeder trip at the substation', 'grid'), fix('F1', 'Waited for the supply'), fix('F2', 'Reset the breaker')],
  { plant: units }));
  await g(page, `pcsOpen('C6')`);
  // With no reason picked the fixes are by use; with the breaker trip, the fix it was brought back by leads.
  await expect(dlg(page).locator('[data-pcs-chips="fix"] [data-action="invPcsPick"]').first()).toContainText('Waited for the supply');
  await expect(dlg(page).locator('#pcsWhere')).toHaveValue('all');
  await dlg(page).locator('[data-pcs-chips="reason"] [data-action="invPcsPick"][data-id="R1"]').click();
  await expect(dlg(page).locator('#pcsReason')).toHaveValue('Rectifier breaker trip');
  await expect(dlg(page).locator('[data-pcs-chips="fix"] [data-action="invPcsPick"]').first()).toContainText('Reset the breaker');
  await expect(dlg(page).locator('#pcsWhere')).toHaveValue('u:U1');
  // A chip pressed again lets it go.
  await dlg(page).locator('[data-pcs-chips="reason"] [data-action="invPcsPick"][data-id="R1"]').click();
  await expect(dlg(page).locator('#pcsReason')).toHaveValue('');
  await dlg(page).locator('[data-pcs-chips="reason"] [data-action="invPcsPick"][data-id="R1"]').click();
  await dlg(page).locator('[data-pcs-chips="fix"] [data-action="invPcsPick"][data-id="F2"]').click();
  await dlg(page).locator('#pcsTo').fill('12:20');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  const s = await stored(page);
  expect(entry(s, 'C6').downtime).toMatchObject({ reason: 'R1', fix: 'F2', unitId: 'U1', where: 'vat-a1' });
});

test('a cause tied to a unit: the unit and its line say so, the To-do asks at three in 30 days and red at five, and its move opens the unit', async ({ page }) => {
  const tied = (id: string, n: number) => cut(id, wday(n), '10:00', '10:20', { reason: 'R1', fix: 'F1', unitId: 'U1', where: 'vat-a1', setAt: 1 });
  await loadAppWithState(page, book([tied('C1', 2), tied('C2', 4), tied('C3', 6), cut('C4', wday(8), '10:00', '10:25', { reason: 'R2', where: 'all', setAt: 1 })],
    [reason('R1', 'Rectifier breaker trip', 'plant'), reason('R2', 'Feeder trip at the substation', 'grid'), fix('F1', 'Reset the breaker')],
    { plant: { units: [unit('U1', 'Rectifier 1', 'vat-a1')], log: [] } }));
  let t: any[] = await g(page, `TODO_RULE_FNS.powerCause()`);
  expect(t).toHaveLength(1);
  expect(t[0]).toMatchObject({ key: 'powerCause:R1', tone: 'amber', unitId: 'U1', reasonId: 'R1' });
  expect(t[0].title).toBe('“Rectifier breaker trip” cut the power 3 times in 30 days');
  expect(t[0].amount).toBeGreaterThan(0);
  expect(await g(page, `todoWorth(TODO_RULE_FNS.powerCause()[0])`)).toBe(t[0].amount);
  // Two more: red.
  await g(page, `(function () { var p = prodData(); [10, 12].forEach(function (n, i) { var d = new Date(localDateStr() + 'T00:00:00'); d.setDate(d.getDate() - n);
    p.entries.push({ id: 'CX' + i, kind: 'downtime', date: isoOf(d), time: '09:00', to: '09:30', downtime: { cause: 'power', reason: 'R1', unitId: 'U1', where: 'vat-a1', setAt: 1 }, basis: 'relay', src: 'paste', at: 1 }); });
    prodTouch(); })()`);
  t = await g(page, `TODO_RULE_FNS.powerCause()`);
  expect(t[0]).toMatchObject({ tone: 'red' });
  // The grid's reason, once in 30 days, raises nothing: the supply is the case's question at five.
  expect(t.filter((x: any) => x.reasonId === 'R2')).toEqual([]);

  // The unit's own record and its line say so.
  await g(page, `prodSetTab('equipment'); _prodView = 'main'; switchTab('pageProduction')`);
  await expect(page.locator('[data-plt-station="vat-a1"] [data-pcs-station="vat-a1"]')).toContainText('5 power cuts hit VAT A1 in 90 days: Rectifier breaker trip');
  // The move goes to the unit.
  const moves: any[] = await g(page, `advTaskMoves(TODO_RULE_FNS.powerCause()[0])`);
  expect(moves[0]).toMatchObject({ say: 'Get “Rectifier breaker trip” checked on Rectifier 1', go: { kind: 'plantUnit', id: 'U1' } });
  await g(page, `closeOverlay(); todoGo(${JSON.stringify(moves[0].go)})`);
  await expect(page.locator('[data-plt-dialog="U1"] [data-pcs-unit]')).toContainText('5 power cuts tied to it in 90 days');
  await expect(page.locator('[data-plt-dialog="U1"] [data-pcs-unit]')).toContainText('Keeps cutting');
});

test('a reason from the grid is a task only at five in 30 days, and its move is the power case', async ({ page }) => {
  const grid = (id: string, n: number) => cut(id, wday(n), '13:00', '13:30', { reason: 'R2', where: 'all', setAt: 1 });
  await loadAppWithState(page, book([grid('C1', 1), grid('C2', 3), grid('C3', 5), grid('C4', 7)], [reason('R2', 'Feeder trip at the substation', 'grid')]));
  expect(await g(page, `TODO_RULE_FNS.powerCause()`)).toEqual([]);
  await g(page, `(function () { var d = new Date(localDateStr() + 'T00:00:00'); d.setDate(d.getDate() - 9);
    prodData().entries.push({ id: 'C5', kind: 'downtime', date: isoOf(d), time: '13:00', to: '13:30', downtime: { cause: 'power', reason: 'R2', where: 'all', setAt: 1 }, basis: 'relay', src: 'paste', at: 1 });
    prodTouch(); })()`);
  const t: any[] = await g(page, `TODO_RULE_FNS.powerCause()`);
  expect(t).toHaveLength(1);
  expect(t[0]).toMatchObject({ tone: 'amber', scope: 'grid' });
  const moves: any[] = await g(page, `advTaskMoves(TODO_RULE_FNS.powerCause()[0])`);
  expect(moves).toHaveLength(1);
  expect(moves[0]).toMatchObject({ go: { kind: 'powerCase' } });
});

test('the To-do asks to complete a recent cut, and its move opens the cut; history imported, a cut long past and one done are never asked', async ({ page }) => {
  await loadAppWithState(page, book([
    cut('C1', wday(1), '09:40'),
    cut('C2', wday(3), '10:00', '10:30'),                                   // closed, no reason, recent: asked for its reason
    cut('C3', wday(20), '10:00', '10:30'),                                  // closed, no reason, past a fortnight: not asked
    cut('C4', wday(40), '10:00'),                                           // no time back, past 30 days: not asked
    cut('C5', wday(2), '11:00', undefined, {}, { src: 'import' })]));       // the imported log: never asked
  const t: any[] = await g(page, `TODO_RULE_FNS.powerComplete()`);
  expect(t).toHaveLength(1);
  expect(t[0]).toMatchObject({ tone: 'amber', cuts: ['C1', 'C2'], go: { kind: 'powerCut', id: 'C1' } });
  expect(t[0].title).toBe('Complete 2 power cuts');
  expect(t[0].sub).toBe('no time back on 1 · no reason on 2');
  // Its moves complete each cut, then the list.
  const moves: any[] = await g(page, `advTaskMoves(TODO_RULE_FNS.powerComplete()[0])`);
  expect(moves.map((m: any) => m.go)).toEqual([{ kind: 'powerCut', id: 'C1' }, { kind: 'powerCut', id: 'C2' }, { kind: 'power', tab: 'cuts' }]);
  await g(page, `todoGo({ kind: 'powerCut', id: 'C1' })`);
  await expect(page.locator('#pagePower')).toHaveClass(/inv-page-active/);
  await expect(page.locator('[data-pcs-dialog="C1"]')).toBeVisible();
  await page.locator('#pcsTo').fill('10:05');
  await page.locator('#pcsReason').fill('Feeder trip');
  await page.locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  // Only the closed one with no reason is left, and it is blue.
  const after: any[] = await g(page, `TODO_RULE_FNS.powerComplete()`);
  expect(after[0]).toMatchObject({ tone: 'info', cuts: ['C2'] });
});

test('a power-in time the register wrote is never typed over; one the record only bounded can be set; nothing changed saves nothing', async ({ page }) => {
  await loadAppWithState(page, book([
    cut('C1', wday(2), '10:55', '11:15', {}, { basis: 'register', src: 'photo' }),
    cut('C2', wday(1), '19:00', '19:16', { atLeast: true })]));
  await g(page, `pcsOpen('C1')`);
  await expect(dlg(page).locator('#pcsTo')).toHaveCount(0);
  await expect(dlg(page).locator('[data-pcs-to-fixed]')).toHaveText('10:55 AM – 11:15 AM');
  await expect(dlg(page)).toContainText('As the register wrote it');
  // Nothing typed: nothing to save, said.
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(page.locator('.inv-toast').last()).toContainText('Nothing to save');
  await expect(dlg(page)).toBeVisible();
  await g(page, `closeOverlay(); pcsOpen('C2')`);
  await expect(dlg(page).locator('#pcsTo')).toBeVisible();
  await dlg(page).locator('#pcsTo').fill('19:40');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  const s = await stored(page);
  expect(entry(s, 'C2').to).toBe('19:40');
  expect(entry(s, 'C2').downtime.atLeast).toBeUndefined();
  expect(entry(s, 'C1').to).toBe('11:15');
});

test('a time back earlier on the clock than the cut is asked about: an overnight cut on Yes, nothing on Cancel', async ({ page }) => {
  await loadAppWithState(page, book([cut('C1', wday(2), '17:45')]));
  await g(page, `pcsOpen('C1')`);
  await dlg(page).locator('#pcsTo').fill('07:30');
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Did the power stay off overnight?');
  expect(entry(await stored(page), 'C1').to).toBeUndefined();
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  expect(await answerAsk(page, 'ok')).toContain('13 h 45 min');
  await expect(dlg(page)).toHaveCount(0);
  expect(await g(page, `(function () { var c = powerCuts().find(function (c) { return c.ids.indexOf('C1') >= 0; }); return [c.overnight, c.min, c.open]; })()`)).toEqual([true, 825, false]);
});

test('Power → Causes draws what causes the cuts by what they cost, where they hit and what brings it back, coded by where each starts', async ({ page }) => {
  const at = (id: string, n: number, from: string, to: string, dt: any) => cut(id, wday(n), from, to, { setAt: 1, ...dt });
  await loadAppWithState(page, book([
    at('C1', 1, '10:00', '10:20', { reason: 'R1', fix: 'F1', where: 'all' }),
    at('C2', 2, '10:00', '10:20', { reason: 'R1', fix: 'F1', where: 'all' }),
    at('C3', 3, '11:00', '12:00', { reason: 'R2', fix: 'F2', where: 'vat-a2' }),
    at('C4', 4, '11:00', '12:00', { reason: 'R2', fix: 'F2', where: 'vat-a2' }),
    at('C5', 5, '11:00', '12:00', { reason: 'R2', fix: 'F2', where: 'vat-a2' }),
    at('C6', 6, '15:00', '15:10', { reason: 'R3' }),
    cut('C7', wday(7), '16:00', '16:30')],
  [reason('R1', 'Feeder trip at the substation', 'grid'), reason('R2', 'Panel MCB trip', 'plant'), reason('R3', 'Loose cable at the meter', ''),
    fix('F1', 'Waited for the supply'), fix('F2', 'Reset the MCB')]));
  await switchTab(page, 'pagePower');
  // The Overview's bars, with the way to Causes.
  await expect(page.locator('#pcsWhy')).toContainText('6 of 7 cuts have a reason');
  await page.locator('#pcsWhy [data-action="invPowerTab"][data-tab="causes"]').click();
  await expect(page.locator('[data-pcs-tiles]')).toContainText('6/7');
  // The causes ranked by what they cost, coded: red in the plant three times in 30 days, blue from the grid, grey not placed.
  const bars = page.locator('#pcsReasons .inv-chart-ranked-row');
  await expect(bars).toHaveCount(3);
  await expect(bars.first()).toContainText('Panel MCB trip');
  await expect(page.locator('#pcsReasons .inv-chart-ranked-fill-danger')).toHaveCount(1);
  await expect(page.locator('#pcsReasons .inv-chart-ranked-fill-info')).toHaveCount(1);
  await expect(page.locator('#pcsReasons .inv-chart-ranked-fill-neutral')).toHaveCount(1);
  await expect(page.locator('#pcsReasons')).toContainText('1 cut with no reason');
  // Where they hit: VAT A2 red (three started in the plant), the whole plant blue (the supply's).
  await expect(page.locator('#pcsPlaces [data-pcs-place="vat-a2"]')).toHaveClass(/inv-tile-danger/);
  await expect(page.locator('#pcsPlaces [data-pcs-place="all"]')).toHaveClass(/inv-tile-info/);
  await expect(page.locator('#pcsPlaces [data-pcs-place="vat-a1"]')).toContainText('no cut tied to it');
  // What brings it back, fastest first.
  await expect(page.locator('#pcsFixes .inv-chart-ranked-row').first()).toContainText('Waited for the supply');
  await expect(page.locator('#pcsFixes .inv-chart-ranked-row').first()).toContainText('back in 20 min');
  // The list itself.
  await expect(page.locator('#pcsList-reason [data-pcs-entry]')).toHaveCount(3);
  await expect(page.locator('#pcsList-fix [data-pcs-entry]')).toHaveCount(2);
});

test('the owner renames a reason and merges one into another: every cut keeps its reason, the spellings go with it, and the change log says so', async ({ page }) => {
  await loadAppWithState(page, book([
    cut('C1', wday(1), '10:00', '10:20', { reason: 'R1', setAt: 1 }), cut('C2', wday(2), '10:00', '10:20', { reason: 'R2', setAt: 1 })],
  [reason('R1', 'Feeder trip at the substation', 'grid'), reason('R2', 'feeder trip', '', ['FEEDER TRIP'])]));
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="causes"]').click();
  await page.locator('#pcsList-reason [data-pcs-entry="R2"] [data-action="invPcsEdit"]').click();
  await page.locator('#pcsEditName').fill('LINE TRIP at feeder');
  await page.locator('[data-action="invPcsEditSave"]').click();
  let s = await stored(page);
  let r2 = s.power.causes.find((c: any) => c.id === 'R2');
  expect(r2.name).toBe('Line trip at feeder');
  expect(r2.aliases).toEqual(['FEEDER TRIP']);   // the old name, the same spelling in another case
  // Merged into the other: it leaves the list, its cut reads the one it joined, and its names are kept there.
  await page.locator('#pcsList-reason [data-pcs-entry="R2"] [data-action="invPcsEdit"]').click();
  await page.locator('#pcsEditMerge').selectOption('R1');
  await page.locator('[data-action="invPcsEditSave"]').click();
  await expect(page.locator('#pcsList-reason [data-pcs-entry]')).toHaveCount(1);
  s = await stored(page);
  r2 = s.power.causes.find((c: any) => c.id === 'R2');
  expect(r2.mergedInto).toBe('R1');
  expect(s.power.causes.find((c: any) => c.id === 'R1').aliases).toEqual(['Line trip at feeder', 'FEEDER TRIP']);
  expect(await g(page, `pcsAnalysis().reasons.map(function (e) { return [e.c.id, e.n]; })`)).toEqual([['R1', 2]]);
  // A name typed as the merged one's is read as the one it joined.
  expect(await g(page, `pcsMatch('feeder trip', 'reason').c.id`)).toBe('R1');
  const log = (s.changeLog || []).filter((e: any) => e.coll === 'power.causes');
  expect(log.length).toBeGreaterThanOrEqual(2);
});

test('Production’s entry carries the door: Complete while open, Edit reason once it has one, and the row says the reason', async ({ page }) => {
  await loadAppWithState(page, book([cut('C1', wday(1), '14:10'), cut('C2', wday(2), '10:00', '10:30', { reason: 'R1', setAt: 1 })],
    [reason('R1', 'Feeder trip at the substation', 'grid')]));
  await g(page, `prodSetTab('entries'); _prodView = 'main'; switchTab('pageProduction')`);
  await expect(page.locator('[data-prod-entry="C1"] [data-action="invPcsOpen"]')).toHaveText('Complete');
  await expect(page.locator('[data-prod-entry="C2"] [data-action="invPcsOpen"]')).toHaveText('Edit reason');
  await expect(page.locator('[data-prod-entry="C2"]')).toContainText('Feeder trip at the substation');
  await page.locator('[data-prod-entry="C1"] [data-action="invPcsOpen"]').click();
  await expect(page.locator('[data-pcs-dialog="C1"]')).toBeVisible();
});

test('a supervisor completes a cut (a floor entry) under their own name; the list is the owner’s to rename and merge', async ({ page }) => {
  await loadAppWithState(page, book([cut('C1', wday(1), '14:10'), cut('C2', wday(2), '10:00', '10:30', { reason: 'R1', setAt: 1 })],
    [reason('R1', 'Feeder trip at the substation', 'grid')]));
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="causes"]').click();
  await expect(page.locator('#pcsList-reason [data-pcs-entry="R1"]')).toBeVisible();
  await expect(page.locator('#pcsList-reason [data-action="invPcsEdit"]')).toHaveCount(0);
  await page.locator('#pcsComplete [data-pcs-cut="C1"] [data-action="invPcsOpen"]').click();
  await dlg(page).locator('#pcsTo').fill('14:30');
  await dlg(page).locator('[data-pcs-chips="reason"] [data-action="invPcsPick"][data-id="R1"]').click();
  await dlg(page).locator('[data-action="invPcsSave"]').click();
  await expect(dlg(page)).toHaveCount(0);
  const s = await stored(page);
  expect(entry(s, 'C1').downtime).toMatchObject({ reason: 'R1', closedBy: 'Birsa Munda', setBy: 'Birsa Munda' });
  // Asked of the list, the answer is no, never a PIN.
  await g(page, `pcsEditOpen('R1')`);
  expect(await answerAsk(page, 'ok')).toContain('renamed and merged by the owner');
});

test('the production export carries the list its cuts name; an import merges it by id, and one written the same way joins the entry here', async ({ page }) => {
  await loadAppWithState(page, book([cut('C1', wday(1), '10:00', '10:20', { reason: 'R1', fix: 'F1', setAt: 1 })],
    [reason('R1', 'Feeder trip at the substation', 'grid'), fix('F1', 'Waited for the supply')]));
  const out: any = await g(page, `(function () { var got = null, was = downloadJson; downloadJson = function (n, o) { got = o; }; try { prodExport(); } finally { downloadJson = was; } return got; })()`);
  expect(out.powerCauses.map((c: any) => c.id)).toEqual(['R1', 'F1']);
  // Another book's file: its cut names its own ids; one reason is written the way this book writes R1, one fix is new.
  const file = { format: 'sep-production', version: 1, entries: [cut('C9', wday(2), '15:00', '15:30', { reason: 'PCS-x1', fix: 'PCS-x2', setAt: 1 })],
    powerCauses: [{ id: 'PCS-x1', kind: 'reason', name: 'FEEDER TRIP AT THE SUB STATION', aliases: [], scope: 'grid', at: 1, by: 'Office' },
      { id: 'PCS-x2', kind: 'fix', name: 'reset the MCB', aliases: ['RESET MCB'], at: 1, by: 'Office' },
      { id: 'not-ours', kind: 'reason', name: 'Anything' }, { id: 'PCS-x3', kind: 'note', name: 'Not a kind' }, { id: 'R1', kind: 'reason', name: 'Written over?' }] };
  const res: any = await g(page, `prodMergeImport(${JSON.stringify(file)}, 'other.json')`);
  expect(res).toMatchObject({ ok: true, added: 1, causes: 2 });
  const list: any[] = await g(page, `S.power.causes`);
  expect(list.find(c => c.id === 'R1').name).toBe('Feeder trip at the substation');
  expect(list.find(c => c.id === 'PCS-x1')).toMatchObject({ mergedInto: 'R1' });
  expect(list.find(c => c.id === 'PCS-x2')).toMatchObject({ kind: 'fix', name: 'Reset the MCB', aliases: ['RESET MCB'] });
  expect(list.some(c => c.id === 'not-ours' || c.id === 'PCS-x3')).toBe(false);
  // Both cuts read the one reason here.
  expect(await g(page, `pcsAnalysis().reasons.map(function (e) { return [e.c.id, e.n]; })`)).toEqual([['R1', 2]]);
});
