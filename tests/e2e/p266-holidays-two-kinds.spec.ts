import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, todayIso, type SepState } from './fixtures';

// P266 (owner, 17 Nov 2026): "Break that section in the setting into its own categories, so static and flexible holidays are treated
// differently." A festival saved as MM-DD (a date that moves each year) recurred on the wrong day the next year. Paid holidays are now two
// fields: every year (MM-DD) and dated (a full date, one year). The book keeps one list, its kind read off each date's form.

const YR = todayIso().slice(0, 4), NEXT = String(+YR + 1);
async function load(page: any, holidays: string[]) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), labour: { ...(emptyState() as any).labour, holidays } } as SepState);
}

test.describe('P266: paid holidays, every year and dated', () => {
  test('the list splits by kind; a festival moved to its date counts in its year only', async ({ page }) => {
    await load(page, ['01-26', '08-15', '10-02', '11-09']);
    await openSettingsAt(page, 'rest');
    await expect(page.locator('#setHolidaysFixed')).toHaveValue('01-26, 08-15, 10-02, 11-09');
    await expect(page.locator('#setHolidaysDated')).toHaveValue('');
    await expect(page.locator('section, details').filter({ has: page.locator('#setHolidaysDated') }).first()).toContainText(`None in ${YR} yet.`);
    // The festival moves to the dated field; a month and day typed there is this year's, a full date among the fixed ones is its own day.
    await page.locator('#setHolidaysFixed').fill(`01-26, 08-15, 10-02, ${NEXT}-01-14`);
    await page.locator('#setHolidaysDated').fill(`${YR}-11-09, 10-21`);
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="rest"]').click();
    const l = (await readStoredState(page)).labour;
    expect(l.holidays).toEqual(['01-26', '08-15', '10-02', `${YR}-10-21`, `${YR}-11-09`, `${NEXT}-01-14`]);
    await expect(page.locator('[data-sum="rest"]')).toHaveText('full at 90% · half at 80% · 3 every year · 3 dated');
    const on = await page.evaluate(([y, n]) => ['-11-09', '-10-02', '-10-21'].flatMap(d => [(window as any).labourIsHoliday(y + d), (window as any).labourIsHoliday(n + d)]), [YR, NEXT]);
    // 9 Nov and 21 Oct are holidays this year only; 2 Oct every year.
    expect(on).toEqual([true, false, true, true, true, false]);
  });
});
