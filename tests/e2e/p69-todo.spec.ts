import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, workingDaysBack, type SepState, openPulse } from './fixtures';

// P69 (phone): the To-do on the v2.0 components (design principles §7, §9 step 3), on Today → Needs you since the tab map
// (TM2a: the To-do page joined it). The add field in a toolbar with the view's one primary, heading the tasks; the tasks as
// cards in Now, This week and Later, yours first; status a mark, a tone and a word; a task of your own is ticked through a
// real tick box whose label is the touch target; Done folded at the foot. No v1.0 inv-td- class is drawn on the screen, its
// dialogs or Pulse's card.

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

async function openFold(d: Locator) {
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click();
}
async function load(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, state());
}

test.describe('P69: To-do', () => {
  test('your own tasks lead: first in their group, and ahead of every raised task that is not red', async ({ page }) => {
    // No export recorded, so the backup task is raised too: a raised task that is not red.
    await loadAppWithState(page, state());
    const order = await page.evaluate(() => (window as any).todoRanked().map((r: any) => (r.mine ? 'mine:' + r.mine.text : 'app:' + r.app.tone)));
    // Late ones first (yours before the raised one), then all of yours, then the rest.
    expect(order.slice(0, 3)).toEqual(['mine:Call the zinc supplier', 'app:red', 'mine:File the July note']);
    expect(order.slice(3).length).toBeGreaterThan(0);
    expect(order.slice(3).every((k: string) => k.startsWith('app:') && k !== 'app:red')).toBe(true);
    // Needs you draws them so: Now is yours, then the raised red one; This week leads with yours.
    const now = page.locator('#homeNeeds [data-tdy-group="now"] .inv-deck-item');
    expect(await now.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.todo))).toEqual(['mine', 'app']);
    // A task just added lands with yours, ahead of the raised ones.
    await page.locator('#todoNew').fill('Ring the bank');
    await page.locator('[data-action="invTodoAdd"]').click();
    const week = page.locator('#homeNeeds [data-tdy-group="week"]');
    await openFold(week);
    const kinds = await week.locator('.inv-deck-item').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.todo + ':' + (e.textContent || '').includes('Ring the bank')));
    expect(kinds.slice(0, 2)).toEqual(['mine:false', 'mine:true']);
    expect(kinds.slice(2).every(k => k.startsWith('app:'))).toBe(true);
  });

  test('the add field has the one primary; Done is folded at the foot; no v1.0 class is drawn', async ({ page }) => {
    await load(page);
    await expect(page.locator('#homeNeeds .inv-btn-primary')).toHaveCount(1);
    await expect(page.locator('#homeNeeds [data-card="tasks"] > .inv-toolbar #todoNew.inv-input')).toBeVisible();
    await expect(page.locator('#homeNeeds [data-todo="app"]')).toHaveCount(1);
    await expect(page.locator('#homeNeeds .inv-deck-item[data-todo="mine"]')).toHaveCount(2);
    await expect(page.locator('#homeNeeds [class*="inv-td-"], #homeTodoCard [class*="inv-td-"]')).toHaveCount(0);

    const done = page.locator('#homeNeeds [data-card="done"]');
    await expect(done.locator('.inv-panel-count')).toHaveText('1');
    expect(await done.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    await openFold(done);
    const row = done.locator('[data-todo="mine"][data-done]');
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/inv-row-done/);
    await expect(row.locator('.inv-check')).toBeChecked();
    // The field stays: Done is a fold under the tasks, not a view in place of them.
    await expect(page.locator('#todoNew')).toBeVisible();
  });

  test('status is a mark, a tone and a word; the app task carries its mark, the late task its due date', async ({ page }) => {
    await load(page);
    const app = page.locator('#homeNeeds [data-todo="app"]').filter({ hasText: 'Order Q558' });
    await expect(app).toHaveAttribute('data-tone', 'red');
    await expect(app.locator('.inv-deck-head .inv-dot-mark-danger')).toHaveText('!');
    const late = page.locator('#homeNeeds [data-todo="mine"]').filter({ hasText: 'Call the zinc supplier' });
    await expect(late).toHaveAttribute('data-tone', 'red');
    await expect(late.locator('.inv-deck-head .inv-dot-danger')).toHaveText('Yesterday');
    await expect(late.locator('.inv-deck-sub')).toContainText('about the drum');
    // Now holds the two red ones, This week the undated one.
    await expect(page.locator('#homeNeeds [data-tdy-group="now"] [data-tdy-count]')).toHaveText('2');
    await expect(page.locator('#homeNeeds [data-tdy-group="week"] [data-tdy-count]')).toHaveText('1');
  });

  test('a tick through the label ticks once and moves the task to Done', async ({ page }) => {
    await load(page);
    await openFold(page.locator('#homeNeeds [data-tdy-group="week"]'));
    const row = page.locator('#homeNeeds [data-todo="mine"]').filter({ hasText: 'File the July note' });
    await row.locator('.inv-row-tick').click();
    await expect(page.locator('#homeNeeds .inv-deck-item[data-todo="mine"]').filter({ hasText: 'File the July note' })).toHaveCount(0);
    await expect(page.locator('#homeNeeds [data-card="done"] .inv-panel-count')).toHaveText('2');
    const st = (await readStoredState(page)).todo;
    expect(st.tasks.find((t: any) => t.id === 'TD-b').doneAt).toBeGreaterThan(0);
  });

  test('the app task opens on its figures, what clears it, and a snooze; the edit dialog on fields', async ({ page }) => {
    await load(page);
    await page.locator('#homeNeeds [data-todo="app"] [data-action="invTodoOpenApp"]').first().click();
    const card = page.locator('.inv-dialog');
    await expect(card.locator('[data-todo-facts] .inv-panel-title')).toContainText('Order Q558');
    await expect(card.locator('[data-todo-facts] .inv-row .inv-num').first()).toBeVisible();
    await expect(card.locator('.inv-callout-info[data-todo-clears]')).toContainText('Clears itself');
    await expect(card.locator('.inv-btn-primary')).toHaveCount(1);
    await expect(card.locator('[data-action="invTodoSnooze"]')).toHaveCount(2);
    await page.locator('.inv-dialog-close').click();

    await page.locator('#homeNeeds [data-todo="mine"] [data-action="invTodoEdit"]').first().click();
    await expect(card.locator('.inv-field #todoText.inv-input')).toBeVisible();
    await expect(card.locator('#todoLinkKind.inv-select')).not.toHaveAttribute('data-action', /.*/);
    await expect(card.locator('#todoNote.inv-textarea')).toBeVisible();
    await card.locator('.inv-chip[data-action="invTodoDue"][data-v="0"]').click();
    await expect(card.locator('#todoDue')).toHaveValue(todayIso());
  });

  test('Pulse: Add task opens Needs you on the field, though Done was left open', async ({ page }) => {
    // Pulse's To-do card is hidden by every preset since the tab map (TM2c): a layout of the owner's own shows it.
    await page.addInitScript(() => { try { localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom', order: ['quick', 'todo'], hidden: {}, wide: {} })); } catch { /* */ } });
    await load(page);
    await openFold(page.locator('#homeNeeds [data-card="done"]'));
    await openPulse(page);
    const home = page.locator('#homeTodoCard');
    await expect(home.locator('[data-todo="mine"] .inv-row-tick .inv-check')).toHaveCount(2);
    await page.locator('[data-action="invHomeQuick"][data-go="task"]').click();
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await expect(page.locator('#todoNew')).toBeFocused();
  });
});
