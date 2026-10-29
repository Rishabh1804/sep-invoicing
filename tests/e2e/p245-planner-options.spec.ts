import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P245: the planner's options carry their details, acid recovery and the fume extraction are their own, and the plant register's
// units down feed the plan (owner, 28 Oct 2026: "The details under most of the options are missing. Also, under machines and
// infrastructure we already have the machines that are down or need repairing, but we do nothing with that information on
// planner"). Every unit, figure and name here is made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function lastMonths(): string[] {
  const out: string[] = [];
  const d = new Date(); d.setDate(1);
  for (let i = 1; i <= 3; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 10); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-10`); }
  return out;
}
function book(units = true): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] }];
  let n = 0;
  s.invoices = [];
  lastMonths().forEach(date => {
    n++;
    s.invoices.push({ id: 'INV' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed', clientId: 1, clientName: 'DELTA AUTO',
      items: [{ partNumber: 'BRACKET', desc: 'BRACKET', unit: 'KG', qty: 2000, rate: 12, amount: 24000 }], taxableValue: 24000, grandTotal: 28320, createdAt: Date.now() });
  });
  if (units) {
    const u = (id: string, name: string, station: string, kg: number, status: string, extra: any = {}) =>
      Object.assign({ id, name, station, kind: 'tank', kgRound: kg, status, since: todayIso(), reason: status === 'run' ? '' : 'rectifier failed', condition: 'fair', addedOn: todayIso(), at: Date.now() }, extra);
    s.plant = { units: [u('PU-1', 'Tank 1', 'vat-a2', 40, 'run'), u('PU-2', 'Tank 2', 'vat-a2', 40, 'run'), u('PU-3', 'Tank 3', 'vat-a2', 40, 'down', { needs: 'new anode bars' }),
      u('PU-4', 'Tank 4', 'vat-a2', 40, 'down', { gone: true }), u('PU-5', 'Tank 1', 'vat-a1', 30, 'run', { condition: 'needs', needs: 'a heater' }),
      u('PU-6', 'Barrel 1', 'barrel', 50, 'run', { kind: 'barrel' }), u('PU-7', 'Barrel 2', 'barrel', 50, 'run', { kind: 'barrel' }), u('PU-8', 'Barrel 3', 'barrel', 50, 'down', { kind: 'barrel' })], log: [] };
  }
  return s;
}

test.describe('P245 the planner’s options and the units down', () => {
  test('a line plates on the units working today, and a repair brings a unit’s share back', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var B = plnBase(), L = B.lines['vat-a2'];
      var moves = plnUnitMoves().map(function (x) { return [x.id, x.kind, Math.round(x.share * 100)]; });
      var sc = plnScenarioEnsure(); sc.plan = { 'fix:PU-3': 0 };
      _plnPlanned = null;
      var P = plnPlanned();
      return { working: L.units.nAvail + ' of ' + L.units.n, kg: L.kgRound, moves: moves, after: P.months[0].lines['vat-a2'].kgRound };
    })()`);
    // The line's figure is the line as it runs, on two tanks of four: a tank brought back adds half again of it.
    expect(r.working).toBe('2 of 4');
    // Tank 3 is a repair, Tank 4 a sale, VAT A1's tank in need of work an overhaul, Barrel 3 a repair.
    expect(r.moves).toEqual(expect.arrayContaining([['fix:PU-3', 'fix', 50], ['sell:PU-4', 'sell', 0], ['fix:PU-5', 'fix', 0], ['fix:PU-8', 'fix', 50]]));
    expect(r.moves.length).toBe(4);
    expect(r.after).toBeCloseTo(r.kg * 1.5, 6);
  });

  test('a barrel brought back adds what another barrel would, on the same basis', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var B = plnBase(), sc = plnScenarioEnsure();
      sc.plan = { 'fix:PU-8': 0 }; _plnPlanned = null;
      var back = plnPlanned().months[0].lines.barrel.kgRound - B.lines.barrel.kgRound;
      sc.plan = { load50: 0, barrelFix: 0, barrel2: 0 };   // it follows the overhaul, on the bigger load _plnPlanned = null;
      var bought = plnPlanned().months[0].lines.barrel.kgRound - B.lines.barrel.kgRound;
      return { back: back, bought: bought };
    })()`);
    expect(r.back).toBeGreaterThan(0);
    expect(Math.abs(r.back - r.bought)).toBeLessThanOrEqual(0.5);
  });

  test('a move with no cost set is said on the verdict', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `(function () { var sc = plnScenarioEnsure(); sc.plan = { pickHood: 0, 'fix:PU-3': 0 }; saveState(); })()`);
    await switchTab(page, 'pagePlanner');
    await expect(page.locator('#plnVerdict')).toContainText('2 moves with no cost set');
  });

  test('a sale is cash in once its price is set; a unit in need of work may fail until its overhaul', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var p = plnData(); p.cfg.fx = { 'sell:PU-4': { price: 30000 } };
      var sc = plnScenarioEnsure(); sc.plan = { 'sell:PU-4': 2 };
      _plnPlanned = null;
      var P = plnPlanned();
      var T1 = plnTrials();
      sc.plan['fix:PU-5'] = 0; _plnPlanned = null;
      var T2 = plnTrials();
      var ev = function (T) { return T.all.reduce(function (s, x) { return s + x.events.filter(function (e) { return /Tank 1/.test(e[1]); }).length; }, 0); };
      return { capex: P.months[2].capex, before: ev(T1), after: ev(T2) };
    })()`);
    expect(r.capex).toBe(-30000);
    expect(r.before).toBeGreaterThan(0);
    expect(r.after).toBe(0);
  });

  test('a tank or barrel counts on its own station’s line, whatever its “line it stops” field names', async ({ page }) => {
    const s: any = book();
    // Barrel 3 (down) and Barrel 1 name VAT A1 as the line they stop; a rectifier on the power station names VAT A2.
    s.plant.units.find((u: any) => u.id === 'PU-8').line = 'vat-a1';
    s.plant.units.find((u: any) => u.id === 'PU-6').line = 'vat-a1';
    s.plant.units.push({ id: 'PU-9', name: 'Rectifier 1', station: 'power', kind: 'rectifier', line: 'vat-a2', status: 'run', since: todayIso(), condition: 'fair', addedOn: todayIso(), at: Date.now() });
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function () {
      var B = plnBase(), fix = plnUnitMoveOf('fix:PU-8'), sc = plnScenarioEnsure();
      sc.plan = { 'fix:PU-8': 0 }; _plnPlanned = null;
      var P = plnPlanned();
      return { line: fix.line, share: Math.round(fix.share * 100), barrel: P.months[0].lines.barrel.kgRound - B.lines.barrel.kgRound,
        a1: P.months[0].lines['vat-a1'].kgRound - B.lines['vat-a1'].kgRound,
        lines: ['PU-6', 'PU-9'].map(function (id) { return pltLineOf(pltUnitById(id)); }),
        shares: [plnUnitShareOf({ id: 'PU-6', line: 'barrel' }), plnUnitShareOf({ id: 'PU-9', line: 'vat-a2' })] };
    })()`);
    expect(r.line).toBe('barrel');
    expect(r.share).toBe(50);
    expect(r.barrel).toBeGreaterThan(0);
    expect(r.a1).toBe(0);
    // A barrel stops a share of the barrel line; a rectifier stops the whole line its field names.
    expect(r.lines).toEqual(['barrel', 'vat-a2']);
    expect(r.shares).toEqual([0.5, 1]);
  });

  test('HCl used a month is read as Stock reads the line, never from a window a bill opens', async ({ page }) => {
    await loadAppWithState(page, book(false));
    const r: any = await g(page, `(function () {
      var t = localDateStr(), d = function (n) { return isoAddDays(t, -n); }, e = function (id, kind, qty, date) { return { id: id, itemId: 'ST-HCL', kind: kind, qty: qty, date: date, at: Date.now() }; };
      S.stock = { items: [{ id: 'ST-HCL', name: 'HCL', unit: 'L', active: true }], pastes: [],
        entries: [e('E1', 'bill', 2000, d(50)), e('E2', 'used', 100, d(4)), e('E3', 'used', 100, d(3)), e('E4', 'used', 100, d(2))] };
      var h = plnHclMonth(), v = plnInputVals('pickAcid'), rate = stockRate(S.stock.items[0]);
      // With no use recorded, what came in, an estimate.
      S.stock.entries = [e('E5', 'bill', 2000, d(50)), e('E6', 'received', 600, d(20))];
      var h2 = plnHclMonth(), v2 = plnInputVals('pickAcid');
      return { l: h.l, fromRate: Math.round(rate.rate * 26), src: v._src.hclL, l2: h2.l, src2: v2._src.hclL, came: h2.came };
    })()`);
    expect(r.l).toBe(2600);
    expect(r.l).toBe(r.fromRate);
    expect(r.src).toBe('measured');
    expect(r.l2).toBe(Math.round(600 * 30 / 21));
    expect(r.src2).toBe('estimate');
    expect(r.came).toBe(true);
  });

  test('the spent acid’s leg saves nothing until the share recovered is set', async ({ page }) => {
    await loadAppWithState(page, book(false));
    const r: any = await g(page, `(function () {
      var p = plnData(); p.cfg.fx = { pickAcid: { hclL: 1000, acidRs: 2, dispKL: 4, dispLessRs: 500, dispShare: 25 } };
      var sc = plnScenarioEnsure(); sc.plan = { pickAcid: 0 };
      _plnBase = null; _plnPlanned = null;
      var P = plnPlanned(), fx = plnFx('pickAcid');
      return { m: Math.round(P.months[0].margin - P.base[0].margin), save: fx.chemSave + fx.effSave, say: plnSay('pickAcid') };
    })()`);
    expect(r.m).toBe(0);
    expect(r.save).toBe(0);
    expect(r.say).toMatch(/not worked out/);
  });

  test('a unit on standby fails only at a risk typed on it', async ({ page }) => {
    const s: any = book();
    const tank = s.plant.units.find((u: any) => u.id === 'PU-5');
    tank.status = 'standby';
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function () {
      var ev = function (T) { return T.all.reduce(function (n, x) { return n + x.events.filter(function (e) { return /a heater|breaks down/.test(e[1]); }).length; }, 0); };
      var none = ev(plnTrials());
      pltUnitById('PU-5').risk = { p: 0.5, days: 1, cost: 0, say: 'a heater fails' }; _plnBase = null; _plnPlanned = null;
      return { none: none, typed: ev(plnTrials()) };
    })()`);
    expect(r.none).toBe(0);
    expect(r.typed).toBeGreaterThan(0);
  });

  test('pickling’s row names the tanks its assumed rate stands on', async ({ page }) => {
    const s: any = book();
    const p = (id: string, status: string) => ({ id, name: 'Pickling ' + id, station: 'pick', kind: 'tank', status, since: todayIso(), condition: 'fair', addedOn: todayIso(), at: Date.now() });
    s.plant.units.push(p('PU-10', 'run'), p('PU-11', 'run'), p('PU-12', 'down'));
    await loadAppWithState(page, s);
    expect(await g(page, `plnPickSrc(plnBase())`)).toBe('assumed: today’s kilos with a tenth to spare, on the 2 of 3 tanks working');
  });

  test('acid recovery adds nothing until its figures are set, then the acid and the spent acid it saves', async ({ page }) => {
    await loadAppWithState(page, book(false));
    const r: any = await g(page, `(function () {
      var sc = plnScenarioEnsure(); sc.plan = { pickAcid: 0 };
      _plnPlanned = null;
      var a = plnPlanned(), m0 = a.months[0].margin - a.base[0].margin, say0 = plnSay('pickAcid');
      var p = plnData(); p.cfg.fx = { pickAcid: { hclL: 1000, share: 50, acidRs: 2, dispKL: 4, dispLessRs: 500, dispShare: 25, runMo: 300 } };
      _plnBase = null; _plnPlanned = null;
      var b = plnPlanned(), m1 = Math.round(b.months[0].margin - b.base[0].margin), say1 = plnSay('pickAcid');
      // Each leg comes off its own Ledger row: the acid off chemicals, the spent acid (and the running cost) off the effluent row.
      var rows = { chem: Math.round(b.months[0].cost.chem - b.base[0].cost.chem), other: Math.round(b.months[0].cost.other - b.base[0].cost.other) };
      // A bill that is the same whatever is sent: a KL less sent away saves nothing.
      p.cfg.fx.pickAcid.dispLessRs = 0; _plnBase = null; _plnPlanned = null;
      var c = plnPlanned(), say2 = plnSay('pickAcid');
      // A figure typed under the KL's old key and words is not read: the leg is not set.
      p.cfg.fx.pickAcid = { hclL: 1000, share: 50, acidRs: 2, dispKL: 4, dispRs: 500, dispShare: 25, runMo: 300 }; _plnBase = null; _plnPlanned = null;
      var d = plnPlanned();
      return { m0: Math.round(m0), say0: say0, m1: m1, say1: say1, rows: rows, m2: Math.round(c.months[0].margin - c.base[0].margin), say2: say2,
        m3: Math.round(d.months[0].margin - d.base[0].margin), say3: plnSay('pickAcid'), src3: plnInputVals('pickAcid')._src.dispLessRs,
        label: PLN_STATIONS[0].levels.find(function (l) { return l.id === 'pickAcid'; }).inputs.find(function (i) { return i.key === 'dispLessRs'; }).label };
    })()`);
    expect(r.m0).toBe(0);
    expect(r.say0).toMatch(/not worked out/);
    // Half of 1,000 L at ₹2, and a quarter of 4 KL less sent away at ₹500 saved a KL, less ₹300 to run it.
    expect(r.m1).toBe(1000 + 500 - 300);
    expect(r.say1).toBe('500 L of acid a month recovered, 1.0 KL less sent away: ' + await g(page, 'formatInrShort(1500)') + ' a month');
    expect(r.rows).toEqual({ chem: -1000, other: -500 + 300 });
    // The spent acid still goes less, and saves nothing; the sentence says so.
    expect(r.m2).toBe(1000 - 300);
    expect(r.say2).toMatch(/500 L of acid a month recovered, 1\.0 KL less sent away \(saving nothing at the figure set\)/);
    expect(r.m3).toBe(1000 - 300);
    expect(r.say3).toMatch(/1\.0 KL less sent away \(what that saves is not set\)/);
    expect(r.src3).toBe('unset');
    expect(r.label).toBe('What each KL less sent away saves, before GST (nothing while the bill is the same whatever is sent)');
  });

  test('the approved load’s saving is the penalty the bills carry, nothing once it is billed', async ({ page }) => {
    const s: any = book(false);
    const m = lastMonths().map(d => d.slice(0, 7)).reverse();
    s.power = { load: { sanctioned: 25, approved: 50, approvedOn: m[0] + '-05' } };
    s.costBills = m.map((month, i) => ({ id: 'PB' + i, kind: 'power', month, amount: 40000, kvaBilled: 25, penalty: [4000, 6000, 5000][i], at: Date.now() + i }));
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function () {
      var v = plnInputVals('load50'), a = { rs: v.powerSave, src: v._src.powerSave, say: plnSay('load50') };
      S.power.load.approved = 25; var w = plnInputVals('load50');
      return { a: a, billed: [w.powerSave, w._src.powerSave] };
    })()`);
    expect(r.a.rs).toBe(5000);
    expect(r.a.src).toBe('measured');
    expect(r.a.say).toContain('the median of 3 bills');
    expect(r.billed).toEqual([0, 'measured']);
  });

  test('the fume extraction is its own option, and ISO 9001 and CQI-11 need it', async ({ page }) => {
    await loadAppWithState(page, book(false));
    const r: any = await g(page, `(function () {
      var sc = plnScenarioEnsure(); sc.plan = { docs: 0, iso: 0 };
      _plnPlanned = null;
      var a = plnPlanned().ready.iso;
      sc.plan.pickHood = 1; _plnPlanned = null;
      var b = plnPlanned();
      return { without: a, withIt: b.ready.iso, run: Math.round(b.months[3].cost.other - b.base[3].cost.other) };
    })()`);
    expect(r.without).toBeNull();
    expect(r.withIt).toBeGreaterThan(0);
    expect(r.run).toBe(4000);
  });

  test('every option folds open to what it needs and what its figures rest on; Set figures saves them', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="moves"]').click();
    await page.locator('#pagePlanner [data-action="invPlnMoves"][data-k="plant"]').click();
    // Every Plant option and every repair has its details.
    const levels = await page.locator('[data-pl-level]').count();
    expect(levels).toBeGreaterThan(10);
    expect(await page.locator('[data-pl-level] [data-pl-detail]').count()).toBe(levels);
    await expect(page.locator('#plnRepairs [data-pl-unit]')).toHaveCount(4);
    const lines = page.locator('[data-pl-line="vat-a2"]');
    await expect(lines).toContainText('2 of 4 units working');
    const acid = page.locator('[data-pl-level="pickAcid"]');
    await acid.locator(':scope > summary').click();
    await expect(acid.locator('[data-pl-detail]')).toContainText('What it needs');
    await expect(acid.locator('[data-pl-detail]')).toContainText('not set');
    await acid.locator('[data-action="invPlnFig"]').click();
    await page.locator('#plnFig_1').fill('40');
    await page.locator('[data-action="invPlnFigSave"]').click();
    await expect(page.locator('[data-pl-level="pickAcid"]')).toContainText('recovered');
    const stored = await readStoredState(page);
    expect(stored.planner.cfg.fx.pickAcid.share).toBe(40);
  });

  test('a 0 typed in Set figures is the owner’s figure: the spent acid’s leg saves nothing and the acid recovered still does', async ({ page }) => {
    await loadAppWithState(page, book(false));
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="moves"]').click();
    await page.locator('#pagePlanner [data-action="invPlnMoves"][data-k="plant"]').click();
    const acid = page.locator('[data-pl-level="pickAcid"]');
    await acid.locator(':scope > summary').click();
    await acid.locator('[data-action="invPlnFig"]').click();
    const keys = await g(page, `PLN_STATIONS[0].levels.find(function (l) { return l.id === 'pickAcid'; }).inputs.map(function (i) { return i.key; })`) as string[];
    const typed: Record<string, string> = { hclL: '1000', share: '50', acidRs: '2', dispKL: '4', dispLessRs: '0', dispShare: '25', runMo: '300' };
    expect(keys.slice().sort()).toEqual(Object.keys(typed).sort());
    for (let i = 0; i < keys.length; i++) await page.locator('#plnFig_' + i).fill(typed[keys[i]]);
    await page.locator('[data-action="invPlnFigSave"]').click();
    expect((await readStoredState(page)).planner.cfg.fx.pickAcid.dispLessRs).toBe(0);
    const r: any = await g(page, `(function () {
      var sc = plnScenarioEnsure(); sc.plan = { pickAcid: 0 }; _plnPlanned = null;
      var v = plnInputVals('pickAcid'), P = plnPlanned();
      return { src: v._src.dispLessRs, m: Math.round(P.months[0].margin - P.base[0].margin), say: plnSay('pickAcid') };
    })()`);
    expect(r.src).toBe('set');
    // Half of 1,000 L at ₹2 recovered, less ₹300 to run it: the spent acid's leg adds nothing at the 0 typed.
    expect(r.m).toBe(1000 - 300);
    expect(r.say).toMatch(/1\.0 KL less sent away \(saving nothing at the figure set\)/);
  });
});
