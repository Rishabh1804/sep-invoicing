import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Stats and History rework.
 *
 * Stats used to report revenue with no tonnage behind it, which in a business
 * priced per kilogram cannot distinguish a good month from a loss-making one.
 * History used to omit the two event kinds an audit actually goes looking for:
 * the tombstone a deleted invoice leaves behind, and an accepted duplicate
 * challan.
 */

const COST_PER_KG = 8.55;

function invoice(opts: {
  id: string; clientId: number; clientName: string;
  qty: number; rate: number; date?: string;
}) {
  const amount = Math.round(opts.qty * opts.rate * 100) / 100;
  return {
    id: opts.id,
    invoiceNumber: opts.id,
    displayNumber: `SEP/TEST-${opts.id}`,
    date: opts.date || todayIso(),
    status: 'active',
    invoiceState: 'created',
    clientId: opts.clientId,
    clientName: opts.clientName,
    gstType: 'intra',
    items: [{
      partNumber: 'CLAMP 45X86', desc: 'BOX CLAMP', hsn: '998873',
      unit: 'KG', qty: opts.qty, rate: opts.rate, amount, nosQty: null,
    }],
    taxableValue: amount,
    cgstAmt: Math.round(amount * 9) / 100,
    sgstAmt: Math.round(amount * 9) / 100,
    igstAmt: 0,
    grandTotal: Math.round(amount * 1.18 * 100) / 100,
    createdAt: recentTs(),
  };
}

/** Two clients, deliberately on opposite sides of full cost. */
function pricedState(): SepState {
  const state = emptyState();
  state.defaultCostPerKg = COST_PER_KG;
  state.clients = [
    { id: 1, name: 'GOOD RATE CLIENT', billingMode: 'kg', gstType: 'intra', isActive: true },
    { id: 2, name: 'BELOW COST CLIENT', billingMode: 'kg', gstType: 'intra', isActive: true },
  ] as SepState['clients'];
  state.invoices = [
    invoice({ id: '00001', clientId: 1, clientName: 'GOOD RATE CLIENT', qty: 1000, rate: 13 }),
    invoice({ id: '00002', clientId: 2, clientName: 'BELOW COST CLIENT', qty: 2000, rate: 5.4 }),
  ];
  return state;
}

test.describe('Stats — tonnage and realisation', () => {
  test('reports tonnage and rupees per kilogram, not revenue alone', async ({ page }) => {
    await loadAppWithState(page, pricedState());
    await switchTab(page, 'pageStats');

    const band = page.locator('.inv-kpi-grid').first();
    await expect(band).toBeVisible();

    // 1000 kg + 2000 kg.
    await expect(band).toContainText('3.00 t');
    // (13,000 + 10,800) / 3000 = 7.93/kg.
    await expect(band).toContainText('7.93');
    await expect(band).toContainText('23,800.00');
  });

  test('flags realisation below full cost with the size of the shortfall', async ({ page }) => {
    await loadAppWithState(page, pricedState());
    await switchTab(page, 'pageStats');

    // 7.93 realised against 8.55 cost is a loss, and the alert says by how much.
    const alert = page.locator('.inv-stats-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('below full cost');
  });

  test('ranks clients by realisation, worst first, and marks the ones under cost', async ({ page }) => {
    await loadAppWithState(page, pricedState());
    await switchTab(page, 'pageStats');

    const table = page.locator('.inv-stats-card', { hasText: 'Realisation by Client' });
    await expect(table).toBeVisible();

    const rows = table.locator('.inv-stats-table-row');
    await expect(rows).toHaveCount(2);
    // Worst priced first — the ordering is the point of the table.
    await expect(rows.nth(0)).toContainText('BELOW COST CLIENT');
    await expect(rows.nth(0)).toContainText('5.40');
    await expect(rows.nth(1)).toContainText('GOOD RATE CLIENT');
    await expect(rows.nth(1)).toContainText('13.00');

    // The under-cost figure is called out, not just listed.
    await expect(rows.nth(0).locator('.inv-stats-val-danger')).toHaveCount(1);
    await expect(rows.nth(1).locator('.inv-stats-val-danger')).toHaveCount(0);
  });

  test('says so when tonnage could not be established for every line', async ({ page }) => {
    const state = pricedState();
    // A NOS line with no weight anywhere: tonnage cannot include it.
    (state.invoices as Array<Record<string, unknown>>).push({
      ...invoice({ id: '00003', clientId: 1, clientName: 'GOOD RATE CLIENT', qty: 50, rate: 4 }),
      items: [{ partNumber: 'UNKNOWN PIN', desc: 'UNKNOWN PIN', hsn: '998873', unit: 'NOS', qty: 50, rate: 4, amount: 200, nosQty: 50 }],
    });
    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    const caveat = page.locator('.inv-stats-caveat').first();
    // Stated in revenue terms: one unweighed line worth ₹10L matters more than
    // fifty worth ₹500, and it is the revenue ratio that governs how far the
    // realisation figure can be trusted.
    await expect(caveat).toContainText('cover 99% of revenue');
    await expect(caveat).toContainText('no weight on file');
    await expect(caveat).toContainText('reads better than the real blend');
  });

  /* Regression, found by rendering the live backup.
   *
   * Realisation divided TOTAL revenue by weighed-only tonnage — numerator over
   * every line, denominator over a subset — which inflates the answer by
   * exactly 1 / (revenue coverage). On real data that read ₹21.23/kg where the
   * matched figure was ₹13.00. The lines without weights are not a random
   * sample: they are the piece-billed work, i.e. the low-realisation end. */
  test('realisation divides revenue and tonnage over the same lines', async ({ page }) => {
    const state = pricedState();
    // Same two weighed clients, plus a large unweighed NOS line. Tonnage cannot
    // include it, so its revenue must not be in the numerator either.
    (state.invoices as Array<Record<string, unknown>>).push({
      ...invoice({ id: '00003', clientId: 1, clientName: 'GOOD RATE CLIENT', qty: 1, rate: 1 }),
      items: [{ partNumber: 'NO WEIGHT PIN', desc: 'NO WEIGHT PIN', hsn: '998873', unit: 'NOS', qty: 1000, rate: 20, amount: 20000, nosQty: 1000 }],
      taxableValue: 20000,
    });
    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    const band = page.locator('.inv-kpi-grid').first();
    // Tonnage is unchanged at 3.00 t, so realisation must stay 7.93 — not leap
    // to (23,800 + 20,000) / 3000 = 14.60.
    await expect(band).toContainText('3.00 t');
    await expect(band).toContainText('7.93');
    await expect(band).not.toContainText('14.60');
  });

  test('a client whose weights are mostly missing is listed, not ranked', async ({ page }) => {
    const state = pricedState();
    // Below-cost client billed almost entirely on parts with no weight.
    (state.invoices as Array<Record<string, unknown>>)[1] = {
      ...invoice({ id: '00002', clientId: 2, clientName: 'BELOW COST CLIENT', qty: 1, rate: 1 }),
      items: [{ partNumber: 'NO WEIGHT PIN', desc: 'NO WEIGHT PIN', hsn: '998873', unit: 'NOS', qty: 5000, rate: 2, amount: 10000, nosQty: 5000 }],
      taxableValue: 10000,
    };
    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    const table = page.locator('.inv-stats-card', { hasText: 'Realisation by Client' });
    const partialRow = table.locator('.inv-stats-row-partial');
    await expect(partialRow).toHaveCount(1);
    await expect(partialRow).toContainText('BELOW COST CLIENT');
    // Shown as unestablished, never as a per-kg number drawn from a sliver.
    await expect(partialRow).toContainText('n/a');
    await expect(table).toContainText('cannot be priced per kg');
  });

  test('tonnage share is withheld when the largest client has no weights', async ({ page }) => {
    const state = pricedState();
    // Make the unweighed client the largest by revenue.
    (state.invoices as Array<Record<string, unknown>>)[1] = {
      ...invoice({ id: '00002', clientId: 2, clientName: 'BELOW COST CLIENT', qty: 1, rate: 1 }),
      items: [{ partNumber: 'NO WEIGHT PIN', desc: 'NO WEIGHT PIN', hsn: '998873', unit: 'NOS', qty: 5000, rate: 20, amount: 100000, nosQty: 5000 }],
      taxableValue: 100000,
    };
    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    const card = page.locator('.inv-stats-card', { hasText: 'Concentration' });
    await expect(card).toContainText('BELOW COST CLIENT');
    // Its measured tonnage is ~0, so a share would read as "small" when the
    // truth is "unknown". That inversion is the trap.
    await expect(card).toContainText('not measurable');
    await expect(card).toContainText('unknown, not small');
  });

  test('reports output tax and what is still unfiled', async ({ page }) => {
    await loadAppWithState(page, pricedState());
    await switchTab(page, 'pageStats');

    const card = page.locator('.inv-stats-card', { hasText: 'Output Tax' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Not yet marked filed');
    // Neither seeded invoice is filed.
    await expect(card).toContainText('(2)');
  });

  test('periods are measured on the invoice date, not on entry time', async ({ page }) => {
    const state = pricedState();
    // Dated last month but entered today: it belongs to last month.
    (state.invoices as Array<Record<string, unknown>>)[1] = {
      ...invoice({ id: '00002', clientId: 2, clientName: 'BELOW COST CLIENT', qty: 2000, rate: 5.4 }),
      date: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1, 15);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
      })(),
      createdAt: recentTs(),
    };
    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    // MTD sees only the invoice dated this month: 1000 kg.
    await expect(page.locator('.inv-kpi-grid').first()).toContainText('1.00 t');
  });
});

test.describe('History — audit events', () => {
  function auditState(): SepState {
    const state = pricedState();
    state.voidedNumbers = [{
      invoiceNumber: '00666',
      displayNumber: 'SEP/TEST-00666',
      date: todayIso(),
      clientId: 1,
      clientName: 'GOOD RATE CLIENT',
      taxableValue: 5000,
      grandTotal: 5900,
      lastState: 'dispatched',
      wasCancelled: false,
      reason: 'Duplicate of 00657',
      reserved: true,
      source: 'deleted',
      voidedAt: recentTs(3600000),
    }];
    state.incomingMaterial = [{
      id: 'IM-DUPE-ACK',
      challanNo: '702',
      challanDate: todayIso(),
      clientId: 1,
      clientName: 'GOOD RATE CLIENT',
      vehicleNo: '',
      items: [{ id: 'IM-DUPE-ACK-0', partNumber: 'CLAMP 45X86', desc: 'BOX CLAMP', hsn: '998873', unit: 'KG', qty: 100, rate: 13, amount: 1300, nosQty: null, invoiced: false, invoiceId: null }],
      receivedDate: todayIso(),
      notes: '',
      createdAt: recentTs(7200000),
      dupeAck: { at: recentTs(7100000), matchedIds: ['IM-OTHER'] },
    }];
    return state;
  }

  test('a deleted invoice survives as a tombstone carrying its reason', async ({ page }) => {
    await loadAppWithState(page, auditState());
    await switchTab(page, 'pageHistory');

    const log = page.locator('#historyList');
    await expect(log).toContainText('SEP/TEST-00666 deleted');
    await expect(log).toContainText('Duplicate of 00657');
    // Reserved: the number is spent and may not be reissued.
    await expect(log).toContainText('number stays spent');
  });

  test('an accepted duplicate warning is on the record', async ({ page }) => {
    await loadAppWithState(page, auditState());
    await switchTab(page, 'pageHistory');

    await expect(page.locator('#historyList')).toContainText('Duplicate warning accepted for challan 702');
  });

  test('the Audit filter isolates voids, cancellations and duplicate acks', async ({ page }) => {
    await loadAppWithState(page, auditState());
    await switchTab(page, 'pageHistory');

    await page.locator('[data-action="invHistoryType"][data-type="audit"]').click();
    const log = page.locator('#historyList');
    await expect(log).toContainText('deleted');
    await expect(log).toContainText('Duplicate warning accepted');
    // Ordinary invoice creation is not an audit event.
    await expect(log).not.toContainText('created for');
  });

  test('search narrows the log', async ({ page }) => {
    await loadAppWithState(page, auditState());
    await switchTab(page, 'pageHistory');

    await page.locator('#historySearch').fill('00666');
    await expect(page.locator('.inv-history-item')).toHaveCount(1);
    await expect(page.locator('#historyList')).toContainText('00666');
  });

  test('a void is not tappable — the invoice it names is gone', async ({ page }) => {
    await loadAppWithState(page, auditState());
    await switchTab(page, 'pageHistory');
    await page.locator('[data-action="invHistoryType"][data-type="audit"]').click();

    const voidRow = page.locator('.inv-history-item', { hasText: '00666 deleted' });
    await expect(voidRow).toHaveClass(/inv-history-item-static/);
    await expect(voidRow).not.toHaveAttribute('data-action', /.*/);
  });
});
