import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, recentTs, noSeedIM, SepState } from './fixtures';

/*
 * Client performance.
 *
 * Month on month for one account, and what has quietly stopped arriving. A
 * part that disappears raises no error, empties no queue and never shows up as
 * a loss — it shows up as a slightly smaller month, twice, and then it is
 * normal. Naming it is the whole reason this view exists.
 *
 * Cadence is measured against each part's OWN rhythm rather than a fixed
 * cut-off, because a fixed one calls every quarterly part dead in month two.
 */

/** n days before today, as YYYY-MM-DD. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let seq = 0;
function invoice(part: string, dayAgo: number, opts: { qty?: number; rate?: number; clientId?: number } = {}) {
  seq += 1;
  const qty = opts.qty ?? 500;
  const rate = opts.rate ?? 5.4;
  return {
    id: `INV-${seq}`,
    invoiceNumber: String(seq).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(seq).padStart(5, '0')}`,
    date: daysAgo(dayAgo),
    status: 'active',
    invoiceState: 'filed',
    clientId: opts.clientId ?? 1,
    clientName: opts.clientId === 2 ? 'DORABJI AUTO' : 'SSSMEHTA',
    clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: part, desc: part, hsn: '998873', unit: 'KG', qty, rate, amount: qty * rate, nosQty: null }],
    taxableValue: qty * rate, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: qty * rate, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
  };
}

function perfState(invoices: unknown[], im: unknown[] = []): SepState {
  seq = 0;
  const s = emptyState();
  s.clients = [
    { id: 1, name: 'SSSMEHTA', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'DORABJI AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ] as never;
  s.invoices = invoices;
  // seed.js fills an empty incomingMaterial with 50 demo challans, so a spec
  // about cadence has to hand it something or measure the seed instead.
  s.incomingMaterial = im.length > 0 ? im : noSeedIM();
  s.defaultCostPerKg = 8.55;
  return s;
}

async function openPerf(page: Page) {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').first().click();
  await page.locator('#cpClientSelect').waitFor();
}

/** Every part in one cadence group. */
function group(page: Page, title: string) {
  return page.locator('.inv-cp-group').filter({ has: page.locator('.inv-cp-group-title', { hasText: title }) });
}

test('P22: a part that fell out of its rhythm is named, with how overdue it is', async ({ page }) => {
  const invoices = [
    // Every ~21 days, then nothing for 95.
    ...[300, 279, 258, 237, 216, 195, 174, 153, 132, 111, 95].map((d) => invoice('BRACKET 22', d)),
    // Still arriving fortnightly.
    ...[70, 56, 42, 28, 14, 3].map((d) => invoice('CLAMP 165X83', d)),
  ];
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  const stopped = group(page, 'Stopped');
  await expect(stopped).toContainText('BRACKET 22');
  await expect(stopped).toContainText('95 days since the last one');
  await expect(stopped).not.toContainText('CLAMP 165X83');

  await expect(group(page, 'Steady')).toContainText('CLAMP 165X83');
});

test('P22: a quarterly part is not called stopped just for being absent two months', async ({ page }) => {
  // Ships roughly every 90 days; last one 60 days ago, which is well inside
  // its own rhythm. A fixed "absent for two months" rule would bury this.
  const invoices = [360, 270, 180, 90, 60].map((d) => invoice('QUARTERLY PART', d));
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  await expect(group(page, 'Steady')).toContainText('QUARTERLY PART');
  await expect(group(page, 'Stopped')).toContainText('Nothing has fallen out of its rhythm');
});

test('P22: a part that ships twice a week is not stopped after nine days', async ({ page }) => {
  // Typical gap ~3 days, absent 9. Without a floor, 1.75x a tiny gap flags
  // every fast-moving part the moment it pauses.
  const invoices = [30, 27, 24, 21, 18, 15, 12, 9].map((d) => invoice('FAST PART', d));
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  await expect(group(page, 'Steady')).toContainText('FAST PART');
});

test('P22: a recently started part is new, not steady', async ({ page }) => {
  const invoices = [
    ...[20, 8].map((d) => invoice('HINGE PIN NEW', d)),
    ...[200, 170, 140, 110, 80, 50, 20].map((d) => invoice('OLD FAITHFUL', d)),
  ];
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  await expect(group(page, 'New')).toContainText('HINGE PIN NEW');
  await expect(group(page, 'Steady')).toContainText('OLD FAITHFUL');
});

test('P22: a rename is flagged rather than reported as lost business', async ({ page }) => {
  const invoices = [
    // Old spelling stops...
    ...[250, 229, 208, 187, 166].map((d) => invoice('Base plate 90', d)),
    // ...and a longer spelling of the same part starts.
    ...[25, 10].map((d) => invoice('BASE PLATE 90 (40X6)', d)),
  ];
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  // Part numbers here are known to vary in spelling between documents, and
  // reporting a rename as lost work would discredit every other row.
  await expect(group(page, 'Stopped')).toContainText('Possibly renamed to');
  await expect(group(page, 'Stopped')).toContainText('BASE PLATE 90 (40X6)');
});

test('P22: cadence counts challans too, so unbilled arrivals are not read as silence', async ({ page }) => {
  // Billed regularly up to 40 days ago; the newest arrival is on a challan
  // that has not been invoiced yet.
  const invoices = [130, 110, 90, 70, 50, 40].map((d) => invoice('LIVE PART', d));
  const im = [{
    id: 'IM-1', challanNo: '9', challanDate: daysAgo(2), clientId: 1, clientName: 'SSSMEHTA',
    items: [{ id: 'a', partNumber: 'LIVE PART', desc: 'LIVE PART', hsn: '998873', unit: 'KG', qty: 400, rate: 5.4, amount: 2160, nosQty: null, invoiced: false, invoiceId: null }],
    createdAt: recentTs(),
  }];
  await loadAppWithState(page, perfState(invoices, im));
  await openPerf(page);

  // On the billing record alone this part had been quiet for 40 days against a
  // 20-day rhythm, which would have read as stopped.
  await expect(group(page, 'Steady')).toContainText('LIVE PART');
  await expect(group(page, 'Stopped')).not.toContainText('LIVE PART');
});

test('P22: a part that only ever arrived says so instead of showing zero revenue', async ({ page }) => {
  const im = [{
    id: 'IM-1', challanNo: '9', challanDate: daysAgo(5), clientId: 1, clientName: 'SSSMEHTA',
    items: [{ id: 'a', partNumber: 'NEVER BILLED', desc: 'NEVER BILLED', hsn: '998873', unit: 'KG', qty: 400, rate: 5.4, amount: 2160, nosQty: null, invoiced: false, invoiceId: null }],
    createdAt: recentTs(),
  }];
  await loadAppWithState(page, perfState([invoice('BILLED PART', 5)], im));
  await openPerf(page);

  // ₹0.00 would read as worthless work rather than unbilled work.
  await expect(page.locator('.inv-cp-mat', { hasText: 'NEVER BILLED' })).toContainText('challan only');
  await expect(page.locator('.inv-cp-mat', { hasText: 'NEVER BILLED' })).not.toContainText('₹0.00');
});

test('P22: the view is scoped to one client and switches between them', async ({ page }) => {
  const invoices = [
    ...[60, 40, 20, 5].map((d) => invoice('MEHTA PART', d)),
    ...[60, 40, 20, 5].map((d) => invoice('DORABJI PART', d, { clientId: 2, rate: 13 })),
  ];
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  // Defaults to the largest account by revenue, which is the one worth watching.
  await expect(page.locator('#cpClientSelect')).toHaveValue('2');
  await expect(page.locator('#clientPerfArea')).toContainText('DORABJI PART');
  await expect(page.locator('#clientPerfArea')).not.toContainText('MEHTA PART');

  await page.locator('#cpClientSelect').selectOption('1');
  await expect(page.locator('#clientPerfArea')).toContainText('MEHTA PART');
  await expect(page.locator('#clientPerfArea')).not.toContainText('DORABJI PART');
});

test('P22: month on month can be read as revenue, tonnage or realisation', async ({ page }) => {
  const invoices = [70, 40, 10].map((d) => invoice('P', d));
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  await expect(page.locator('.inv-stats-card', { hasText: 'Month on Month' })).toBeVisible();
  await expect(page.locator('.inv-chart-svg rect.inv-chart-bar').first()).toBeVisible();

  await page.locator('[data-action="invPerfSeries"][data-series="rate"]').click();
  // Realisation is the contract rate for a weight-billed client.
  await expect(page.locator('.inv-kpi', { hasText: 'Realisation' })).toContainText('5.40');
});

test('P22: a quiet month is kept — the silence is the finding', async ({ page }) => {
  // Billed, then three months of nothing, then billed again. Dropping the empty
  // months renders an unbroken run of bars for an account that went dark.
  const invoices = [
    invoice('P', 150),
    invoice('P', 15),
  ];
  await loadAppWithState(page, perfState(invoices));
  await openPerf(page);

  const months = await page.evaluate(() => {
    const id = Number((document.getElementById('cpClientSelect') as HTMLSelectElement).value);
    return (window as any).cpMonthly(id, 12).map((m: { revenue: number }) => m.revenue);
  });
  // Five or six buckets depending on where today falls, but the middle ones
  // must be zeros rather than absent.
  expect(months.length).toBeGreaterThanOrEqual(5);
  expect(months.filter((v: number) => v === 0).length).toBeGreaterThanOrEqual(3);
  expect(months[0]).toBeGreaterThan(0);
  expect(months[months.length - 1]).toBeGreaterThan(0);
});
