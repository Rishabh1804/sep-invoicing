import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Credit notes netted off realisation.
 *
 * Stats read invoices and nothing else, so a client on a standing discount
 * reported the rate on the invoice rather than the rate they actually pay. For
 * SSS Mehta that 2% is the whole distance between the Rs 5.40/kg the register
 * shows and the Rs 5.29 the account is worth — and that account is the one the
 * dashboard exists to examine.
 *
 * Two rules are under test here, because getting either wrong makes the netting
 * worse than not doing it:
 *
 *   - The credit belongs to the invoices it credits, NOT to the date the note
 *     was raised. The reference note is dated 4 August against a July batch.
 *     Booking it in August would net one period's revenue against another
 *     period's tonnage.
 *   - It never touches tonnage. The plating happened; only the price changed.
 *     Reduce both and the rate does not move at all, which is the entire point.
 */

const COST_PER_KG = 8.55;

/** A KG-billed invoice: quantity is already kilograms, so tonnage is exact. */
function invoice(opts: { id: string; kg: number; rate: number; date?: string }) {
  const amount = Math.round(opts.kg * opts.rate * 100) / 100;
  return {
    // The credit notes below name invoices by this id, so it has to be the
    // shape the app itself issues.
    id: `INV-${opts.id}`,
    invoiceNumber: opts.id,
    displayNumber: `SEP/TEST-${opts.id}`,
    date: opts.date || todayIso(),
    status: 'active',
    invoiceState: 'created',
    clientId: 1,
    clientName: 'SSSMEHTA INDUSTRIES LTD.',
    gstType: 'intra',
    items: [{
      partNumber: 'CLAMP 45X86', desc: 'BOX CLAMP', hsn: '998873',
      unit: 'KG', qty: opts.kg, rate: opts.rate, amount, nosQty: null,
    }],
    taxableValue: amount,
    cgstAmt: Math.round(amount * 9) / 100,
    sgstAmt: Math.round(amount * 9) / 100,
    igstAmt: 0,
    grandTotal: Math.round(amount * 1.18 * 100) / 100,
    createdAt: recentTs(),
  };
}

/** A saved credit note over a batch. Only the fields the netting reads. */
function creditNote(opts: {
  num: string; taxable: number; invoiceIds: string[];
  status?: string; date?: string;
}) {
  const taxable = opts.taxable;
  return {
    id: `CN-${opts.num}`,
    cnNumber: opts.num,
    displayNumber: `CN/${opts.num}/26-27`,
    date: opts.date || todayIso(),
    clientId: 1,
    clientName: 'SSSMEHTA INDUSTRIES LTD.',
    invoiceIds: opts.invoiceIds,
    invoiceNumbers: opts.invoiceIds,
    discountPct: 2,
    unit: 'KG', rate: 10, qty: taxable / 10,
    gstType: 'intra',
    taxableValue: taxable,
    cgstPer: 9, cgstAmt: Math.round(taxable * 9) / 100,
    sgstPer: 9, sgstAmt: Math.round(taxable * 9) / 100,
    igstPer: 0, igstAmt: 0,
    grandTotal: Math.round(taxable * 1.18 * 100) / 100,
    status: opts.status || 'active',
    createdAt: recentTs(),
  };
}

/** The first day of the previous month, as YYYY-MM-DD. */
function lastMonthIso(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function mehtaState(invoices: unknown[], notes: unknown[]): SepState {
  const s = emptyState();
  s.defaultCostPerKg = COST_PER_KG;
  s.clients = [{
    id: 1, name: 'SSSMEHTA INDUSTRIES LTD.', billingMode: 'kg', gstType: 'intra',
    gstin: '20ABHCS4033N1ZD', address: '', isActive: true,
  } as never];
  s.invoices = invoices;
  s.incomingMaterial = noSeedIM();
  (s as unknown as { creditNotes: unknown[] }).creditNotes = notes;
  s.invPrefix = 'SEP/2026-27/';
  return s;
}

/** The headline band. Every figure under test is in this one grid. */
function band(page: Page) {
  return page.locator('.inv-kpi-grid').first();
}

/* Two invoices, 1,000 kg each at Rs 10/kg. Rs 20,000 of taxable over 2,000 kg
   is exactly Rs 10.00/kg before any discount — a round number so a wrong
   answer is legible rather than plausible. 2% of it is Rs 400. */
const PAIR = [
  invoice({ id: '00001', kg: 1000, rate: 10 }),
  invoice({ id: '00002', kg: 1000, rate: 10 }),
];

test('P24: the discount comes off the rate, and the tonnage stays where it was', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'] }),
  ]));
  await switchTab(page, 'pageStats');

  // 20,000 - 400.
  await expect(band(page)).toContainText('19,600');
  // The kilograms were plated whatever the price ended up being.
  await expect(band(page)).toContainText('2.00 t');
  // 19,600 / 2,000. Netting value against unchanged weight is the whole
  // mechanism: take 2% off both and this still reads 10.00.
  await expect(band(page)).toContainText('9.80');
});

test('P24: without the note the same book reads 10.00/kg', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, []));
  await switchTab(page, 'pageStats');

  await expect(band(page)).toContainText('20,000');
  await expect(band(page)).toContainText('2.00 t');
  await expect(band(page)).toContainText('10.00');
});

test('P24: a cancelled note credits nothing, because it exports at zero', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'], status: 'cancelled' }),
  ]));
  await switchTab(page, 'pageStats');

  await expect(band(page)).toContainText('20,000');
  await expect(band(page)).toContainText('10.00');
});

test('P24: the netting is stated in place, not left as an unexplained shortfall', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'] }),
  ]));
  await switchTab(page, 'pageStats');

  // A rate 2% off the rate card, with nothing saying why, reads as a bug in
  // the rate card. Visible, not merely present — this is a reporting path.
  const note = page.locator('.inv-stats-caveat').first();
  await expect(note).toBeVisible();
  await expect(note).toContainText('400');
  await expect(note).toContainText('credit notes');
  await expect(note).toContainText('Tonnage is untouched');
});

test('P24: a batch straddling the period boundary splits where its invoices fall', async ({ page }) => {
  /* The note is dated TODAY and covers one invoice from last month and one
     from this. If the credit were booked on the note's own date, the whole
     Rs 400 would land in the current month. It is booked against the invoices,
     so month-to-date sees only the half that belongs to it. */
  const straddling = [
    invoice({ id: '00001', kg: 1000, rate: 10, date: lastMonthIso() }),
    invoice({ id: '00002', kg: 1000, rate: 10 }),
  ];
  await loadAppWithState(page, mehtaState(straddling, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'] }),
  ]));
  await switchTab(page, 'pageStats');

  // MTD: 10,000 - 200 over 1,000 kg.
  await expect(band(page)).toContainText('9,800');
  await expect(band(page)).toContainText('1.00 t');
  await expect(band(page)).toContainText('9.80');

  // All time: both halves, and the same rate — the split does not lose paise.
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
  await expect(band(page)).toContainText('19,600');
  await expect(band(page)).toContainText('2.00 t');
  await expect(band(page)).toContainText('9.80');
});

test('P24: credit that reached no invoice is reported, never absorbed', async ({ page }) => {
  /* The invoice this note names has been deleted. The customer still paid
     Rs 400 less, so silently dropping the credit overstates earnings by
     exactly that — and it is the deletion that wants looking at. */
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-GONE'] }),
  ]));
  await switchTab(page, 'pageStats');

  const alert = page.locator('.inv-stats-alert').first();
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('400');
  await expect(alert).toContainText('no longer exist');
  // And nothing was netted off a book it does not belong to.
  await expect(band(page)).toContainText('20,000');
});

test('P24: the per-client table ranks on the netted rate and says so', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'] }),
  ]));
  await switchTab(page, 'pageStats');

  const row = page.locator('.inv-stats-table-row').filter({ hasText: 'SSSMEHTA' }).first();
  await expect(row).toContainText('9.80');
  await expect(row).toContainText('19,600');
  await expect(row).toContainText('net of');
});

test('P24: output tax carries the 9B reduction', async ({ page }) => {
  await loadAppWithState(page, mehtaState(PAIR, [
    creditNote({ num: '006', taxable: 400, invoiceIds: ['INV-00001', 'INV-00002'] }),
  ]));
  await switchTab(page, 'pageStats');

  // 18% of 20,000 is 3,600; 18% of the 400 credited is 72.
  const card = page.locator('.inv-stats-card').filter({ hasText: 'Output Tax' }).first();
  await expect(card).toContainText('3,528');
  await expect(card).toContainText('72');
});

test('P24: raising a note from the register moves the dashboard', async ({ page }) => {
  /* End to end, because the arithmetic above all starts from a note that was
     placed into state by hand. This one is raised the way the owner raises
     one — tick the batch in the register, credit it — and the realisation on
     the Stats tab has to move on its own. */
  await page.addInitScript(() => {
    localStorage.setItem('sep_inv_view_prefs',
      JSON.stringify({ clientId: '', month: '', search: '', state: '' }));
  });
  await loadAppWithState(page, mehtaState(PAIR, []));

  await switchTab(page, 'pageStats');
  await expect(band(page)).toContainText('10.00');

  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  await page.locator('[data-action="invRegCreditNote"]').click();
  await page.locator('#cnPct').waitFor();
  await page.locator('[data-action="invCnSave"]').click();
  // Saving drops straight into the printable note; step past it.
  await page.locator('[data-action="invClosePrint"]').click();

  await switchTab(page, 'pageStats');
  await expect(band(page)).toContainText('19,600');
  await expect(band(page)).toContainText('2.00 t');
  await expect(band(page)).toContainText('9.80');
});
