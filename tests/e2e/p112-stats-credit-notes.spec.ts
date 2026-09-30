import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, switchTab, todayIso, recentTs } from './fixtures';

// P112: credit notes are netted across all of Stats (owner, 30 Sep 2026: "credit note should be netted across all of
// stats"). Only contribution by client took them off; the headline, realisation, clients, six months and the trend read a
// rebate as revenue.
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const line = { partNumber: 'CLAMP 1', desc: 'CLAMP 1', hsn: '998873', unit: 'KG', qty: 100, rate: 10, amount: 1000, nosQty: null };
const inv = (id: string) => ({ id, invoiceNumber: id.slice(4), displayNumber: 'SEP/TEST-' + id.slice(4), date: todayIso(), status: 'active',
  invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', items: [line], taxableValue: 1000,
  cgstPer: 9, cgstAmt: 90, sgstPer: 9, sgstAmt: 90, igstPer: 0, igstAmt: 0, grandTotal: 1180, createdAt: recentTs() });
const book = (notes: any[]) => {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = [inv('INV-1'), inv('INV-2')];
  s.invNextNum = 3;
  s.creditNotes = notes;
  return s;
};
const note = (id: string, o: any) => ({ id, cnNumber: id, displayNumber: 'CN/' + id, date: todayIso(), status: 'active', clientId: 1,
  clientName: 'TEST CLIENT KG', taxableValue: 40, kind: 'rebate', createdAt: recentTs(), ...o });

test('a batch rebate comes off its invoices in proportion, and every Stats figure reads it', async ({ page }) => {
  await loadAppWithState(page, book([note('1', { invoiceIds: ['INV-1', 'INV-2'] }), note('2', { invoiceIds: ['INV-1'], status: 'cancelled', taxableValue: 500 })]));
  const net: any = await g(page, 'statsInvoices().map(function(i) { return [i.id, i.taxableValue, i._credit || 0, i.items[0].amount]; })');
  expect(net).toEqual([['INV-1', 980, 20, 980], ['INV-2', 980, 20, 980]]);
  // Tonnage is untouched; realisation falls by the credit.
  expect(await g(page, 'weighLines(statsInvoices()).kg')).toBe(200);
  expect(await g(page, 'Math.round(weighLines(statsInvoices()).revKnown / weighLines(statsInvoices()).kg * 100) / 100')).toBe(9.8);
  await switchTab(page, 'pageStats');
  await expect(page.locator('#pageStats [data-callout="credit-notes"]')).toContainText('₹40.00 taken off');
});

test("a note against one invoice comes off that one; one naming no invoice in the book is said, not guessed", async ({ page }) => {
  await loadAppWithState(page, book([note('3', { kind: 'adjustment', againstInvoiceId: 'INV-2', invoiceIds: [] }),
    note('4', { againstInvoice: 'SEP/OLD-00443', invoiceIds: [], taxableValue: 75 })]));
  const net: any = await g(page, 'statsInvoices().map(function(i) { return i.taxableValue; })');
  expect(net).toEqual([1000, 960]);
  await switchTab(page, 'pageStats');
  await expect(page.locator('#pageStats [data-callout="credit-notes"]')).toContainText('1 note (₹75.00) name no invoice in the book');
});

// The trend keeps its own reach whatever the period chip says, and shades the period on it (owner, 30 Sep 2026: option 1).
test('the trend shades the chosen period on its longer history, and says what it shows', async ({ page }) => {
  const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - 4);
  const old = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-15';
  const s = book([]);
  s.invoices[1] = { ...s.invoices[1], date: old };
  await loadAppWithState(page, s);
  await openStatsTab(page, 'trends');
  const card = page.locator('#pageStats [data-card="trend"]');
  await expect(card.locator('[data-span]')).toHaveCount(1);
  await expect(card).toContainText('Shows the last 12 months whatever the period above; the shaded part is MTD.');
  await page.locator('#pageStats [data-action="invStatsPeriod"][data-period="all"]').click();
  await expect(card.locator('[data-span]')).toHaveCount(0);
  await expect(card).toContainText('All time covers all of it.');
});
