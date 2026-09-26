import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso } from './fixtures';

// P60: charts that answer questions (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 2). Each chart is drawn into a
// scratch box on a booted page, so the tests read the same markup the dashboards will.

async function draw(page: Page, js: string) {
  await page.evaluate(src => {
    let box = document.getElementById('chartTest');
    // On <body>, not inside a page: Home re-renders itself after boot and would take the box with it.
    // Pinned above the app's fixed bars, so a tap reaches the datum and not the bottom navbar (test-only styling).
    if (!box) { box = document.createElement('div'); box.id = 'chartTest'; box.className = 'inv-panel'; box.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9999;max-height:70vh;overflow:auto'; document.body.appendChild(box); }
    box.innerHTML = (0, eval)(src);
  }, js);
}

test.beforeEach(async ({ page }) => {
  const s = emptyState() as any; s.incomingMaterial = noSeedIM();
  await loadAppWithState(page, s);
});

test('a line that goes overdrawn draws below a zero line, and several series share one axis', async ({ page }) => {
  await draw(page, `chartLines(['Apr','May','Jun','Jul'], [
    { label: 'Balance', values: [120000, 40000, -30000, 15000] },
    { label: 'In', values: [90000, 70000, 60000, 110000], tone: 2 } ], { ariaLabel: 'Cash' })`);
  await expect(page.locator('#chartTest .inv-chart-zero')).toHaveCount(1);
  await expect(page.locator('#chartTest polyline.inv-chart-path')).toHaveCount(2);
  await expect(page.locator('#chartTest .inv-chart-pt')).toHaveCount(8);
  // The overdrawn point sits below the zero line.
  const [zeroY, lowY] = await page.evaluate(() => {
    const z = document.querySelector('#chartTest .inv-chart-zero')!.getAttribute('y1');
    const p = Array.from(document.querySelectorAll('#chartTest .inv-chart-pt')).find(c => /Jun: -/.test(c.getAttribute('data-read') || ''))!;
    return [+z!, +p.getAttribute('cy')!];
  });
  expect(lowY).toBeGreaterThan(zeroY);
  // The keys carry each series' last value.
  await expect(page.locator('#chartTest .inv-chart-keys')).toContainText('Balance');
  await expect(page.locator('#chartTest .inv-chart-keys')).toContainText('₹15K');
});

test('a line with no negative draws no zero line, and a band draws a range', async ({ page }) => {
  await draw(page, `chartLines(['1','2','3'], [{ label: 'Forecast', values: [10, 12, 14] }], { band: [{ lo: 8, hi: 12 }, { lo: 9, hi: 15 }, { lo: 10, hi: 18 }] })`);
  await expect(page.locator('#chartTest .inv-chart-zero')).toHaveCount(0);
  await expect(page.locator('#chartTest polygon.inv-chart-band')).toHaveCount(1);
});

test('a tap on a point reads its exact figure into the readout', async ({ page }) => {
  await draw(page, `chartLines(['Apr','May'], [{ label: 'Balance', values: [120000, 40000.5] }])`);
  await page.locator('#chartTest .inv-chart-pt').nth(1).click();
  await expect(page.locator('#chartTest .inv-chart-readout')).toHaveText('Balance, May: ₹40,000.50');
  await expect(page.locator('#chartTest .inv-chart-pt').nth(1)).toHaveClass(/inv-chart-read-on/);
});

test('stacked bars stack to their total; grouped bars stand side by side', async ({ page }) => {
  await draw(page, `chartStack(['Jul','Aug'], [
    { label: 'Wages', values: [60, 40] }, { label: 'Power', values: [40, 0] } ], { unit: 'count' })`);
  // Aug has no Power: three segments, not four.
  await expect(page.locator('#chartTest rect.inv-chart-seg')).toHaveCount(3);
  const jul = await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('#chartTest rect.inv-chart-seg')).filter(e => e.getAttribute('data-key') === 'Jul');
    return { h: r.reduce((s, e) => s + +e.getAttribute('height')!, 0), top: Math.min(...r.map(e => +e.getAttribute('y')!)), xs: new Set(r.map(e => e.getAttribute('x'))).size };
  });
  expect(jul.xs).toBe(1);   // one column
  await draw(page, `chartStack(['Jul'], [{ label: 'In', values: [50] }, { label: 'Out', values: [30] }], { mode: 'group', unit: 'count' })`);
  const xs = await page.evaluate(() => Array.from(document.querySelectorAll('#chartTest rect.inv-chart-seg')).map(e => +e.getAttribute('x')!));
  expect(xs[1]).toBeGreaterThan(xs[0]);   // side by side
  await page.locator('#chartTest rect.inv-chart-seg').first().click();
  await expect(page.locator('#chartTest .inv-chart-readout')).toHaveText('Jul, In: 50');
});

test('a pie wedge is tappable, reads its share, and the selected one is marked', async ({ page }) => {
  await draw(page, `chartPieTap([{ key: 'wages', label: 'Wages', value: 75 }, { key: 'power', label: 'Electricity', value: 25 }], { unit: 'count', selected: 'power' })`);
  await expect(page.locator('#chartTest .inv-chart-wedge[data-key="power"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#chartTest .inv-chart-legend-row[data-key="power"]')).toHaveAttribute('aria-pressed', 'true');
  // A finger lands on the ring, not the hole: aim at the right edge of the three-quarter wedge.
  const w = page.locator('#chartTest .inv-chart-wedge[data-key="wages"]');
  const bb = (await w.boundingBox())!;
  await w.click({ position: { x: bb.width * 0.93, y: bb.height * 0.5 } });
  await expect(page.locator('#chartTest .inv-chart-readout')).toHaveText('Wages: 75 (75.0%)');
});

test('a range names the months it covers', async ({ page }) => {
  const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08'];
  const r = await page.evaluate(ms => { const w = window as any; return { m3: w.chartRangeMonths('3M', ms), m6: w.chartRangeMonths('6M', ms), all: w.chartRangeMonths('ALL', ms) }; }, months);
  expect(r.m3).toEqual(['2025-06', '2025-07', '2025-08']);
  expect(r.m6).toHaveLength(6);
  expect(r.all).toHaveLength(8);
  // FY runs from April of the current financial year.
  const t = todayIso(), y = +t.slice(0, 4), m = +t.slice(5, 7), start = `${m >= 4 ? y : y - 1}-04`;
  const fyMonths = [`${+start.slice(0, 4) - 1}-12`, start, t.slice(0, 7)];
  const fy = await page.evaluate(ms => (window as any).chartRangeMonths('FY', ms), fyMonths);
  expect(fy).toEqual([...new Set([start, t.slice(0, 7)])]);
  await draw(page, `chartRangeHtml('6M', 'invTestRange')`);
  await expect(page.locator('#chartTest [data-range="6M"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#chartTest [data-range]')).toHaveText(['3M', '6M', 'FY', 'All']);
});
