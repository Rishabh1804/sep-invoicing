import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * The sales register as a DOCUMENT.
 *
 * The CSV is a working paper for the accountant. This is the same register as
 * something a customer can be handed: SSS Mehta get the register for a batch
 * alongside the credit note raised on it, and a spreadsheet is not what goes
 * out with a GST document.
 *
 * Two things carry real risk and both are asserted here. It must honour a
 * SELECTION, because a credit note is raised from a ticked batch and the
 * register filter alone cannot express "these fourteen". And it must not carry
 * one customer's invoices into another customer's hands.
 */

function invoice(num: number, over: Record<string, unknown> = {}) {
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(),
    status: 'active', invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1, clientName: 'SSSMEHTA INDUSTRIES LTD', clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 1000, cgstPer: 9, cgstAmt: 90, sgstPer: 9, sgstAmt: 90, igstPer: 0, igstAmt: 0,
    grandTotal: 1180, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
    ...over,
  };
}

function stateWith(invoices: unknown[]): SepState {
  const s = emptyState();
  s.invoices = invoices;
  s.invNextNum = 99;
  return s;
}

const openDoc = async (page: Page) => {
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invPrintSalesRegister"]').first().click();
  return page.locator('.inv-sr-doc');
};

test('P32: the register prints as a document, in serial order, footing to its rows', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(3), invoice(1), invoice(2)]));
  const doc = await openDoc(page);
  await expect(doc).toBeVisible();

  // Identity is READ FROM STATE, never frozen into the template — the same rule
  // the certificate and the credit note follow, and the reason the prototype
  // certificate could drift to a wrong GSTIN.
  await expect(doc.locator('.inv-sr-co')).toContainText('SOMA ELECTRO PRODUCTS');

  // Serial order, not the on-screen sort. A register is read by serial: that is
  // the order rule 46's consecutive series is kept in, and the order a gap is
  // spotted in.
  const nums = await doc.locator('tbody .inv-sr-num').allInnerTexts();
  expect(nums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002', 'SEP/TEST-00003']);

  // The total is of the rows actually printed.
  const foot = await doc.locator('tfoot').innerText();
  expect(foot).toContain('3 invoices');
  expect(foot).toContain('\u20B93,000.00');   // taxable
  expect(foot).toContain('\u20B93,540.00');   // invoice amount
});

test('P32: a cancelled invoice prints at zero and still occupies its number', async ({ page }) => {
  // Same rule the CSV uses: the number was issued, so the series has to show
  // it. Dropping the row would leave a gap indistinguishable from one never
  // issued — the exact ambiguity the void ledger exists to remove.
  await loadAppWithState(page, stateWith([invoice(1), invoice(2, { status: 'cancelled' })]));
  const doc = await openDoc(page);

  const nums = await doc.locator('tbody .inv-sr-num').allInnerTexts();
  expect(nums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002']);
  const row = doc.locator('tbody tr', { hasText: 'SEP/TEST-00002' });
  await expect(row).toContainText('Cancelled');
  // Its money is zero, and it is excluded from the total.
  expect(await doc.locator('tfoot').innerText()).toContain('\u20B91,000.00');
});

test('P32: a ticked batch scopes the document, and the face says so', async ({ page }) => {
  // THE POINT OF THE FEATURE. A credit note is raised from a ticked batch; the
  // register that accompanies it must cover exactly that batch. The register
  // filter cannot express "these two".
  await loadAppWithState(page, stateWith([invoice(1), invoice(2), invoice(3)]));
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegToggleInv"][data-id="INV-1"]').first().click();
  await page.locator('[data-action="invRegToggleInv"][data-id="INV-3"]').first().click();

  await page.locator('[data-action="invPrintSalesRegister"]').first().click();
  const doc = page.locator('.inv-sr-doc');

  const nums = await doc.locator('tbody .inv-sr-num').allInnerTexts();
  expect(nums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00003']);
  // Stated on the face: the CSV is filter-only, so the two CAN disagree, and a
  // document that names its own scope cannot mislead anybody about which it is.
  await expect(doc.locator('.inv-sr-meta')).toContainText('2 selected invoices');
  expect(await doc.locator('tfoot').innerText()).toContain('2 invoices');
});

test('P32: a register spanning two customers warns before it is sent to one', async ({ page }) => {
  // This document exists to go out WITH a credit note, and a credit note is
  // addressed to one customer. Sending a multi-customer register to one of them
  // discloses the others. Warn, never block: filing it is a legitimate use.
  await loadAppWithState(page, stateWith([
    invoice(1),
    invoice(2, { clientId: 2, clientName: 'DORABJI ENGINEERING' }),
  ]));
  await openDoc(page);
  const notice = page.locator('.inv-qc-notice-warn');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('2 customers');
  // Warned, not blocked — the document is still there.
  await expect(page.locator('.inv-sr-doc')).toBeVisible();

  // One customer: no banner at all. A check that only ever speaks up teaches
  // the reader to stop trusting its silence.
  await loadAppWithState(page, stateWith([invoice(1), invoice(2)]));
  await openDoc(page);
  await expect(page.locator('.inv-qc-notice-warn')).toHaveCount(0);
});

test('P32: the table fits the sheet at a long customer name and a full month', async ({ page }) => {
  /* The lesson from invoice 00866, which ran 752px of content into a 703px page
     and was caught only when it came back from the floor. A table's minimum
     width is the sum of its cells' minimum widths, so free text that cannot
     wrap holds the row open and the sheet overflows. */
  const many = Array.from({ length: 40 }, (_, i) =>
    invoice(i + 1, { clientName: 'SSSMEHTA INDUSTRIES PRIVATE LIMITED, ADITYAPUR' }));
  await loadAppWithState(page, stateWith(many));
  // A4 at 96dpi. The phone project is far narrower than a sheet, so an overflow
  // that only exists at print width is invisible to every other check here.
  await page.setViewportSize({ width: 794, height: 1123 });
  await openDoc(page);

  const measure = () => page.evaluate(() => {
    const doc = document.querySelector('.inv-sr-doc') as HTMLElement;
    const cs = getComputedStyle(doc);
    const printable = doc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const rows = [...doc.querySelectorAll('.inv-sr-table tr')];
    const rowMin = Math.max(...rows.map(tr =>
      [...tr.children].reduce((n, td) => n + (td as HTMLElement).scrollWidth, 0)));
    return { printable: Math.round(printable), rowMin: Math.round(rowMin) };
  });
  const shipped = await measure();
  expect(shipped.rowMin).toBeLessThanOrEqual(shipped.printable);

  /* And again in a deliberately wide face, so the assertion means the same on a
     laptop, on CI (no webfonts, a different fallback) and on the shop's Windows
     box. sw.js lets the font CSS fail rather than block the install, so the
     fallback is a real print path. */
  await page.addStyleTag({ content: '.inv-sr-doc{--ff-base:"DejaVu Sans",sans-serif}' });
  const wide = await measure();
  expect(wide.rowMin).toBeLessThanOrEqual(wide.printable);

  // The header repeats on every printed page — a continuation page has to say
  // which column is which.
  expect(await page.locator('.inv-sr-table thead')
    .evaluate(el => getComputedStyle(el).display)).toBe('table-header-group');
});

/** A void the operator can see in the register: reserved, so it exports. */
function voidRec(num: number, date: string, reason = 'typed against the wrong challan, reissued as 00812') {
  return {
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date, clientId: 1, clientName: 'SSSMEHTA INDUSTRIES LTD',
    taxableValue: 0, grandTotal: 0, lastState: 'dispatched', wasCancelled: false,
    reason, reserved: true, source: 'deleted', voidedAt: recentTs(),
  };
}

test('P32: a void prints its number but NOT its internal reason', async ({ page }) => {
  // A void reason is internal commentary and this document is handed to a
  // customer. The number showing as Voided is what the consecutive series
  // needs; the reason stays in the CSV and the number audit.
  const s = stateWith([invoice(1)]);
  (s as SepState & { voidedNumbers: unknown[] }).voidedNumbers = [voidRec(2, todayIso())];
  await loadAppWithState(page, s);
  const doc = await openDoc(page);

  const row = doc.locator('tbody tr', { hasText: 'SEP/TEST-00002' });
  await expect(row).toContainText('Voided');
  await expect(row).not.toContainText('wrong challan');
  await expect(row).not.toContainText('VOID:');
  // The number is still accounted for — the series explains its own gap.
  const nums = await doc.locator('tbody .inv-sr-num').allInnerTexts();
  expect(nums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002']);
});

test('P32: a DATE RANGE scopes voids, on the document and in the CSV', async ({ page }) => {
  /* getVoidedForExport honoured `month` and not `dateFrom`/`dateTo`, so a
     range-scoped register carried voids from outside its own range — and the
     range is exactly how a credit-note batch is expressed. The fix reaches the
     CSV too, so both are asserted: the two documents must not disagree about
     which numbers are in the batch. */
  const s = stateWith([invoice(1, { date: '2026-08-10' })]);
  (s as SepState & { voidedNumbers: unknown[] }).voidedNumbers = [
    voidRec(2, '2026-08-12'),   // inside the range
    voidRec(3, '2026-07-04'),   // outside it
  ];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageRegister');
  await page.locator('#regDateFrom').fill('2026-08-01');
  await page.locator('#regDateTo').fill('2026-08-31');

  await page.locator('[data-action="invPrintSalesRegister"]').first().click();
  const nums = await page.locator('.inv-sr-doc tbody .inv-sr-num').allInnerTexts();
  expect(nums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002']);
  expect(nums).not.toContain('SEP/TEST-00003');

  // The CSV, from the same fix.
  await page.locator('[data-action="invClosePrint"]').first().click().catch(() => {});
  const csv = await page.evaluate(() => {
    const w = window as unknown as {
      downloadCSV: (f: string, r: unknown[][]) => void; exportSalesCSV: () => void; __csv?: unknown;
    };
    let got: string[][] = [];
    w.downloadCSV = (_f, rows) => { got = rows as string[][]; };
    w.exportSalesCSV();
    return got;
  });
  const csvNums = csv.slice(2).map(r => r[0]);
  expect(csvNums).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002']);
});
