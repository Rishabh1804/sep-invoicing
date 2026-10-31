import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P252: the supervisor's cash paid out (owner, 31 Oct 2026: "For Shyam's 1840 - he has given that as a message in whatsapp",
// then "Payout total"). His message of amounts and its total is read, checked line by line, stored, and counted in the week's
// payout; the same message is never counted twice; a line is voided with a reason; and the bank reads that part of the
// Saturday's cash as the plant's other costs, not wages. Made-up names and figures.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const D1 = shift(todayIso(), -2), D2 = shift(todayIso(), -1);
const MSG = `${dmy(D1)}/ HCL 250
${dmy(D2)}/ JAR 150
SABUN               320
${dmy(D2)}/          90
KILO ROMEO  700
----------------------------------
        ONLY       1510`;

function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: [{ id: 1, name: 'Alfa Oraon', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }],
    attendance: {}, ...(extra || {}) } as unknown as SepState;
}
async function pasteCash(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await ev(page, `attSetView('paste')`);
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
  await expect(page.locator('[data-cash-review]')).toBeVisible();
}

test.describe('P252: cash paid out', () => {
  test('the message is read a line each, its kinds guessed, a line with no word asked, and the total checked', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await ev(page, `parseCashMessage(${JSON.stringify(MSG)}, '${D2}')`);
    expect(r.lines.map((l: any) => [l.what, l.amount, l.cat])).toEqual([
      ['HCL', 250, 'carriage'], ['JAR', 150, 'consumables'], ['SABUN', 320, 'consumables'], ['', 90, 'other'], ['KILO ROMEO', 700, 'service']]);
    expect(r.lines[0].date).toBe(D1);
    expect(r.total).toBe(1510);
    expect(r.sum).toBe(1510);
    expect(r.issues.some((x: any) => x.n === 4)).toBe(true);
    // A total the lines do not reach is said in red.
    const bad: any = await ev(page, `parseCashMessage(${JSON.stringify(MSG.replace('1510', '1600'))})`);
    expect(bad.issues.some((x: any) => x.tone === 'danger')).toBe(true);
    // His weekly payment message sums the payout up: it is not cash spent.
    expect(await ev(page, `cashLooksLike(${JSON.stringify('Weekly payment\nPAYMENT 40000\nNASTA 1200\nKILO 1510\n----\nTOTAL 42710 only')})`)).toBe(false);
    expect(await ev(page, `cashLooksLike(${JSON.stringify(MSG)})`)).toBe(true);
  });

  test('pasted, it is reviewed, saved into the week, counted in the payout, refused a second time, and voided with a reason', async ({ page }) => {
    await loadAppWithState(page, book());
    const ws: string = await ev(page, `attWeekStartOf(localDateStr())`) as string;
    const before: number = await ev(page, `payWeek('${ws}').total`) as number;
    await pasteCash(page, MSG);
    // A line saying what it was for nowhere is asked before the save.
    await page.locator('[data-action="invPayCashSave"]').click();
    await expect(page.locator('[data-cash-review]')).toBeVisible();
    await page.locator('[data-cash-what="3"]').fill('Gloves');
    await page.locator('[data-cash-cat="4"]').selectOption('repair');
    await page.locator('[data-action="invPayCashSave"]').click();
    await expect(page.locator('[data-cash-review]')).toHaveCount(0);
    const st: any = await readStoredState(page);
    expect(st.cashOut).toHaveLength(5);
    expect(st.cashOut.every((e: any) => e.week === ws)).toBe(true);
    expect(st.cashOut.find((e: any) => e.what === 'KILO ROMEO').cat).toBe('repair');
    expect(st.cashOut.find((e: any) => e.what === 'SABUN').date).toBe(await ev(page, 'localDateStr()'));
    expect(st.cashPastes).toHaveLength(1);
    const after: any = await ev(page, `(function(){ var w = payWeek('${ws}'); return { total: w.total, cash: w.cashOut }; })()`);
    expect(after.cash).toBe(1510);
    expect(after.total).toBeCloseTo(before + 1510, 2);
    // Pay shows it in the verdict and its own card.
    await ev(page, `attSetView('pay')`);
    await expect(page.locator('[data-card="cashout"]')).toBeVisible();
    await expect(page.locator('[data-pay-cashout]')).toContainText('1,510');
    await expect(page.locator('[data-card="cashout"] [data-cash-row]')).toHaveCount(5);
    // The same message again would count it twice: refused.
    await pasteCash(page, MSG);
    await expect(page.locator('[data-cash-seen]')).toBeVisible();
    await expect(page.locator('[data-action="invPayCashSave"]')).toBeDisabled();
    await page.locator('[data-cash-review] [data-action="invCloseOverlay"]').last().click();
    // A line voided with a reason leaves the payout.
    await ev(page, `attSetView('pay')`);
    const id = st.cashOut.find((e: any) => e.what === 'JAR').id;
    await page.locator(`[data-action="invPayCashVoid"][data-id="${id}"]`).click();
    await page.locator('.inv-dialog input, .inv-dialog textarea').last().fill('Bought twice');
    await page.locator('.inv-dialog .inv-btn-primary').last().click();
    await expect.poll(() => ev(page, `payWeek('${ws}').cashOut`)).toBe(1360);
  });

  test('the bank reads that part of the Saturday cash as other costs, not wages or drawings', async ({ page }) => {
    await loadAppWithState(page, book());
    const out: any = await ev(page, `(function(){
      var ws = '2026-09-06';
      var pw = { recordedDays: 6, workingDays: 6, total: 5000, cashOut: 1000, lab: { hourlessMarks: 0 } };
      var orig = payWeek; payWeek = function() { return pw; };
      try {
        var cls = [{ cat: 'wages', cash: true, row: { date: '2026-09-12', dr: 7000 }, auto: false }];
        var bm = bankCostByMonth(cls);
        var c = bm.cashWeeks[ws] || Object.values(bm.cashWeeks)[0];
        return { wages: c && c.wages, misc: c && c.misc, drawings: c && c.drawings, other: Math.round(bm.months['2026-09'].other.amount) };
      } finally { payWeek = orig; }
    })()`);
    expect(out.wages).toBe(4000);
    expect(out.misc).toBe(1000);
    expect(out.drawings).toBe(2000);
    expect(out.other).toBe(1000);
  });
});
