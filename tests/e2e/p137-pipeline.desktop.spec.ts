import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, openPulse } from './fixtures';
import { pipeState, pipeStateCalm, pipeStateLong, sweepStages } from './p137-pipeline.fixture';
import { bigSweepState, problems, sweepState, type Stop } from './sweep-fixture';

// P137 (desktop): the pipeline is a column the pane's width with the open stage's list filling the room beside it. Like
// every list-and-pane screen (P80) the page itself does not scroll: the pipeline and the list each scroll inside
// themselves. A stage's actions land where the desktop keeps them: the Register's table with its rows ticked, a challan
// open in IM's pane.

async function measure(page: Page) {
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  return page.evaluate(() => {
    const se = document.scrollingElement!, pg = document.querySelector('.inv-page-active') as HTMLElement;
    const rail = document.querySelector('#pagePipeline .inv-pipe-rail') as HTMLElement, list = document.getElementById('pipeList')!;
    const host = document.getElementById('pipeHost')!.getBoundingClientRect(), r = rail.getBoundingClientRect(), l = list.getBoundingClientRect();
    return {
      pageOver: se.scrollHeight - se.clientHeight,
      hostGap: Math.round(innerHeight - host.bottom - parseFloat(getComputedStyle(pg).paddingBottom)),
      railW: Math.round(r.width), railLeft: Math.round(r.left), listLeft: Math.round(l.left), listRight: Math.round(l.right), hostRight: Math.round(host.right),
      sameTop: Math.abs(r.top - l.top) < 1,
      listScrolls: list.scrollHeight > list.clientHeight + 1,
      pane: parseFloat(getComputedStyle(document.documentElement).fontSize) * 22,
    };
  });
}

for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
  test(`at ${w}×${h} the pipeline sits beside the open stage's list, and only the list scrolls`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await loadAppWithState(page, pipeStateLong());
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('#pipeList [data-pipe-list="created"]')).toBeVisible();
    const m = await measure(page);
    // Side by side, top-aligned: the pipeline the pane's width on the left, the list filling the rest to the host's edge.
    expect(m.sameTop).toBe(true);
    expect(Math.abs(m.railW - m.pane)).toBeLessThanOrEqual(1);
    expect(m.listLeft).toBeGreaterThan(m.railLeft + m.railW);
    expect(Math.abs(m.listRight - m.hostRight)).toBeLessThanOrEqual(1);
    // The page is still; the list of sixty-odd invoices scrolls inside itself, its foot on the page's.
    expect(m.pageOver).toBeLessThanOrEqual(1);
    expect(Math.abs(m.hostGap)).toBeLessThanOrEqual(1);
    expect(m.listScrolls).toBe(true);
    // Another stage is another list, from its top (Dispatched is as long: the one before's place is not kept).
    await page.locator('#pipeList').evaluate(el => { el.scrollTop = 400; });
    expect(await page.locator('#pipeList').evaluate(el => el.scrollTop)).toBe(400);
    await page.locator('#pagePipeline button[data-pipe-stage="dispatched"]').click();
    await expect(page.locator('#pipeList [data-pipe-list="dispatched"]')).toBeVisible();
    expect((await measure(page)).listScrolls).toBe(true);
    await expect.poll(() => page.locator('#pipeList').evaluate(el => el.scrollTop)).toBe(0);
    expect((await measure(page)).pageOver).toBeLessThanOrEqual(1);
  });
}

test('on a short screen the pipeline scrolls in its own column, and keeps its place when a stage is tapped', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 460 });
  await loadAppWithState(page, pipeState());
  await switchTab(page, 'pagePipeline');
  const rail = page.locator('#pagePipeline .inv-pipe-rail');
  expect(await rail.evaluate(el => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  const top = await rail.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
  expect(top).toBeGreaterThan(0);
  await page.locator('#pagePipeline button[data-pipe-stage="owed"]').click();
  await expect(page.locator('#pipeList [data-pipe-list="owed"]')).toBeVisible();
  expect(await rail.evaluate(el => el.scrollTop)).toBe(top);
});

test('the stage’s actions land where the desktop keeps them: the Register’s table ticked, a challan in IM’s pane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, pipeState());
  await openPulse(page);
  await switchTab(page, 'pagePipeline');
  await page.locator('#pipeList [data-pipe-list="created"] [data-action="invPipeBulk"]').click();
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  expect(await page.locator('#regMaster input[data-action="invRegToggleInv"]:checked').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id).sort()))
    .toEqual(['INV-C1', 'INV-C2', 'INV-C3']);
  await expect(page.locator('#regSelBar .inv-selbar-count')).toHaveText('3 selected');
  await expect(page.locator('#regSelBar [data-action="invRegBulkState"][data-state="printed"]')).toHaveText('Printed (3)');

  await switchTab(page, 'pagePipeline');
  await page.locator('#pagePipeline button[data-pipe-stage="awaiting"]').click();
  await page.locator('#pipeList [data-pipe-im="IM-3"]').click();
  await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#imMasterDetail')).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#imDetail .inv-pane-head')).toContainText('Ch. 703');
  // The desktop's top bar names the stage beside the page.
  await switchTab(page, 'pagePipeline');
  await page.locator('#pagePipeline button[data-pipe-stage="printed"]').click();
  await expect(page.locator('#topbarCtx')).toHaveText('Pipeline · Printed');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the pipeline and every stage's list are v2.0 only on the desktop (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ colorScheme: scheme });
    const stops: Stop[] = [];
    for (const book of [pipeState(), pipeStateCalm(), sweepState(), bigSweepState()]) {
      await loadAppWithState(page, book);
      await sweepStages(page, 'desktop', stops);
    }
    expect(stops.length).toBeGreaterThan(15);
    expect(problems(stops)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
