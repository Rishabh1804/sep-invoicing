import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso } from './fixtures';

// P260: Accept with explanation (owner, 7 Nov 2026, on a Sunday the supervisor booked as 3 hands short of pickling where the rule
// reads 2: "It should be 2 hands but Shyam has calculated it as needing 3 hands, accept with explanation option should be there").
// A booking the rule does not reach is shown on the day's Extra hours card, where it was booked, with Accept: the hours stay as
// booked (and paid), the reason goes on the record, and People → Areas lists it under Accepted. Made-up names; dates from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const DAY = (() => { const t = new Date(todayIso() + 'T00:00:00'); t.setDate(t.getDate() - 1); const p = (n: number) => String(n).padStart(2, '0'); return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); })();

function book() {
  const staff = [1, 2, 3, 4].map(i => ({ id: i, name: 'Hand ' + 'ABCD'[i - 1], comp: 'hourly', hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true }));
  const marks: Record<string, unknown> = {};
  staff.forEach(w => { marks[w.id] = { st: 'P', area: 'vat-a1', hours: 8, ot: 0 }; });
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff,
    areaTargets: { 'vat-a1': 4, 'pickling-vat': 3 }, shiftNeeds: { [DAY]: { 'vat-a1': 4, 'pickling-vat': 2 } },
    // Pickling needs 2 today and nobody stood there: the rule reads 16 h; the sheet booked 24.
    attendance: { [DAY]: { marks, extra: [{ kind: 'coverage', area: 'pickling-vat', hours: 24 }], note: '' } } };
}

test('a booking the rule does not reach is accepted with an explanation on the day, and stays as booked', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageStaff');
  await ev(page, `_attView = 'day'; _attDate = '${DAY}'; renderAttendance()`);
  const flags = page.locator('#attExtra [data-att-extra-flags]');
  await expect(flags.locator('[data-flag="warning"]')).toContainText('24.0 h against 16.0 h');
  await flags.locator('[data-action="invAreaExplain"]').click();
  const dlg = page.locator('.inv-dialog').filter({ hasText: 'Accept with explanation' });
  await expect(dlg).toContainText('Accepting keeps the 24.0 h as booked');
  await dlg.locator('#areaExReason').fill('The supervisor counted 3 hands short; paid as booked.');
  await dlg.locator('[data-action="invAreaExplainSave"]').click();
  await expect(flags.locator('[data-flag="ack"]')).toContainText('paid as booked');
  await expect(flags.locator('[data-flag="warning"]')).toHaveCount(0);
  const st = await readStoredState(page);
  expect(st.attendance[DAY].extra[0].hours).toBe(24);
  expect(st.extraExceptions).toHaveLength(1);
  expect(st.extraExceptions[0]).toMatchObject({ iso: DAY, scope: 'pickling-vat', expected: 16, booked: 24 });
  // Areas says the same, under Accepted.
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
  await expect(page.locator('[data-card="extra"] [data-flag="ack"]')).toContainText('Accepted');
});
