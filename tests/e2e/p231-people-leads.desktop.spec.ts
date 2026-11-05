import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P231 on the desktop (docs/UI_PASS_3.md §12): the Roster's cards beside the open hand's record, the Filter inline, and the step row
// laid across. Made-up names and figures only.

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true }];
const book = (): SepState => ({ ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {} } as unknown as SepState);

test('a card opens its hand in the pane, marked current; the Filter is the row’s own controls', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
  await expect(page.locator('#pageStaff [data-att-toolbar="roster"] #attRosterArea')).toBeVisible();
  await expect(page.locator('#pageStaff [data-action="invTbFilter"]')).toHaveCount(0);
  const open = page.locator('#attRosterHost [data-roster-card="2"] [data-action="invAttRosterOpen"]');
  await open.click();
  await expect(page.locator('#attRosterHost')).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#attRosterPane [data-worker-pane="2"]')).toBeVisible();
  await expect(open).toHaveAttribute('aria-current', 'true');
  await page.locator('#attRosterArea').selectOption('vat-a1');
  await expect(page.locator('#attRosterHost [data-roster-card]')).toHaveCount(1);
});

test('the day’s steps lie across one row, a node above its words', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageStaff');
  const row = page.locator('#pageStaff [data-next-steps="day"]');
  await expect(row).toBeVisible();
  const tops = await row.locator('.inv-step-node').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const node = await row.locator('.inv-step').first().locator('.inv-step-node').boundingBox();
  const words = await row.locator('.inv-step').first().locator('.inv-step-title').boundingBox();
  expect(words!.y).toBeGreaterThan(node!.y + node!.height - 1);
  expect(todayIso()).toBeTruthy();
});
