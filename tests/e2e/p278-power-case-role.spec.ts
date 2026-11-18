import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { PINS, guardBook, unlock, withUsers } from './p140-guard.fixture';

// P278: Power → Case is not a Supervisor's (owner, 17 Nov 2026: "Remove the option for the supervisor to view the
// power-case"). The case draws revenue, realisation, margins and wages; a role that does not see money and wages has no Case
// tab, no address, no print, no search entry and no move that leads to it. A cut's cost stays every role's (QA4-4). Made-up.

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

test('a Supervisor has no Case: not a tab, not by address, not printed, not in search, not in a move', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await switchTab(page, 'pagePower');
  await expect(page.locator('#pagePower [data-action="invPowerTab"]')).toHaveText(['Cuts', 'Causes', 'Load & bills']);
  // An address or a stored tab that names the case lands on Cuts.
  await ev(page, `powerSetTab('case'); renderPower()`);
  await expect(page.locator('#powerContent [data-power-case]')).toHaveCount(0);
  await expect(page.locator('#powerContent [data-power-picture]')).toHaveCount(0);
  await expect(page.locator('#pagePower [data-action="invPowerTab"][aria-selected="true"]')).toHaveText('Cuts');
  // Printing it draws nothing.
  await ev(page, `powerPrint()`);
  await expect(page.locator('#invPrintBody [data-power-picture]')).toHaveCount(0);
  expect(await ev(page, `srchSees({ kind: 'screen', go: { kind: 'place', loc: { tab: 'pagePower', v: 'case', id: '' } } })`)).toBe(false);
  // The month's move names the cuts, never the case.
  const moves = await ev(page, `JSON.stringify(advPowerMoves({ power: function() { return powerAnalysis(); }, today: localDateStr(), seen: {} }))`);
  expect(moves).not.toContain('powerCase');
  expect(moves).not.toMatch(/power case/i);
  expect(moves).toContain('cuts');
  expect(await page.locator('body').innerText()).not.toMatch(/realisation|counting everyone.s wages/i);
});

test('the owner keeps the Case, its print and its search entry', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  await switchTab(page, 'pagePower');
  await expect(page.locator('#pagePower [data-action="invPowerTab"]')).toHaveText(['Cuts', 'Causes', 'Load & bills', 'Case']);
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  await expect(page.locator('#powerContent [data-power-picture]')).toHaveCount(1);
  expect(await ev(page, `srchSees({ kind: 'screen', go: { kind: 'place', loc: { tab: 'pagePower', v: 'case', id: '' } } })`)).toBe(true);
});
