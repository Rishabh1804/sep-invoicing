import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Credit notes.
 *
 * SSS Mehta hold a standing 2% discount on any payment batch spanning seven
 * days or more, bought to smooth cash flow. Each such batch ships as two
 * documents: the sales register for the range, and a credit note for 2% of it.
 * The batch is the unit, not the invoice.
 *
 * The reference (CN/005/26-27, 04/08/26) credits Rs 5,902.12 against roughly
 * Rs 2.95L of taxable, and its quantity of 1092.98 KG times Rs 5.40 comes to
 * 5902.09 — three paise short of the amount printed. That gap is the evidence
 * that the rupees are computed first and the kilograms derived from them.
 */

function invoice(num: number, over: Record<string, unknown> = {}) {
  const taxable = (over.taxableValue as number) ?? 1000;
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(),
    status: 'active',
    invoiceState: 'created',
    clientId: 1,
    clientName: 'SSSMEHTA INDUSTRIES LTD.',
    clientGSTIN: '20ABHCS4033N1ZD',
    clientAddress: { add1: 'A-4, Road No. 2', add2: 'ADITYAPUR', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 5.4, amount: taxable, nosQty: null }],
    taxableValue: taxable,
    cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
    ...over,
  };
}

/** n days before today, as YYYY-MM-DD. */
function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mehtaState(invoices: unknown[]): SepState {
  const s = emptyState();
  s.clients = [{
    id: 1, name: 'SSSMEHTA INDUSTRIES LTD.', billingMode: 'piece', gstType: 'intra',
    gstin: '20ABHCS4033N1ZD', address: '',
    // The ladder the derived quantity is priced off.
    rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }],
    itemRates: [],
  } as never];
  s.invoices = invoices;
  s.invPrefix = 'SEP/2026-27/';
  return s;
}

/**
 * Load with the register's month filter cleared.
 *
 * A batch has to span seven days to be the case under test, and the register
 * defaults to the current month — so a fixture built with `daysAgoIso(20)`
 * silently loses invoices to the previous month for the first three weeks of
 * every month, and the batch under test is not the batch that gets credited.
 * Clearing the month filter makes the span the only thing the dates control.
 */
async function loadForBatch(page: Page, state: SepState) {
  await page.addInitScript(() => {
    localStorage.setItem('sep_inv_view_prefs',
      JSON.stringify({ clientId: '', month: '', search: '', state: '' }));
  });
  await loadAppWithState(page, state);
}

/** Select every invoice in the register and open the credit note form. */
async function openCnForm(page: Page) {
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  await page.locator('[data-action="invRegCreditNote"]').click();
  await page.locator('#cnPct').waitFor();
}

async function stored(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state') || '{}'));
}

test('P19: reproduces the reference document arithmetic', async ({ page }) => {
  // A batch totalling the reference's base, spread over a fortnight.
  await loadForBatch(page, mehtaState([
    invoice(1, { taxableValue: 150000, date: daysAgoIso(20) }),
    invoice(2, { taxableValue: 145106, date: daysAgoIso(6) }),
  ]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();
  await page.locator('.inv-cn-doc').waitFor();

  const s = await stored(page);
  const cn = s.creditNotes[0];
  expect(cn.batchTaxable).toBe(295106);
  // 2% of the batch — the figure on the reference.
  expect(cn.taxableValue).toBe(5902.12);
  expect(cn.cgstAmt).toBe(531.19);
  expect(cn.sgstAmt).toBe(531.19);
  expect(cn.grandTotal).toBe(6964.5);
  // Quantity derived from value, so it lands on the reference's 1092.98 even
  // though 1092.98 x 5.40 does not come back to 5902.12.
  expect(cn.qty).toBe(1092.99);
  expect(cn.rate).toBe(5.4);
});

test('P19: the series is its own, formatted off the invoice prefix', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { date: daysAgoIso(10) })]));
  await openCnForm(page);
  // Named on the button before it is raised, so the number is never a surprise.
  await expect(page.locator('[data-action="invCnSave"]')).toContainText('CN/001/26-27');
  await page.locator('[data-action="invCnSave"]').click();
  await page.locator('.inv-cn-doc').waitFor();

  const s = await stored(page);
  expect(s.creditNotes[0].displayNumber).toBe('CN/001/26-27');
  expect(s.cnNextNum).toBe(2);
});

test('P19: the note names the batch it credits, not one invoice of it', async ({ page }) => {
  await loadForBatch(page, mehtaState([
    invoice(1, { date: daysAgoIso(20) }),
    invoice(2, { date: daysAgoIso(14) }),
    invoice(3, { date: daysAgoIso(8) }),
    invoice(4, { date: daysAgoIso(2) }),
  ]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();

  const doc = page.locator('.inv-cn-doc');
  await expect(doc).toContainText('SEP/TEST-00001 – SEP/TEST-00004 (4 invoices)');
  // And in full, because a document crediting four invoices while naming one
  // is not auditable.
  await expect(doc.locator('.inv-cn-annex-list')).toContainText('SEP/TEST-00002');
  await expect(doc.locator('.inv-cn-annex-list')).toContainText('SEP/TEST-00003');

  const s = await stored(page);
  expect(s.creditNotes[0].invoiceNumbers).toHaveLength(4);
});

test('P19: a batch under a week warns but is not blocked', async ({ page }) => {
  await loadForBatch(page, mehtaState([
    invoice(1, { date: daysAgoIso(2) }),
    invoice(2, { date: daysAgoIso(1) }),
  ]));
  await openCnForm(page);

  // The discount is for batches of seven days or more. Split batches are the
  // operator's call, so this states the fact and leaves the decision.
  await expect(page.locator('.inv-confirm-warn')).toContainText('spans 2 days');
  await expect(page.locator('[data-action="invCnSave"]')).toBeEnabled();
});

test('P19: a selection spanning two customers is refused, with the reason', async ({ page }) => {
  const s = mehtaState([invoice(1, { date: daysAgoIso(10) }), invoice(2, { clientId: 2, clientName: 'DORABJI AUTO' })]);
  (s.clients as unknown[]).push({
    id: 2, name: 'DORABJI AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
  } as never);
  await loadForBatch(page, s);

  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  await page.locator('[data-action="invRegCreditNote"]').click();

  await expect(page.locator('.inv-toast')).toContainText('addressed to one customer');
  await expect(page.locator('#cnPct')).toHaveCount(0);
});

test('P19: cancelled invoices are left out of the base and the omission is stated', async ({ page }) => {
  await loadForBatch(page, mehtaState([
    invoice(1, { taxableValue: 10000, date: daysAgoIso(10) }),
    invoice(2, { taxableValue: 99999, status: 'cancelled', cancelledAt: recentTs() }),
  ]));
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  await page.locator('[data-action="invRegCreditNote"]').click();
  await page.locator('#cnPct').waitFor();
  await page.locator('[data-action="invCnSave"]').click();

  const s = await stored(page);
  // 2% of 10000 only. Those goods were never billed.
  expect(s.creditNotes[0].batchTaxable).toBe(10000);
  expect(s.creditNotes[0].taxableValue).toBe(200);
});

test('P19: the discount rate is editable and restates the totals live', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { taxableValue: 100000, date: daysAgoIso(10) })]));
  await openCnForm(page);

  await expect(page.locator('.inv-total-grand')).toContainText('2,360.00');
  await page.locator('#cnPct').fill('3');
  await expect(page.locator('.inv-total-grand')).toContainText('3,540.00');

  await page.locator('[data-action="invCnSave"]').click();
  const s = await stored(page);
  expect(s.creditNotes[0].discountPct).toBe(3);
  expect(s.creditNotes[0].taxableValue).toBe(3000);
});

test('P19: a credit note is cancelled, never deleted — the number stays spent', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { date: daysAgoIso(10) })]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();
  await page.locator('[data-action="invClosePrint"]').click();

  await page.locator('[data-action="invCnList"]').click();
  await page.locator('[data-action="invCnCancel"]').click();

  const s = await stored(page);
  expect(s.creditNotes).toHaveLength(1);
  expect(s.creditNotes[0].status).toBe('cancelled');
  // The customer holds a document bearing CN/001. The next one is CN/002.
  expect(s.cnNextNum).toBe(2);
});

test('P19: the document reads company identity from state, not a frozen copy', async ({ page }) => {
  const s = mehtaState([invoice(1, { date: daysAgoIso(10) })]);
  s.company = {
    name: 'SOMA ELECTRO PRODUCTS', add1: '8-B, 1st Phase, Industrial Area, Adityapur',
    add2: 'Jamshedpur - 832 109', add3: '', phone: '', mobile: '', email: '',
    gstin: '20AAPFS4718J2Z0', state: 'JHARKHAND', stateCode: '20',
  };
  await loadForBatch(page, s);
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();

  const doc = page.locator('.inv-cn-doc');
  // The reference's header and footer disagreed with each other on both the
  // company name and its address. One source means they cannot.
  await expect(doc.locator('.inv-cn-seller-name')).toHaveText('SOMA ELECTRO PRODUCTS');
  await expect(doc.locator('.inv-cn-sig-co')).toHaveText('SOMA ELECTRO PRODUCTS');
  // PAN is carved out of the GSTIN rather than stored twice.
  await expect(doc).toContainText('AAPFS4718J');
});

test('P19: words state the total, and the tax words state all of the tax', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { taxableValue: 295106, date: daysAgoIso(10) })]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();

  const doc = page.locator('.inv-cn-doc');
  // The reference printed the sub-total here while the figure beside it was
  // the total: 6964.50, not 5902.12.
  await expect(doc.locator('.inv-cn-words-box')).toContainText('Six Thousand Nine Hundred Sixty Four');
  // And all the tax, not one of its two halves: 1062.38, not 531.19.
  await expect(doc.locator('.inv-cn-taxwords')).toContainText('One Thousand Sixty Two');
});
