import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openAttendance } from './fixtures';

// P119 (owner, 30 Sep 2026): Staff → Day is a board, a card per area and a line per hand, with the area, hours and OT on
// the name; the Overview says where everyone stood, the office, gate, Flex and Civil included. Made-up names.

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [
    { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Charlie', comp: 'monthly', area: 'office', dayRate: 600, active: true, onFloor: false },
    { id: 4, name: 'Delta', comp: 'monthly', area: 'gate', dayRate: 400, active: true, onFloor: false },
    { id: 5, name: 'Echo', comp: 'hourly', area: 'civil', hourRate: 45, active: true, onFloor: false },
    { id: 6, name: 'Foxtrot', comp: 'hourly', area: 'flex', hourRate: 45, active: true, onFloor: true },
    { id: 7, name: 'Golf', comp: 'monthly', area: 'barrel', dayRate: 500, active: true, onFloor: true },
  ];
  const m = (area: string, st = 'P', hours = 8) => ({ st, area, hours, ot: 0 });
  s.attendance = { [todayIso()]: { marks: { 1: m('vat-a1'), 2: m('vat-a2', 'P', 10), 3: m('office'), 4: m('gate'), 5: m('civil'), 6: m('flex'), 7: { st: 'A', hours: 0, ot: 0, area: 'flex' } }, extra: [], note: '' } };
  return s as SepState;
}
async function openDay(page: Page) {
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
}

test('Day is a card per area with each hand on one line, and the absent in a strip of their own', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page);
  for (const a of ['vat-a1', 'vat-a2', 'office', 'gate', 'civil', 'flex']) await expect(page.locator(`[data-att-area-card="${a}"]`)).toBeVisible();
  await expect(page.locator('[data-att-area-card="civil"]')).toContainText('Echo');
  await expect(page.locator('#attAbsentList')).toContainText('Golf');
  // An absent hand stays on their home area's card, so a tap never moves the line; marked present, they count there.
  const golf = page.locator('[data-att-area-card="barrel"] [data-att-row="7"]');
  await expect(golf).toContainText('Absent');
  await golf.locator('[data-action="invAttSet"][data-st="P"]').click();
  await expect(page.locator('[data-att-area-card="barrel"] .inv-panel-title')).toContainText('1');
  await expect(page.locator('#attAbsentList')).toHaveCount(0);
});

test('a name opens the hand’s day: the area and the overtime change in place', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page);
  await page.locator('[data-att-row="1"] [data-action="invAttEdit"]').click();
  const dlg = page.locator('[data-att-edit="1"]');
  await expect(dlg).toBeVisible();
  await dlg.locator('select[data-att-area]').selectOption('vat-a2');
  await dlg.locator('input[data-att-ot]').fill('2');
  await dlg.locator('input[data-att-ot]').dispatchEvent('change');
  await dlg.locator('[data-action="invAttEditClose"]').last().click();
  await expect(page.locator('[data-att-area-card="vat-a2"]')).toContainText('Alfa');
  const mk = (await readStoredState(page)).attendance[todayIso()].marks['1'];
  expect(mk).toMatchObject({ area: 'vat-a2', ot: 2 });
});

test('the Overview says where everyone stood, office, gate, Flex and Civil included', async ({ page }) => {
  await loadAppWithState(page, book());
  // Floor's Overview: its People card holds the day's attendance panel (TM4a; People's own Overview went).
  await switchTab(page, 'pageFloor');
  const alloc = page.locator('#flrAtt [data-att-alloc]');
  for (const [a, n] of [['office', '1'], ['gate', '1'], ['civil', '1'], ['flex', '1'], ['vat-a1', '1']]) await expect(alloc.locator(`[data-alloc="${a}"]`)).toContainText(n);
});
