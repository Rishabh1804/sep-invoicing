import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P95: an invoice shows the credit notes raised on it (owner, 29 Sep 2026: "see quickly if a credit note has been
// raised against an invoice and hovering could show the reason why … so the issue can be flagged early"). A row
// carries a CN mark whose title names each note, whether the invoice is the one it is against or only in its batch,
// why it was raised and its amount; the detail lists them; a note opens its invoice; and a note that no longer
// matches its invoice raises a To-do.

const day = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const inv = (n: number, taxable: number, o: any = {}) => ({ id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
  date: day(-20 + n), status: 'active', invoiceState: 'dispatched', dispatchedAt: recentTs(), clientId: 1, clientName: 'NOVA CLAMPS PVT. LTD.', clientGSTIN: '',
  clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }, gstType: 'intra',
  items: [{ partNumber: 'CLAMP 1', desc: 'CLAMP 1', hsn: '998873', unit: 'NOS', qty: 100, rate: taxable / 100, amount: taxable }],
  taxableValue: taxable, cgstPer: 9, cgstAmt: taxable * 0.09, sgstPer: 9, sgstAmt: taxable * 0.09, igstPer: 0, igstAmt: 0, grandTotal: taxable * 1.18,
  challanNo: '', createdAt: recentTs(), ...o });
const note = (id: string, o: any) => ({ id, cnNumber: id.slice(3), displayNumber: 'CN/' + id.slice(3) + '/26-27', date: day(-2), clientId: 1, clientName: 'NOVA CLAMPS PVT. LTD.',
  status: 'active', createdAt: recentTs(), ...o });

function state(extra: (s: any) => void = () => {}): SepState {
  const s: any = emptyState();
  s.clients = [{ id: 1, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
  s.invoices = [inv(1, 4000), inv(2, 6000), inv(3, 1000), inv(4, 500)];
  s.creditNotes = [
    // The batch rebate over 1 and 2, taken against 2.
    note('CN-007', { invoiceIds: ['INV-1', 'INV-2'], invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], againstInvoice: 'SEP/TEST-00002', againstInvoiceId: 'INV-2',
      periodFrom: day(-19), periodTo: day(-18), discountPct: 2, batchTaxable: 10000, taxableValue: 200, grandTotal: 236 }),
    // A rate correction on 3 alone.
    note('CN-008', { kind: 'adjustment', reasonKey: 'rate', reason: 'Rate correction: billed at 14.50, card says 13.00', invoiceIds: ['INV-3'], invoiceNumbers: ['SEP/TEST-00003'],
      againstInvoice: 'SEP/TEST-00003', againstInvoiceId: 'INV-3', taxableValue: 90, grandTotal: 106.2 }),
    // A cancelled note credits nothing and marks nothing.
    note('CN-006', { status: 'cancelled', invoiceIds: ['INV-4'], againstInvoice: 'SEP/TEST-00004', againstInvoiceId: 'INV-4', discountPct: 2, taxableValue: 10, grandTotal: 11.8 }),
  ];
  s.invNextNum = 5;
  extra(s);
  return s as SepState;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const mark = (p: Page, id: string) => p.locator(`#regList [data-id="${id}"] [data-cn-mark]`);

test.describe('P95: an invoice shows its credit notes', () => {
  test('a register row carries a CN mark; hovering names the note, its role, why and how much', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageRegister');
    await expect(mark(page, 'INV-2')).toHaveAttribute('title', /CN\/007\/26-27 · against this invoice · Batch rebate 2% on 2 invoices/);
    await expect(mark(page, 'INV-1')).toHaveAttribute('title', /CN\/007\/26-27 · in its batch/);
    await expect(mark(page, 'INV-3')).toHaveAttribute('title', /Rate correction: billed at 14\.50/);
    await expect(mark(page, 'INV-3')).toHaveAttribute('title', /₹106\.20/);
    await expect(mark(page, 'INV-4')).toHaveCount(0);   // its only note was cancelled
  });

  test('the invoice detail lists its notes and each opens; a note opens its invoice', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageRegister');
    await page.locator('#regList [data-action="invViewInvoiceDetail"][data-id="INV-2"]').first().click();
    const row = page.locator('.inv-scrim-dialog [data-cn-link="CN-007"]');
    await expect(row).toContainText('against this invoice');
    await expect(row).toContainText('Batch rebate 2%');
    await row.locator('[data-action="invCnPreview"]').click();
    await expect(page.locator('.inv-print-view-active .inv-cn-doc')).toBeVisible();
    await g(page, 'closePrintPreview()');

    await g(page, 'renderCreditNoteList()');
    await page.locator('.inv-scrim-dialog .inv-row:has([data-id="CN-008"]) [data-action="invViewInvoiceDetail"]').click();
    await expect(page.locator('.inv-scrim-dialog').last()).toContainText('SEP/TEST-00003');
  });

  test('To-do: a note against a cancelled or deleted invoice is red; notes crediting more than it billed are amber', async ({ page }) => {
    await loadAppWithState(page, state(s => {
      s.invoices[2].status = 'cancelled';                          // CN/008's invoice cancelled
      s.creditNotes.push(note('CN-009', { kind: 'adjustment', reason: 'Goods returned', invoiceIds: ['INV-2'], againstInvoice: 'SEP/TEST-00002',
        againstInvoiceId: 'INV-2', taxableValue: 5900, grandTotal: 6962 }));   // 200 + 5,900 against 6,000 billed
      s.creditNotes.push(note('CN-010', { kind: 'adjustment', recorded: true, reason: 'Rate correction', againstInvoice: '000443', taxableValue: 50, grandTotal: 59 }));
    }));
    const tasks = await g(page, 'TODO_RULE_FNS.cnMatch().map(function(t){ return [t.key, t.tone, t.title]; })');
    expect(tasks).toEqual([
      ['cnMatch:CN-008', 'red', 'CN/008/26-27 is against a cancelled invoice'],
      ['cnOver:INV-2', 'amber', 'Credit notes exceed invoice TEST-00002'],
    ]);
    // A note recorded against a number from outside the book (000443) names no invoice here and is not judged.
    // Deleted outright, the invoice's note still asks.
    const gone = await g(page, 'S.invoices = S.invoices.filter(function(i){ return i.id !== "INV-3"; }); TODO_RULE_FNS.cnMatch()[0].title');
    expect(gone).toBe('CN/008/26-27 is against an invoice no longer in the register');
  });
});
