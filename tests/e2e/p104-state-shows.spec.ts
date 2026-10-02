import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, type SepState, openPulse } from './fixtures';

// P104: an invoice's state shows the moment it changes (owner, 29 Sep 2026: "the invoice state change to printed should
// be immediately once the invoice is printed and when I mark it dispatched the state should change immediately, right
// now I have to refresh or switch tabs"). After Print nothing was redrawn, and a mark redrew only the Register, so
// Home's recent invoices, a client or the To-do kept the old state under the sheet. A Mark button drawn before the
// print also fell through: Mark printed on a printed invoice dispatched it.

const items = [{ partNumber: 'CLAMP 100X83 (NT)', desc: 'CLAMP 100X83 (NT)', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }];
const inv = (id: string, o: any = {}) => ({ id, invoiceNumber: id.slice(4).padStart(5, '0'), displayNumber: 'SEP/TEST-' + id.slice(4).padStart(5, '0'),
  date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '20ABCDE1234F1Z5',
  clientAddress: { add1: 'A-4, Road No. 2', add2: 'ADITYAPUR', add3: '', state: 'JHARKHAND', stateCode: '20' }, gstType: 'intra', items,
  taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '',
  challanNo: '834', challanDate: todayIso(), poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [],
  createdAt: recentTs(), ...o });
const book = (o: any = {}): SepState => { const s: any = emptyState(); s.invoices = [inv('INV-1', o)]; s.invNextNum = 2; return s; };
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const stored = (p: Page) => g(p, '({ st: S.invoices[0].invoiceState || "created", printedAt: S.invoices[0].printedAt || null })');
const step = (p: Page) => p.locator('[data-inv-detail="INV-1"] [aria-current="step"]');
const homeRow = (p: Page) => p.locator('#pageHome .inv-row').filter({ has: p.locator('[data-id="INV-1"]') }).first();
const regRow = (p: Page) => p.locator('#pageRegister .inv-page-active, #pageRegister').locator('[data-action="invViewInvoiceDetail"][data-id="INV-1"]').first();

async function print(page: Page, from: string) {
  await page.locator(from).first().click();
  await page.locator('[data-action="invPrint"]').click();
  await page.locator('[data-action="invClosePrint"]').click();
}

test.describe('P104: a state shows the moment it changes', () => {
  test.beforeEach(async ({ page }) => {
    await loadAppWithState(page, book());
    await openPulse(page);
    await page.evaluate(() => { window.print = function() {}; });
  });

  test("Print from Home's row shows Printed on the row at once", async ({ page }) => {
    await expect(homeRow(page).locator('.inv-badge')).toHaveText('Created');
    await print(page, '#pageHome [data-action="invPreviewInvoice"][data-id="INV-1"]');
    expect((await stored(page)).st).toBe('printed');
    await expect(homeRow(page).locator('.inv-badge')).toHaveText('Printed');
  });

  test("Print from the Register's sheet shows Printed in the list; Not printed puts it back", async ({ page }) => {
    await switchTab(page, 'pageRegister');
    await regRow(page).click();
    await expect(step(page)).toContainText('Created');
    await print(page, '[data-inv-detail="INV-1"] [data-action="invPreviewInvoice"]');
    await expect(regRow(page)).toContainText('Printed');
    await regRow(page).click();
    await expect(step(page)).toContainText('Printed');
    // The print dialog cannot say whether paper came out: a print that never did is put back, stamp and all.
    await page.locator('[data-inv-detail="INV-1"] [data-action="invNotPrinted"]').click();
    await expect(step(page)).toContainText('Created');
    expect(await stored(page)).toEqual({ st: 'created', printedAt: null });
    await expect(page.locator('[data-inv-detail="INV-1"] [data-action="invNotPrinted"]')).toHaveCount(0);
    await expect(regRow(page)).toContainText('Created');
  });

  test("Mark dispatched from Home's sheet moves the sheet and Home's row with it", async ({ page }) => {
    await page.locator('#pageHome button.inv-row-main[data-id="INV-1"]').click();
    await page.locator('[data-inv-detail="INV-1"] [data-action="invAdvanceState"][data-state="dispatched"]').click();
    expect((await stored(page)).st).toBe('dispatched');
    // The sheet stays open on its new step, and focus is on the next one.
    await expect(step(page)).toContainText('Dispatched');
    await expect(page.locator('[data-inv-detail="INV-1"] [data-action="invAdvanceState"][data-state="delivered"]')).toBeFocused();
    await expect(homeRow(page).locator('.inv-badge')).toHaveText('Dispatched');
  });

  test('a Mark button drawn before a print names a step reached, and does not skip past it', async ({ page }) => {
    await switchTab(page, 'pageRegister');
    await regRow(page).click();
    // Printed elsewhere (another window) while this sheet still shows Created.
    await g(page, 'S.invoices[0].invoiceState = "printed"; S.invoices[0].printedAt = Date.now()');
    await page.locator('[data-inv-detail="INV-1"] [data-action="invAdvanceState"][data-state="printed"]').click();
    expect((await stored(page)).st).toBe('printed');
    await expect(step(page)).toContainText('Printed');
    await expect(regRow(page)).toContainText('Printed');
  });
});
