import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P160: learning from responses (the intelligence's fifth step, 6 Oct 2026). How the owner answers the tasks the app raises
// tunes what it raises and in what order: suggested, never silent, applied with a tap and put back with one. Made-up figures.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function iso(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const clients = [1, 2, 3, 4].map(id => ({ id, name: ['ALPHA', 'BETA', 'GAMMA', 'DELTA'][id - 1], billingMode: 'weight', rates: [], isActive: true }));
function book(extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = clients;
  return Object.assign(s, extra);
}
async function stub(page: Page, rules: Record<string, any[]>) {
  await page.evaluate(r => {
    const w: any = window;
    Object.keys(w.TODO_RULE_FNS).forEach(k => { if (!r[k] && k !== 'learn') w.TODO_RULE_FNS[k] = () => []; });
    Object.keys(r).forEach(k => { const list = r[k]; w.TODO_RULE_FNS[k] = () => JSON.parse(JSON.stringify(list)); });
  }, rules);
}
const task = (rule: string, id: number, extra: any = {}) => Object.assign({ key: rule + ':' + id, rule, tone: 'amber', clientId: id, title: rule + ' ' + id, sub: 's', why: 'w',
  facts: [], clears: 'c', go: { kind: 'client', id }, goLabel: 'Open', sig: 's' + id }, extra);
/* Responses as the book keeps them, each a separate moment. */
const resp = (rule: string, act: string, n: number, age = 0) => Array.from({ length: n }, (_, i) => ({ at: Date.now() - (i + 1) * 3600e3, key: rule + ':' + (i + 1), rule, act, age }));

test.describe('P160 learning from responses', () => {
  test('a check snoozed again and again, never acted on, is offered a higher threshold, applied with a tap and put back', async ({ page }) => {
    await loadAppWithState(page, book({ todo: { tasks: [], snoozes: {}, resp: resp('challan', 'snooze', 3) } }));
    const sug: any = await g(page, `learnSuggestions()`);
    expect(sug.map((x: any) => [x.kind, x.rule, x.from, x.to])).toEqual([['raise', 'challan', 5, 10]]);
    expect(sug[0].title).toBe('Raise a challan is waiting to be billed to 10 days');
    // Learnt from your answers is on Needs you, at the foot of the tasks (the tab map, TM2a).
    await switchTab(page, 'pageHome');
    const row = page.locator('#homeNeeds [data-learn="raise:challan"]');
    await expect(row).toContainText('3 snoozes in 90 days, none acted on. Now 5 days.');
    await row.locator('[data-action="invLearnApply"]').click();
    expect(await g(page, `todoCfg().challanDays`)).toBe(10);
    await expect(page.locator('[data-learn="raise:challan"]')).toHaveCount(0);
    const applied = page.locator('[data-learn-applied="0"]');
    await expect(applied).toContainText('Raised from 5 to 10');
    await applied.locator('[data-action="invLearnUndo"]').click();
    expect(await g(page, `todoCfg().challanDays`)).toBe(5);
    const st: any = await readStoredState(page);
    expect(st.todo.learn.applied[0]).toMatchObject({ kind: 'raise', rule: 'challan', from: 5, to: 10 });
    expect(st.todo.learn.applied[0].undoneAt).toBeGreaterThan(0);
  });

  test('a check with no threshold is offered off; Not now holds until the figures change', async ({ page }) => {
    await loadAppWithState(page, book({ todo: { tasks: [], snoozes: {}, resp: resp('owed90', 'week', 3) } }));
    expect(await g(page, `learnSuggestions().map(function (x) { return x.key; })`)).toEqual(['off:owed90']);
    await g(page, `learnDismiss('off:owed90')`);
    expect(await g(page, `learnSuggestions().length`)).toBe(0);
    await g(page, `todoData().resp.push({ at: Date.now(), key: 'owed90:9', rule: 'owed90', act: 'snooze', age: 0 })`);
    expect(await g(page, `learnSuggestions().map(function (x) { return x.key; })`)).toEqual(['off:owed90']);
    await g(page, `learnApply('off:owed90')`);
    expect(await g(page, `todoCfg().owed90`)).toBe(false);
  });

  test('a check acted on within a day is offered the lead, and then comes first in its tone', async ({ page }) => {
    await loadAppWithState(page, book({ todo: { tasks: [], snoozes: {}, resp: resp('payingSlower', 'go', 3, 0) } }));
    await stub(page, { owed90: [task('owed90', 1, { amount: 9000 })], payingSlower: [task('payingSlower', 2)] });
    expect(await g(page, `todoApp().filter(function (t) { return t.rule !== 'learn'; }).map(function (t) { return t.rule; })`)).toEqual(['owed90', 'payingSlower']);
    expect(await g(page, `learnSuggestions().map(function (x) { return x.key; })`)).toEqual(['lead:payingSlower']);
    await g(page, `learnApply('lead:payingSlower')`);
    expect(await g(page, `todoApp().filter(function (t) { return t.rule !== 'learn'; }).map(function (t) { return t.rule; })`)).toEqual(['payingSlower', 'owed90']);
  });

  test('tasks on screen a fortnight and never opened count; one that cleared itself sooner does not', async ({ page }) => {
    await page.addInitScript(([a, b, c]) => {
      localStorage.setItem('sep_inv_todo_seen', JSON.stringify({
        'cn:1': { f: a, l: c, r: 'cn' }, 'cn:2': { f: a, l: c, r: 'cn' }, 'cn:3': { f: b, l: c, r: 'cn' },
        'cn:4': { f: a, l: a, r: 'cn' }, 'cn:5': { f: a, l: c, r: 'cn', o: c } }));
    }, [iso(-20), iso(-16), todayIso()]);
    await loadAppWithState(page, book());
    const s: any = await g(page, `learnStats().cn`);
    expect(s.stale).toBe(3);
    expect(await g(page, `learnSuggestions().map(function (x) { return x.key; })`)).toEqual(['off:cn']);
    expect((await g(page, `learnSuggestions()`) as any)[0].say).toBe('3 tasks left unopened for 14 days or more in 90 days, none acted on.');
  });

  test('a fold snoozed is one decision for its members, and the snooze is recorded where it is made', async ({ page }) => {
    await loadAppWithState(page, book());
    await stub(page, { owed90: [task('owed90', 1, { amount: 100 }), task('owed90', 2, { amount: 200 }), task('owed90', 3, { amount: 300 })] });
    await switchTab(page, 'pageHome');
    await page.locator('#homeNeeds [data-todo="app"] [data-action="invTodoOpenApp"]').first().click();
    // The clock ticks between the members on a slow device (CI caught it, 9 Oct 2026): here it ticks on every reading.
    await page.evaluate(() => { const now = Date.now.bind(Date); let n = 0; Date.now = () => now() + n++; });
    await page.locator('[data-action="invTodoSnooze"][data-v="sig"]').click();
    const r: any = await g(page, `todoData().resp`);
    expect(r.map((x: any) => x.key).sort()).toEqual(['owed90:1', 'owed90:2', 'owed90:3']);
    expect(r.every((x: any) => x.act === 'snooze')).toBe(true);
    expect(new Set(r.map((x: any) => x.at)).size, 'one answer, one moment').toBe(1);
    expect(await g(page, `learnStats().owed90.snooze`)).toBe(1);
  });

  test('a task’s button and a move under it are answers; the To-do raises one task that opens the suggestions', async ({ page }) => {
    await loadAppWithState(page, book({ todo: { tasks: [], snoozes: {}, resp: resp('challan', 'snooze', 3) } }));
    await stub(page, { owed90: [task('owed90', 1, { amount: 100 })] });
    await switchTab(page, 'pageHome');
    await page.locator('#homeNeeds [data-tdy-task="owed90:1"] [data-action="invTodoOpenApp"]').click();
    await page.locator('.inv-dialog-foot [data-action="invTodoGoApp"]').click();
    expect(await g(page, `todoData().resp.filter(function (x) { return x.key === 'owed90:1'; }).map(function (x) { return x.act; })`)).toEqual(['go']);
    const t: any = await g(page, `todoAppAll(['learn'])[0]`);
    expect(t.title).toBe('1 suggestion from how you answer the tasks');
    await g(page, `todoGo(${JSON.stringify(t.go)})`);
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await expect(page.locator('#todoLearn [data-learn="raise:challan"]')).toBeVisible();
  });
});
