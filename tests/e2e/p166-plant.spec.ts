import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, answerAsk, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P166 (owner, 7 Oct 2026, docs/WORKERS_AND_PLANT.md W1): the plant register. Every barrel and tank with its line, kg a round and
// status; a line's capacity is its units side by side; every status change is kept with its day; the planner's machines are
// units; a unit down for days is a task; the owner's alone to change.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function book(units?: any[], log?: any[]): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  if (units) s.plant = { units, log: log || [] };
  return s;
}
const tank = (id: string, name: string, station: string, kg: number | null, status = 'run', since = day(-30)) =>
  ({ id, name, station, kind: station === 'barrel' ? 'barrel' : 'tank', kgRound: kg, status, since, reason: status === 'run' ? '' : 'rectifier failed', condition: 'fair' });
async function openEquipment(page: Page) {
  await switchTab(page, 'pageProduction');
  await page.locator('#productionContent .inv-viewtab[data-tab="equipment"]').click();
}

test.describe('P166 the plant register', () => {
  test('a unit added by hand: its line, kg a round and status; the line’s capacity follows', async ({ page }) => {
    await loadAppWithState(page, book());
    await openEquipment(page);
    await expect(page.locator('#pltEmpty')).toBeVisible();
    for (const [name, kg, status] of [['Tank 1', '30', 'run'], ['Tank 2', '30', 'run'], ['Tank 3', '20', 'run'], ['Tank 4', '20', 'down']]) {
      await page.locator('[data-action="invPltEdit"]').first().click();
      await page.fill('#pltName', name);
      await page.selectOption('#pltStation', 'vat-a1');
      await page.fill('#pltKg', kg);
      await page.selectOption('#pltStatus', status);
      if (status === 'down') await page.fill('#pltReason', 'heater coil');
      await page.locator('[data-action="invPltSave"]').click();
    }
    const a1 = page.locator('[data-plt-station="vat-a1"]');
    await expect(a1.locator('[data-plt-unit]')).toHaveCount(4);
    // Side by side, by kg a round: 80 of 100 available.
    await expect(a1.locator('[data-plt-cap]')).toContainText('3 of 4 tanks working · 80% available');
    await expect(a1.locator('[data-plt-unit][data-status="down"]')).toContainText('Tank 4');
    await expect(a1.locator('.inv-panel-head')).toContainText('1 not working');
    const st: any = await g(page, `({ n: S.plant.units.length, log: S.plant.log.length, down: S.plant.log.filter(function (l) { return l.to === 'down'; }).length })`);
    expect(st).toEqual({ n: 4, log: 4, down: 1 });
  });

  test('by count when a kg a round is missing; running at what the register reads', async ({ page }) => {
    await loadAppWithState(page, book([tank('B1', 'Barrel 1', 'barrel', null), tank('B2', 'Barrel 2', 'barrel', null), tank('B3', 'Barrel 3', 'barrel', null),
      tank('B4', 'Barrel 4', 'barrel', null, 'down'), tank('B5', 'Barrel 5', 'barrel', null, 'repair'), tank('B6', 'Barrel 6', 'barrel', null, 'down')]));
    const cap: any = await g(page, `(function () { var c = pltCapacity('barrel'); return { n: c.n, a: c.nAvail, pct: c.pct, byKg: c.byKg, note: c.note }; })()`);
    expect(cap).toEqual({ n: 6, a: 3, pct: 0.5, byKg: false, note: 'by count: no kg a round set' });
    // The register's reading of the line (the planner's), against the kg a round available.
    const used: any = await g(page, `(function () {
      S.plant.units.forEach(function (u) { u.kgRound = 50; });
      plnBase = function () { return { lines: { barrel: { src: 'register', kgRound: 120, register: { days: 9 } } } }; };
      var c = pltCapacity('barrel'); return { avail: c.kgAvail, used: Math.round(c.used.pct * 100) };
    })()`);
    expect(used).toEqual({ avail: 150, used: 80 });
  });

  test('a status change is kept with its day; the day’s status is read back from it', async ({ page }) => {
    await loadAppWithState(page, book([tank('T1', 'Tank 1', 'vat-a2', 40, 'run', day(-20))], [{ id: 'L0', unitId: 'T1', date: day(-20), from: null, to: 'run', at: 1 }]));
    await openEquipment(page);
    await page.locator('[data-plt-unit="T1"]').click();
    await page.selectOption('#pltStatus', 'repair');
    await expect(page.locator('#pltSince')).toHaveValue(todayIso());
    await page.fill('#pltSince', day(-4));
    await page.fill('#pltReason', 'relining');
    await page.locator('[data-action="invPltSave"]').click();
    const r: any = await g(page, `(function () { var u = pltUnitById('T1');
      return { before: pltStatusOn(u, '${day(-6)}'), after: pltStatusOn(u, '${day(-2)}'), down: pltDownDays(u, '${day(-10)}', '${todayIso()}'), log: S.plant.log.length }; })()`);
    expect(r).toEqual({ before: 'run', after: 'repair', down: 5, log: 2 });
    await expect(page.locator('#pltLog')).toContainText('relining');
    // Retired with a reason, never deleted.
    await page.locator('[data-plt-unit="T1"]').click();
    await page.locator('[data-action="invPltRetire"]').click();
    await answerAsk(page, 'ok', 'scrapped');
    const gone: any = await g(page, `({ kept: S.plant.units.length, retired: !!S.plant.units[0].retiredAt, why: S.plant.units[0].retireReason, live: pltUnits().length })`);
    expect(gone).toEqual({ kept: 1, retired: true, why: 'scrapped', live: 0 });
  });

  test('Equipment shows the plant by line; Floor’s Overview shows the line’s units on the day', async ({ page }) => {
    await loadAppWithState(page, book([tank('A', 'Tank 1', 'vat-a1', 25), tank('B', 'Tank 2', 'vat-a1', 25, 'down', day(-5))],
      [{ id: 'L1', unitId: 'A', date: day(-30), from: null, to: 'run', at: 1 }, { id: 'L2', unitId: 'B', date: day(-30), from: null, to: 'run', at: 1 }, { id: 'L3', unitId: 'B', date: day(-5), from: 'run', to: 'down', at: 2 }]));
    await switchTab(page, 'pageProduction');
    // The plant at a glance led Production's Overview; it is Equipment's now (the tab map, TM4c), its verdict naming the line.
    await page.locator('#productionContent .inv-viewtab[data-tab="equipment"]').click();
    await expect(page.locator('#pltVerdict .inv-hero-title')).toHaveText('1 of 2 tanks down on VAT A1');
    await expect(page.locator('#pltVerdict [data-plt-factor="vat-a1"]')).toContainText('50% available');
    await switchTab(page, 'pageFloor');
    // The units not working, a status at a time (TM4f: a name a fact had read as a chain).
    await expect(page.locator('[data-line="vat-a1"] [data-flr-units]')).toContainText('Down: Tank 2');
  });

  test('a unit down three days is a task, red at seven', async ({ page }) => {
    await loadAppWithState(page, book([tank('A', 'Tank 1', 'vat-a1', 25, 'down', day(-4)), tank('B', 'Barrel 1', 'barrel', 60, 'repair', day(-8)), tank('C', 'Tank 9', 'pick', 10, 'down', day(-1))]));
    const t: any = await g(page, `TODO_RULE_FNS.plantDown().map(function (x) { return x.key + ':' + x.tone; }).sort()`);
    expect(t).toEqual(['plantDown:A:amber', 'plantDown:B:red']);
  });

  test('the planner’s machines move into the register once, and the planner reads them there', async ({ page }) => {
    const s: any = book();
    s.planner = { cfg: {}, checklist: [], lenders: [], heard: [], heldBack: [], scenarios: [],
      machines: [{ id: 'MA-1', item: 'Barrel drive', station: 'barrel', line: 'barrel', state: 'needs', needs: 'new gearbox', risk: { p: 0.1, cost: 20000, days: 3, say: 'gearbox' } }] };
    await loadAppWithState(page, s);
    const r: any = await g(page, `({ left: S.planner.machines.length, unit: S.plant.units[0].name, st: S.plant.units[0].station, m: plnLive('machines').map(function (x) { return [x.id, x.item, x.state, x.risk.p]; }) })`);
    expect(r).toEqual({ left: 0, unit: 'Barrel drive', st: 'barrel', m: [['MA-1', 'Barrel drive', 'needs', 0.1]] });
    await switchTab(page, 'pagePlanner');
    // Plant is a kind under the planner's Moves since the tab map (TM2d); a book with nothing weighed to plan from shows the
    // registers alone, the machines among them, on every view.
    await page.locator('#pagePlanner .inv-viewtab[data-v="moves"]').click();
    const plant = page.locator('#pagePlanner [data-action="invPlnMoves"][data-k="plant"]');
    if (await plant.count()) await plant.click();
    await expect(page.locator('#plnMachines [data-pl-machine="MA-1"]')).toContainText('Barrel drive');
    // On the phone the row's Edit is in its fold (TM2d).
    const row = page.locator('#plnMachines [data-pl-machine="MA-1"]');
    if (await row.evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open)) await row.locator(':scope > summary').click();
    await row.locator('[data-action="invPltEdit"]').click();
    await expect(page.locator('#pltName')).toHaveValue('Barrel drive');
  });

  test('the owner’s alone: a supervisor sees the plant, and is told a change is the owner’s', async ({ page }) => {
    await loadAppWithState(page, book([tank('A', 'Tank 1', 'vat-a1', 25)]));
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await openEquipment(page);
    await expect(page.locator('[data-plt-unit="A"]')).toBeVisible();
    await expect(page.locator('#productionContent [data-action="invPltEdit"]:not([data-id])')).toHaveCount(0);
    await page.locator('[data-plt-unit="A"]').click();
    await expect(page.locator('.inv-dialog')).toContainText('changed by the owner alone');
    await expect(page.locator('#pltName')).toHaveCount(0);
  });
});
