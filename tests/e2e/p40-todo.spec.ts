import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, workingDaysBack, type SepState } from './fixtures';

// P40: the To-do tab, its Home card, and the payload the Windows widget draws.
// Two kinds of task, always labelled: MINE (typed, ticked, never deleted) and
// APP (raised from the book, cleared by fixing the thing, snoozed only against
// the figures it was raised on). The widget host itself only exists on
// Windows; what is tested here is everything the app hands it and takes back.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function base(extra: Partial<SepState> = {}): SepState {
  // A backup "today" keeps the backup rule quiet unless a test wants it.
  return { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState;
}

async function load(page: Page, state: SepState) {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, state);
}

function task(id: string, text: string, due = '', extra: Record<string, unknown> = {}) {
  return { id, text, due, note: '', link: null, createdAt: 1, doneAt: null, ...extra };
}

/* A line running out: counted 20, then 6 a day for two working days. */
function stockRunningOut() {
  const [d1, d2, d3] = workingDaysBack(4).slice(1).reverse();
  return {
    items: [{ id: 'SI-1', name: 'Q558', key: 'Q558', aliases: [], unit: 'KG', basis: 'draw', active: true, createdAt: 1 }],
    entries: [
      { id: 'SE-1', itemId: 'SI-1', kind: 'count', qty: 20, date: d1, at: 1, seq: 0 },
      { id: 'SE-2', itemId: 'SI-1', kind: 'used', qty: 6, date: d2, at: 2, seq: 1, days: 1 },
      { id: 'SE-3', itemId: 'SI-1', kind: 'used', qty: 6, date: d3, at: 3, seq: 1, days: 1 },
    ],
    pastes: [],
  };
}

test.describe('P40: To-do', () => {
  test('adds, ticks and reopens a task of your own; nothing is deleted', async ({ page }) => {
    await load(page, base());
    await switchTab(page, 'pageTodo');
    await page.locator('#todoNew').fill('Ask about CN/001');
    await page.locator('#todoNew').press('Enter');
    const row = page.locator('.inv-td-row').filter({ hasText: 'Ask about CN/001' });
    await expect(row).toHaveCount(1);
    // Enter leaves the box ready for the next one.
    await expect(page.locator('#todoNew')).toBeFocused();
    await expect(page.locator('#todoNew')).toHaveValue('');

    await row.locator('[data-action="invTodoToggle"]').click();
    await expect(page.locator('.inv-td-fold').first()).toContainText('Done · 1');
    let st = (await readStoredState(page)).todo;
    expect(st.tasks).toHaveLength(1);
    expect(st.tasks[0].doneAt).toBeGreaterThan(0);

    await page.locator('[data-action="invTodoFoldDone"]').click();
    await page.locator('.inv-td-row-done [data-action="invTodoToggle"]').click();
    st = (await readStoredState(page)).todo;
    expect(st.tasks[0].doneAt).toBeNull();
    await expect(page.locator('.inv-td-row').filter({ hasText: 'Ask about CN/001' })).not.toHaveClass(/inv-td-row-done/);
  });

  test('a task due yesterday is late: red, counted on More, and on Home', async ({ page }) => {
    await load(page, base({ todo: { tasks: [task('TD-a', 'Later thing'), task('TD-b', 'Check the nitric count', iso(-1))], snoozes: {} } } as any));
    await expect(page.locator('#moreBadge')).toHaveText('1');
    const home = page.locator('#homeTodoCard');
    await expect(home.locator('.inv-td-hrow').first()).toContainText('Check the nitric count');
    await expect(home.locator('.inv-td-hrow').first()).toContainText('Yesterday');
    await expect(home.locator('.inv-td-lbl-mine').first()).toBeVisible();

    await switchTab(page, 'pageTodo');
    await expect(page.locator('.inv-td-row.inv-td-tone-red')).toContainText('Check the nitric count');
    await expect(page.locator('.inv-stk-meta')).toContainText('2 open');
    await expect(page.locator('.inv-stk-meta')).toContainText('1 late');
  });

  test('stock running out raises an App task; a snooze holds until the figures change', async ({ page }) => {
    await load(page, base({ stock: stockRunningOut() } as any));
    await switchTab(page, 'pageTodo');
    const row = page.locator('#todoContent [data-action="invTodoOpenApp"]').filter({ hasText: 'Order Q558' });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/inv-td-tone-red/);
    await expect(row).toContainText('8 KG left');
    // An App task has no tick box: it clears itself.
    await expect(row.locator('.inv-td-box')).toHaveCount(0);

    await row.click();
    await expect(page.locator('.inv-td-clears').first()).toContainText('Clears itself');
    await page.locator('[data-action="invTodoSnooze"][data-v="sig"]').click();
    await expect(page.locator('#todoContent [data-action="invTodoOpenApp"]').filter({ hasText: 'Order Q558' })).toHaveCount(0);
    await expect(page.locator('[data-action="invTodoFoldSnoozed"]')).toContainText('Snoozed · 1');

    // The line runs out: the figures the snooze was granted on no longer hold.
    await g(page, `S.stock.entries.push({ id: 'SE-4', itemId: 'SI-1', kind: 'used', qty: 8, date: '${todayIso()}', at: 4, seq: 1, days: 1 }); saveState(); renderTodo();`);
    await expect(page.locator('#todoContent [data-action="invTodoOpenApp"]').filter({ hasText: 'Order Q558' })).toContainText('Out');
  });

  test('a credit-note batch past 7 days raises a task that opens the register with the batch ticked', async ({ page }) => {
    const inv = (id: string, n: number, date: string, state = 'dispatched') => ({
      id, displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), invoiceNumber: String(n).padStart(5, '0'),
      clientId: 2, clientName: 'PIECE CLIENT', date, status: 'active', invoiceState: state,
      taxableValue: 1000, grandTotal: 1180, lineItems: [], createdAt: n,
    });
    await load(page, base({
      clients: [...emptyState().clients, { id: 2, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }],
      invoices: [inv('I1', 1, iso(-20)), inv('I2', 2, iso(-10)), inv('I3', 3, iso(-5)), inv('I4', 4, iso(-1))],
      invNextNum: 5,
      creditNotes: [{ id: 'CN-1', cnNumber: '007', displayNumber: 'CN/007/26-27', clientId: 2, clientName: 'PIECE CLIENT',
        status: 'active', invoiceIds: ['I1'], periodFrom: iso(-20), periodTo: iso(-20), discountPct: 2, createdAt: 1 }],
    } as any));
    await switchTab(page, 'pageTodo');
    const row = page.locator('#todoContent [data-action="invTodoOpenApp"]').filter({ hasText: 'Credit note due: PIECE CLIENT' });
    await expect(row).toContainText('3 invoices since CN/007/26-27');
    await expect(row).toContainText('₹60.00');
    await expect(row).toContainText('Batch spans 10 days');

    await row.click();
    await page.locator('[data-action="invTodoGoApp"]').click();
    await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
    const sel = await g(page, `Object.keys(_regSelected).sort().join(',')`);
    expect(sel).toBe('I2,I3,I4');
  });

  test('a task edited with a due date and a link opens what it links to', async ({ page }) => {
    await load(page, base());
    await switchTab(page, 'pageTodo');
    await page.locator('#todoNew').fill('Revise rate');
    await page.locator('[data-action="invTodoNew"]').click();
    await expect(page.locator('#todoText')).toHaveValue('Revise rate');
    await page.locator('[data-action="invTodoDue"][data-v="1"]').click();
    await page.locator('#todoLinkKind').selectOption('client');
    await page.locator('#todoLinkId').selectOption('1');
    await page.locator('#todoNote').fill('from the new card');
    await page.locator('[data-action="invTodoSave"]').click();

    const t = (await readStoredState(page)).todo.tasks[0];
    expect(t.due).toBe(iso(1));
    expect(t.link).toEqual({ kind: 'client', id: '1', label: 'TEST CLIENT KG' });
    const row = page.locator('.inv-td-row').filter({ hasText: 'Revise rate' });
    await expect(row).toContainText('Tomorrow');
    await row.locator('[data-action="invTodoGo"]').click();
    await expect(page.locator('#ceditName')).toHaveValue('TEST CLIENT KG');
  });

  test('the widget: payload on hide, a Done from the card lands in the book on show', async ({ page }) => {
    await load(page, base({ stock: stockRunningOut(), todo: { tasks: [task('TD-a', 'Check the nitric count', iso(-1)), task('TD-b', 'Later thing')], snoozes: {} } } as any));

    const p = await g(page, 'todoWidgetPayload()') as any;
    expect(p.title).toBe('3 open · 2 late');
    expect(p.rows.map((r: any) => r.text)).toEqual(['Order Q558', 'Check the nitric count', 'Later thing']);
    expect(p.rows[0]).toMatchObject({ mine: false, rid: 'a:stock:SI-1', color: 'Attention', late: true, big: false });
    expect(p.rows[1]).toMatchObject({ mine: true, id: 'TD-a', rid: 'm:TD-a', sub: 'due yesterday', color: 'Attention' });
    // Every binding in the template is something the payload carries.
    const tpl = readFileSync('widgets/todo-template.json', 'utf8');
    const names = new Set([...tpl.matchAll(/\$\{!?([a-z]+)/gi)].map(m => m[1]).filter(n => n !== 'host'));
    for (const n of names) expect(n in p || n in p.rows[0], `payload lacks ${n}`).toBe(true);

    // Closing (hidden) leaves the widget its list.
    await g(page, `todoWidgetPut('payload', null)`);
    await g(page, `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
    await expect.poll(async () => ((await g(page, `todoWidgetGet('payload')`)) as any)?.rows?.length).toBe(3);

    // A Done tapped on the card while the app was away is applied on show.
    await g(page, `todoWidgetPut('queue', [{ id: 'TD-a', at: 12345 }])`);
    await g(page, `Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
    await expect.poll(async () => (await readStoredState(page)).todo.tasks.find((t: any) => t.id === 'TD-a').doneAt).toBe(12345);
    const t = (await readStoredState(page)).todo.tasks.find((x: any) => x.id === 'TD-a');
    expect(t.doneBy).toBe('widget');
    expect(await g(page, `todoWidgetGet('queue')`)).toEqual([]);
  });

  test('the widget opens the app on a task, or on the box to add one', async ({ page }) => {
    await load(page, base({ todo: { tasks: [task('TD-a', 'Check the nitric count')], snoozes: {} } } as any));
    await page.goto('/?tab=pageTodo&todo=' + encodeURIComponent('open:m:TD-a'));
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
    await expect(page.locator('#todoText')).toHaveValue('Check the nitric count');

    await page.goto('/?tab=pageTodo&todo=add');
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
    await expect(page.locator('#todoNew')).toBeFocused();
  });

  test('manifest, template and worker agree on the widget', async () => {
    const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
    const w = m.widgets[0];
    expect(w.tag).toBe('sep-todo');
    expect(w.ms_ac_template).toBe('widgets/todo-template.json');
    for (const s of w.screenshots) expect(() => readFileSync(s.src)).not.toThrow();
    const tpl = JSON.parse(readFileSync(w.ms_ac_template, 'utf8'));
    expect(tpl.type).toBe('AdaptiveCard');
    const raw = JSON.stringify(tpl);
    expect(raw).toContain('done:${id}');
    expect(raw).toContain('open:${rid}');
    const sw = readFileSync('sw.js', 'utf8');
    expect(sw).toContain("const WIDGET_TAG = 'sep-todo'");
    expect(sw).toContain("'./widgets/todo-template.json'");
  });
});
