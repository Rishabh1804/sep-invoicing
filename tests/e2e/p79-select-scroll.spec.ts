import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';
import { walkSelects, probed, type Jump } from './p79-select-scroll.fixture';

// P79 (phone): picking an option in any drop-down, or pressing a filter chip or segment, on any page, view tab or
// dialog, leaves the page where it was. Receivables sent the page back to the top on every client picked.

test('a change inside a view never moves the page (phone)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await loadAppWithState(page, sweepState());
  const jumps: Jump[] = [];
  await walkSelects(page, jumps);
  // It reached the drop-downs the owner meant: Receivables' client pickers among them.
  expect(probed.filter(p => / select|#/.test(p)).length).toBeGreaterThan(15);
  expect(probed.some(p => p.includes('Receivables') && p.includes('data-bank-client'))).toBe(true);
  expect(jumps.map(j => `${j.where}: ${j.control} top ${j.before}→${j.after}, scroll ${j.scrollBefore}→${j.scrollAfter}`)).toEqual([]);
  expect(errors).toEqual([]);
});

test('an open view tab off the edge of a phone is brought in sideways, and a new tab starts at the top', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageFinance');
  const row = page.locator('#financeContent .inv-viewtabs');
  // The last of six tabs sits past a 393px screen; the row scrolls sideways to it.
  await page.locator('#financeContent .inv-viewtab[data-tab="gst"]').click();
  const inRow = await row.evaluate(r => {
    const t = r.querySelector('.inv-viewtab[aria-selected="true"]')!.getBoundingClientRect(), b = r.getBoundingClientRect();
    return t.left >= b.left - 1 && t.right <= b.right + 1;
  });
  expect(inRow).toBe(true);
  // A different tab is a navigation: from far down the Overview, a tap on a pie slice's statement link opens the
  // Bank tab at the top, not wherever the Overview was scrolled to.
  await page.locator('#financeContent .inv-viewtab[data-tab="overview"]').click();
  await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('style', 'height:1600px'); document.body.appendChild(d); window.scrollTo(0, 900); });
  await page.evaluate(() => { (window as any).finSetTab('bank'); (window as any).renderFinance(); });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
});
