import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P69 (desktop): the To-do on the desktop, on Today → Needs you since the tab map (TM2a): the tasks go across the top with the
// add field on one line with its primary, and yours lead.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('P69 desktop: the tasks go across the top, the add field on one line with its primary, yours first', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(),
    todo: { tasks: [{ id: 'TD-a', text: 'Late one', due: iso(-1), note: '', link: null, createdAt: 1, doneAt: null }], snoozes: {} },
  } as unknown as SepState);
  await switchTab(page, 'pageHome');
  await expect(page.locator('#homeNeeds')).toBeVisible();
  const stack = await page.locator('#homeNeeds [data-card="tasks"]').boundingBox();
  const host = await page.locator('#homeNeeds').boundingBox();
  expect(stack && host).toBeTruthy();
  // Across the top: the tasks take the row.
  expect(stack!.width).toBeGreaterThan(host!.width * 0.9);
  const input = await page.locator('#todoNew').boundingBox();
  const add = await page.locator('[data-action="invTodoAdd"]').boundingBox();
  expect(Math.abs(input!.y + input!.height / 2 - (add!.y + add!.height / 2))).toBeLessThan(2);
  await expect(page.locator('#homeNeeds .inv-btn-primary')).toHaveCount(1);
  // What you typed leads.
  await expect(page.locator('#homeNeeds [data-tdy-group="now"] .inv-deck-item').first()).toHaveAttribute('data-todo', 'mine');
});
