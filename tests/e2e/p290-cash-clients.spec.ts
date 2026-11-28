import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P290: a client who pays in cash and has no GST registration (owner, 28 Nov 2026: "We need to add them as clients, but they pay us
// via cash, once in 2-3 months, so they don't have any GST filing or registration"). Ticked "Cash, no invoice" on its card, its work
// is read and counted on the floor, and it is never offered for an invoice or a challan, so it never reaches GSTR-1 or the receivables.
// Made-up names and figures: the repo is public.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const CLIENTS = [
  { id: 1, name: 'NOVA CLAMPS PVT. LTD.', gstin: '20ABCDE1234F1Z5', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [] },
  { id: 2, name: 'KILO TRADERS', gstin: '', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [], cashOnly: true },
];

test.describe('P290: a cash client, never invoiced', () => {
  test('ticked on its card, said in the list; never offered for an invoice or a challan; read and counted on the floor', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: [], attendance: {}, incomingMaterial: noSeedIM() } as unknown as SepState);
    // Ticked on the card and saved.
    await ev(page, 'openClientEdit(1)');
    await expect(page.locator('#ceditCash')).not.toBeChecked();
    await page.locator('#ceditCash').check();
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect((await readStoredState(page)).clients.find((x: any) => x.id === 1).cashOnly).toBe(true);
    // Unticked, it is a client like any other again.
    await ev(page, 'openClientEdit(1)');
    await page.locator('#ceditCash').uncheck();
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect((await readStoredState(page)).clients.find((x: any) => x.id === 1).cashOnly).toBeFalsy();
    // Never offered for an invoice: the client search finds the other, and a form set to it by any road does not save.
    expect(await ev(page, `(function(){ invoiceForm.clientId = 2; return validateInvoiceKeyed().map(function(e){ return e.key + ':' + e.text; }); })()`))
      .toContain('client:This client pays in cash and is never invoiced: untick Cash, no invoice in its client card to invoice it');
    // Read on the floor: the pickling hand's load is its, asked nothing.
    const m = await ev(page, `parseProdPaste(${JSON.stringify('01/01/2026, 10:29 am - Pickler: KILO TRADERS\nHOOK--60 Kg\nPickling time 10:00 am\nFor Barrel')}, prodCtx())[0].read.items.map(function(i){ return [i.clientId, i.part, i.qty, i.issues.filter(function(x){ return x.tone === 'red'; }).length]; })`);
    expect(m).toEqual([[2, 'HOOK', 60, 0]]);
  });

  test('the invoice and the challan client searches leave it out; the client list says what it is', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: [], attendance: {}, incomingMaterial: noSeedIM() } as unknown as SepState);
    // The invoice's client search, typed: the cash client is not offered.
    await switchTab(page, 'pageCreate');
    await page.locator('#invClientSearch').fill('KILO');
    await expect(page.locator('#invClientResults')).not.toContainText('KILO TRADERS');
    await page.locator('#invClientSearch').fill('NOVA');
    await expect(page.locator('#invClientResults')).toContainText('NOVA CLAMPS');
    // The challan's client search, typed: nor here.
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanClientSearch').fill('KILO');
    await expect(page.locator('[data-action="invSelectChallanClient"]')).toHaveCount(0);
    await page.locator('#imChallanClientSearch').fill('NOVA');
    await expect(page.locator('[data-action="invSelectChallanClient"]')).toHaveCount(1);
    await switchTab(page, 'pageClients');
    await expect(page.locator('#pageClients')).toContainText('Cash, no invoice');
  });
});
