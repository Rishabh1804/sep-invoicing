import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { longBook } from './load-fixture';

// P232 (docs/UI_PASS_3.md §13, §26d; the owner: "The report generated for power cut is extremely text heavy for anyone to be
// interested in solving it. Text heavy should be an optional copy and our copy, so that we know the entire context."): the power
// case and a report each lead with one A4 page, a picture first, the text after it under a toggle, our copy. Every figure on the
// picture is the document's own arithmetic; the charts are the screens' builders on paper, in the printed colours on every palette
// and theme; two prints each, the picture alone and the picture with the text. Made-up names and figures only (the long book).

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const pic = (page: Page) => page.locator('#powerPictureSheet [data-power-picture]');
const rpic = (page: Page) => page.locator('#rptPictureSheet [data-rpt-picture]');

async function openCase(page: Page) {
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="case"]').click();
  await expect(pic(page)).toBeVisible();
}

test.describe('P232: the power case as a picture', () => {
  test('the picture leads: four tiles, cuts by month and by the hour, the cost as one bar, the options with the recommendation, the open items', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openCase(page);
    await expect(pic(page).locator('[data-pcp-tile]')).toHaveCount(4);
    // Every figure is powerAnalysis's own: the cuts of the last twelve months, the damage on record, the options.
    const want = await ev(page, `(function () { var a = powerAnalysis(), from = isoAddDays(localDateStr(), -364);
      return { n: a.cuts.filter(function (c) { return c.date >= from; }).length, cost: finRs(a.totals.cost), opts: (a.options || []).map(function (o) { return o.key; }),
        restart: finRs(a.totals.restart), months: a.months.slice(-12).length, quiet: a.months.slice(-12).filter(function (m) { return m.quiet > 0; }).length }; })()`) as any;
    expect(want.n).toBeGreaterThan(0);
    await expect(pic(page).locator('[data-pcp-tile="cuts"] .inv-pcp-tile-v')).toHaveText(String(want.n));
    await expect(pic(page).locator('[data-pcp-sec="cost"] .inv-pcp-h')).toContainText(want.cost);
    await expect(pic(page).locator('[data-pcp-part="restart"]')).toContainText(want.restart);
    await expect(pic(page).locator('[data-pcp-sec="months"] .inv-chart-bar, [data-pcp-sec="months"] .inv-chart-hatched')).toHaveCount(want.months);
    await expect(pic(page).locator('[data-pcp-sec="months"] [data-hatch]')).toHaveCount(want.quiet);
    await expect(pic(page).locator('[data-pcp-option]')).toHaveCount(want.opts.length);
    await expect(pic(page).locator('[data-pcp-option].inv-pcp-card-rec')).toHaveAttribute('data-pcp-option', 'ts');
    await expect(pic(page).locator('[data-pcp-sec="open"] li')).not.toHaveCount(0);
    // A chart on paper has no readout and no Table: paper has no tap. Each bar says its figure.
    await expect(pic(page).locator('[data-action="invChartTable"], .inv-chart-readout')).toHaveCount(0);
    await expect(pic(page).locator('[data-pcp-sec="hours"] .inv-chart-val')).not.toHaveCount(0);
  });

  test('the full case is our copy under the picture: shut until Read the full case, then the text as it was', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openCase(page);
    const full = page.locator('#powerCaseSheet');
    await expect(full).toBeHidden();
    await expect(full.locator('[data-power-case]')).toContainText('1. In short');
    const btn = page.locator('[data-action="invPowerCaseFull"]');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect(full).toBeVisible();
    await expect(btn).toHaveText('Hide the full case');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await btn.click();
    await expect(full).toBeHidden();
  });

  test('Print the picture prints one A4 page; Print the full case the picture, then the text', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openCase(page);
    await expect(page.locator('#powerContent .inv-btn-primary')).toHaveText(['Print the picture']);
    await page.locator('[data-action="invPowerPrintPicture"]').click();
    await expect(page.locator('#invPrintBody [data-power-picture]')).toBeVisible();
    await expect(page.locator('#invPrintBody [data-power-case]')).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    const one = await page.locator('#invPrintBody [data-power-picture]').evaluate(el => {
      const box = el.getBoundingClientRect(), mm = 96 / 25.4;
      return { h: box.height / mm, content: (el as HTMLElement).scrollHeight / mm };
    });
    expect(one.h).toBeLessThanOrEqual(297.5);
    expect(one.content).toBeLessThanOrEqual(297.5);
    await page.emulateMedia({ media: 'screen' });
    await ev(page, `closePrintPreview()`);
    await page.locator('[data-action="invPowerPrint"]').click();
    const order = await page.locator('#invPrintBody').evaluate(el => Array.from(el.children).map(c => c.hasAttribute('data-power-picture') ? 'picture' : c.hasAttribute('data-power-case') ? 'case' : '?'));
    expect(order).toEqual(['picture', 'case']);
  });
});

test.describe('P232: a report as a picture', () => {
  test('the picture leads: revenue, tonnes, realisation and cash; two charts by the period’s parts; what to look at now', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    await expect(rpic(page)).toBeVisible();
    await expect(rpic(page)).toHaveAttribute('data-kind', 'monthly');
    await expect(rpic(page).locator('[data-pcp-tile]')).toHaveCount(4);
    // The revenue tile is the report's own Invoiced figure (whole rupees on the picture).
    const want = await ev(page, `(function () { var p = rptCurrent(), end = p.to > localDateStr() ? localDateStr() : p.to;
      return finRs(sumTaxable(statsInvoices().filter(function (i) { return i.date && i.date >= p.from && i.date <= end; }))); })()`) as string;
    await expect(rpic(page).locator('[data-pcp-tile="revenue"] .inv-pcp-tile-v')).toHaveText(want);
    await expect(rpic(page).locator('[data-pcp-sec="chart1"] .inv-pcp-h')).toHaveText('Invoiced by pay week');
    await expect(rpic(page).locator('[data-pcp-sec="chart1"] .inv-chart-axis, [data-pcp-sec="chart1"] text').filter({ hasText: /^W\d+/ }).first()).toBeAttached();
    // While the period runs, what to look at is the red and amber of the To-do, as the report's Open items hold it.
    const red = await ev(page, `todoRanked().filter(function (r) { return r.tone === 'red' || r.tone === 'amber'; }).length`) as number;
    await expect(rpic(page).locator('[data-pcp-sec="look"] li')).toHaveCount(Math.min(3, red));
    // A day reads by line.
    await page.locator('[data-action="invRptKind"][data-kind="daily"]').click();
    await expect(rpic(page).locator('[data-pcp-sec="chart1"] .inv-pcp-h')).toHaveText('Plated by line, kg');
  });

  test('a past period looks at its worst figures, never at today’s tasks; nothing to draw says so in words', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
    await expect(rpic(page).locator('[data-pcp-sec="look"] .inv-pcp-h')).toHaveText('To look at');
    const tasks = await ev(page, `todoRanked().map(function (r) { return r.app ? r.app.title : r.mine.text; })`) as string[];
    const said = await rpic(page).locator('[data-pcp-sec="look"]').innerText();
    for (const t of tasks) expect(said).not.toContain(t);
    // A day far back has nothing on record: each chart says so, never draws an empty frame read as a zero.
    await ev(page, `rptSet('daily', isoAddDays(localDateStr(), -400)); renderReports()`);
    await expect(rpic(page).locator('[data-pcp-sec="chart1"] .inv-pcp-none')).toHaveText('Nothing plated on record');
    await expect(rpic(page).locator('[data-pcp-sec="chart1"] svg')).toHaveCount(0);
  });

  test('the report is under its picture until Read the full report; the two prints, and the queue’s rule kept', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    await expect(page.locator('#rptSheet')).toBeHidden();
    await page.locator('[data-action="invRptFull"]').click();
    await expect(page.locator('#rptSheet [data-rpt-doc]')).toBeVisible();
    await page.locator('[data-action="invRptPrintPicture"]').click();
    await expect(page.locator('#invPrintBody [data-rpt-picture]')).toBeVisible();
    await expect(page.locator('#invPrintBody [data-rpt-doc]')).toHaveCount(0);
    // The period still running lists the sender's own tasks on its picture too: only the owner opens it from the queue.
    expect(await ev(page, `JSON.stringify(_printNeed)`)).toContain('"owner":true');
    await ev(page, `closePrintPreview()`);
    await page.locator('[data-action="invRptPrint"]').click();
    const order = await page.locator('#invPrintBody').evaluate(el => Array.from(el.children).map(c => c.hasAttribute('data-rpt-picture') ? 'picture' : c.hasAttribute('data-rpt-doc') ? 'report' : '?'));
    expect(order).toEqual(['picture', 'report']);
  });
});

test('paper reads no palette and no theme: a picture’s charts print the same ink on every palette, dark as light', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await openCase(page);
  const inks = async () => page.locator('#powerPictureSheet').evaluate(el => Array.from(el.querySelectorAll('.inv-chart-bar, .inv-sharebar-part, .inv-chart-grid-label, .inv-pcp-tile, .inv-pcp-doc'))
    .map(e => { const cs = getComputedStyle(e); return cs.fill + '|' + cs.color + '|' + cs.backgroundColor + '|' + cs.borderTopColor; }).join(';'));
  await ev(page, `document.documentElement.dataset.palette = 'teal'`);
  const teal = await inks();
  for (const pal of ['zinc', 'terracotta']) {
    await ev(page, `document.documentElement.dataset.palette = '${pal}'`);
    expect(await inks(), pal).toBe(teal);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await inks(), 'dark').toBe(teal);
});

test('a chart on paper: the drawing alone, each bar its figure, a bar known to read low hatched', async ({ page }) => {
  await loadAppWithState(page, longBook());
  const html = await ev(page, `chartBars([{ label: 'A', value: 3 }, { label: 'B', value: 5, hatch: true, note: '2 days likely unreported' }], { unit: 'count', paper: true })`) as string;
  expect(html).toContain('inv-chart-paper');
  expect(html).not.toContain('invChartTable');
  expect(html).not.toContain('inv-chart-readout');
  expect(html).toContain('data-hatch');
  expect(html).toContain('2 days likely unreported');
  expect((html.match(/inv-chart-val/g) || []).length).toBe(2);
});
