import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Tax invoice pagination.
 *
 * An invoice with enough line items runs past one sheet, and the printed
 * document has to survive that. Four things were wrong when it did:
 *
 *  - Margins lived in `padding` on the invoice block while `@page` margin was
 *    0. Block padding is applied once to the whole flow, so page two began
 *    hard against the paper edge.
 *  - The declaration was `position: fixed` at the bottom of every sheet. Fixed
 *    takes it out of flow without reserving the band, so the rows printed
 *    through it.
 *  - Nothing stopped a break falling inside a row, inside the letterhead box,
 *    or between the totals and the signature that attests them.
 *  - A continuation page carried no invoice number and no copy label — the
 *    letterhead is on page one only.
 *
 * These assertions read the computed print styles rather than a rendered PDF:
 * the break rules are the contract, and a PDF pixel diff would pin the page
 * count of one fixture instead.
 */

type Line = {
  partNumber: string; desc?: string; unit?: string;
  qty: number; rate: number; amount: number;
};

/** `count` line items — enough to run a tax invoice past one sheet. */
function manyLines(count: number): Line[] {
  return Array.from({ length: count }, (_, i) => ({
    partNumber: `2082 3240 ${String(4000 + i)}`,
    desc: `CLAMP ${100 + i}X83 (NT) (40X6)`,
    qty: 10 + i,
    rate: 13,
    amount: (10 + i) * 13,
  }));
}

function invoice(num: number, lines: Line[]) {
  const items = lines.map((l) => ({
    partNumber: l.partNumber,
    desc: l.desc ?? l.partNumber,
    hsn: '998873',
    unit: l.unit ?? 'KG',
    qty: l.qty, rate: l.rate, amount: l.amount,
    nosQty: null,
  }));
  const taxable = items.reduce((s, i) => s + i.amount, 0);
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(),
    status: 'active',
    invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    clientGSTIN: '',
    clientAddress: { add1: 'A-4, Road No. 2', add2: 'ADITYAPUR, JAMSHEDPUR', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items,
    taxableValue: taxable,
    cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '',
    challanNo: '94', challanDate: todayIso(), poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
  };
}

function stateWith(invoices: unknown[]): SepState {
  const state = emptyState();
  state.invoices = invoices;
  state.invNextNum = invoices.length + 1;
  state.bankDetails = 'SBI ADITYAPUR — A/C 1234567890';
  return state;
}

/** Open the register, open the invoice's detail, and press Preview. */
async function previewOne(page: Page, invId: string) {
  await switchTab(page, 'pageRegister');
  await page.locator(`#regList [data-action="invViewInvoiceDetail"][data-id="${invId}"]`).first().click();
  // Scoped to the detail overlay: Home's recent list renders the same action
  // as a hidden print button, and it sits earlier in the DOM.
  await page.locator('.inv-overlay-scrim [data-action="invPreviewInvoice"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();
}

/** Computed value of one property, under print media. */
async function printStyle(page: Page, selector: string, prop: string): Promise<string> {
  await page.emulateMedia({ media: 'print' });
  return page.locator(selector).first().evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p as string).trim(),
    prop,
  );
}

const LONG = manyLines(40);

test('P30: a continuation page still names its invoice and its copy', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, LONG)]));
  await previewOne(page, 'INV-1');

  // The caption rides in the <thead>, the one box browsers repeat on every
  // printed page. One per copy, and each states which copy it belongs to.
  const captions = page.locator('.inv-print-invoice .inv-pi-table thead .inv-pi-caption');
  await expect(captions).toHaveCount(3);
  await expect(captions.nth(0)).toContainText('SEP/TEST-00001');
  await expect(captions.nth(0)).toContainText('ORIGINAL FOR RECIPIENT');
  await expect(captions.nth(1)).toContainText('DUPLICATE FOR TRANSPORTER');

  // It sits inside the header group, above the column headings — not in the
  // body, where it would scroll away with the rows.
  await expect(page.locator('.inv-pi-table tbody .inv-pi-caption')).toHaveCount(0);
});

test('P30: the letterhead and the totals/signature block each stay whole', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, LONG)]));
  await previewOne(page, 'INV-1');

  // The head block chains `border-top: none` between its parts to draw one
  // box; split across a page it opens the box.
  await expect(page.locator('.inv-pi-head-block')).toHaveCount(3);
  await expect(page.locator('.inv-pi-head-block').first()).toContainText('TAX INVOICE');
  await expect(page.locator('.inv-pi-head-block').first()).toContainText('Bill To');

  // Totals, bank, signature and declaration are one block: a break between the
  // totals and the signature attesting them is the one that must not happen.
  const tail = page.locator('.inv-pi-tail').first();
  await expect(tail).toContainText('Total Amount');
  await expect(tail).toContainText('Authorised Signatory');
  await expect(tail).toContainText('SBI ADITYAPUR');

  expect(await printStyle(page, '.inv-pi-head-block', 'break-inside')).toBe('avoid');
  expect(await printStyle(page, '.inv-pi-tail', 'break-inside')).toBe('avoid');
});

test('P30: a line item is never sliced across the page boundary', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, LONG)]));
  await previewOne(page, 'INV-1');

  expect(await printStyle(page, '.inv-pi-table tbody tr', 'break-inside')).toBe('avoid');
  // The column headings repeat with the caption.
  expect(await printStyle(page, '.inv-pi-table thead', 'display')).toBe('table-header-group');
});

test('P30: margins come from the page, not from padding on the flow', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, LONG)]));
  await previewOne(page, 'INV-1');

  await page.emulateMedia({ media: 'print' });
  const sheet = page.locator('.inv-print-invoice').first();

  // Padding on the block is applied once to the whole flow — page two would
  // start at the paper edge. `@page invoice` gives every page the gutter.
  const padding = await sheet.evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
  });
  expect(padding).toEqual(['0px', '0px', '0px', '0px']);
  expect(await sheet.evaluate((el) => getComputedStyle(el).page)).toBe('invoice');

  // The declaration flows with the tail. Fixed took it out of flow without
  // reserving the band, so rows printed through it.
  expect(await printStyle(page, '.inv-pi-declaration', 'position')).toBe('static');
});

test('P30: a short invoice is unchanged — one copy per page, three pages', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, manyLines(2))]));
  await previewOne(page, 'INV-1');

  await expect(page.locator('.inv-print-invoice')).toHaveCount(3);
  // The first two copies break after; the last must not, or the print carries
  // a trailing blank sheet.
  await expect(page.locator('.inv-print-invoice.inv-pi-page-break')).toHaveCount(2);
  await expect(page.locator('.inv-print-invoice').last()).not.toHaveClass(/inv-pi-page-break/);
});
