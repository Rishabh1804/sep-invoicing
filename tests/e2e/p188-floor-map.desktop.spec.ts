import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { longBook } from './load-fixture';

// P188 on the desktop (docs/TAB_MAP.md TM4): Floor's Overview four heroes across; Production's Entries a list beside the open entry,
// each row saying where it came from; Stock's Spend and prices in the pane beside the list; Power's toolbar per view (§1a-12) and its
// case at life size where the sheet fits. Made-up names and figures.

const where = (p: Page) => p.evaluate(() => { const l = (window as any).navLoc(); return [l.tab, l.v || '', l.id || '']; });
const tabs = (page: Page, page_: string) => page.locator(`#${page_} .inv-viewtabs:not(#wsTabs) .inv-viewtab`);

test.describe('P188: Floor’s map on the desktop', () => {
  test('the Overview’s four heroes go across, People carrying the verdict, the turnaround on a row of its own; the line cards follow', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageFloor');
    await expect(page.locator('#flrHeroes')).toHaveClass(/inv-heroes-4/);
    const boxes = await page.locator('#flrHeroes > [data-card]').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width)]; }));
    expect(boxes).toHaveLength(5);
    // Four across from 80rem; two to a row under it. The fifth (the flow thread's turnaround, T3) is alone on the last row and
    // takes it, so the grid never ends in a blank cell.
    const wide = await page.evaluate(() => window.innerWidth >= 80 * parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(new Set(boxes.slice(0, 4).map(b => b[0])).size).toBe(wide ? 1 : 2);
    expect(boxes[4][0]).toBeGreaterThan(boxes[3][0]);
    const row = await page.locator('#flrHeroes').evaluate(e => Math.round(e.getBoundingClientRect().width));
    expect(Math.abs(boxes[4][1] - row)).toBeLessThanOrEqual(1);
    await expect(page.locator('#flrHeroes > [data-card="flr-people"]')).toHaveAttribute('data-verdict', '');
    await expect(page.locator('#flrLines > [data-line]')).toHaveCount(4);
  });

  test('Production → Entries: a list beside the open entry, each row naming where it came from; Lines and Entries alone carry Paste message', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveText(['Paste message']);
    await tabs(page, 'pageProduction').filter({ hasText: 'Entries' }).click();
    await expect(page.locator('#prodEntriesVerdict')).toHaveAttribute('open', '');
    const badges = await page.locator('#prodEntriesHost [data-prod-badges] .inv-badge').allInnerTexts();
    expect(badges.some(b => /^(register|relay|message|hand|import)$/.test(b))).toBe(true);
    const first = page.locator('#prodEntriesHost [data-action="invProdEntryOpen"]').first();
    const id = await first.getAttribute('data-id');
    await first.click();
    await expect(page.locator('#prodEntryPane')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'entries', id]);
    await tabs(page, 'pageProduction').filter({ hasText: 'In plant' }).click();
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveCount(0);
  });

  test('Stock: Spend and prices opens in the pane beside the list and shuts on a second press', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStock');
    await expect(page.locator('#stockVerdict')).toHaveAttribute('open', '');
    await expect(page.locator('#pageStock details[data-fold="stock-spend"]')).toHaveCount(0);
    const btn = page.locator('#pageStock [data-action="invStockSpend"]');
    await btn.click();
    await expect(page.locator('#stockMasterDetail')).toHaveClass(/inv-pane-open/);
    await expect(page.locator('#stockMasterDetail #stockSpend #dashSupplier')).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(page.locator('#stockMasterDetail')).not.toHaveClass(/inv-pane-open/);
  });

  test('Power: each view its own toolbar, the cards open; the case at life size where the sheet fits', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pagePower');
    await expect(page.locator('#powerVerdict')).toHaveAttribute('open', '');
    await expect(page.locator('#powerContent [data-power-toolbar="cuts"] .inv-btn-primary')).toHaveText('Enter a cut');
    await expect(page.locator('#powerContent [data-power-toolbar="cuts"] .inv-btn')).toHaveText(['Enter a cut', 'More']);
    await tabs(page, 'pagePower').filter({ hasText: 'Causes' }).click();
    await expect(page.locator('#powerContent [data-power-toolbar]')).toHaveCount(0);
    await expect(page.locator('#pcsVerdict')).toHaveAttribute('open', '');
    await tabs(page, 'pagePower').filter({ hasText: 'Load & bills' }).click();
    await expect(page.locator('#powerContent [data-power-toolbar="load"] .inv-btn')).toHaveText(['Edit load']);
    await tabs(page, 'pagePower').filter({ hasText: 'Case' }).click();
    await expect(page.locator('#powerContent [data-power-toolbar="case"] .inv-btn')).toHaveText(['Print the case', 'Options’ figures']);
    const zoom = await page.locator('#powerCaseSheet').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--pp-zoom')));
    expect(zoom).toBe(1);
  });

  test('People: Week’s way back to this week is a button on the desktop, not under More', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStaff');
    await page.locator('[data-att-period] [data-view="week"]').click();
    await expect(page.locator('#attWeekVerdict')).toHaveAttribute('open', '');
    const back = page.locator('[data-att-toolbar="week"] [data-action="invAttThisWeek"]');
    await expect(back).toBeDisabled();
    await page.locator('[data-att-toolbar="week"] [data-action="invAttWeekStep"][data-step="-1"]').click();
    await expect(back).toBeEnabled();
    await back.click();
    await expect(back).toBeDisabled();
  });
});
