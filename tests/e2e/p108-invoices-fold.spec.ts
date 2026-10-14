import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, answerAsk, readStoredState, noSeedIM, SepState, openPulse, toolbarMore, setFilter, filterControl, closeFilter } from './fixtures';

/*
 * P108: invoices, credit notes, printed documents and GST exports (the QA sweep, 29 Sep 2026).
 * One test or a few per finding, each named by its id in the sweep's ledger. Made-up clients and parts.
 */

const g = (page: Page, expr: string) => page.evaluate(x => (0, eval)(x), expr);

const ADDR = { add1: 'A-1 Test Road', add2: 'Adityapur', add3: '', state: 'JHARKHAND', stateCode: '20' };

/* An invoice; `prefix` names its series. */
function inv(num: number, over: Record<string, unknown> = {}) {
  const prefix = (over.prefix as string) || 'SEP/TEST-';
  const n = String(num).padStart(5, '0');
  const rest: Record<string, unknown> = { ...over };
  delete rest.prefix;
  return {
    id: 'INV-' + num, invoiceNumber: n, displayNumber: prefix + n, date: todayIso(),
    status: 'active', invoiceState: 'created', dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '', clientAddress: ADDR, gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0,
    grandTotal: 153.4, amountInWords: '', challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs(), updatedAt: recentTs(),
    ...rest,
  };
}

function voidRec(num: number, over: Record<string, unknown> = {}) {
  const n = String(num).padStart(5, '0');
  return { invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
    taxableValue: 130, grandTotal: 153.4, lastState: 'dispatched', wasCancelled: false, reason: 'test void', reserved: true,
    source: 'deleted', voidedAt: recentTs(), ...over };
}

const KG_CLIENT = { id: 1, name: 'TEST CLIENT KG', billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', address: '', isActive: true,
  rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
const PIECE_CLIENT = { id: 2, name: 'PIECE TEST WORKS', billingMode: 'piece', gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
const N2W_CLIENT = { id: 3, name: 'N2W TEST WORKS', billingMode: 'nos_to_weight', gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };

function book(invoices: unknown[], over: Record<string, unknown> = {}): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [KG_CLIENT, PIECE_CLIENT, N2W_CLIENT] as never;
  s.invoices = invoices;
  s.invNextNum = 99;
  return Object.assign(s, over) as SepState;
}

/* The register opened on all dates, so a fixture's dates are the only thing that decides what is listed. */
async function loadAllDates(page: Page, state: SepState) {
  await page.addInitScript(() => {
    localStorage.setItem('sep_inv_view_prefs', JSON.stringify({ clientId: '', month: '', search: '', state: '' }));
  });
  await loadAppWithState(page, state);
}

async function openDetail(page: Page, invId: string) {
  await g(page, `openInvoiceDetail('${invId}')`);
  await expect(page.locator(`[data-inv-detail="${invId}"]`)).toBeVisible();
}

async function openDelete(page: Page, invId: string) {
  await openDetail(page, invId);
  await page.locator(`[data-inv-detail="${invId}"] [data-action="invDeleteInvoice"]`).click();
  await expect(page.locator('#invDeleteReason')).toBeVisible();
}

/* What downloadCSV was handed, instead of a file. */
async function captureCsv(page: Page, run: string) {
  await page.evaluate(() => {
    (window as any).__csv = null;
    (window as any).downloadCSV = (filename: string, rows: unknown[][]) => { (window as any).__csv = { filename, rows }; };
  });
  await g(page, run);
  return page.evaluate(() => (window as any).__csv as { filename: string; rows: any[][] });
}

async function pickClient(page: Page, q: string) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill(q);
  await page.locator('[data-action="invSelectClient"]').first().click();
}

async function typePart(page: Page, idx: number, part: string) {
  await page.locator(`input[data-action="invEditLinePart"][data-idx="${idx}"]`).fill(part);
  await g(page, 'dismissAllAutocomplete()');
}

/* ===== I1: the series is read by its prefix ===== */

test('I1: deleting this year\'s last invoice returns its number to this year\'s series, never past last year\'s', async ({ page }) => {
  const old = [1, 2, 950].map(n => inv(n, { id: 'OLD-' + n, prefix: 'SEP/2025-26/', invoiceState: 'filed', filedAt: recentTs() }));
  const cur = [1, 2, 3].map(n => inv(n, { id: 'NEW-' + n, prefix: 'SEP/2026-27/' }));
  await loadAllDates(page, book([...old, ...cur], { invPrefix: 'SEP/2026-27/', invNextNum: 4 }));
  await openDelete(page, 'NEW-3');
  await page.locator('#invDeleteReason').fill('typed against the wrong client');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  expect((await readStoredState(page)).invNextNum).toBe(3);
});

test('I1: the number audit keeps each financial year\'s series apart', async ({ page }) => {
  // Last year ran 1–3; this year has 1, 3 and 4 — its 00002 is missing. Keyed by the number alone, last year's 00002
  // stood in for it and the gap was never shown.
  const old = [1, 2, 3].map(n => inv(n, { id: 'OLD-' + n, prefix: 'SEP/2025-26/', invoiceState: 'filed', filedAt: recentTs() }));
  const cur = [1, 3, 4].map(n => inv(n, { id: 'NEW-' + n, prefix: 'SEP/2026-27/' }));
  await loadAllDates(page, book([...old, ...cur], { invPrefix: 'SEP/2026-27/', invNextNum: 5 }));
  const a: any = await g(page, 'JSON.stringify((function(a) { return { u: a.unaccounted.map(function(e) { return e.display; }), c: a.counts }; })(analyseInvoiceNumbers()))').then(x => JSON.parse(x as string));
  expect(a.u).toEqual(['SEP/2026-27/00002']);
  expect(a.c.active).toBe(6);

  // Accounted for under its own series.
  await switchTab(page, 'pageRegister');
  await toolbarMore(page, 'Number audit');
  await expect(page.locator('.inv-scrim-dialog')).toContainText('SEP/2025-26/');
  await page.locator('[data-action="invAccountForNumber"][data-num="2"]').click();
  await page.locator('#invGapReason').fill('spoiled, filed at zero');
  await page.locator('[data-action="invSaveGapReason"]').click();
  const v = (await readStoredState(page)).voidedNumbers;
  expect(v).toHaveLength(1);
  expect(v[0]).toMatchObject({ invoiceNumber: '00002', displayNumber: 'SEP/2026-27/00002', reserved: true });
  expect((await readStoredState(page)).invNextNum).toBe(5);
});

/* ===== I2: a line needs a part and a quantity ===== */

test('I2: a blank line, a line with no part and a line with no quantity are refused, naming the line', async ({ page }) => {
  await loadAppWithState(page, book([], { invNextNum: 1 }));
  await pickClient(page, 'test client');
  await page.locator('[data-action="invAddLineItem"]').click();
  const save = page.locator('#invSaveBtn');
  const errs = page.locator('#invErrorsArea');
  // No error before a try (the tab map, TM5h): a form nobody has touched says nothing, and Save is there to tap.
  await expect(errs).toBeEmpty();
  await expect(save).toBeEnabled();
  // A blank line, saved: it was a ₹0 invoice of nothing. Refused, naming the line, and Save held while the error shows.
  await save.click();
  await expect(errs).toContainText('Line 1');
  await expect(save).toBeDisabled();

  await page.locator('input[data-field="qty"][data-idx="0"]').fill('10');
  await expect(errs).toContainText('Line 1: name the part');
  await expect(save).toBeDisabled();

  await typePart(page, 0, 'TEST PART 9');
  await expect(save).toBeEnabled();

  await page.locator('input[data-field="qty"][data-idx="0"]').fill('');
  await expect(errs).toContainText('Line 1: enter the quantity');
  await expect(save).toBeDisabled();
  expect((await readStoredState(page)).invoices).toHaveLength(0);
});

test('I2: a line with nothing on it is not certified', async ({ page }) => {
  const i1 = inv(1, { items: [
    { partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null },
    { partNumber: '', desc: '', hsn: '998873', unit: 'KG', qty: 0, rate: 13, amount: 0, nosQty: null },
  ] });
  await loadAppWithState(page, book([i1]));
  await g(page, "showQualityCertificates(['INV-1'])");
  await expect(page.locator('.inv-qc-page')).toHaveCount(1);
  await expect(page.locator('.inv-qc-notice')).toContainText('1 line with nothing on it');
  // The certificate keeps the line's own number: the first line is 01.
  await expect(page.locator('.inv-qc-page').first()).toContainText('QC/SEP/TEST-00001/01');
});

/* ===== I3: a NOS challan line billed in part ===== */

function nosChallanState(): SepState {
  const s = book([], { invNextNum: 1 });
  s.incomingMaterial = [{ id: 'IM-601', challanNo: '601', challanDate: todayIso(), clientId: 2, clientName: PIECE_CLIENT.name,
    vehicleNo: '', receivedDate: todayIso(), notes: '', createdAt: recentTs(),
    items: [{ id: 'IM-601-0', partNumber: 'TEST CLAMP 60', desc: 'TEST CLAMP 60 (40X6)', hsn: '998873', unit: 'NOS',
      qty: 600, rate: 2.5, amount: 1500, nosQty: 600, invoiced: false, invoiceId: null }] }] as never;
  return s;
}

test('I3: a 200 dispatch of a 600-piece challan line bills 200 pieces, and 400 stay open', async ({ page }) => {
  await loadAppWithState(page, nosChallanState());
  await pickClient(page, 'piece test');
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-601"]').check();
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('200');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  const st = await readStoredState(page);
  expect(st.invoices[0].items[0]).toMatchObject({ qty: 200, nosQty: 200, amount: 500 });
  expect(st.incomingMaterial[0].items[0]).toMatchObject({ billedQty: 200, billedNos: 200, invoiced: false });
  expect(await g(page, "imLineOpen(S.incomingMaterial[0].items[0]).nos")).toBe(400);
});

test('I3: an invoice saved with the whole challan\'s pieces on a part line still bills only its share', async ({ page }) => {
  const s = nosChallanState();
  s.invoices = [inv(1, { clientId: 2, clientName: PIECE_CLIENT.name, items: [{ partNumber: 'TEST CLAMP 60', desc: 'TEST CLAMP 60 (40X6)',
    hsn: '998873', unit: 'NOS', qty: 200, rate: 2.5, amount: 500, nosQty: 600, imItemId: 'IM-601-0' }], taxableValue: 500 })];
  s.invNextNum = 2;
  await loadAppWithState(page, s);
  expect(await g(page, 'S.incomingMaterial[0].items[0].billedNos')).toBe(200);
  expect(await g(page, 'imLineOpen(S.incomingMaterial[0].items[0]).nos')).toBe(400);
});

/* ===== I4: deleting an invoice says what happens to its number ===== */

test('I4: a created invoice below the last leaves a gap the dialog names, and the returns carry it at ₹0', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2), inv(3)], { invNextNum: 4 }));
  await openDelete(page, 'INV-2');
  const dlg = page.locator('.inv-scrim-dialog').last();
  await expect(dlg).not.toContainText('returns to the series');
  await expect(dlg).toContainText('SEP/TEST-00003 is already issued');
  await page.locator('#invDeleteReason').fill('duplicate of 00001');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  expect((await readStoredState(page)).invNextNum).toBe(4);
  expect(await g(page, 'getVoidedForExport().map(function(v) { return v.invoiceNumber; }).join()')).toBe('00002');
  const csv = await captureCsv(page, 'exportGSTR1CSV()');
  const row = csv.rows.find(r => r[1] === 'SEP/TEST-00002');
  expect(row).toBeTruthy();
  expect(row![3]).toBe(0);
});

test('I4: deleting the last created invoice gives its number back, and says so', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2)], { invNextNum: 3 }));
  await openDelete(page, 'INV-2');
  await expect(page.locator('.inv-scrim-dialog').last()).toContainText('the next invoice takes SEP/TEST-00002');
  await page.locator('#invDeleteReason').fill('typed twice');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  expect((await readStoredState(page)).invNextNum).toBe(2);
  expect(await g(page, 'getVoidedForExport().length')).toBe(0);
});

test('I4: a cancelled invoice deleted keeps its number spent, in the audit and in the returns', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2, { status: 'cancelled', cancelledAt: recentTs() })], { invNextNum: 3 }));
  await openDelete(page, 'INV-2');
  await expect(page.locator('.inv-scrim-dialog').last()).toContainText('was cancelled');
  await page.locator('#invDeleteReason').fill('clearing the cancelled copy');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  const st = await readStoredState(page);
  expect(st.invNextNum).toBe(3);
  expect(st.voidedNumbers[0]).toMatchObject({ invoiceNumber: '00002', reserved: true, wasCancelled: true });
  expect(await g(page, 'getVoidedForExport().map(function(v) { return v.invoiceNumber; }).join()')).toBe('00002');
  await switchTab(page, 'pageRegister');
  await toolbarMore(page, 'Number audit');
  await expect(page.locator('.inv-scrim-dialog [data-num-kind="voided"]')).toContainText('cancelled before it was deleted');
});

test('I4/IR: the delete warns from GSTR-1\'s due day, the 11th, as the Delivered state does', async ({ page }) => {
  // A fixed clock, so the dates below mean the same thing on any day the suite runs: an August invoice on 20 Sep is
  // past its GSTR-1 due day (11 Sep), where the old test (the 5th of the month after next, 5 Oct) called it unfiled.
  await page.clock.setFixedTime(new Date('2026-09-20T10:00:00'));
  await loadAllDates(page, book([inv(1, { date: '2026-08-10' })], { invNextNum: 2 }));
  await openDelete(page, 'INV-1');
  await expect(page.locator('[data-delete-warn]')).toContainText('filed GST return');
});

/* ===== I5: the printed note never prints the app's working ===== */

test('I5: a note with no invoice large enough prints no reference at all', async ({ page }) => {
  const s = book([inv(1, { taxableValue: 1000 }), inv(2, { taxableValue: 1000 })]);
  (s as any).creditNotes = [
    { id: 'CN-A', cnNumber: '006', displayNumber: 'CN/006/TEST', date: todayIso(), status: 'active', clientId: 1, clientName: 'TEST CLIENT KG',
      invoiceIds: ['INV-1', 'INV-2'], invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], invoiceDates: [todayIso(), todayIso()],
      periodFrom: todayIso(), periodTo: todayIso(), discountPct: 2, batchTaxable: 2000, reason: 'Standing 2% batch discount',
      unit: 'KG', rate: 13, qty: 1, gstType: 'intra', taxableValue: 5000, cgstPer: 9, cgstAmt: 450, sgstPer: 9, sgstAmt: 450,
      igstPer: 0, igstAmt: 0, grandTotal: 5900, createdAt: recentTs() },
    { id: 'CN-B', cnNumber: '007', displayNumber: 'CN/007/TEST', date: todayIso(), status: 'active', clientId: 1, clientName: 'TEST CLIENT KG',
      invoiceIds: ['INV-1'], invoiceNumbers: ['SEP/TEST-00001'], againstInvoice: 'SEP/TEST-00001', againstInvoiceId: 'INV-1',
      againstInvoiceDate: todayIso(), periodFrom: todayIso(), periodTo: todayIso(), discountPct: 2, batchTaxable: 1000,
      reason: 'Standing 2% batch discount', unit: 'KG', rate: 13, qty: 1, gstType: 'intra', taxableValue: 20, cgstPer: 9, cgstAmt: 1.8,
      sgstPer: 9, sgstAmt: 1.8, igstPer: 0, igstAmt: 0, grandTotal: 23.6, createdAt: recentTs() },
  ];
  await loadAppWithState(page, s);
  await g(page, "showCreditNotePreview('CN-A')");
  const doc = page.locator('.inv-cn-doc');
  await expect(doc).toBeVisible();
  await expect(doc).not.toContainText('large enough');
  await expect(doc).not.toContainText('Against Invoice');
  await g(page, "closePrintPreview(); showCreditNotePreview('CN-B')");
  await expect(page.locator('.inv-cn-doc')).toContainText('Against Invoice');
  await expect(page.locator('.inv-cn-doc')).toContainText('SEP/TEST-00001');
});

/* ===== I6: changing the client takes the old client's things with it ===== */

function twoClientChallanState(): SepState {
  const s = book([], { invNextNum: 1 });
  s.incomingMaterial = [{ id: 'IM-A1', challanNo: 'A1', challanDate: todayIso(), clientId: 1, clientName: KG_CLIENT.name,
    vehicleNo: 'JH 05AA 0001', receivedDate: todayIso(), notes: '', createdAt: recentTs(),
    items: [{ id: 'IM-A1-0', partNumber: 'TEST PLATE A', desc: 'TEST PLATE A', hsn: '998873', unit: 'KG', qty: 50, rate: 13, amount: 650,
      nosQty: null, invoiced: false, invoiceId: null }] }] as never;
  return s;
}

test('I6: what the app filled for the old client goes when the client is changed', async ({ page }) => {
  await loadAppWithState(page, twoClientChallanState());
  await pickClient(page, 'test client');
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-A1"]').check();
  await expect(page.locator('.inv-line')).toHaveCount(1);
  await expect(page.locator('#invChallanNo')).toHaveValue('A1');
  await expect(page.locator('#invTransport')).toHaveValue('JH 05AA 0001');
  await page.locator('[data-action="invClearClient"]').click();
  // Nothing typed, so nothing is asked.
  await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
  await expect(page.locator('.inv-line')).toHaveCount(0);
  await expect(page.locator('#invChallanNo')).toHaveValue('');
  await expect(page.locator('#invTransport')).toHaveValue('');
  expect(await g(page, '(invoiceForm._linkedIMIds || []).length + (invoiceForm._linkedIMItemIds || []).length')).toBe(0);
});

test('I6: a field typed for the old client asks before it goes', async ({ page }) => {
  await loadAppWithState(page, twoClientChallanState());
  await pickClient(page, 'test client');
  await page.locator('#invOptional > summary').click();
  await page.locator('#invPONumber').fill('PO-TYPED-1');
  await page.locator('[data-action="invClearClient"]').click();
  const said = await answerAsk(page, 'cancel');
  expect(said).toContain('PO-TYPED-1');
  await expect(page.locator('[data-chosen-client]')).toContainText('TEST CLIENT KG');
  await expect(page.locator('#invPONumber')).toHaveValue('PO-TYPED-1');
  await page.locator('[data-action="invClearClient"]').click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#invClientSearch')).toBeVisible();
  await expect(page.locator('#invPONumber')).toHaveValue('');
});

/* ===== I8: a cancelled document says so on paper ===== */

test('I8: a cancelled invoice prints CANCELLED on every copy', async ({ page }) => {
  await loadAppWithState(page, book([inv(1, { status: 'cancelled', cancelledAt: recentTs() }), inv(2)]));
  await g(page, "showPrintPreview('INV-1')");
  await page.emulateMedia({ media: 'print' });
  const bands = page.locator('.inv-print-invoice .inv-pi-cancelled');
  await expect(bands).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(bands.nth(i)).toBeVisible();
  await expect(bands.first()).toContainText('CANCELLED');
  await page.emulateMedia({ media: 'screen' });
  // A live invoice prints clean.
  await g(page, "closePrintPreview(); showPrintPreview('INV-2')");
  await expect(page.locator('.inv-pi-cancelled')).toHaveCount(0);
});

test('I8: a cancelled credit note prints CANCELLED', async ({ page }) => {
  const s = book([inv(1, { taxableValue: 5000 })]);
  (s as any).creditNotes = [{ id: 'CN-X', cnNumber: '003', displayNumber: 'CN/003/TEST', date: todayIso(), status: 'cancelled', cancelledAt: recentTs(),
    clientId: 1, clientName: 'TEST CLIENT KG', invoiceIds: ['INV-1'], invoiceNumbers: ['SEP/TEST-00001'], againstInvoice: 'SEP/TEST-00001',
    againstInvoiceId: 'INV-1', periodFrom: todayIso(), periodTo: todayIso(), discountPct: 2, batchTaxable: 5000, reason: 'Standing 2% batch discount',
    unit: 'KG', rate: 13, qty: 7.69, gstType: 'intra', taxableValue: 100, cgstPer: 9, cgstAmt: 9, sgstPer: 9, sgstAmt: 9, igstPer: 0, igstAmt: 0,
    grandTotal: 118, createdAt: recentTs() }];
  await loadAppWithState(page, s);
  await g(page, "showCreditNotePreview('CN-X')");
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.inv-cn-doc .inv-cn-cancelled')).toBeVisible();
  await expect(page.locator('.inv-cn-doc .inv-cn-cancelled')).toContainText('CANCELLED');
  await page.emulateMedia({ media: 'screen' });
});

/* ===== I9: a quantity prints as it is held ===== */

test('I9: kilograms held to three places print to three places', async ({ page }) => {
  await loadAppWithState(page, book([inv(1, { items: [
    { partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 150.274, rate: 13, amount: 1953.56, nosQty: null },
    { partNumber: 'P2', desc: 'Other', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null },
  ] })]));
  await g(page, "showPrintPreview('INV-1')");
  const rows = page.locator('.inv-print-invoice').first().locator('.inv-pi-table tbody tr');
  await expect(rows.nth(0).locator('td').nth(4)).toHaveText('150.274');
  await expect(rows.nth(1).locator('td').nth(4)).toHaveText('10.00');
});

/* ===== I10: an edit leaves a blank date blank ===== */

test('I10: editing an invoice with no challan or despatch date keeps them blank', async ({ page }) => {
  await loadAllDates(page, book([inv(1)], { invNextNum: 2 }));
  await openDetail(page, 'INV-1');
  await page.locator('[data-inv-detail="INV-1"] [data-action="invEditInvoice"]').click();
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('#invChallanDate')).toHaveValue('');
  await expect(page.locator('#invDespatchDate')).toHaveValue('');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices[0].updatedAt).toBeGreaterThan(0);
  const st = await readStoredState(page);
  expect(st.invoices[0].challanDate).toBe('');
  expect(st.invoices[0].despatchDate).toBe('');
});

/* ===== I11: the export's voids answer to the register's filters ===== */

test('I11: a State filter leaves voids out, and a void is found by the challan its invoice billed', async ({ page }) => {
  const s = book([inv(1), inv(3)], { invNextNum: 4 });
  (s as any).voidedNumbers = [voidRec(2, { challanNo: '777' })];
  await loadAllDates(page, s);
  await switchTab(page, 'pageRegister');
  expect(await g(page, 'getVoidedForExport().length')).toBe(1);
  await setFilter(page, '#regStateFilter', 'created');
  expect(await g(page, 'getVoidedForExport().length')).toBe(0);
  await setFilter(page, '#regStateFilter', '');
  await page.locator('#regSearch').fill('777');
  await expect.poll(() => g(page, 'getVoidedForExport().length')).toBe(1);
  await page.locator('#regSearch').fill('778');
  await expect.poll(() => g(page, 'getVoidedForExport().length')).toBe(0);
});

/* ===== I12: a challan line's shares add up to its amount ===== */

function thirdsState(): SepState {
  const s = book([], { invNextNum: 3 });
  s.incomingMaterial = [{ id: 'IM-3', challanNo: '303', challanDate: todayIso(), clientId: 2, clientName: PIECE_CLIENT.name,
    vehicleNo: '', receivedDate: todayIso(), notes: '', createdAt: recentTs(),
    items: [{ id: 'IM-3-0', partNumber: 'TEST THIRD', desc: 'TEST THIRD', hsn: '998873', unit: 'NOS', qty: 3, rate: 33.33, amount: 100,
      nosQty: null, invoiced: false, invoiceId: null }] }] as never;
  const share = (n: number) => inv(n, { clientId: 2, clientName: PIECE_CLIENT.name, taxableValue: 33.33,
    items: [{ partNumber: 'TEST THIRD', desc: 'TEST THIRD', hsn: '998873', unit: 'NOS', qty: 1, rate: 33.33, amount: 33.33, nosQty: null, imItemId: 'IM-3-0' }] });
  s.invoices = [share(1), share(2)];
  return s;
}

test('I12: the share that completes a challan line takes what is left of its amount', async ({ page }) => {
  await loadAppWithState(page, thirdsState());
  await pickClient(page, 'piece test');
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-3"]').check();
  const amt = page.locator('input[data-field="amount"][data-idx="0"]');
  await expect(amt).toHaveValue('33.34');
  // Typed again, the last piece still takes the remainder.
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('1');
  await expect(amt).toHaveValue('33.34');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(3);
  const sum = (await readStoredState(page)).invoices.reduce((t: number, i: any) => t + i.items[0].amount, 0);
  expect(Math.round(sum * 100) / 100).toBe(100);
});

/* ===== I14: a raised note says so where it is seen ===== */

test('I14: raising a credit note says so above the preview, not under it', async ({ page }) => {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  await loadAllDates(page, book([inv(1, { date: d(10), taxableValue: 1000 }), inv(2, { date: d(1), taxableValue: 1000 })]));
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  await page.locator('[data-action="invRegCreditNote"]').click();
  await page.locator('[data-action="invCnSave"]').click();
  await expect(page.locator('#invPrintBody .inv-qc-notice')).toContainText('raised');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#invPrintBody .inv-qc-notice')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
});

/* ===== I15: a typed rate is the operator's ===== */

test('I15: a rate typed on a nos_to_weight line is not replaced by the card rate', async ({ page }) => {
  await loadAppWithState(page, book([], { invNextNum: 1, partWeights: { 'TEST N2W': 0.5 } }));
  await switchTab(page, 'pageCreate');
  await g(page, `invoiceForm.clientId = 3; invoiceForm.items = [{ partNumber: 'TEST N2W', desc: 'TEST N2W', hsn: '998873', unit: 'NOS',
    qty: 100, rate: 13, amount: 650, nosQty: null, _override: false, _label: '' }]; renderCreateForm();`);
  const rate = page.locator('input[data-field="rate"][data-idx="0"]');
  const amt = page.locator('input[data-field="amount"][data-idx="0"]');
  await rate.fill('15');
  await expect(amt).toHaveValue('750.00');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('200');
  await expect(amt).toHaveValue('1500.00');
  expect(await g(page, 'invoiceForm.items[0].rate')).toBe(15);
});

/* ===== I16: the client search reads a GSTIN in any case ===== */

test('I16: a GSTIN typed in lower case finds its client', async ({ page }) => {
  await loadAppWithState(page, book([]));
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('20abcde');
  await expect(page.locator('#invClientResults [data-action="invSelectClient"]')).toContainText('TEST CLIENT KG');
});

/* ===== I17: the CSVs name the company from its settings ===== */

test('I17: every CSV names the company and GSTIN as Settings holds them', async ({ page }) => {
  const s = book([inv(1)], { invNextNum: 2 });
  s.company = { ...(s.company as Record<string, string>), name: 'ACME TEST PLATING', gstin: '20TESTS0000T1Z0' };
  (s as any).creditNotes = [{ id: 'CN-1', cnNumber: '001', displayNumber: 'CN/001/TEST', date: todayIso(), status: 'active', clientId: 1,
    clientName: 'TEST CLIENT KG', invoiceIds: ['INV-1'], invoiceNumbers: ['SEP/TEST-00001'], periodFrom: todayIso(), periodTo: todayIso(),
    gstType: 'intra', taxableValue: 2.6, cgstPer: 9, cgstAmt: 0.23, sgstPer: 9, sgstAmt: 0.23, igstPer: 0, igstAmt: 0, grandTotal: 3.06, createdAt: recentTs() }];
  await loadAllDates(page, s);
  for (const run of ['exportSalesCSV()', 'exportGSTR1CSV()', 'exportCreditNotesCSV()']) {
    const csv = await captureCsv(page, run);
    expect(String(csv.rows[0][0]), run).toMatch(/^ACME TEST PLATING \| GSTIN: 20TESTS0000T1Z0 \| Export Date: /);
    expect(csv.rows[0].join(' '), run).not.toContain('SOMA');
  }
});

/* ===== IR: one serial order, across financial years ===== */

test('IR: the registers and certificates run last year\'s series before this year\'s', async ({ page }) => {
  const s = book([
    inv(1, { id: 'NEW-1', prefix: 'SEP/2026-27/' }),
    inv(950, { id: 'OLD-950', prefix: 'SEP/2025-26/' }),
    inv(2, { id: 'NEW-2', prefix: 'SEP/2026-27/' }),
  ], { invPrefix: 'SEP/2026-27/', invNextNum: 3 });
  await loadAllDates(page, s);
  const csv = await captureCsv(page, 'exportSalesCSV()');
  expect(csv.rows.slice(2).map(r => r[0])).toEqual(['SEP/2025-26/00950', 'SEP/2026-27/00001', 'SEP/2026-27/00002']);
  await g(page, "showQualityCertificates(['NEW-2', 'OLD-950', 'NEW-1'])");
  const refs = await page.locator('.inv-qc-meta-row span:first-child').allInnerTexts();
  expect(refs.map(r => r.replace('Sr. No.: ', ''))).toEqual(['QC/SEP/2025-26/00950/01', 'QC/SEP/2026-27/00001/01', 'QC/SEP/2026-27/00002/01']);
});

/* ===== IB1: Clear range clears ===== */

test('IB1: Clear range clears the range', async ({ page }) => {
  const d = (n: number) => { const x = new Date(); x.setMonth(x.getMonth() - n, 1); return x.toISOString().slice(0, 10); };
  await loadAppWithState(page, book([inv(1, { date: d(2) }), inv(2)]));
  await switchTab(page, 'pageRegister');
  // The range is behind Filter on the phone (the tab map, TM5c), its Clear range with it.
  await setFilter(page, '#regDateFrom', d(2));
  await setFilter(page, '#regDateTo', d(2));
  await expect(page.locator('#regList')).not.toContainText('SEP/TEST-00002');
  await expect(page.locator('#pageRegister .inv-token[data-clear="range"]')).toHaveCount(1);
  await (await filterControl(page, '[data-action="invRegClearRange"]')).click();
  await closeFilter(page);
  expect(await g(page, 'regFilter.dateFrom + regFilter.dateTo')).toBe('');
  await expect(await filterControl(page, '#regDateFrom')).toHaveValue('');
  await expect(await filterControl(page, '#regDateTo')).toHaveValue('');
  await expect(await filterControl(page, '[data-action="invRegClearRange"]')).toHaveCount(0);
  await closeFilter(page);
  await expect(page.locator('#pageRegister .inv-token[data-clear="range"]')).toHaveCount(0);
});

/* ===== IB2: an edit or a reissue goes back to the Register, on the invoice ===== */

test('IB2: Update invoice returns to the Register with the invoice open', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2)], { invNextNum: 3 }));
  await openDetail(page, 'INV-2');
  await page.locator('[data-inv-detail="INV-2"] [data-action="invEditInvoice"]').click();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
  await expect(page.locator('[data-inv-detail="INV-2"]')).toBeVisible();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
});

test('IB2: a reissue returns to the Register with the new invoice open', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2)], { invNextNum: 3 }));
  await openDelete(page, 'INV-2');
  await page.locator('#invDeleteReason').fill('rate was wrong');
  await page.locator('[data-action="invConfirmReissue"]').click();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
  const id = await g(page, "S.invoices.find(function(i) { return i.invoiceNumber === '00002'; }).id");
  await expect(page.locator(`[data-inv-detail="${id}"]`)).toBeVisible();
});

/* ===== IB3 + IB4: one door to a new invoice form, which asks before it throws work away ===== */

test('IB3: the Stats drill-down chooses its client even when a form exists, and the choice does not leak', async ({ page }) => {
  await loadAppWithState(page, book([inv(1)], { invNextNum: 2 }));
  await openPulse(page);
  await switchTab(page, 'pageCreate');
  await expect(page.locator('#invClientSearch')).toBeVisible();
  await switchTab(page, 'pageStats');
  await g(page, "openClientDrillOverlay('1')");
  await page.locator('[data-action="invStatsCreateInvoice"]').dispatchEvent('click');
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('[data-chosen-client]')).toContainText('TEST CLIENT KG');
  // A later New invoice is blank.
  await page.locator('[data-action="invResetForm"]').click();
  await openPulse(page);
  await page.locator('#pageHome [data-action="invCreateNew"]').first().click();
  await expect(page.locator('#invClientSearch')).toBeVisible();
  expect(await g(page, 'typeof _preselectedClientId')).toBe('undefined');
});

async function typedForm(page: Page) {
  await pickClient(page, 'test client');
  await page.locator('[data-action="invAddLineItem"]').click();
  await typePart(page, 0, 'TEST HALF TYPED');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('12');
}
const lineShown = (page: Page) => expect(page.locator('input[data-action="invEditLinePart"][data-idx="0"]')).toHaveValue('TEST HALF TYPED');

test('IB4: New invoice asks before it throws away an invoice being typed', async ({ page }) => {
  await loadAppWithState(page, book([inv(1)], { invNextNum: 2 }));
  await openPulse(page);
  await typedForm(page);
  await openPulse(page);
  await page.locator('#pageHome [data-action="invCreateNew"]').first().click();
  const said = await answerAsk(page, 'cancel');
  expect(said).toContain('Discard the invoice being typed?');
  await switchTab(page, 'pageCreate');
  await lineShown(page);
  await openPulse(page);
  await page.locator('#pageHome [data-action="invCreateNew"]').first().click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('.inv-line')).toHaveCount(0);
});

test('IB4: Edit asks too, and so does a reissue, before anything is deleted', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2)], { invNextNum: 3 }));
  await typedForm(page);
  await openDetail(page, 'INV-1');
  await page.locator('[data-inv-detail="INV-1"] [data-action="invEditInvoice"]').click();
  await answerAsk(page, 'cancel');
  expect(await g(page, 'invoiceForm.editingId')).toBeNull();

  await g(page, 'closeOverlay()');
  await openDelete(page, 'INV-2');
  await page.locator('#invDeleteReason').fill('rate was wrong');
  await page.locator('[data-action="invConfirmReissue"]').click();
  await answerAsk(page, 'cancel');
  // Kept: nothing was deleted, and the form being typed is as it was.
  expect((await readStoredState(page)).invoices).toHaveLength(2);
  expect(await g(page, 'invoiceForm.items[0].partNumber')).toBe('TEST HALF TYPED');
});

test('IB4: IM\'s Create invoice asks too', async ({ page }) => {
  const s = twoClientChallanState();
  await loadAppWithState(page, s);
  await typedForm(page);
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invCheckIMChallan"][data-id="IM-A1"]').first().click();
  await page.locator('[data-action="invCreateFromIM"]').first().click();
  await answerAsk(page, 'cancel');
  expect(await g(page, 'invoiceForm.items[0].partNumber')).toBe('TEST HALF TYPED');
  await page.locator('[data-action="invCreateFromIM"]').first().click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  expect(await g(page, 'invoiceForm.items[0].partNumber')).toBe('TEST PLATE A');
});

/* ===== IB5: cancelling a credit note asks ===== */

test('IB5: cancelling a credit note asks first, Cancel focused', async ({ page }) => {
  const s = book([inv(1, { taxableValue: 5000 })]);
  (s as any).creditNotes = [{ id: 'CN-1', cnNumber: '001', displayNumber: 'CN/001/TEST', date: todayIso(), status: 'active', clientId: 1,
    clientName: 'TEST CLIENT KG', invoiceIds: ['INV-1'], invoiceNumbers: ['SEP/TEST-00001'], againstInvoice: 'SEP/TEST-00001', againstInvoiceId: 'INV-1',
    periodFrom: todayIso(), periodTo: todayIso(), discountPct: 2, batchTaxable: 5000, gstType: 'intra', taxableValue: 100, cgstPer: 9, cgstAmt: 9,
    sgstPer: 9, sgstAmt: 9, igstPer: 0, igstAmt: 0, grandTotal: 118, createdAt: recentTs() }];
  await loadAppWithState(page, s);
  await g(page, 'renderCreditNoteList()');
  await page.locator('[data-action="invCnCancel"]').click();
  await expect(page.locator('[data-ui-ask] [data-ans="cancel"]')).toBeFocused();
  await answerAsk(page, 'cancel');
  expect((await readStoredState(page)).creditNotes[0].status).toBe('active');
  await page.locator('[data-action="invCnCancel"]').click();
  await answerAsk(page, 'ok');
  await expect.poll(async () => (await readStoredState(page)).creditNotes[0].status).toBe('cancelled');
});

/* ===== IB6: the select-all button follows the selection ===== */

test('IB6: after a bulk action clears the selection, the button says Select all and does it', async ({ page }) => {
  await loadAllDates(page, book([inv(1), inv(2)], { invNextNum: 3 }));
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  const all = page.locator('[data-action="invRegSelectAll"]');
  await all.click();
  await expect(all).toHaveText('Clear selection');
  await page.locator('[data-action="invRegBulkState"][data-state="printed"]').click();
  await expect(all).toHaveText('Select all (2)');
  await all.click();
  await expect(page.locator('#regSelBar .inv-selbar-count')).toHaveText('2 selected');
  // Unticking one row: the button offers to select all again.
  await page.locator('#regList [data-action="invRegToggleInv"]').first().click();
  await expect(all).toHaveText('Select all (2)');
});

/* ===== IB7: cancelling a filed invoice says what it does not undo ===== */

test('IB7: cancelling a filed invoice warns that its return needs an amendment', async ({ page }) => {
  await loadAllDates(page, book([inv(1, { invoiceState: 'filed', filedAt: recentTs() }), inv(2)], { invNextNum: 3 }));
  await openDetail(page, 'INV-1');
  await page.locator('[data-inv-detail="INV-1"] [data-action="invCancelInvoice"]').click();
  await expect(page.locator('[data-cancel-warn]')).toContainText('filed GSTR-1');
  await expect(page.locator('[data-cancel-warn]')).toContainText('amendment');
  await g(page, 'closeTopOverlay()');
  await openDetail(page, 'INV-2');
  await page.locator('[data-inv-detail="INV-2"] [data-action="invCancelInvoice"]').click();
  await expect(page.locator('[data-cancel-warn]')).toHaveCount(0);
});

/* ===== IB8: a part that zeroes a line asks why ===== */

test('IB8: a part typed that prices a nos_to_weight line at ₹0 draws the reason picker', async ({ page }) => {
  await loadAppWithState(page, book([], { invNextNum: 1, partWeights: { 'TEST N2W': 0.5 } }));
  await switchTab(page, 'pageCreate');
  await g(page, `invoiceForm.clientId = 3; invoiceForm.items = [{ partNumber: 'TEST N2W', desc: 'TEST N2W', hsn: '998873', unit: 'NOS',
    qty: 10, rate: 13, amount: 65, nosQty: null, _override: false, _label: '' }]; renderCreateForm();`);
  await expect(page.locator('#invZeroReason0 [data-zero-reason]')).toHaveCount(0);
  await typePart(page, 0, 'NO WEIGHT PART');
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('0.00');
  await expect(page.locator('#invZeroReason0 [data-zero-reason]')).toBeVisible();
  await page.locator('#invZeroReason0 [data-reason="sample"]').click();
  await expect(page.locator('#invSaveBtn')).toBeEnabled();
});

/* ===== IB9: a save that cannot happen says why ===== */

test('IB9: the form says so when its client or its invoice has gone', async ({ page }) => {
  await loadAllDates(page, book([inv(1)], { invNextNum: 2 }));
  await pickClient(page, 'test client');
  await page.locator('[data-action="invAddLineItem"]').click();
  await typePart(page, 0, 'TEST PART 9');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('5');
  await g(page, 'S.clients = S.clients.filter(function(c) { return c.id !== 1; }); updateTotalsDisplay();');
  await expect(page.locator('#invErrorsArea')).toContainText('no longer in the client master');
  await expect(page.locator('#invSaveBtn')).toBeDisabled();
  await g(page, 'saveInvoice()');
  await expect(page.locator('.inv-toast')).toContainText('no longer in the client master');

  await loadAllDates(page, book([inv(1)], { invNextNum: 2 }));
  await g(page, "editInvoice('INV-1')");
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await g(page, 'S.invoices = []; updateTotalsDisplay();');
  await expect(page.locator('#invErrorsArea')).toContainText('no longer in the register');
  await g(page, 'saveInvoice()');
  await expect(page.locator('.inv-toast')).toContainText('no longer in the register');
});
