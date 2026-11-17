import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, SepState } from './fixtures';

/*
 * P268: the new-invoice path, end to end by keyboard (owner: "creating a new invoice still has no keyboard navigation").
 * Challan entry got it (P12); Create did not. Its form re-renders by replacing innerHTML and none of its controls carried a
 * data-k, so picking a client, picking a part, adding or removing a line, ticking a challan or changing a unit each dropped
 * focus to <body>; Alt+N and Ctrl+Enter were the challan form's alone; Add line and Create invoice were out of the Enter
 * chain; a save refused for an error left the cursor nowhere. Made-up data only (HR-10).
 */

const CLIENT = 'DELTA AUTO';

function book(withChallan = false): SepState {
  const s: any = emptyState();
  s.clients = [{ id: 1, name: CLIENT, billingMode: 'kg', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] }];
  // Two parts sharing a prefix, so arrowing to the second is the keyboard's doing, not the lone-match shortcut.
  s.items = [
    { id: 101, partNumber: 'QX1 A', desc: 'TEST BRACKET', hsn: '998873', unit: 'KG', rate: 13 },
    { id: 102, partNumber: 'QX1 B', desc: 'TEST BRACKET WIDE', hsn: '998873', unit: 'KG', rate: 14 },
  ];
  if (withChallan) {
    s.incomingMaterial = [{ id: 'IM-9', challanNo: '9001', challanDate: todayIso(), clientId: 1, clientName: CLIENT, vehicleNo: '',
      items: [{ id: 'IM-9-0', partNumber: 'QX1 A', desc: 'TEST BRACKET', hsn: '998873', unit: 'KG', qty: 40, rate: 13, amount: 520, invoiced: false, invoiceId: null }],
      receivedDate: todayIso(), notes: '', createdAt: Date.now() - 3600000 }];
  }
  return s as SepState;
}

async function openCreate(page: Page, withChallan = false) {
  await loadAppWithState(page, book(withChallan));
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').waitFor();
}

async function pickClient(page: Page) {
  await page.locator('#invClientSearch').fill('DELTA');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pageCreate [data-chosen-client]')).toContainText(CLIENT);
}

const line = (page: Page, field: string, idx: number) => page.locator(`#createFormArea [data-k="${field}-${idx}"]`);

test.describe('Create invoice: keyboard entry', () => {
  test('a client picked by Enter hands focus on, to Add line; Enter there makes a line and lands on its part', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await expect(page.locator('#createFormArea [data-k="addline"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(1);
    await expect(line(page, 'part', 0)).toBeFocused();
  });

  test('a client with a challan waiting: focus lands on its tick, and Space ticks it without losing focus', async ({ page }) => {
    await openCreate(page, true);
    await pickClient(page);
    const tick = page.locator('#createFormArea [data-action="invCreatePickChallan"]');
    await expect(tick).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(1);
    await expect(page.locator('#createFormArea [data-action="invCreatePickChallan"]')).toBeChecked();
    await expect(page.locator('#createFormArea [data-action="invCreatePickChallan"]')).toBeFocused();
  });

  test('the part list is arrowed, Enter commits, and focus goes on to the quantity', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'part', 0).fill('QX1');
    await expect(page.locator('#invPartAC0 .inv-menu-item:not(.inv-menu-add)')).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(line(page, 'part', 0)).toHaveValue('QX1 B');
    await expect(line(page, 'qty', 0)).toBeFocused();
  });

  test('Alt+N adds a line and focuses its part', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.locator('#invDate').focus();
    await page.keyboard.press('Alt+n');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(1);
    await expect(line(page, 'part', 0)).toBeFocused();
    await page.keyboard.press('Alt+n');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(2);
    await expect(line(page, 'part', 1)).toBeFocused();
  });

  test('changing a line unit keeps focus on it', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'unit', 0).focus();
    await line(page, 'unit', 0).selectOption('NOS');
    await expect(line(page, 'unit', 0)).toBeFocused();
    await expect(line(page, 'unit', 0)).toHaveValue('NOS');
  });

  test('Enter from the rate steps onto Add line, never dead-ends', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'part', 0).fill('QX1 A');
    await page.keyboard.press('Enter');
    await line(page, 'qty', 0).fill('10');
    await line(page, 'rate', 0).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#createFormArea [data-k="addline"]')).toBeFocused();
  });

  test('a line removed by keyboard: focus lands on the line that slid up, or on Add line', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Alt+n');
    await page.keyboard.press('Alt+n');
    await line(page, 'remove', 0).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(1);
    await expect(line(page, 'part', 0)).toBeFocused();
    await line(page, 'remove', 0).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#createFormArea .inv-line')).toHaveCount(0);
    await expect(page.locator('#createFormArea [data-k="addline"]')).toBeFocused();
  });

  test('Change client by keyboard lands on the client search', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.locator('#createFormArea [data-k="clientchange"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#invClientSearch')).toBeFocused();
  });

  test('Ctrl+Enter saves the invoice', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'part', 0).fill('QX1 A');
    await page.keyboard.press('Enter');
    await line(page, 'qty', 0).fill('10');
    await page.keyboard.press('Control+Enter');
    await expect.poll(() => page.evaluate(() => (0, eval)('S.invoices.length'))).toBe(1);
  });

  test('a save refused for an error puts the cursor in the field it names', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'part', 0).fill('QX1 A');
    await page.keyboard.press('Enter');
    await expect(line(page, 'qty', 0)).toBeFocused();
    await page.locator('#invDate').focus();
    await page.keyboard.press('Control+Enter');
    await expect(line(page, 'qty', 0)).toBeFocused();
    expect(await page.evaluate(() => (0, eval)('S.invoices.length'))).toBe(0);
  });

  test('Escape closes the part list and leaves the typed text alone', async ({ page }) => {
    await openCreate(page);
    await pickClient(page);
    await page.keyboard.press('Enter');
    await line(page, 'part', 0).fill('QX1');
    await expect(page.locator('#invPartAC0')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#invPartAC0')).toBeHidden();
    await expect(line(page, 'part', 0)).toHaveValue('QX1');
  });
});
