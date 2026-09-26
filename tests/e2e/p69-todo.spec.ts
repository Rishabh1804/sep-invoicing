import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, workingDaysBack, type SepState } from './fixtures';

// P69 (phone): the To-do screen on the v2.0 components (design principles §7, §9 step 3).
// View tabs Open / Done; the add field in a toolbar with the view's one primary; app tasks
// and your own as rows in two flush panels; status a dot and a word; a task of your own is
// ticked through a real tick box whose label is the touch target. No v1.0 inv-td- class is
// drawn on the screen, its dialogs or the Home card.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function state(): SepState {
  const [d1, d2, d3] = workingDaysBack(4).slice(1).reverse();
  const insightsOff = { insQuiet: false, insRealLow: false, insClientDown: false, insLeak: false, insBelowVar: false,
    insLabour: false, insAttGap: false, insChemPrice: false };
  return {
    ...emptyState(), incomingMaterial: noSeedIM(), todoCheck: insightsOff,
    stock: {
      items: [{ id: 'SI-1', name: 'Q558', key: 'Q558', aliases: [], unit: 'KG', basis: 'draw', active: true, createdAt: 1 }],
      entries: [
        { id: 'SE-1', itemId: 'SI-1', kind: 'count', qty: 20, date: d1, at: 1, seq: 0 },
        { id: 'SE-2', itemId: 'SI-1', kind: 'used', qty: 6, date: d2, at: 2, seq: 1, days: 1 },
        { id: 'SE-3', itemId: 'SI-1', kind: 'used', qty: 6, date: d3, at: 3, seq: 1, days: 1 },
      ],
      pastes: [],
    },
    todo: {
      tasks: [
        { id: 'TD-a', text: 'Call the zinc supplier', due: iso(-1), note: 'about the drum', link: null, createdAt: 1, doneAt: null },
        { id: 'TD-b', text: 'File the July note', due: '', note: '', link: null, createdAt: 2, doneAt: null },
        { id: 'TD-c', text: 'Old thing', due: '', note: '', link: null, createdAt: 3, doneAt: Date.now() - 3600e3 },
      ],
      snoozes: {},
    },
  } as unknown as SepState;
}

async function load(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, state());
}

test.describe('P69: To-do', () => {
  test('Open and Done are view tabs; the add field has the one primary; no v1.0 class is drawn', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageTodo');
    const tabs = page.locator('#todoContent .inv-viewtabs[role="tablist"] .inv-viewtab[role="tab"]');
    await expect(tabs).toHaveCount(2);
    await expect(page.locator('.inv-viewtab[data-v="open"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.inv-viewtab[data-v="open"]')).toContainText('Open 3');
    await expect(page.locator('.inv-viewtab[data-v="done"]')).toContainText('Done 1');
    await expect(page.locator('#pageTodo .inv-btn-primary')).toHaveCount(1);
    await expect(page.locator('#pageTodo .inv-toolbar #todoNew.inv-input')).toBeVisible();
    await expect(page.locator('#todoContent [data-todo-sec="app"].inv-panel-flush [data-todo="app"]')).toHaveCount(1);
    await expect(page.locator('#todoContent [data-todo-sec="mine"].inv-panel-flush [data-todo="mine"]')).toHaveCount(2);
    await expect(page.locator('#todoContent [class*="inv-td-"], #homeTodoCard [class*="inv-td-"]')).toHaveCount(0);

    await page.locator('.inv-viewtab[data-v="done"]').click();
    await expect(page.locator('.inv-viewtab[data-v="done"]')).toHaveAttribute('aria-selected', 'true');
    const done = page.locator('#todoContent [data-todo="mine"][data-done]');
    await expect(done).toHaveCount(1);
    await expect(done).toHaveClass(/inv-row-done/);
    await expect(done.locator('.inv-check')).toBeChecked();
    await expect(page.locator('#todoNew')).toHaveCount(0);
  });

  test('status is a dot and a word, the app task carries its mark, the late task its due date', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageTodo');
    const app = page.locator('#todoContent [data-todo="app"]').filter({ hasText: 'Order Q558' });
    await expect(app.locator('.inv-row-lead .inv-dot-mark-danger')).toHaveText('!');
    await expect(app.locator('.inv-row-end .inv-dot-danger')).toHaveText('Act now');
    const late = page.locator('#todoContent [data-todo="mine"]').filter({ hasText: 'Call the zinc supplier' });
    await expect(late).toHaveAttribute('data-tone', 'red');
    await expect(late.locator('.inv-row-end .inv-dot-danger')).toHaveText('Yesterday');
    await expect(late.locator('.inv-row-meta')).toContainText('about the drum');
    await expect(page.locator('#todoContent .inv-pagehead-meta')).toContainText('3 open tasks');
  });

  test('a tick through the label ticks once and moves the task to Done', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageTodo');
    const row = page.locator('#todoContent [data-todo="mine"]').filter({ hasText: 'File the July note' });
    await row.locator('.inv-row-tick').click();
    await expect(page.locator('#todoContent [data-todo="mine"]').filter({ hasText: 'File the July note' })).toHaveCount(0);
    await expect(page.locator('.inv-viewtab[data-v="done"]')).toContainText('Done 2');
    const st = (await readStoredState(page)).todo;
    expect(st.tasks.find((t: any) => t.id === 'TD-b').doneAt).toBeGreaterThan(0);
  });

  test('the app task opens on its figures, what clears it, and a snooze; the edit dialog on fields', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageTodo');
    await page.locator('#todoContent [data-todo="app"]').first().click();
    const card = page.locator('.inv-overlay-card');
    await expect(card.locator('[data-todo-facts] .inv-panel-title')).toContainText('Order Q558');
    await expect(card.locator('[data-todo-facts] .inv-row .inv-num').first()).toBeVisible();
    await expect(card.locator('.inv-callout-info[data-todo-clears]')).toContainText('Clears itself');
    await expect(card.locator('.inv-btn-primary')).toHaveCount(1);
    await expect(card.locator('[data-action="invTodoSnooze"]')).toHaveCount(2);
    await page.locator('.inv-overlay-close').click();

    await page.locator('#todoContent [data-todo="mine"] [data-action="invTodoEdit"]').first().click();
    await expect(card.locator('.inv-field #todoText.inv-input')).toBeVisible();
    await expect(card.locator('#todoLinkKind.inv-select')).not.toHaveAttribute('data-action', /.*/);
    await expect(card.locator('#todoNote.inv-textarea')).toBeVisible();
    await card.locator('.inv-chip[data-action="invTodoDue"][data-v="0"]').click();
    await expect(card.locator('#todoDue')).toHaveValue(todayIso());
  });

  test('Home: Add task opens the Open tab even when Done was the last view', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageTodo');
    await page.locator('.inv-viewtab[data-v="done"]').click();
    await switchTab(page, 'pageHome');
    const home = page.locator('#homeTodoCard');
    await expect(home.locator('[data-todo="mine"] .inv-row-tick .inv-check')).toHaveCount(2);
    await page.locator('[data-action="invHomeQuick"][data-go="task"]').click();
    await expect(page.locator('#todoNew')).toBeFocused();
    await expect(page.locator('.inv-viewtab[data-v="open"]')).toHaveAttribute('aria-selected', 'true');
  });
});
