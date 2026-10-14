import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState, openAttendance } from './fixtures';

// P72 (desktop): Day's controls sit beside the name on one row, pressed P in its tone (the desktop's grey
// "on" segment does not win over a status); Areas' span is an inv-seg; the week grid is one table.

test('P72 desktop: Day rows carry their controls beside the name; Areas and Week on the components', async ({ page }) => {
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(),
    staff: [{ id: 1, name: 'Arun Das', comp: 'monthly', dayRate: 520, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }],
    areaTargets: { 'vat-a1': 4 },
    attendance: { [todayIso()]: { marks: { 1: { st: 'P', ot: 0, hours: 0, area: 'vat-a1' } }, extra: [], note: '' } },
  } as unknown as SepState);
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  const row = page.locator('[data-att-row="1"]');
  const [name, seg] = await Promise.all([row.locator('.inv-row-title').boundingBox(), row.locator('.inv-seg').boundingBox()]);
  expect(Math.abs((name!.y + name!.height / 2) - (seg!.y + seg!.height / 2))).toBeLessThan(name!.height);
  const p = row.locator('[data-st="P"]');
  const [bg, surface2] = await p.evaluate((el) => [getComputedStyle(el).backgroundColor,
    getComputedStyle(document.documentElement).getPropertyValue('--surface-2')]);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  const okBg = await page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--ok-bg)'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
  expect(bg).toBe(okBg);
  expect(surface2).toBeTruthy();

  await page.locator('#attToolbar .inv-viewtab[data-view="areas"]').click();
  await expect(page.locator('.inv-seg [data-action="invAreaSpan"][aria-pressed="true"]')).toHaveText('1 week');
  await expect(page.locator('[data-area-row="vat-a1"] .inv-dot')).toContainText('under');
  await openAttendance(page, 'week');
  await expect(page.locator('#attWeekGrid table.inv-table-grid tbody tr')).toHaveCount(1);
});
