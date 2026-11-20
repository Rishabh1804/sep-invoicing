import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { PINS, guardBook, unlock, withUsers } from './p140-guard.fixture';

// P282: Power → Cuts draws a cut's wages only to a role that sees wages (owner, 18 Nov 2026, T-JF: "Hide wage parts on Cuts").
// The idle wages and the catch-up overtime are left out of the cut's total, the month's and the year's too, so they cannot be
// had by subtracting the rows shown from the total. A cut's other cost stays every role's (QA4-4). Made-up names and rates.

const ev = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function book() {
  const s: any = guardBook();
  const d = todayIso();
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true }];
  s.production = { entries: [{ id: 'C1', kind: 'downtime', date: d, time: '10:00', to: '10:30', downtime: { cause: 'power', open: false },
    basis: 'relay', src: 'paste', at: 1 }], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  s.attendance = { [d]: { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' } };
  return s;
}
const cutFigures = (p: Page) => ev(p, `(function(){ var c = powerAnalysis().cuts[0].cost; return { idle: c.idle, idleAll: c.idleAll, recOt: c.recOt, total: c.total, restart: c.restart, contrib: c.contrib, hidden: !!c.wagesHidden }; })()`);

test('the owner sees the wages that bought nothing on a cut', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  const k: any = await cutFigures(page);
  expect(k.idle).toBeGreaterThan(0);
  expect(k.hidden).toBe(false);
  await switchTab(page, 'pagePower');
  await page.locator('#powerContent [data-power-cut] summary').first().click();
  await expect(page.locator('#powerContent [data-power-cut]').first()).toContainText('Wages that bought nothing');
  await expect(page.locator('[data-power-wages-hidden]')).toHaveCount(0);
});

test('a Supervisor is shown a cut without its wages, in the rows and in every total', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  const k: any = await cutFigures(page);
  expect(k).toMatchObject({ idle: 0, idleAll: 0, recOt: 0, hidden: true });
  // The total is what is left once the wages are out: nothing in it to subtract.
  expect(k.total).toBeCloseTo(k.restart + k.contrib, 2);
  await switchTab(page, 'pagePower');
  const cut = page.locator('#powerContent [data-power-cut]').first();
  await cut.locator('summary').click();
  await expect(cut).not.toContainText('Wages that bought nothing');
  await expect(cut).not.toContainText('Catch-up overtime');
  await expect(cut.locator('[data-power-wages-hidden]')).toHaveCount(1);
  await expect(page.locator('#powerVerdict')).toContainText('wages left out');
  const monthCost = await ev(page, `powerAnalysis().months.filter(function(m){ return m.cuts; }).slice(-1)[0].cost`);
  expect(monthCost).toBeCloseTo(k.total, 2);
});
