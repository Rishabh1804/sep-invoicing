import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P69 (desktop): the To-do screen wider — From your data and Mine side by side, the add
// field on one line with its primary.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('P69 desktop: the two lists sit side by side, the add field on one line', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(),
    todo: { tasks: [{ id: 'TD-a', text: 'Late one', due: iso(-1), note: '', link: null, createdAt: 1, doneAt: null }], snoozes: {} },
  } as unknown as SepState);
  await switchTab(page, 'pageTodo');
  const app = await page.locator('#todoContent [data-todo-sec="app"]').boundingBox();
  const mine = await page.locator('#todoContent [data-todo-sec="mine"]').boundingBox();
  expect(app && mine).toBeTruthy();
  expect(Math.abs(app!.y - mine!.y)).toBeLessThan(2);
  expect(mine!.x).toBeGreaterThan(app!.x + app!.width - 1);
  const input = await page.locator('#todoNew').boundingBox();
  const add = await page.locator('[data-action="invTodoAdd"]').boundingBox();
  expect(Math.abs(input!.y + input!.height / 2 - (add!.y + add!.height / 2))).toBeLessThan(2);
  await expect(page.locator('#pageTodo .inv-btn-primary')).toHaveCount(1);
});
