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

  // Rule 53(1A)(g) wants the serial number AND the date of the corresponding
  // invoice. The number alone is not the particular.
  await expect(doc.locator('.inv-cn-meta-sub')).toContainText('dated');

  // The batch survives as the WORKING — and the caption has to keep CLAIMING the
  // linkage, not merely describe the arithmetic. s.15(3)(b) lets a post-supply
  // discount reduce taxable value only where it is specifically linked to the
  // relevant invoices, and naming all four is how this note satisfies that limb.
  // "Computed on (N invoices)" asserts a basis and drops the linkage; it was
  // shipped once and withdrawn (Iuno I-2).
  await expect(doc.locator('.inv-cn-annex-title')).toContainText('Invoices credited (4)');
  await expect(doc.locator('.inv-cn-annex-title')).toContainText('computed on this batch');
  await expect(doc.locator('.inv-cn-annex-list')).toContainText('SEP/TEST-00003');
  // Every annex entry carries its own date, for the same statutory reason.
  const annex = await doc.locator('.inv-cn-annex-list').innerText();
  expect((annex.match(/SEP\/TEST-\d{5} \(\d{2}\/\d{2}\/\d{4}\)/g) || [])).toHaveLength(4);

  const s = await stored(page);
  expect(s.creditNotes[0].invoiceNumbers).toHaveLength(4);
  // Stamped, so the number on the customer's copy cannot move later.
  expect(s.creditNotes[0].againstInvoice).toBe('SEP/TEST-00002');
  // The date is stamped too — a deleted invoice must not strip a statutory
  // particular off a document the customer already holds.
  expect(s.creditNotes[0].againstInvoiceDate).toBeTruthy();
  expect(s.creditNotes[0].invoiceDates).toHaveLength(4);
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

test('P19: a cancelled invoice is never named — it credits nothing', async ({ page }) => {
  // The creation path never offers one: cnValidateSelection hands over active
  // invoices only. The RETROACTIVE path maps raw invoiceIds, so a cancelled
  // invoice sits there with its full taxableValue intact and would otherwise be
  // the largest qualifying candidate. Naming it would attribute a credit to a
  // supply that was never billed and appears in GSTR-1 at zero — the same rule
  // the quality certificate already enforces (Iuno I-3).
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 1000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 9000, status: 'cancelled' }),
  ]);
  await loadForBatch(page, st);

  const r = await page.evaluate(() => {
    const w = window as unknown as {
      cnPickAgainstInvoice: (inv: unknown[], t: number, e?: string | null) => { displayNumber: string } | null;
    };
    const live = { id: 'INV-1', displayNumber: 'SEP/TEST-00001', taxableValue: 1000, status: 'active' };
    const dead = { id: 'INV-2', displayNumber: 'SEP/TEST-00002', taxableValue: 9000, status: 'cancelled' };
    return {
      // The cancelled one is larger and would win on value alone.
      pick: (w.cnPickAgainstInvoice([live, dead], 500, null) || { displayNumber: null }).displayNumber,
      // And when it is the ONLY candidate, the answer is none — not itself.
      pickOnlyDead: w.cnPickAgainstInvoice([dead], 500, null),
    };
  });
  expect(r.pick).toBe('SEP/TEST-00001');
  expect(r.pickOnlyDead).toBeNull();
});

test('P19: a batch that is present but too small says so, not that it vanished', async ({ page }) => {
  // Two different failures that an earlier version reported with one message.
  // Only one of them is actionable: a batch sitting in the register whose every
  // invoice is smaller than the credit is the operator's call (split it, or
  // raise against a later invoice), while a batch that is GONE is not. Telling
  // them the invoices vanished when the invoices are on screen hides the one
  // fix available (Iuno I-5).
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 1000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 1000 }),
  ]);
  (st as SepState & { creditNotes: unknown[] }).creditNotes = [
    { id: 'CN-small', displayNumber: 'CN/006/26-27', status: 'active',
      invoiceIds: ['INV-1', 'INV-2'],
      invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], taxableValue: 5000 },
    { id: 'CN-gone', displayNumber: 'CN/007/26-27', status: 'active',
      invoiceIds: ['INV-99'], invoiceNumbers: ['SEP/TEST-00099'], taxableValue: 100 },
  ];
  await loadForBatch(page, st);

  const r = await page.evaluate(() => {
    const w = window as unknown as { cnAgainstInvoiceLabel: (cn: unknown) => string };
    // N.B. `S` is declared with `let` in state.js — a lexical binding, never a
    // window property — so an evaluate() cannot read it. The app's own functions
    // close over it, so the notes are passed in instead.
    return {
      small: w.cnAgainstInvoiceLabel({ id: 'CN-small', invoiceIds: ['INV-1', 'INV-2'],
        invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], taxableValue: 5000 }),
      gone: w.cnAgainstInvoiceLabel({ id: 'CN-gone', invoiceIds: ['INV-99'],
        invoiceNumbers: ['SEP/TEST-00099'], taxableValue: 100 }),
    };
  });
  expect(r.small).toContain('none of the 2 large enough');
  expect(r.small).not.toContain('no longer in the register');
  expect(r.gone).toContain('no longer in the register');
  // And it does not say "1 invoices".
  expect(r.gone).not.toContain('1 invoices');
});

test('P19: the reference can be set by hand, and the headroom rule still binds', async ({ page }) => {
  // The rule picks the LARGEST qualifying invoice. BM's stated convention is
  // looser — "any invoice that has at least that much amount billed" — and the
  // notes already issued on paper did not all use largest: measured on the live
  // 7 Sep backup, CN/005's recorded reference IS the largest and the rule
  // reproduces it, while CN/004's 000443 qualifies but is not the largest. If
  // those notes are ever back-entered, the app has to be able to carry the
  // number on the customer's copy. A document in somebody's hands is the fact;
  // a rule is not (Iuno, Q6).
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 5000 }),
    invoice(2, { date: daysAgoIso(14), taxableValue: 9000 }),   // largest → the rule's pick
    invoice(3, { date: daysAgoIso(2), taxableValue: 100 }),     // too small to carry it
  ]);
  await loadForBatch(page, st);
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();
  expect((await stored(page)).creditNotes[0].againstInvoice).toBe('SEP/TEST-00002');

  const id = (await stored(page)).creditNotes[0].id;
  // A PICK-LIST, not a text box: the valid set is the batch, and the numbers are
  // 17 characters an operator would otherwise retype exactly on a shop phone.
  const pick = async (idx: number) => {
    await page.evaluate(([cnId, i]) => {
      (window as unknown as { cnPickAgainst: (c: string, n: number) => void })
        .cnPickAgainst(cnId as string, i as number);
    }, [id, idx] as [string, number]);
    return (await stored(page)).creditNotes[0];
  };

  // A qualifying invoice that is NOT the rule's pick is accepted (index 0 =
  // SEP/TEST-00001 at 5,000).
  const chosen = await pick(0);
  expect(chosen.againstInvoice).toBe('SEP/TEST-00001');
  expect(chosen.againstInvoiceDate).toBeTruthy();

  // One too small to carry the credit is refused — the headroom test binds
  // whoever chose the invoice.
  expect((await pick(2)).againstInvoice).toBe('SEP/TEST-00001');

  // Cleared, and the rule is free to choose again.
  expect((await pick(-1)).againstInvoice).toBeUndefined();

  // The overlay offers exactly the batch — an invoice outside it is not
  // representable, which is the point of a pick-list over free text.
  await page.evaluate((cnId) => {
    (window as unknown as { cnSetAgainstInvoice: (c: string) => void }).cnSetAgainstInvoice(cnId);
  }, id);
  const offered = await page.locator('.inv-overlay-scrim .inv-reg-invnum').allInnerTexts();
  expect(offered.sort()).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002', 'SEP/TEST-00003']);
  // And the one that cannot carry the credit is shown as unpickable, with why.
  await expect(page.locator('.inv-overlay-scrim .inv-reg-row-cancelled')).toContainText('SEP/TEST-00003');
});

test('P19: a cancelled note is neither stamped nor editable', async ({ page }) => {
  // A cancelled note credits nothing and exports at zero, so it has no credit to
  // attribute. The migration must skip it and the setter must refuse it — if the
  // two disagree, the machine writes a reference the operator cannot correct
  // (Cipher C-5). Measured on BM's own state: CN/006 is cancelled.
  const st = mehtaState([
    invoice(1, { date: daysAgoIso(20), taxableValue: 9000 }),
    invoice(2, { date: daysAgoIso(2), taxableValue: 9000 }),
  ]);
  (st as SepState & { creditNotes: unknown[] }).creditNotes = [
    { id: 'CN-x', displayNumber: 'CN/006/26-27', status: 'cancelled',
      invoiceIds: ['INV-1', 'INV-2'],
      invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], taxableValue: 100 },
  ];
  await loadForBatch(page, st);

  // The migration ran at boot and left it alone.
  expect((await stored(page)).creditNotes[0].againstInvoice).toBeUndefined();

  // And the setter refuses it rather than opening a picker over it.
  await page.evaluate(() => {
    (window as unknown as { cnSetAgainstInvoice: (c: string) => void }).cnSetAgainstInvoice('CN-x');
  });
  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
  expect((await stored(page)).creditNotes[0].againstInvoice).toBeUndefined();
});

test('P19: the reference is on the same tax head as the note', async ({ page }) => {
  // cnCompute reads gstType from the CLIENT; every invoice carries its own. A
  // client flipped to `inter` after a batch was billed `intra` would otherwise
  // produce an IGST note naming a CGST/SGST invoice — two documents disagreeing
  // about which head the tax sits under (Iuno, Q1). Live data is clean today;
  // this is the guard, not a reproduction.
  await loadForBatch(page, mehtaState([invoice(1, { date: daysAgoIso(20), taxableValue: 1000 })]));

  const r = await page.evaluate(() => {
    const w = window as unknown as {
      cnPickAgainstInvoice: (i: unknown[], t: number, e: string | null, g?: string) =>
        { displayNumber: string } | null;
    };
    const bigIntra = { id: 'A', displayNumber: 'SEP/TEST-00001', taxableValue: 9000, gstType: 'intra' };
    const smallInter = { id: 'B', displayNumber: 'SEP/TEST-00002', taxableValue: 5000, gstType: 'inter' };
    return {
      // Head beats size: the smaller inter invoice wins for an inter note.
      inter: (w.cnPickAgainstInvoice([bigIntra, smallInter], 100, null, 'inter') || { displayNumber: null }).displayNumber,
      intra: (w.cnPickAgainstInvoice([bigIntra, smallInter], 100, null, 'intra') || { displayNumber: null }).displayNumber,
      // A PREFERENCE, not a filter: with nothing on the right head, a reference
      // on the wrong one still beats no reference at all, and the mismatch is
      // then visible on the face rather than diffuse across the batch.
      noMatch: (w.cnPickAgainstInvoice([bigIntra], 100, null, 'inter') || { displayNumber: null }).displayNumber,
      // Unchanged when the caller states no head.
      unstated: (w.cnPickAgainstInvoice([bigIntra, smallInter], 100, null) || { displayNumber: null }).displayNumber,
    };
  });
  expect(r.inter).toBe('SEP/TEST-00002');
  expect(r.intra).toBe('SEP/TEST-00001');
  expect(r.noMatch).toBe('SEP/TEST-00001');
  expect(r.unstated).toBe('SEP/TEST-00001');
});

test('P19: the annex fits the sheet however many invoices a batch names', async ({ page }) => {
  /* Adding a date to every entry grew the live CN/007 annex from 264 to 459
     characters — 1.74x — on a printed GST document, and NOTHING in this file
     measured the credit note's sheet fit (Cipher C-12). That is the shape of
     this repo's most expensive print regression: invoice 00866 ran 752px of
     content into a 703px page, measured only after it came back from the
     floor, because the harness was structurally blind to it.

     The overflow MECHANISM is absent here — .inv-cn-annex-list carries
     overflow-wrap: break-word and no .inv-cn-* rule sets nowrap — so this is a
     guard, not a reproduction. It exists so the next thing added to the annex
     cannot silently run off the paper. */
  const many = Array.from({ length: 30 }, (_, i) =>
    invoice(i + 1, { date: daysAgoIso(30 - i), taxableValue: 9000 }));
  await loadForBatch(page, mehtaState(many));
  await openCnForm(page);
  await page.locator('[data-action="invCnSave"]').click();

  // A4 at 96dpi. The project's phone viewport is far narrower than a sheet, so
  // an overflow that only exists at print width is invisible to every other
  // check in this file.
  await page.setViewportSize({ width: 794, height: 1123 });

  const measure = () => page.evaluate(() => {
    const doc = document.querySelector('.inv-cn-doc') as HTMLElement;
    const cs = getComputedStyle(doc);
    const printable = doc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // scrollWidth, not the box width: `width: 100%` hides an overflow inside
    // the element's own box, so the box can never report it.
    const widest = Math.max(...[...doc.querySelectorAll('*')]
      .map((el) => (el as HTMLElement).scrollWidth));
    return { printable: Math.round(printable), widest: Math.round(widest) };
  });

  const asShipped = await measure();
  expect(asShipped.widest).toBeLessThanOrEqual(asShipped.printable);

  /* And again in a deliberately wide face — the assertion that makes this mean
     the same thing on a laptop, on CI (no webfonts, different fallback) and on
     the shop's Windows box. sw.js lets the webfont CSS fail rather than block
     the install, so the fallback is a real print path, not a test artifact. */
  await page.addStyleTag({ content: '.inv-cn-doc{--ff-base:"DejaVu Sans",sans-serif}' });
  const wideFace = await measure();
  expect(wideFace.widest).toBeLessThanOrEqual(wideFace.printable);

  // 30 dated entries are actually on the sheet — the guard must be measuring a
  // loaded annex, not an empty one.
  const annex = await page.locator('.inv-cn-annex-list').innerText();
  expect((annex.match(/\(\d{2}\/\d{2}\/\d{4}\)/g) || [])).toHaveLength(30);
});
