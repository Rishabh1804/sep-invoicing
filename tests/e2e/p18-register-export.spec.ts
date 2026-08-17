import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Register selection and CSV export.
 *
 * Three complaints from the owner, all in the same place: bulk select had no
 * "select all", exports covered whole months only, and the file that came out
 * was neither ordered nor named for what it contained.
 *
 * The ordering one was a real filing defect. Both CSVs took getFilteredInvoices()
 * order, which on mobile is createdAt descending — so the register handed to the
 * accountant read backwards — and appended voided numbers in a block at the end
 * rather than in their own slot in the series.
 */

/** First day of the month `n` months back, as YYYY-MM-DD. */
function monthsAgoIso(n: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function invoice(num: number, over: Record<string, unknown> = {}) {
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
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0,
    grandTotal: 153.4, amountInWords: '',
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

/** Capture what downloadCSV was handed, instead of writing a file. */
async function captureExport(page: Page, action: string) {
  await page.evaluate(() => {
    (window as any).__csv = null;
    (window as any).downloadCSV = (filename: string, rows: unknown[][]) => {
      (window as any).__csv = { filename, rows };
    };
  });
  await page.locator(`[data-action="${action}"]`).first().click();
  return page.evaluate(() => (window as any).__csv as { filename: string; rows: string[][] });
}

async function enterSelectMode(page: Page) {
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
}

test('P18: select all ticks every selectable invoice, and toggles back off', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1), invoice(2), invoice(3)]));
  await enterSelectMode(page);

  const selectAll = page.locator('[data-action="invRegSelectAll"]');
  await expect(selectAll).toHaveText('Select all (3)');
  await selectAll.click();

  await expect(page.locator('.inv-im-sel-count')).toHaveText('3 selected');
  // The same control clears, rather than leaving the only way out be three taps.
  await expect(selectAll).toHaveText('Clear selection');
  await selectAll.click();
  await expect(page.locator('.inv-im-sel-count')).toHaveCount(0);
});

test('P18: select all skips cancelled invoices — no bulk action accepts one', async ({ page }) => {
  await loadAppWithState(page, stateWith([
    invoice(1),
    invoice(2, { status: 'cancelled', cancelledAt: recentTs() }),
    invoice(3),
  ]));
  await enterSelectMode(page);

  // Mobile renders no checkbox on a cancelled row, so selecting one would be
  // unclearable — and every bulk path refuses it anyway.
  await expect(page.locator('[data-action="invRegSelectAll"]')).toHaveText('Select all (2)');
  await page.locator('[data-action="invRegSelectAll"]').click();
  await expect(page.locator('.inv-im-sel-count')).toHaveText('2 selected');
});

test('P18: changing a filter drops the selection instead of hiding it', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1), invoice(2)]));
  await enterSelectMode(page);
  await page.locator('[data-action="invRegSelectAll"]').click();
  await expect(page.locator('.inv-im-sel-count')).toHaveText('2 selected');

  // Filter to a state none of them are in. The rows leave the screen; without
  // this the selection survives and every bulk action still acts on it.
  await page.locator('#regStateFilter').selectOption('filed');

  await expect(page.locator('.inv-im-sel-count')).toHaveCount(0);
  const selected = await page.evaluate(() => Object.keys((window as any)._regSelected));
  expect(selected).toEqual([]);
});

test('P18: a date range reaches invoices the month filter hides', async ({ page }) => {
  const lastMonth = monthsAgoIso(1);
  await loadAppWithState(page, stateWith([
    invoice(1, { date: lastMonth }),
    invoice(2),
  ]));
  await switchTab(page, 'pageRegister');

  // Default filter is the current month, so last month's invoice is not shown.
  await expect(page.locator('#regList')).not.toContainText('SEP/TEST-00001');

  await page.locator('#regDateFrom').fill(lastMonth);
  await page.locator('#regDateTo').fill(lastMonth);

  await expect(page.locator('#regList')).toContainText('SEP/TEST-00001');
  await expect(page.locator('#regList')).not.toContainText('SEP/TEST-00002');
  // The month it replaced is cleared, not left set and quietly ignored.
  await expect(page.locator('#regMonthFilter')).toHaveValue('');
  await expect(page.locator('.inv-reg-scope-note')).toBeVisible();
});

test('P18: setting a month clears the range, so only one of them is ever in force', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1)]));
  await switchTab(page, 'pageRegister');

  await page.locator('#regDateFrom').fill(monthsAgoIso(1));
  await expect(page.locator('#regMonthFilter')).toHaveValue('');

  await page.locator('#regMonthFilter').fill(todayIso().slice(0, 7));
  await expect(page.locator('#regDateFrom')).toHaveValue('');
  await expect(page.locator('#regDateTo')).toHaveValue('');
  await expect(page.locator('.inv-reg-scope-note')).toHaveCount(0);
});

test('P18: the sales register exports in serial order, with voids in their own slot', async ({ page }) => {
  // Typed out of order — createdAt descending would emit 2, 3, 1.
  const s = stateWith([
    invoice(3, { createdAt: recentTs(0) }),
    invoice(1, { createdAt: recentTs(60_000) }),
    invoice(2, { createdAt: recentTs(30_000) }),
  ]);
  // 00004 was issued and voided; it belongs after 3, not in a block at the end.
  s.voidedNumbers = [{
    invoiceNumber: '00004', displayNumber: 'SEP/TEST-00004', date: todayIso(),
    clientId: 1, clientName: 'TEST CLIENT KG', taxableValue: 0, grandTotal: 0,
    lastState: 'dispatched', wasCancelled: false,
    reason: 'duplicate of 00003', reserved: true, source: 'deleted', voidedAt: recentTs(),
  }];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageRegister');

  const csv = await captureExport(page, 'invExportSales');
  // Row 0 is metadata, row 1 is the header.
  const numbers = csv.rows.slice(2).map((r) => r[0]);
  expect(numbers).toEqual([
    'SEP/TEST-00001', 'SEP/TEST-00002', 'SEP/TEST-00003', 'SEP/TEST-00004',
  ]);
  expect(csv.rows[2 + 3][2]).toContain('VOID: duplicate of 00003');
});

test('P18: GSTR1 exports in serial order too', async ({ page }) => {
  await loadAppWithState(page, stateWith([
    invoice(2, { createdAt: recentTs(0) }),
    invoice(1, { createdAt: recentTs(60_000) }),
  ]));
  await switchTab(page, 'pageRegister');

  const csv = await captureExport(page, 'invExportGstr1');
  expect(csv.rows.slice(2).map((r) => r[1])).toEqual(['SEP/TEST-00001', 'SEP/TEST-00002']);
});

test('P18: the filename states the scope it was taken under', async ({ page }) => {
  const lastMonth = monthsAgoIso(1);
  await loadAppWithState(page, stateWith([invoice(1, { date: lastMonth })]));
  await switchTab(page, 'pageRegister');

  await page.locator('#regDateFrom').fill(lastMonth);
  await page.locator('#regDateTo').fill(lastMonth);
  await page.locator('#regClientFilter').selectOption('1');

  const csv = await captureExport(page, 'invExportSales');
  // Two exports under different filters must not land in the downloads folder
  // under the same name.
  expect(csv.filename).toBe(`SEP-Sales-Register_${lastMonth}_to_${lastMonth}_TEST-CLIENT-KG.csv`);
  // And the scope travels inside the file as well as on it.
  expect(csv.rows[0].join(' ')).toContain('Scope: ');
});

test('P18: clicking a filter control does not rebuild it out from under the pointer', async ({ page }) => {
  await loadAppWithState(page, stateWith([invoice(1), invoice(2)]));
  await switchTab(page, 'pageRegister');

  // Mark the live elements. If a click rebuilds the toolbar, the marked nodes
  // are discarded with it — which is what shut the client dropdown the instant
  // it was opened, because the toolbar re-render replaced the <select> the
  // native popup was hanging off.
  await page.evaluate(() => {
    ['regClientFilter', 'regStateFilter', 'regMonthFilter', 'regDateFrom', 'regDateTo']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.dataset.probe = 'live'; });
  });

  for (const id of ['regClientFilter', 'regStateFilter', 'regDateFrom']) {
    await page.locator(`#${id}`).click();
    const survived = await page.evaluate(
      (elId) => document.getElementById(elId)?.dataset.probe === 'live', id);
    expect(survived, `${id} was replaced by a click`).toBe(true);
  }
});

test('P18: choosing a client still filters — the change path is the one that acts', async ({ page }) => {
  const s = stateWith([invoice(1), invoice(2, { clientId: 2, clientName: 'OTHER CLIENT' })]);
  (s.clients as unknown[]).push({ id: 2, name: 'OTHER CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' } as never);
  await loadAppWithState(page, s);
  await switchTab(page, 'pageRegister');

  await page.locator('#regClientFilter').selectOption('2');
  await expect(page.locator('#regList')).toContainText('SEP/TEST-00002');
  await expect(page.locator('#regList')).not.toContainText('SEP/TEST-00001');
});
