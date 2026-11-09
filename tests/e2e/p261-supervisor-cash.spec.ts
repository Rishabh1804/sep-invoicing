import { test, expect, Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso } from './fixtures';

// P261: the cash with the supervisor (owner, 7 Nov 2026: "347.5 goes to Shyam, and he had 290 due already = 637 total due - 400 ACI
// HCl trip = 237 due now", then "Build the ledger"). What is handed for a payout past it stays with him, what he spends from it
// comes off, a balance set on a day is the start. Made-up names; the screen's dates are from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const iso = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const TODAY = todayIso();
const YDAY = (() => { const t = new Date(TODAY + 'T00:00:00'); t.setDate(t.getDate() - 1); return iso(t); })();

test('the week of 7 Nov: 290 held, 44,500 handed for a 44,152.50 payout, 400 spent, leaves 237.50; the bank reads the kept part as his float', async ({ page }) => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(),
    staff: [{ id: 30, name: 'Gate Night', comp: 'monthly', monthWage: 4000, area: 'gate', onFloor: false, active: true }],
    staffPayments: [{ id: 'P-1', staffId: 30, date: '2026-11-07', amount: 4000, kind: 'payment', at: 1 }],
    payHanded: { '2026-11-01': { amount: 44500, at: 1 } },
    supCash: [{ id: 'SC-1', date: '2026-10-31', kind: 'set', amount: 290, note: 'agreed', at: 1 },
      { id: 'SC-2', date: '2026-11-07', kind: 'spent', amount: 400, note: 'HCl trip', at: 2 },
      { id: 'SC-3', date: '2026-10-20', kind: 'spent', amount: 999, note: 'before the balance', at: 3 }] };
  await loadAppWithState(page, s);
  const out: any = await ev(page, `(function(){
    var pw = { recordedDays: 6, workingDays: 6, total: 44152.5, cashOut: 0, lab: { hourlessMarks: 0 } };
    var orig = payWeek; payWeek = function() { return pw; };
    try {
      var L = scLedger();
      var cls = [{ cat: 'wages', cash: true, row: { date: '2026-11-07', dr: 48500 }, auto: false }];
      var c = bankCostByMonth(cls).cashWeeks['2026-11-01'];
      return { bal: L.balance, over: L.rows.filter(function(r){ return r.kind === 'over'; })[0].amount,
        before: L.rows.filter(function(r){ return r.id === 'SC-3'; })[0].before,
        float: c.float, drawings: c.drawings, hand: c.handCash, wages: c.wages };
    } finally { payWeek = orig; }
  })()`);
  expect(out).toEqual({ bal: 237.5, over: 347.5, before: true, float: 347.5, drawings: 0, hand: 4000, wages: 44152.5 });
});

test('on Pay: the cash handed, a balance set, a spend and its void move what he holds', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(),
    staff: [{ id: 1, name: 'Hand A', comp: 'hourly', hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true }] } as any);
  await switchTab(page, 'pageStaff');
  const ws = await ev(page, `attWeekStartOf('${TODAY}')`) as string;
  await ev(page, `_attView = 'pay'; _attWeekStart = '${ws}'; _attDate = '${TODAY}'; renderAttendance()`);
  const card = page.locator('[data-card="supcash"]');
  await expect(card.locator('[data-sc-balance]')).toHaveText('Holds nothing');
  if (!(await card.evaluate(el => (el as HTMLDetailsElement).open))) await card.locator(':scope > summary').click();
  // A balance set at the end of yesterday.
  await card.locator('[data-action="invPayScOpen"][data-kind="set"]').click();
  let dlg = page.locator('[data-sc-form="set"]');
  await dlg.locator('#scAmount').fill('100');
  await dlg.locator('#scDate').fill(YDAY);
  await dlg.locator('[data-action="invPayScSave"]').click();
  await expect(card.locator('[data-sc-balance]')).toHaveText('Holds ₹100.00');
  // Handed for this week's payout (nothing recorded, so a payout of ₹0): all of it stays with him.
  const fc = page.locator('#payForecast');
  if (!(await fc.evaluate(el => (el as HTMLDetailsElement).open))) await fc.locator(':scope > summary').click();
  await fc.locator('[data-pay-handed] [data-action="invPayHanded"]').click();
  await answerAsk(page, 'ok', '500');
  await expect(fc.locator('[data-pay-handed] .inv-row-meta')).toContainText('₹500.00 over, kept by the supervisor');
  await expect(card.locator('[data-sc-balance]')).toHaveText('Holds ₹600.00');
  // A spend needs what it was for.
  await card.locator('[data-action="invPayScOpen"][data-kind="spent"]').click();
  dlg = page.locator('[data-sc-form="spent"]');
  await dlg.locator('#scAmount').fill('50');
  await expect(dlg).toContainText('Holds ₹600.00 now → holds ₹550.00');
  await dlg.locator('#scNote').fill('Acid trip');
  await dlg.locator('[data-action="invPayScSave"]').click();
  await expect(card.locator('[data-sc-balance]')).toHaveText('Holds ₹550.00');
  let st = await readStoredState(page);
  expect(st.payHanded[ws].amount).toBe(500);
  expect(st.supCash.map((e: any) => [e.kind, e.amount])).toEqual([['set', 100], ['spent', 50]]);
  // Voided with a reason, kept on the record.
  const id = st.supCash[1].id;
  await card.locator(`[data-sc-row="${id}"] [data-action="invPayScVoid"]`).click();
  await answerAsk(page, 'ok', 'typed twice');
  await expect(card.locator('[data-sc-balance]')).toHaveText('Holds ₹600.00');
  st = await readStoredState(page);
  expect(st.supCash[1].voidReason).toBe('typed twice');
});
