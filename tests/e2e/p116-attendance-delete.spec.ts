import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P116: a day's attendance is deleted only with a reason, and the deletion is logged (owner, 30 Sep 2026: "there is no way
// to delete a day's data after providing a reason that can be logged"). A day saved under no date ("null") is moved to the
// same log by a migration (owner: "delete the attendance day saved under null, the day it was for was added correctly").
// Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const day = () => ({ marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' }, 2: { st: 'A', hours: 0, area: 'barrel' } },
  extra: [{ kind: 'coverage', area: 'barrel', hours: 8 }], note: '' });

function book(extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'barrel', hourRate: 60, active: true, onFloor: true }];
  return Object.assign(s, extra) as SepState;
}

test('a day is deleted only with a reason, kept whole in the log, and History says what went and why', async ({ page }) => {
  const d = todayIso();
  await loadAppWithState(page, book({ attendance: { [d]: day() } }));
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
  // Cancel keeps the day.
  await page.locator('[data-action="invAttDayDelete"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('1 EXTRA row');
  expect(await g(page, `!!S.attendance['${d}']`)).toBe(true);
  // With a reason, the day goes.
  await page.locator('[data-action="invAttDayDelete"]').click();
  await answerAsk(page, 'ok', 'Entered on the wrong date; re-entered on the right one');
  const st = await readStoredState(page) as any;
  expect(st.attendance[d]).toBeUndefined();
  expect(st.attendanceDeletes).toHaveLength(1);
  expect(st.attendanceDeletes[0]).toMatchObject({ key: d, iso: d, marks: 2, extra: 1, how: 'by hand', reason: 'Entered on the wrong date; re-entered on the right one' });
  expect(st.attendanceDeletes[0].day.marks['1']).toMatchObject({ st: 'P', area: 'vat-a1' });
  // No day, no delete button.
  await expect(page.locator('[data-action="invAttDayDelete"]')).toHaveCount(0);
  await switchTab(page, 'pageHistory');
  await expect(page.locator('#pageHistory')).toContainText('Attendance day deleted');
  await expect(page.locator('#pageHistory')).toContainText('re-entered on the right one');
});

test('a day saved under no date is moved to the log on start, with the owner’s reason, and a real day is untouched', async ({ page }) => {
  const d = todayIso();
  await loadAppWithState(page, book({ attendance: { [d]: day(), null: day() } as any }));
  const st = await readStoredState(page) as any;
  expect(Object.keys(st.attendance)).toEqual([d]);
  expect(st.attendanceDeletes).toHaveLength(1);
  expect(st.attendanceDeletes[0]).toMatchObject({ key: 'null', iso: null, how: 'migration', marks: 2 });
  expect(st.attendanceDeletes[0].reason).toContain('the day it was for was entered correctly');
  await switchTab(page, 'pageHistory');
  await expect(page.locator('#pageHistory')).toContainText('saved under no date ("null")');
});
