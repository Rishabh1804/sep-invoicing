import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSales, readStoredState, switchTab, todayIso, recentTs, answerAsk, type SepState } from './fixtures';

// P176 (owner, 7 Oct 2026: "start with 3 and 4"): Clients → Prospects, a list of firms approached to fill the spare capacity.
// A prospect's stage, follow-up and estimated tonnes; its quotations; won makes the client; the To-do asks for a follow-up due;
// the pipeline is set against the spare. Names and figures are made up; dates are built from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };

function book(extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 10, effectiveFrom: '2026-01-01' }], itemRates: [] }];
  // Thirty days of billing at 1,000 kg each: about 30 t over 90 days, against ~4 t a working day.
  s.invoices = Array.from({ length: 30 }, (_, i) => ({ id: 'INV-' + i, invoiceNumber: String(i + 1).padStart(5, '0'), displayNumber: 'T/' + String(i + 1).padStart(5, '0'),
    date: day(-i * 2 - 1), status: 'active', invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra',
    items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1000, rate: 10, amount: 10000 }], taxableValue: 10000, cgstAmt: 900, sgstAmt: 900, igstAmt: 0, grandTotal: 11800, createdAt: recentTs() }));
  return Object.assign(s, extra);
}

test('add a prospect from Office → Sales → Prospects; its follow-up is a To-do task and Pulse names the pipeline against the spare', async ({ page }) => {
  await loadAppWithState(page, book());
  // Sales since the tab map (9 Oct 2026; Clients' fifth view before).
  await openSales(page, 'prospects');
  await expect(page.locator('[data-prs-tile="open"]')).toContainText('0');
  await page.locator('[data-action="invPrsNew"]').click();
  const dlg = page.locator('[data-prs-dialog="new"]');
  await dlg.locator('#prsName').fill('BETA PRESSINGS');
  await dlg.locator('#prsContact').fill('Mr Test');
  await dlg.locator('#prsPhone').fill('98765 43210');
  await dlg.locator('#prsProcess').fill('Zinc on brackets');
  await dlg.locator('#prsKg').fill('5');
  await dlg.locator('#prsRate').fill('13');
  await dlg.locator('#prsStage').selectOption('contacted');
  await dlg.locator('#prsNext').fill(day(-8));
  await dlg.locator('[data-action="invPrsSave"]').click();
  await expect(page.locator('[data-prospect]')).toHaveCount(1);
  await expect(page.locator('[data-prospect]')).toContainText('5.0 t a month at ₹13.00/kg');
  await expect(page.locator('[data-prospect]')).toContainText('follow-up 8 d late');
  // Weighted at 20% while contacted: 1 t a month.
  await expect(page.locator('[data-prs-tile="pipeline"]')).toContainText('1.0 t');
  const st: any = await readStoredState(page);
  expect(st.prospects[0]).toMatchObject({ name: 'BETA PRESSINGS', kgMonth: 5000, rate: 13, stage: 'contacted', nextAt: day(-8) });
  expect(st.changeLog.some((e: any) => e.coll === 'prospects' && e.op === 'add')).toBe(true);
  const t: any = await ev(page, `todoAppAll().filter(function(t) { return t.rule === 'prospectFollow'; }).map(function(t) { return [t.tone, t.title]; })`);
  expect(t).toEqual([['red', 'Follow up BETA PRESSINGS']]);
  const mv: any = await ev(page, `prsPlantMove()`);
  expect(mv.say).toMatch(/^Follow up 1 prospect: 1\.0 t a month in the pipeline against [\d.]+ t spare$/);
  expect(mv.worth.amount).toBe(1000 * 13);
  // The task opens the prospect.
  await ev(page, `todoGo({ kind: 'prospect', id: S.prospects[0].id })`);
  await expect(page.locator('[data-prs-dialog]')).toHaveCount(1);
});

test('a quotation drafted for a prospect is addressed to it and linked; issued, the prospect reads quoted', async ({ page }) => {
  const p = { id: 'PR-1', name: 'GAMMA AUTO', contact: 'Ms Test', process: 'Barrel zinc', kgMonth: 3000, rate: 12.5, stage: 'contacted', nextAt: day(5), log: [], createdAt: 1 };
  await loadAppWithState(page, book({ prospects: [p] }));
  await ev(page, `setItemsSubView('prospects'); switchTab('pageClients')`);
  await page.locator('[data-action="invPrsOpen"][data-id="PR-1"]').click();
  await page.locator('[data-action="invPrsDraft"]').click();
  await expect(page.locator('[data-qt-draft-note]')).toContainText('For the prospect GAMMA AUTO');
  const q: any = await ev(page, `({ name: _qtForm.q.to.name, attn: _qtForm.q.to.attn, pid: _qtForm.q.prospectId, rate: _qtForm.q.lines[0].rate, item: _qtForm.q.lines[0].item })`);
  expect(q).toEqual({ name: 'GAMMA AUTO', attn: 'Ms Test', pid: 'PR-1', rate: 12.5, item: 'Barrel zinc' });
  await ev(page, `qtSaveDraft()`);
  expect(await ev(page, `prsQuotes(S.prospects[0]).length`)).toBe(1);
  expect(await ev(page, `prsStage(S.prospects[0])`)).toBe('contacted');
  await ev(page, `getQuotations()[0].status = 'issued'; getQuotations()[0].num = 1`);
  expect(await ev(page, `prsStage(S.prospects[0])`)).toBe('quoted');
});

test('won makes the client from the prospect and links the two; lost needs a reason', async ({ page }) => {
  const p = { id: 'PR-2', name: 'DELTA WORKS', phone: '90000 00001', email: 'd@example.com', stage: 'quoted', nextAt: day(1), log: [], createdAt: 1 };
  const q = { id: 'Q-1', prospectId: 'PR-2', clientId: null, status: 'issued', num: 3, fy: '26-27', rev: 0, date: day(-3), to: { name: 'DELTA WORKS' }, lines: [], terms: [] };
  await loadAppWithState(page, book({ prospects: [p, { id: 'PR-3', name: 'EPS', stage: 'new', log: [], createdAt: 1 }], quotations: [q] }));
  await ev(page, `setItemsSubView('prospects'); switchTab('pageClients')`);
  await page.locator('[data-action="invPrsOpen"][data-id="PR-2"]').click();
  await page.locator('[data-action="invPrsWin"]').click();
  await expect(page.locator('#ceditName')).toHaveValue('DELTA WORKS');
  await expect(page.locator('#ceditMobile')).toHaveValue('90000 00001');
  await page.locator('[data-action="invSaveClient"]').click();
  const st: any = await readStoredState(page);
  const c = st.clients.find((x: any) => x.name === 'DELTA WORKS');
  expect(c).toBeTruthy();
  expect(st.prospects[0]).toMatchObject({ stage: 'won', clientId: c.id });
  expect(st.quotations[0].clientId).toBe(c.id);
  expect(await ev(page, `todoAppAll().filter(function(t) { return t.rule === 'prospectFollow'; }).length`)).toBe(0);
  // Lost with no reason is refused; with one it is kept, closed, and out of the open list.
  await ev(page, `prsFormOpen('PR-3')`);
  await page.locator('#prsStage').selectOption('lost');
  await page.locator('[data-action="invPrsSave"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Say why it was lost');
  await page.locator('#prsLost').fill('Went with a plant nearer');
  await page.locator('[data-action="invPrsSave"]').click();
  await expect(page.locator('[data-prospect]')).toHaveCount(0);
  await page.locator('#prsStageFilter').selectOption('all');
  await expect(page.locator('[data-prospect]')).toHaveCount(2);
  await expect(page.locator('[data-prospect="PR-3"]')).toContainText('Went with a plant nearer');
});
