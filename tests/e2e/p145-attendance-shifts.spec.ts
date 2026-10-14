import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, workdayIso, type SepState, openAttendance, attDayAs } from './fixtures';

// P145 (owner, 1 Oct 2026: "there is also no way to record which area the OT workers actually worked on, we get to select one
// option for the entire day. Every worker can have states, like morning OT, General, Evening OT, Late night OT, etc. … right now
// we just select the General shift areas and OT areas are neglected, both in the app and in Deepak's sheet"). Each hand has a
// General area and an area per OT slot; a slot is that slot's OT block crew, and overtime is booked where it was worked.

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [
    { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 480, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'monthly', area: 'barrel', dayRate: 480, active: true, onFloor: true },
  ];
  s.attendance = { [todayIso()]: { marks: {
    1: { st: 'P', area: 'vat-a1', hours: 0, ot: 0 }, 2: { st: 'P', area: 'barrel', hours: 0, ot: 0 },
  }, extra: [], note: '' } };
  return s as SepState;
}
async function openSheet(page: Page) {
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  await attDayAs(page, 'sheet');
}
const day = async (page: Page) => (await readStoredState(page)).attendance[todayIso()];

test('the sheet takes an area for each OT slot; a slot is that slot’s OT crew, made at its usual times and gone when emptied', async ({ page }) => {
  await loadAppWithState(page, book());
  await openSheet(page);
  await page.locator('[data-att-sheet-row="1"] select[data-att-slot="evening"]').selectOption('vat-a2');
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="evening"]').selectOption('vat-a2');
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="morning"]').selectOption('barrel');
  let d = await day(page);
  const evening = d.extra.filter((x: any) => x.kind === 'block' && x.from === '17:00');
  expect(evening).toHaveLength(1);
  expect(evening[0]).toMatchObject({ areas: ['vat-a2'], crew: [1, 2], to: '20:00', hours: 0 });
  expect(d.extra.find((x: any) => x.from === '06:00')).toMatchObject({ areas: ['barrel'], crew: [2] });
  // The general shift's area is the mark's own, untouched.
  expect(d.marks['1'].area).toBe('vat-a1');
  // Moving a hand within a slot moves them; the slot made for nobody goes.
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="morning"]').selectOption('');
  d = await day(page);
  expect(d.extra.find((x: any) => x.from === '06:00')).toBeUndefined();
  // The board says where each stood.
  await attDayAs(page, 'board');
  await expect(page.locator('[data-att-row="1"]')).toContainText('Evening OT VAT A2');
});

test('a hand on an OT block the roll wrote shows its area, and the dialog sets the morning slot', async ({ page }) => {
  const s: any = book();
  s.attendance[todayIso()].extra = [{ kind: 'block', areas: ['vat-a1'], crew: [1], hours: 6, from: '20:00', to: '06:00' }];
  await loadAppWithState(page, s);
  await openSheet(page);
  await expect(page.locator('[data-att-sheet-row="1"] select[data-att-slot="night"]')).toHaveValue('vat-a1');
  await page.locator('[data-att-sheet-row="1"] [data-action="invAttEdit"]').click();
  const dlg = page.locator('[data-att-edit="1"]');
  await dlg.locator('select[data-att-slot="morning"]').selectOption('vat-a2');
  const d = await day(page);
  // The roll's own night block keeps its EXTRA and its crew.
  expect(d.extra.find((x: any) => x.from === '20:00')).toMatchObject({ hours: 6, crew: [1] });
  expect(d.extra.find((x: any) => x.from === '06:00')).toMatchObject({ areas: ['vat-a2'], crew: [1] });
});

test('overtime is booked to the area it was worked in, and Deepak’s sheet carries the OT areas', async ({ page }) => {
  // A working day: a worked national holiday is paid like a Sunday, with no overtime to book (2 Oct is one).
  const s: any = book(), day = workdayIso();
  s.attendance = { [day]: s.attendance[todayIso()] };
  s.attendance[day].marks[1] = { st: 'P', area: 'vat-a1', hours: 11, ot: 3, inMin: 510, outMin: 1200 };
  s.attendance[day].extra = [{ kind: 'block', areas: ['vat-a2'], crew: [1], hours: 0, from: '17:00', to: '20:00' }];
  await loadAppWithState(page, s);
  const res = await page.evaluate((iso) => {
    const lab = (window as any).labourForRange(iso, iso);
    return { a1: lab.byArea['vat-a1'] ? lab.byArea['vat-a1'].hours : 0, a2: lab.byArea['vat-a2'] ? lab.byArea['vat-a2'].hours : 0,
      sheet: (window as any).attSheetDeepakHtml(iso, true) };
  }, day);
  expect(res.a2).toBe(3);
  expect(res.a1).toBe(0);
  expect(res.sheet).toContain('Evening OT');
  expect(res.sheet).toMatch(/Alfa[\s\S]*?VAT A1[\s\S]*?VAT A2/);
});
