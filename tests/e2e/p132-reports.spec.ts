import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, switchTab, todayIso, type SepState } from './fixtures';
import { sweepState, dayOff } from './sweep-fixture';

// P132: Review → Reports (owner, 1 Oct 2026: "a daily weekly and a monthly quarterly yearly report generator"). A report
// is a document drawn from the data every time it is shown or printed, the Power case's contract: the same A4 document on
// the page and in the print view, every figure read off the app's own function. The book is the sweep's (made-up names,
// dates from today): invoices over six months, challans, attendance, production, a power cut, a bank statement.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function openReports(page: Page, kind?: string) {
  await switchTab(page, 'pageReports');
  if (kind) await page.locator(`[data-action="invRptKind"][data-kind="${kind}"]`).click();
  await expect(page.locator('#rptSheet [data-rpt-doc]')).toHaveAttribute('data-kind', kind || /.+/);
}
const doc = (page: Page) => page.locator('#rptSheet [data-rpt-doc]');

test('Reports is in Insights, after Stats; each kind draws with its title and the open period reads "to date"', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageStats');
  await expect(page.locator('#wsTabs .inv-viewtab')).toHaveText(['Stats', 'Reports', 'History']);
  await page.locator('#wsTabs [data-tab="pageReports"]').click();
  await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#topbarTitle')).toHaveText('Insights');
  await expect(page.locator('#wsTabs [data-tab="pageReports"]')).toHaveAttribute('aria-selected', 'true');
  const t = todayIso(), d = new Date(t + 'T00:00:00');
  const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, fyl = `FY ${fy}-${String(fy + 1).slice(2)}`;
  const q = Math.floor(((d.getMonth() + 1 - 4 + 12) % 12) / 3) + 1;
  const want: Record<string, RegExp> = {
    daily: new RegExp(`^Daily report — [A-Z][a-z]+day ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, to date$`),
    weekly: new RegExp(`^Weekly report — W\\d+ · \\d+ \\w{3}( \\d{4})? – \\d+ \\w{3} \\d{4}, to date$`),
    monthly: new RegExp(`^Monthly report — ${MONTHS[d.getMonth()]} ${d.getFullYear()}, to date$`),
    quarterly: new RegExp(`^Quarterly report — Q${q} ${fyl} · \\w{3}( \\d{4})? – \\w{3} \\d{4}, to date$`),
    yearly: new RegExp(`^Yearly report — ${fyl}, to date$`),
  };
  for (const k of Object.keys(want)) {
    await page.locator(`[data-action="invRptKind"][data-kind="${k}"]`).click();
    await expect(doc(page)).toHaveAttribute('data-kind', k);
    await expect(doc(page).locator('.inv-rpt-title')).toHaveText(want[k]);
    await expect(doc(page).locator('.inv-rpt-meta')).toContainText(/build/);
    await expect(page.locator('#reportsContent .inv-stepper-sub, #reportsContent .inv-stepper-label')).not.toHaveCount(0);
    await expect(page.locator('#reportsContent .inv-stepper')).toContainText('to date');
    // The page's one primary.
    await expect(page.locator('#pageReports .inv-btn-primary:visible')).toHaveText(['Print']);
  }
  // A weekly is the pay week, Sunday to Saturday; the stepper moves it back a week and the next one is reachable again.
  await page.locator('[data-action="invRptKind"][data-kind="weekly"]').click();
  await expect(page.locator('[data-action="invRptStep"][data-step="1"]')).toBeDisabled();
  await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
  const from = await doc(page).getAttribute('data-from'), to = await doc(page).getAttribute('data-to');
  expect(new Date(from + 'T00:00:00').getDay()).toBe(0);
  expect(new Date(to + 'T00:00:00').getDay()).toBe(6);
  expect(await g(page, `isoDaysBetween('${from}', '${to}')`)).toBe(6);
  expect(from! <= t && to! < t).toBe(true);
  await expect(doc(page).locator('.inv-rpt-title')).not.toContainText('to date');
  await expect(doc(page).locator('[data-rpt-table="breakdown"] tbody tr')).toHaveCount(7);
  await expect(doc(page).locator('[data-rpt-table="breakdown"] tbody tr').first()).toContainText('Sun');
  await expect(page.locator('[data-action="invRptStep"][data-step="1"]')).toBeEnabled();
  await page.locator('[data-action="invRptNow"]').click();
  await expect(doc(page).locator('.inv-rpt-title')).toContainText('to date');
});

test('the figures are the app\'s own: invoiced equals Stats\' headline for the month, labour equals labourForRange', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openStatsTab(page, 'overview');
  await page.locator('[data-action="invStatsPeriod"][data-period="mtd"]').click();
  const statsRev = (await page.locator('#statsContent [data-card="headline"] [data-tile="revenue"] .inv-tile-value').innerText()).replace(/\s+/g, '');
  // Make a report from the Overview opens Reports on the same period.
  await page.locator('#statsMakeReport').click();
  await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
  await expect(doc(page)).toHaveAttribute('data-kind', 'monthly');
  const rptRev = (await doc(page).locator('[data-rpt-tile="invoiced"] .inv-rpt-tile-v').innerText()).replace(/\s+/g, '');
  expect(rptRev).toBe(statsRev);
  // Labour on a month the sweep book's attendance falls in (the twelve days before today): the latest one with marks.
  const lastMarked = dayOff(-1) === todayIso() ? todayIso() : (new Date(dayOff(-1) + 'T00:00:00').getDay() === 0 ? dayOff(-2) : dayOff(-1));
  if (lastMarked.slice(0, 7) !== todayIso().slice(0, 7)) await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
  const from = (await doc(page).getAttribute('data-from'))!, to = (await doc(page).getAttribute('data-to'))!;
  const lab = await g(page, `formatCurrency(labourForRange('${from}', '${to}' > localDateStr() ? localDateStr() : '${to}').total)`);
  expect(lab).not.toBe('₹0.00');
  await expect(doc(page).locator('[data-rpt-tile="labour"] .inv-rpt-tile-v')).toHaveText(lab as string);
  // The month's live cost by component, with its sources (a month or longer).
  await expect(doc(page).locator('[data-rpt-sec="cost"] [data-rpt-table="cost"]')).toContainText(/measured|model|part-recorded|paid, bank/);
  // The power cut two days back, with its damage, on the Power page's own reading.
  await page.locator('[data-action="invRptKind"][data-kind="weekly"]').click();
  if (await page.locator('[data-action="invRptNow"]').isEnabled()) await page.locator('[data-action="invRptNow"]').click();
  const wf = (await doc(page).getAttribute('data-from'))!;
  if (dayOff(-2) >= wf) {
    await expect(doc(page).locator('[data-rpt-tile="power"] .inv-rpt-tile-v')).toHaveText('1');
    const dmg = await g(page, `formatCurrency(powerAnalysis().cuts.find(c => c.date === '${dayOff(-2)}').cost.total)`);
    await expect(doc(page).locator('[data-rpt-table="cuts"] tbody')).toContainText(dmg as string);
  }
});

test('credit notes are netted and said; a day lists its invoices and challans', async ({ page }) => {
  const s: any = sweepState();
  await loadAppWithState(page, s);
  // CN1 credits ₹400 over INV-1 and INV-7: the month of INV-7 reads net of its share, and says so.
  const inv7 = s.invoices.find((x: any) => x.id === 'INV-7');
  await openReports(page, 'monthly');
  await page.locator('#rptMonth').fill(inv7.date.slice(0, 7));
  await page.locator('#rptMonth').dispatchEvent('change');
  await expect(doc(page)).toHaveAttribute('data-from', inv7.date.slice(0, 7) + '-01');
  const want = await g(page, `formatCurrency(sumTaxable(statsInvoices().filter(i => i.date && i.date.slice(0, 7) === '${inv7.date.slice(0, 7)}')))`);
  await expect(doc(page).locator('[data-rpt-tile="invoiced"] .inv-rpt-tile-v')).toHaveText(want as string);
  await expect(doc(page).locator('[data-rpt-tile="invoiced"]')).toContainText(/net of ₹[\d,]+\.\d\d in credit notes/);
  const gross = s.invoices.filter((x: any) => x.status === 'active' && x.date.slice(0, 7) === inv7.date.slice(0, 7)).reduce((a: number, x: any) => a + x.taxableValue, 0);
  expect(Number(String(want).replace(/[₹,]/g, ''))).toBeLessThan(gross);
  // A day: the invoices issued and the challans received that day, as lists.
  await page.locator('[data-action="invRptKind"][data-kind="daily"]').click();
  await page.locator('#rptDay').fill(dayOff(-1));
  await page.locator('#rptDay').dispatchEvent('change');
  await expect(doc(page)).toHaveAttribute('data-from', dayOff(-1));
  const dayInvs = s.invoices.filter((x: any) => x.date === dayOff(-1) && x.status === 'active').length;
  if (dayInvs) await expect(doc(page).locator('[data-rpt-table="dayinvoices"] tbody tr')).toHaveCount(dayInvs);
  await expect(doc(page).locator('[data-rpt-table="daychallans"] tbody tr')).toHaveCount(1);
  await expect(doc(page).locator('[data-rpt-table="lines"] tbody tr')).toHaveCount(3);
  // A past day lists no open To-do (it would invent the day's tasks); today's does.
  await expect(doc(page).locator('[data-rpt-sec="open"]')).toHaveCount(0);
  await page.locator('[data-action="invRptNow"]').click();
  await expect(doc(page).locator('[data-rpt-sec="open"]')).toHaveCount(1);
});

test('a period with nothing recorded says so in one line and shows no zero tile', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  await openReports(page, 'monthly');
  await expect(doc(page).locator('.inv-rpt-none').first()).toContainText('Nothing is recorded for this period');
  await expect(doc(page).locator('.inv-rpt-tile')).toHaveCount(0);
  // The sweep book a year back: nothing then either.
  await loadAppWithState(page, sweepState());
  await openReports(page, 'yearly');
  await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
  await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
  await expect(doc(page).locator('.inv-rpt-tile')).toHaveCount(0);
  await expect(doc(page)).toContainText('Nothing is recorded for this period');
  // And where a tile has nothing of its own, it is a dash with the reason, never a 0.
  await page.locator('[data-action="invRptNow"]').click();
  await page.locator('[data-action="invRptKind"][data-kind="daily"]').click();
  for (const v of await doc(page).locator('.inv-rpt-tile-v').allInnerTexts()) expect(v.trim()).not.toMatch(/^(₹0\.00|0|0 kg)$/);
});

test('Print sends the same document to the print view, A4 with no page margin, named for the period', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openReports(page, 'monthly');
  const onPage = await doc(page).locator('.inv-rpt-title').innerText();
  await page.locator('[data-action="invRptPrint"]').click();
  await expect(page.locator('#invPrintView')).toHaveClass(/inv-print-view-active/);
  await expect(page.locator('#invPrintBody [data-rpt-doc] .inv-rpt-title')).toHaveText(onPage);
  expect(await page.title()).toMatch(/^SEP monthly report \d{4}-\d{2}$/);
  // Laid out on screen at the sheet's width, zoomed to fit the phone.
  const w = await page.locator('#invPrintBody [data-rpt-doc]').evaluate(el => el.getBoundingClientRect().width / (parseFloat(getComputedStyle(el).zoom) || 1));
  expect(Math.abs(w - 210 * 96 / 25.4)).toBeLessThan(2);
  // Every @page rule's margin is 0: a margin box is where the browser stamps its own header and footer.
  const margins = await page.evaluate(() => {
    const out: string[] = [];
    for (const sh of Array.from(document.styleSheets)) { try { for (const r of Array.from(sh.cssRules)) if (r instanceof CSSPageRule) out.push(r.style.margin); } catch { /* cross-origin */ } }
    return out;
  });
  expect(margins.length).toBeGreaterThan(0);
  for (const m of margins) expect(m).toMatch(/^0(px)?$/);
  // On paper: A4, the frame's head repeating, the page's chrome gone.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#pageReports')).toBeHidden();
  await expect(page.locator('#invPrintBody .inv-rpt-frame-head')).toBeVisible();
  const pdf = await page.pdf({ format: 'A4' });
  const mb = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  expect(Math.abs(Number(mb![1]) - 595.3)).toBeLessThan(1.5);
  expect(Math.abs(Number(mb![2]) - 841.9)).toBeLessThan(1.5);
  await page.emulateMedia({ media: 'screen' });
  // A save draws it again, in the print view too.
  await g(page, `S.company.name = 'Zeta Plating Works'; saveState(); tabRedrawActive()`);
  await expect(page.locator('#invPrintBody [data-rpt-doc] .inv-rpt-co')).toHaveText('Zeta Plating Works');
});

test('the address keeps the kind and the period, and a reload opens it again', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openReports(page, 'weekly');
  await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
  const from = (await doc(page).getAttribute('data-from'))!;
  await expect(page).toHaveURL(new RegExp(`tab=pageReports&v=weekly%2F${from}|tab=pageReports&v=weekly/${from}`));
  const title = await doc(page).locator('.inv-rpt-title').innerText();
  await page.locator('[data-action="invRptKind"][data-kind="yearly"]').click();
  await page.goBack();
  await expect(doc(page).locator('.inv-rpt-title')).toHaveText(title);
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
  await expect(doc(page).locator('.inv-rpt-title')).toHaveText(title);
});
