import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openAttendance, attDayAs } from './fixtures';

// P144 (owner, 1 Oct 2026: "Attendance has no option to enter time in and time out by hand, so we have to rely on whatsapp
// message only, there is no way to simply enter the data that is presented to us by Deepak in his sheet"). Staff → Day takes
// an in and an out for each hand, in the hand's dialog and on a sheet laid out like Deepak's; hours and OT are worked out by
// the rolls' own rule. Made-up names.

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [
    { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Delta', comp: 'monthly', area: 'gate', dayRate: 400, active: true, onFloor: false },
  ];
  s.attendance = { [todayIso()]: { marks: {
    1: { st: 'P', area: 'vat-a1', hours: 0, ot: 0 }, 2: { st: 'P', area: 'vat-a2', hours: 0, ot: 0 }, 3: { st: 'P', area: 'gate', hours: 0, ot: 0 },
  }, extra: [], note: '' } };
  return s as SepState;
}
async function openDay(page: Page) {
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
}
async function setTime(page: Page, sel: string, v: string) {
  const f = page.locator(sel);
  await f.fill(v);
  await f.dispatchEvent('change');
}
const mark = async (page: Page, id: number) => (await readStoredState(page)).attendance[todayIso()].marks[String(id)];

test('the hand’s dialog takes an in and an out; hours and OT are worked out as a roll works them out', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page);
  await page.locator('[data-att-row="1"] [data-action="invAttEdit"]').click();
  const dlg = page.locator('[data-att-edit="1"]');
  await setTime(page, '[data-att-edit="1"] input[data-att-in]', '08:30');
  await setTime(page, '[data-att-edit="1"] input[data-att-out]', '19:45');
  // 8:30 → 7:45 PM is 11¼ h: 11 h by the span to the whole hour, 3 h over 8.
  await expect.poll(async () => (await mark(page, 1))).toMatchObject({ inMin: 510, outMin: 1185, hours: 11, ot: 3 });
  await expect(dlg.locator('[data-att-times-note]')).toContainText('11 h, OT 3 h');
  await dlg.locator('[data-action="invAttEditClose"]').last().click();
  await expect(page.locator('[data-att-row="1"]')).toContainText('8:30 AM – 7:45 PM');
  await expect(page.locator('[data-att-row="1"]')).toContainText('OT 3 h');
});

test('the sheet: a row a hand with P / H / A, area, in and out; only the out typed takes the shift’s in; an out past midnight runs on', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page);
  await attDayAs(page, 'sheet');
  const sheet = page.locator('#attSheetEntry');
  await expect(sheet.locator('tr[data-att-sheet-row]')).toHaveCount(3);
  // Out only: 8:30 AM assumed in, 6 PM out → 9 h, OT 1.
  await setTime(page, '[data-att-sheet-row="1"] input[data-att-out]', '18:00');
  await expect(sheet.locator('[data-att-sheet-row="1"] [data-att-sheet-ot]')).toHaveText('1');
  expect(await mark(page, 1)).toMatchObject({ outMin: 1080, hours: 9, ot: 1 });
  // An hourly hand: the hours are the span and there is no OT; 6 PM to 1 AM runs past midnight.
  await setTime(page, '[data-att-sheet-row="2"] input[data-att-in]', '18:00');
  await setTime(page, '[data-att-sheet-row="2"] input[data-att-out]', '01:00');
  await expect(sheet.locator('[data-att-sheet-row="2"] [data-att-sheet-hours]')).toHaveText('7');
  expect(await mark(page, 2)).toMatchObject({ inMin: 1080, outMin: 1500, hours: 7, ot: 0 });
  // The gate's twelve hours are its shift: no OT.
  await setTime(page, '[data-att-sheet-row="3"] input[data-att-in]', '07:00');
  await setTime(page, '[data-att-sheet-row="3"] input[data-att-out]', '19:00');
  expect(await mark(page, 3)).toMatchObject({ hours: 12, ot: 0 });
  // Absent clears the times; the sheet is remembered on the device.
  await sheet.locator('[data-att-sheet-row="1"] [data-action="invAttSet"][data-st="A"]').click();
  const m1 = await mark(page, 1);
  expect(m1.st).toBe('A');
  expect(m1.inMin).toBeUndefined();
  expect(m1.outMin).toBeUndefined();
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await openDay(page);
  await expect(page.locator('#attSheetEntry')).toBeVisible();
});

test('times typed by hand are the hand’s: the mark carries no relay source', async ({ page }) => {
  const s: any = book();
  s.attendance[todayIso()].marks[1] = { st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020, src: 'relay' };
  await loadAppWithState(page, s);
  await openDay(page);
  await attDayAs(page, 'sheet');
  await setTime(page, '[data-att-sheet-row="1"] input[data-att-out]', '20:00');
  const m = await mark(page, 1);
  expect(m.src).toBeUndefined();
  expect(m).toMatchObject({ outMin: 1200, hours: 11, ot: 3 });
});
