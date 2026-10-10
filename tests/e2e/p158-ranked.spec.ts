import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P158: one ranked list (the intelligence's third step, 6 Oct 2026). On the owner's book the To-do held 23 tasks: three
// clients owing over 90 days, six stock lines and three clients' challans each a row of their own, and inside a tone the
// order was the rules' order, not what was at stake. Made-up clients and figures; dates are built from today.

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
/* The rules under test answer what the test says; every other rule is switched off, so the list is only theirs. */
async function stub(page: Page, rules: Record<string, any[]>) {
  await page.evaluate(r => {
    const w: any = window;
    Object.keys(w.TODO_RULE_FNS).forEach(k => { if (!r[k]) w.TODO_RULE_FNS[k] = () => []; });
    Object.keys(r).forEach(k => { const list = r[k]; w.TODO_RULE_FNS[k] = () => JSON.parse(JSON.stringify(list)); });
  }, rules);
}
const owed = (id: number, amount: number, tone = 'amber') => ({ key: 'owed90:' + id, rule: 'owed90', tone, clientId: id, amount,
  title: 'Client ' + id + ' owes', sub: 's', why: 'Receivables · over 90 days', facts: [], clears: 'c', go: { kind: 'finance', tab: 'receipts', client: id }, goLabel: 'Open the client', sig: String(amount) });

test.describe('P158 one ranked list', () => {
  test('inside a tone a firm finding comes first, then the larger sum', async ({ page }) => {
    await loadAppWithState(page, book());
    await stub(page, {
      owed90: [owed(1, 100), owed(2, 500)],
      insLeak: [{ key: 'insLeak:3', rule: 'insLeak', tone: 'amber', clientId: 3, gap: 900, conf: { level: 'partial', say: 'part' },
        title: 'leak', sub: 's', why: 'w', facts: [], clears: 'c', go: { kind: 'client', id: 3 }, goLabel: 'Open', sig: '1' }]
    });
    const keys = await g(page, `todoApp().map(function (t) { return t.key + '=' + Math.round(t.worth); })`);
    expect(keys).toEqual(['owed90:2=500', 'owed90:1=100', 'insLeak:3=900']);
    const ranked = await g(page, `todoRanked().map(function (r) { return r.app.key; })`);
    expect(ranked).toEqual(['owed90:2', 'owed90:1', 'insLeak:3']);
  });

  test('three or more from one rule are one task: worst tone, the sum, each member opens as before', async ({ page }) => {
    await loadAppWithState(page, book());
    await stub(page, { owed90: [owed(1, 100), owed(2, 500, 'red'), owed(3, 250)] });
    const shown: any = await g(page, `todoApp().map(function (t) { return { key: t.key, tone: t.tone, title: t.title, sub: t.sub, n: (t.members || []).length }; })`);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ key: 'fold:owed90', tone: 'red', n: 3 });
    expect(shown[0].title).toBe('3 clients owe ₹850.00 past their terms');
    expect(shown[0].sub).toBe('BETA ₹500.00 · GAMMA ₹250.00 · ALPHA ₹100.00');
    // The list as raised is untouched: the moves and the client card read it.
    expect(await g(page, `todoAppAll(['owed90']).length`)).toBe(3);

    // Needs you holds the tasks (the tab map, TM2a): the fold is one card there.
    await switchTab(page, 'pageHome');
    const rows = page.locator('#homeNeeds [data-todo="app"] [data-action="invTodoOpenApp"]');
    await expect(rows).toHaveCount(1);
    await rows.first().click();
    const dlg = page.locator('[data-todo-fold="owed90"]');
    await expect(dlg.locator('[data-todo="app"]')).toHaveCount(3);
    await expect(dlg.locator('[data-todo="app"]').first()).toContainText('Client 2 owes');
    await dlg.locator('[data-todo="app"]').first().click();
    await expect(page.locator('[data-todo-facts]')).toContainText('Client 2 owes');
    await page.keyboard.press('Escape');

    await rows.first().click();
    await page.locator('.inv-dialog-foot [data-action="invTodoGoApp"]').click();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    expect(await g(page, '_bankOpen')).toBeNull();
  });

  test('a fold snoozes as one, and comes back when its figures change', async ({ page }) => {
    await loadAppWithState(page, book());
    await stub(page, { owed90: [owed(1, 100), owed(2, 500), owed(3, 250)] });
    await g(page, `todoSnooze('fold:owed90', 'sig')`);
    expect(await g(page, `todoApp().length`)).toBe(0);
    expect(await g(page, `todoData().snoozes['fold:owed90'].rule`)).toBe('owed90');
    await switchTab(page, 'pageHome');
    await expect(page.locator('#homeNeeds [data-card="snoozed"] .inv-panel-count')).toHaveText('1');
    // A fourth client: the figures it was snoozed on are not the figures now.
    await stub(page, { owed90: [owed(1, 100), owed(2, 500), owed(3, 250), owed(4, 50)] });
    expect(await g(page, `todoApp().map(function (t) { return t.key; })`)).toEqual(['fold:owed90']);
    // One snoozed on its own leaves two: no fold.
    await stub(page, { owed90: [owed(1, 100), owed(2, 500), owed(3, 250)] });
    await g(page, `delete todoData().snoozes['fold:owed90']; todoSnooze('owed90:1', '7')`);
    expect(await g(page, `todoApp().map(function (t) { return t.key; })`)).toEqual(['owed90:2', 'owed90:3']);
  });

  test('a challan task is worth what is still open on its challans', async ({ page }) => {
    const im = (id: string, amount: number) => ({ id, clientId: 1, clientName: 'ALPHA', challanNo: id, challanDate: iso(-10), createdAt: 1,
      items: [{ id: id + '-1', partNumber: 'P', desc: 'P', unit: 'KG', qty: 100, rate: amount / 100, amount, invoiced: false }] });
    // Half of C2 is on an invoice (what a line has billed is derived from the invoices naming it, im.js).
    const inv = { id: 'I1', invoiceNumber: 'I1', displayNumber: 'I1', clientId: 1, clientName: 'ALPHA', date: iso(-3), status: 'active', state: 'created', taxableValue: 200,
      grandTotal: 200, cgst: 0, sgst: 0, igst: 0, createdAt: 1, items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 50, rate: 4, amount: 200, imItemId: 'C2-1' }] };
    await loadAppWithState(page, book({ incomingMaterial: [im('C1', 700), im('C2', 400)], invoices: [inv] }));
    const t: any = await g(page, `todoAppAll(['challan'])[0]`);
    expect(t.key).toBe('challan:1');
    expect(t.worth).toBeCloseTo(900, 2);
  });

  test('a client\'s page lists everything flagged about it', async ({ page }) => {
    await loadAppWithState(page, book());
    await stub(page, {
      owed90: [owed(1, 100), owed(2, 500), owed(3, 250)],
      insLeak: [{ key: 'insLeak:1', rule: 'insLeak', tone: 'amber', clientId: 1, gap: 40, title: 'ALPHA realised under its usual', sub: 's', why: 'w', facts: [],
        clears: 'c', go: { kind: 'client', id: 1 }, goLabel: 'Open', sig: '1' }]
    });
    await switchTab(page, 'pageClients');
    await g(page, `openClientEdit(1)`);
    const card = page.locator('[data-card="client-tasks"]');
    await expect(card.locator('[data-todo="app"]')).toHaveCount(2);
    await expect(card).toContainText('Client 1 owes');
    await expect(card).toContainText('ALPHA realised under its usual');
    await card.locator('[data-todo="app"]').first().click();
    await expect(page.locator('[data-todo-facts]')).toBeVisible();
  });
});
