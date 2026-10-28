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

  test('acid recovery adds nothing until its figures are set, then the acid and the spent acid it saves', async ({ page }) => {
    await loadAppWithState(page, book(false));
    const r: any = await g(page, `(function () {
      var sc = plnScenarioEnsure(); sc.plan = { pickAcid: 0 };
      _plnPlanned = null;
      var a = plnPlanned(), m0 = a.months[0].margin - a.base[0].margin, say0 = plnSay('pickAcid');
      var p = plnData(); p.cfg.fx = { pickAcid: { hclL: 1000, share: 50, acidRs: 2, dispKL: 4, dispRs: 500, dispShare: 25, runMo: 300 } };
      _plnBase = null; _plnPlanned = null;
      var b = plnPlanned();
      return { m0: Math.round(m0), say0: say0, m1: Math.round(b.months[0].margin - b.base[0].margin), say1: plnSay('pickAcid') };
    })()`);
    expect(r.m0).toBe(0);
    expect(r.say0).toMatch(/not worked out/);
    // Half of 1,000 L at ₹2, and a quarter of 4 KL less sent away at ₹500 a KL, less ₹300 to run it.
    expect(r.m1).toBe(1000 + 500 - 300);
    expect(r.say1).toMatch(/500 L of acid a month recovered, 1\.0 KL less sent away/);
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
});
