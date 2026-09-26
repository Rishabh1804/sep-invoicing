import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P42 desktop: the To-do tab, the Home quick actions and the attendance-roll
// paste in the desktop layout — sidebar instead of the More sheet, the register
// as a table, six quick actions across. The phone-layout behaviour is P40/P41.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dmy(offset: number): string {
  const [y, m, d] = iso(offset).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

const STAFF = [
  { id: 'W1', name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 'W2', name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
];

async function load(page: Page, extra: Partial<SepState> = {}) {
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState);
}

test.describe('P42 desktop: to-do, quick actions, attendance paste', () => {
  test('To-do is in the sidebar and works without the More sheet', async ({ page }) => {
    await load(page, { todo: { tasks: [{ id: 'TD-a', text: 'Late one', due: iso(-1), note: '', link: null, createdAt: 1, doneAt: null }], snoozes: {} } } as any);
    await expect(page.locator('.inv-side-item[data-tab="pageTodo"]:not([data-sub])')).toBeVisible();
    await expect(page.locator('.inv-navbar-more')).toBeHidden();
    await switchTab(page, 'pageTodo');
    await expect(page.locator('.inv-side-item[data-tab="pageTodo"]:not([data-sub])')).toHaveClass(/inv-side-item-on/);
    await expect(page.locator('#todoContent [data-todo][data-tone="red"]')).toContainText('Late one');
    await page.locator('#todoNew').fill('Desk task');
    await page.locator('#todoNew').press('Enter');
    await expect(page.locator('#todoContent [data-todo="mine"]').filter({ hasText: 'Desk task' })).toHaveCount(1);
    expect((await readStoredState(page)).todo.tasks).toHaveLength(2);
  });

  test('the six quick actions sit in one row and each reaches its screen', async ({ page }) => {
    await load(page, { staff: STAFF } as any);
    const qa = page.locator('.inv-btn-grid .inv-btn');
    await expect(qa).toHaveCount(6);
    const ys = await qa.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(ys).size).toBe(1);

    await page.locator('[data-action="invHomeQuick"][data-go="challan"]').click();
    await expect(page.locator('#pageIM.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-form="challan"]').first()).toBeVisible();

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="stock"]').click();
    await expect(page.locator('[data-action="invStockSaveManual"]')).toBeVisible();

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="task"]').click();
    await expect(page.locator('#todoNew')).toBeFocused();
  });

  test('a roll pasted on the desktop is checked and saved into the day', async ({ page }) => {
    await load(page, { staff: STAFF, attendance: {} } as any);
    await page.locator('[data-action="invHomeQuick"][data-go="paste"]').click();
    await expect(page.locator('.inv-side-item[data-tab="pageStaff"]:not([data-sub])')).toHaveClass(/inv-side-item-on/);
    await page.locator('#relayPasteText').fill(`${dmy(-1)}/ in time\n----6:00 AM---\n---VAT A 1---\n1) ARUN\nEXTRA 3 HOURS\n----8:30 AM---\n---VAT A 1---\n1) ARUN\n---berral---\n2) BALA`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('.inv-rl-row').filter({ hasText: 'Arun' })).toContainText('6 AM – 5 PM · 11 h · OT 3 h');
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('#attDate')).toHaveValue(iso(-1));
    const day = (await readStoredState(page)).attendance[iso(-1)];
    expect(day.marks.W1).toMatchObject({ st: 'P', hours: 11, ot: 3, area: 'vat-a1' });
    expect(day.marks.W2).toMatchObject({ st: 'P', hours: 8, area: 'barrel' });
    expect(day.extra).toEqual([{ kind: 'block', areas: ['vat-a1'], crew: ['W1'], hours: 3, from: '06:00', to: '08:30', area: 'vat-a1', src: 'relay' }]);
  });

  test('a credit-note task opens the register table with the batch ticked', async ({ page }) => {
    const inv = (id: string, n: number, date: string) => ({
      id, displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), invoiceNumber: String(n).padStart(5, '0'),
      clientId: 2, clientName: 'PIECE CLIENT', date, status: 'active', invoiceState: 'dispatched',
      taxableValue: 1000, grandTotal: 1180, lineItems: [], createdAt: n,
    });
    await load(page, {
      clients: [...emptyState().clients, { id: 2, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }],
      invoices: [inv('I1', 1, iso(-20)), inv('I2', 2, iso(-10)), inv('I3', 3, iso(-1))], invNextNum: 4,
      creditNotes: [{ id: 'CN-1', cnNumber: '007', displayNumber: 'CN/007/26-27', clientId: 2, clientName: 'PIECE CLIENT',
        status: 'active', invoiceIds: ['I1'], periodFrom: iso(-20), periodTo: iso(-20), discountPct: 2, createdAt: 1 }],
    } as any);
    await page.locator('#homeTodoCard [data-action="invTodoOpenApp"]').filter({ hasText: 'Credit note due' }).click();
    await page.locator('[data-action="invTodoGoApp"]').click();
    await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
    expect(await g(page, `Object.keys(_regSelected).sort().join(',')`)).toBe('I2,I3');
    await expect(page.locator('#pageRegister')).toContainText('SEP/TEST-00002');
  });
});
