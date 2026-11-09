import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso } from './fixtures';

// P262: the weekly hands paid at once (owner, 9 Nov 2026: "For weekly payout, I have to individually go and mark paid for every
// worker. We should have an option to mark multiple at once"). Made-up names; last week's dates, worked out from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const iso = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const shift = (s: string, n: number) => { const t = new Date(s + 'T00:00:00'); t.setDate(t.getDate() + n); return iso(t); };
const WS = (() => { const t = new Date(todayIso() + 'T00:00:00'); t.setDate(t.getDate() - t.getDay() - 7); return iso(t); })();
const D1 = shift(WS, 1);

function book() {
  const staff = [
    { id: 1, name: 'Alfa Oraon', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
    { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
    { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true },
    { id: 4, name: 'Delta Hembrom', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true }];
  const mark = (area: string) => ({ st: 'P', area, inMin: 510, outMin: 1020, hours: 8, ot: 0, outKnown: true });
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff,
    attendance: { [D1]: { marks: { 1: mark('vat-a1'), 2: mark('vat-a2'), 3: mark('barrel'), 4: mark('vat-a1') }, extra: [], note: '' } } };
}

test('Pay all due records a payment to each weekly hand ticked, at the amount typed, and leaves the monthly crew alone', async ({ page }) => {
  await loadAppWithState(page, book() as any);
  await switchTab(page, 'pageStaff');
  await ev(page, `_attView = 'pay'; _attWeekStart = '${WS}'; _attDate = '${D1}'; renderAttendance()`);
  const open = page.locator('[data-pay-all-row] [data-action="invPayAllOpen"]');
  await expect(open).toHaveText('Pay all due · ₹1,200.00');
  await open.click();
  const dlg = page.locator('[data-pay-all-dialog]');
  await expect(dlg.locator('[data-pay-all]')).toHaveCount(3);
  await expect(dlg.locator('[data-pay-all-save]')).toHaveText('Record 3 payments · ₹1,200.00');
  // Charlie left out; Bravo paid ₹350 of ₹400.
  await dlg.locator('[data-pay-all-tick="3"]').uncheck();
  await dlg.locator('[data-pay-all-amt="2"]').fill('350');
  await expect(dlg.locator('[data-pay-all-save]')).toHaveText('Record 2 payments · ₹750.00');
  await dlg.locator('[data-pay-all-save]').click();
  await expect(dlg).toHaveCount(0);
  const st = await readStoredState(page);
  const pays = st.staffPayments.map((p: any) => [p.staffId, p.amount, p.kind, p.date >= WS && p.date <= shift(WS, 6)]);
  expect(pays).toEqual([[1, 400, 'payment', true], [2, 350, 'payment', true]]);
  const due = await ev(page, `payDue('${WS}').rows.filter(function(r){ return r.weekly; }).map(function(r){ return [r.w.id, r.due]; })`);
  expect(due).toEqual([[1, 0], [2, 50], [3, 400]]);
  // One hand left due: no row to pay all.
  await ev(page, `staffPayments().push({ id: 'X', staffId: 2, date: '${D1}', amount: 50, kind: 'payment', at: 1 }); renderAttendance()`);
  await expect(page.locator('[data-pay-all-row]')).toHaveCount(0);
});
