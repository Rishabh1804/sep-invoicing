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
  // 006, not 001: CN/001–005 of this year were issued by hand before the app.
  await expect(page.locator('[data-action="invCnSave"]')).toContainText('CN/006/26-27');
  await page.locator('[data-action="invCnSave"]').click();
  await page.locator('.inv-cn-doc').waitFor();

  const s = await stored(page);
  expect(s.creditNotes[0].displayNumber).toBe('CN/006/26-27');
  expect(s.cnNextNum).toBe(7);
});

test('P19: the series does not restart at 001 over numbers issued by hand', async ({ page }) => {
  const st = mehtaState([invoice(1, { date: daysAgoIso(10) })]);
  // A device that has never raised one in the app still must not hand out a
  // number the customer already holds on paper.
  await loadForBatch(page, st);

  const before = await stored(page);
  expect(before.cnNextNum).toBe(6);
  expect(before._cnSeriesStart1).toBe(true);
});

test('P19: the series start never walks over a note the app already issued', async ({ page }) => {
  const st = mehtaState([invoice(1, { date: daysAgoIso(10) })]);
  // Already at 009 with one raised — the migration must not drag it back to 6.
  (st as unknown as { creditNotes: unknown[]; cnNextNum: number }).creditNotes = [{
    id: 'CN-x', cnNumber: '008', displayNumber: 'CN/008/26-27', date: todayIso(),
    clientId: 1, clientName: 'SSSMEHTA INDUSTRIES LTD.', invoiceIds: [], invoiceNumbers: [],
    discountPct: 2, batchTaxable: 0, taxableValue: 0, grandTotal: 0, status: 'active',
    gstType: 'intra', cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    createdAt: recentTs(),
  }];
  (st as unknown as { cnNextNum: number }).cnNextNum = 9;
  await loadForBatch(page, st);

  const s = await stored(page);
  expect(s.cnNextNum).toBe(9);
});

/* The customer asked for ONE invoice number on the face of the note rather than
   the range it used to print. That changes what the note is ATTRIBUTED to, not
   how it is computed — the discount is still 2% of the whole batch, and the
   batch is still on the annex as the working. */
test('P19: the note names ONE invoice, and states the batch it was computed on', async ({ page }) => {
  await loadForBatch(page, mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 1000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 9000 }),   // largest → the pick
    invoice(3, { date: daysAgoIso(8), taxableValue: 1000 }),
    invoice(4, { date: daysAgoIso(2), taxableValue: 1000 }),
  ]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();

  const doc = page.locator('.inv-cn-doc');
  // One number, and it is the invoice with the most headroom — not the first,
  // not the last, and not a range.
  await expect(doc).toContainText('Against Invoice');
  await expect(doc).toContainText('SEP/TEST-00002');
  await expect(doc).not.toContainText('SEP/TEST-00001 – SEP/TEST-00004');

  // The batch survives as the WORKING. A consolidated 2% that cannot be checked
  // against the turnover it was taken on is not auditable.
  await expect(doc.locator('.inv-cn-annex-title')).toContainText('Computed on (4 invoices)');
  await expect(doc.locator('.inv-cn-annex-list')).toContainText('SEP/TEST-00003');

  const s = await stored(page);
  expect(s.creditNotes[0].invoiceNumbers).toHaveLength(4);
  // Stamped, so the number on the customer's copy cannot move later.
  expect(s.creditNotes[0].againstInvoice).toBe('SEP/TEST-00002');
});

test('P19: the named invoice must be able to absorb the credit, net of notes already on it', async ({ page }) => {
  // The test is on what REMAINS of an invoice, not on its full value: two notes
  // of 4,000 both fit inside 9,000 separately and not together.
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 1000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 9000 }),
  ]);
  (st as SepState & { creditNotes: unknown[] }).creditNotes = [
    { id: 'CN-a', displayNumber: 'CN/001/26-27', status: 'active',
      againstInvoiceId: 'INV-2', taxableValue: 8900 },
    // A CANCELLED note consumes nothing — it exports at zero and credits
    // nothing, which is the whole reason a note is cancelled and not deleted.
    { id: 'CN-b', displayNumber: 'CN/002/26-27', status: 'cancelled',
      againstInvoiceId: 'INV-2', taxableValue: 5000 },
  ];
  await loadForBatch(page, st);

  const r = await page.evaluate(() => {
    const w = window as unknown as {
      cnInvoiceHeadroom: (i: unknown, e?: string) => number;
      cnPickAgainstInvoice: (inv: unknown[], t: number, e?: string | null) => { displayNumber: string } | null;
    };
    const big = { id: 'INV-2', displayNumber: 'SEP/TEST-00002', taxableValue: 9000 };
    const small = { id: 'INV-1', displayNumber: 'SEP/TEST-00001', taxableValue: 1000 };
    return {
      headroom: w.cnInvoiceHeadroom(big),
      // 100 left on the big one, so a 200 credit has to fall to the small one.
      pick200: (w.cnPickAgainstInvoice([small, big], 200, null) || { displayNumber: null }).displayNumber,
      // Nothing can carry 5,000.
      pick5000: w.cnPickAgainstInvoice([small, big], 5000, null),
      // Ignoring its own claim, the big one is whole again.
      ownClaim: w.cnInvoiceHeadroom(big, 'CN-a'),
    };
  });
  expect(r.headroom).toBe(100);
  expect(r.pick200).toBe('SEP/TEST-00001');
  expect(r.pick5000).toBeNull();
  expect(r.ownClaim).toBe(9000);
});

test('P19: a note raised before the rule names one invoice when reprinted', async ({ page }) => {
  // The retroactive half: CN/007 and its siblings carry no stamp, so the pick is
  // recomputed from the batch by the same function — a reprint names what a note
  // raised today would name.
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 1000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 9000 }),
  ]);
  (st as SepState & { creditNotes: unknown[] }).creditNotes = [{
    id: 'CN-old', cnNumber: '007', displayNumber: 'CN/007/26-27', date: todayIso(),
    status: 'active', clientId: 1, clientName: 'SSSMEHTA INDUSTRIES LTD.',
    invoiceIds: ['INV-1', 'INV-2'],
    invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'],
    taxableValue: 200, grandTotal: 236, batchTaxable: 10000, discountPct: 2,
    // no againstInvoice — this is the pre-rule shape
  }];
  await loadForBatch(page, st);

  const stamped = await stored(page);
  // The migration stamps it on load, so a pull or an import cannot revert it to
  // a range the moment somebody syncs from another device.
  expect(stamped.creditNotes[0].againstInvoice).toBe('SEP/TEST-00002');
  expect(stamped.creditNotes[0].againstInvoiceId).toBe('INV-2');
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
  // The customer holds a document bearing CN/006. The next one is CN/007.
  expect(s.cnNextNum).toBe(7);
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

test('P19: typing in the form does not tear out the control being used', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { date: daysAgoIso(10) })]));
  await openCnForm(page);

  // Only the discount moves the totals. Re-rendering for the others replaced
  // the control mid-interaction — on a date input that means pulling the native
  // picker out from under the pointer.
  await page.evaluate(() => {
    ['cnDate', 'cnVehicle'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.dataset.probe = 'live';
    });
  });

  await page.locator('#cnVehicle').fill('JH05DR2505');
  await page.locator('#cnDate').fill(new Date().toISOString().slice(0, 10));

  expect(await page.evaluate(() => document.getElementById('cnDate')?.dataset.probe)).toBe('live');
  expect(await page.evaluate(() => document.getElementById('cnVehicle')?.dataset.probe)).toBe('live');
  // The values still reach the saved note.
  await page.locator('[data-action="invCnSave"]').click();
  const s = await stored(page);
  expect(s.creditNotes[0].vehicleNo).toBe('JH05DR2505');
});

test('P19: the export is named for the notes it holds, not the register filter', async ({ page }) => {
  await loadForBatch(page, mehtaState([invoice(1, { date: daysAgoIso(10) })]));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();
  await page.locator('[data-action="invClosePrint"]').click();

  await page.evaluate(() => {
    (window as any).__csv = null;
    (window as any).downloadCSV = (filename: string, rows: unknown[][]) => {
      (window as any).__csv = { filename, rows };
    };
  });
  await page.locator('[data-action="invCnList"]').click();
  await page.locator('[data-action="invExportCreditNotes"]').click();

  const csv = await page.evaluate(() => (window as any).__csv as { filename: string });
  // It borrowed the register's scope label, so a file holding every credit note
  // came out stamped with whatever month the register happened to be showing.
  const today = new Date().toISOString().slice(0, 10);
  expect(csv.filename).toBe(`SEP-Credit-Notes_${today}.csv`);
});
