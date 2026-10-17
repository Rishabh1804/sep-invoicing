import { test, expect } from '@playwright/test';
import { openSettingsAt, readStoredState } from './fixtures';
import { dueMonth, ensure, feedBook, loadWithFeeds, monthName } from './feeds-fixture';

/*
 * P225 on the desktop (split/feeds.js; docs/UI_PASS_3.md §9b, §9c): the Tata dialog centred and whole at a desk's width, its
 * week one row of seven, the months typed open; Settings' section under Connections with its Check; the To-do's move.
 */

test('the Tata dialog at a desk: centred, nothing past its edge, the week one row of seven, the months typed open', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await loadWithFeeds(page, feedBook());
  await ensure(page);
  const m = dueMonth(), name = monthName(m);
  const task = await page.evaluate(() => (window as any).todoAppAll().find((t: any) => t.rule === 'mktTata'));
  await page.evaluate(go => (window as any).todoGo(go), task.go);
  const dlg = page.locator('[data-mkt-tata]');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#mktMonth')).toHaveValue(m);
  const box = (await dlg.boundingBox())!, vw = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThan(0);
  expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(2);
  const over = await dlg.evaluate(el => Array.from(el.querySelectorAll('*')).filter(x => {
    const r = x.getBoundingClientRect(), d = el.getBoundingClientRect();
    return r.width > 0 && (r.right > d.right + 1 || r.left < d.left - 1);
  }).map(x => x.className || x.tagName));
  expect(over).toEqual([]);
  const tops = await dlg.locator('[data-mkt-week] .inv-mkt-day').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(tops).toHaveLength(7);
  expect(new Set(tops).size).toBe(1);
  // The figures' grid: a label, this year's field and the year before's in one row a figure.
  const row = await page.evaluate(() => ['mktF_cvTotal_now', 'mktF_cvTotal_ly'].map(id => Math.round(document.getElementById(id)!.getBoundingClientRect().top)));
  expect(row[0]).toBe(row[1]);
  await page.locator('#mktF_cvTotal_now').fill('34567');
  await dlg.getByRole('button', { name: `Save ${name}` }).click();
  expect((await readStoredState(page)).market.tata[m].cvTotal).toEqual({ now: 34567, ly: null });
  await expect(dlg.locator('details[data-mkt-months]')).toHaveAttribute('open', '');
  // A headline's row: the whole row its link, its icon at the end.
  const link = dlg.locator('[data-mkt-news] a[data-feed-item]').first();
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const icon = (await link.locator('.inv-row-end svg').boundingBox())!;
  expect(icon.width).toBeLessThanOrEqual(20);
  expect(errors).toEqual([]);
});

test('Settings at a desk: News and weather under Connections, its Check, and the Tata dialog opened over Settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await loadWithFeeds(page, feedBook({ place: 'checkin' }));
  await openSettingsAt(page, 'feeds');
  await expect(page.locator('#settingsScrim section[data-group="connections"] details[data-sec="feeds"]')).toBeVisible();
  await page.locator('[data-sec="feeds"] [data-action="invFeedCheck"]').click();
  await expect(page.locator('[data-feed-check="ok"]')).toContainText('Reached');
  await page.locator('[data-sec="feeds"] [data-action="invMktOpen"]').click();
  await expect(page.locator('[data-mkt-tata]')).toBeVisible();
  await page.locator('[data-mkt-tata] .inv-dialog-foot').getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[data-mkt-tata]')).toHaveCount(0);
  await expect(page.locator('#settingsScrim')).toBeVisible();
  expect(errors).toEqual([]);
});
