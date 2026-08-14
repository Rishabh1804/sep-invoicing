import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Quality certificate (Test Certificate — ZN Plating).
 *
 * The document is issued per part per dispatch, not per invoice — the customer
 * files it against the part they inspect — so an invoice covering three parts
 * is three certificates. The format is approved by Tata Motors QA and says so
 * on its own face: "No alterations are permissible to the format without
 * written approval of QA - TML." These specs pin the fan-out, the derived
 * reference number, the verbatim approved text, and the rule that a cancelled
 * tax invoice certifies nothing.
 */

type Line = {
  partNumber: string; desc?: string; unit?: string;
  qty: number; rate: number; amount: number; nosQty?: number | null;
};

function invoice(num: number, lines: Line[], over: Record<string, unknown> = {}) {
  const items = lines.map((l) => ({
    partNumber: l.partNumber,
    desc: l.desc ?? l.partNumber,
    hsn: '998873',
    unit: l.unit ?? 'KG',
    qty: l.qty, rate: l.rate, amount: l.amount,
    nosQty: l.nosQty ?? null,
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
    ...over,
  };
}

function stateWith(invoices: unknown[]): SepState {
  const state = emptyState();
  state.invoices = invoices;
  state.invNextNum = invoices.length + 1;
  return state;
}

const TWO_LINES: Line[] = [
  { partNumber: '2082 3240 4202', desc: 'CLAMP 165X83 (NT) (40X6)', qty: 40, rate: 13, amount: 520 },
  { partNumber: '5069 3240 4202N', qty: 20.5, rate: 13, amount: 266.5 },
];

/** Open the register, open one invoice's detail, and press Quality Cert. */
async function certifyOne(page: Page, invId: string) {
  await switchTab(page, 'pageRegister');
  // Scoped to the register: Home renders the same action on its recent list.
  await page.locator(`#regList [data-action="invViewInvoiceDetail"][data-id="${invId}"]`).first().click();
  await page.locator('[data-action="invQualityCert"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();
}

/** Enter select mode and tick the given invoices. */
async function selectInvoices(page: Page, invIds: string[]) {
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  for (const id of invIds) {
    await page.locator(`#regList [data-action="invRegToggleInv"][data-id="${id}"]`).first().click();
  }
}

test('P17: one certificate per invoice line, not per invoice', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, TWO_LINES)]));
  await certifyOne(page, 'INV-1');

  const pages = page.locator('.inv-qc-page');
  await expect(pages).toHaveCount(2);
  // Each page names its own part; neither carries the other's.
  await expect(pages.nth(0)).toContainText('2082 3240 4202');
  await expect(pages.nth(1)).toContainText('5069 3240 4202N');
  await expect(pages.nth(0)).not.toContainText('5069 3240 4202N');
});

test('P17: the certificate carries the dispatch it certifies', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, TWO_LINES, { poNumber: 'PO-778' })]));
  await certifyOne(page, 'INV-1');

  const first = page.locator('.inv-qc-page').first();
  await expect(first).toContainText('SEP/TEST-00001');
  await expect(first).toContainText('TEST CLIENT KG');
  await expect(first).toContainText('ADITYAPUR, JAMSHEDPUR');
  await expect(first).toContainText('PO-778');
  // Challan number and date — the certificate is filed against the challan.
  await expect(first).toContainText('94');
  // The gauge rides along in the description; two clamp rows differ only there.
  await expect(first).toContainText('CLAMP 165X83 (NT) (40X6)');
});

test('P17: quantity states its unit — 40 KG and 40 NOS are different consignments', async ({ page }) => {
  const piece: Line[] = [{ partNumber: 'CLAMP 105X83', unit: 'NOS', qty: 40, rate: 2.5, amount: 100 }];
  await loadAppWithState(page, stateWith([invoice(1, piece)]));
  await certifyOne(page, 'INV-1');

  await expect(page.locator('.inv-qc-page').first()).toContainText('40.000 NOS');
});

test('P17: the reference number is derived, so it is the same every time', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(7, TWO_LINES)]));
  await certifyOne(page, 'INV-7');

  const pages = page.locator('.inv-qc-page');
  await expect(pages.nth(0)).toContainText('QC/SEP/TEST-00007/01');
  await expect(pages.nth(1)).toContainText('QC/SEP/TEST-00007/02');

  // Close and regenerate — a counter would have moved on; a derived number does not.
  await page.locator('[data-action="invClosePrint"]').click();
  await certifyOne(page, 'INV-7');
  await expect(page.locator('.inv-qc-page').first()).toContainText('QC/SEP/TEST-00007/01');
});

test('P17: the TML-approved text is reproduced verbatim, typos included', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1, [TWO_LINES[0]])]));
  await certifyOne(page, 'INV-1');

  const cert = page.locator('.inv-qc-page').first();
  await expect(cert).toContainText('TEST CERTIFICATE (ZN PLATING)');
  await expect(cert).toContainText('As Per JAQADPT02 of TATA MOTORS LTD');
  // Original-document spellings. Correcting them would break the QA approval
  // the disclaimer on the same page asserts.
  await expect(cert).toContainText('Cynide / Acid Dip');
  await expect(cert).toContainText('Peef off');
  await expect(cert).toContainText('No alterations are permissible to the format without written approval of QA - TML');
});

test('P17: a cancelled invoice certifies nothing', async ({ page }) => {
  const state = stateWith([invoice(1, TWO_LINES, { status: 'cancelled', cancelledAt: recentTs() })]);
  await loadAppWithState(page, state);
  await switchTab(page, 'pageRegister');
  await page.locator('#regList [data-action="invViewInvoiceDetail"][data-id="INV-1"]').first().click();

  // Not offered on the detail at all.
  await expect(page.locator('[data-action="invQualityCert"]')).toHaveCount(0);

  // And refused if reached another way — the number appears in GSTR-1 at zero.
  await page.evaluate(() => (window as any).showQualityCertificates(['INV-1']));
  await expect(page.locator('.inv-toast')).toContainText('Cancelled invoices cannot carry a quality certificate');
  await expect(page.locator('.inv-print-view-active')).toHaveCount(0);
});

test('P17: a bulk selection prints every line, in book order, and says what it skipped', async ({ page }) => {
  await loadAppWithState(page, stateWith([
    invoice(2, TWO_LINES),
    invoice(1, [{ partNumber: 'FIRST PART', qty: 5, rate: 13, amount: 65 }]),
    invoice(3, TWO_LINES, { status: 'cancelled', cancelledAt: recentTs() }),
  ]));

  // Mobile hides the checkbox on a cancelled row, so the cancelled one is
  // pushed in directly to prove the gather step filters it too.
  await selectInvoices(page, ['INV-1', 'INV-2']);
  await page.evaluate(() => {
    (window as any)._regSelected['INV-3'] = true;
  });

  await page.locator('[data-action="invRegQualityCerts"]').click();
  await page.locator('.inv-print-view-active').waitFor();

  // 1 line from 00001 + 2 from 00002. Nothing from the cancelled 00003.
  const pages = page.locator('.inv-qc-page');
  await expect(pages).toHaveCount(3);
  await expect(pages.nth(0)).toContainText('QC/SEP/TEST-00001/01');
  await expect(pages.nth(1)).toContainText('QC/SEP/TEST-00002/01');
  await expect(pages.nth(2)).toContainText('QC/SEP/TEST-00002/02');

  // A certificate that goes missing from a stack is not noticed until the
  // customer asks for it, so the exclusion is stated in place — a toast would
  // be painted under the print view and never seen.
  const notice = page.locator('.inv-qc-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('3 certificates for 2 invoices');
  await expect(notice).toContainText('skipped 1 cancelled');

  // …and it is app chrome, so it must not reach the customer.
  await page.emulateMedia({ media: 'print' });
  await expect(notice).toBeHidden();
  await expect(page.locator('.inv-qc-page').first()).toBeVisible();
});

test('P17: the selection bar counts what it can actually certify', async ({ page }) => {
  await loadAppWithState(page, stateWith([
    invoice(1, TWO_LINES),
    invoice(2, []),
  ]));
  await selectInvoices(page, ['INV-1', 'INV-2']);

  // Two invoices selected, one certifiable — the button must not promise two.
  await expect(page.locator('[data-action="invRegQualityCerts"]')).toHaveText('Quality certs (1)');
});

test('P17: company identity comes from the invoice, so the two documents cannot disagree', async ({ page }) => {
  const state = stateWith([invoice(1, [TWO_LINES[0]])]);
  state.company = {
    name: 'SOMA ELECTRO PRODUCTS', add1: '8-B, 1st Phase, Industrial Area, Adityapur',
    add2: 'Jamshedpur - 832 109', add3: '', phone: '9431523950', mobile: '8271063224',
    email: 'soma_electro123@rediffmail.com', gstin: '20AAPFS4718J2Z0',
    state: 'JHARKHAND', stateCode: '20',
  };
  await loadAppWithState(page, state);
  await certifyOne(page, 'INV-1');

  const cert = page.locator('.inv-qc-page').first();
  await expect(cert).toContainText('SOMA ELECTRO PRODUCTS');
  // The GSTIN the tax invoice files under, not a second copy frozen in the
  // certificate template that could drift away from it.
  await expect(cert).toContainText('GSTIN : 20AAPFS4718J2Z0');
});
