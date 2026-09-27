import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P78: the duplicate challan NUMBER is checked as it is typed (owner, 27 Sep 2026: "instead of checking for
// duplicate challan at the end of entering the entire challan details, check for duplicate challan number when
// the challan number is typed for a particular client"). Warn, never block. The content fingerprint at save stays
// as the second net, and does not ask again about a challan the field already showed. Made-up names and figures.

const A = 'NUMBER TEST WORKS', B = 'OTHER TEST WORKS';

function state(): SepState {
  const s = emptyState();
  s.clients = [
    { id: 1, name: A, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: B, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ] as never;
  const ch = (id: string, no: string, client: number, qty: number, date = '2026-09-21') => ({
    id, challanNo: no, challanDate: date, clientId: client, clientName: client === 1 ? A : B, vehicleNo: '',
    items: [{ id: id + '-0', partNumber: 'TEST PLATE ' + no, desc: 'TEST PLATE ' + no, hsn: '998873', unit: 'KG', qty, rate: 13,
      amount: qty * 13, nosQty: null, invoiced: false, invoiceId: null }],
    receivedDate: date, notes: '', createdAt: recentTs(),
  });
  s.incomingMaterial = [ch('IM-301', '301', 1, 40), ch('IM-310', '310', 1, 55, todayIso()), ch('IM-555', '555', 2, 20)] as never;
  return s;
}

async function openForm(page: Page) {
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
}
async function pickClient(page: Page, name: string) {
  await page.locator('#imChallanClientSearch').fill(name.slice(0, 6));
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
}
async function fillLine(page: Page, qty: string) {
  await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('NEW TEST PART');
  await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').fill(qty);
}
const warn = (page: Page) => page.locator('#imChallanNoWarn [data-challan-no-warn]');

test('the number is checked for this client the moment it is entered, leading zeros and all, with a way to open the match', async ({ page }) => {
  await loadAppWithState(page, state());
  await openForm(page);
  await pickClient(page, A);
  await page.locator('#imChallanNo').fill('0301');
  await expect(warn(page)).toHaveCount(0);
  await page.locator('#imChallanNo').press('Tab');
  await expect(warn(page)).toContainText(`Challan 301 is already recorded for ${A} on 21 Sep 2026 (1 line, not invoiced)`);
  await expect(warn(page)).toHaveClass(/inv-callout-warning/);

  // Open it: the challan is read in a dialog, and the form is still there with what was typed.
  await warn(page).locator('[data-action="invChallanPeek"]').click();
  const peek = page.locator('[data-challan-peek="IM-301"]');
  await expect(peek).toContainText('TEST PLATE 301');
  await peek.getByRole('button', { name: 'Back to the form' }).click();
  await expect(peek).toHaveCount(0);
  await expect(page.locator('#imChallanNo')).toHaveValue('0301');

  // Another number: the warning goes.
  await page.locator('#imChallanNo').fill('302');
  await page.locator('#imChallanNo').press('Tab');
  await expect(warn(page)).toHaveCount(0);
});

test('a number typed before the client is checked when the client is chosen; another client\'s number is not a match', async ({ page }) => {
  await loadAppWithState(page, state());
  await openForm(page);
  await page.locator('#imChallanNo').fill('555');
  await pickClient(page, A);
  await expect(warn(page)).toHaveCount(0);
  await page.locator('[data-action="invClearChallanClient"]').click();
  await pickClient(page, B);
  await expect(warn(page)).toContainText(`Challan 555 is already recorded for ${B}`);
});

test('saved past the warning it had time to read: not asked again, and the acceptance is stamped', async ({ page }) => {
  await loadAppWithState(page, state());
  await openForm(page);
  await pickClient(page, A);
  await page.locator('#imChallanNo').fill('301');
  await page.locator('#imChallanNo').press('Tab');
  await expect(warn(page)).toBeVisible();
  await fillLine(page, '12');
  await page.waitForTimeout(1300);
  await page.locator('[data-action="invSaveChallan"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Challan saved');
  const saved = (await readStoredState(page)).incomingMaterial.find((m: any) => m.challanNo === '301' && m.id !== 'IM-301');
  expect(saved.dupeAck).toMatchObject({ matchedIds: ['IM-301'], shownAsTyped: true });
});

test('typed and saved in one go, the warning was never read: the save asks', async ({ page }) => {
  await loadAppWithState(page, state());
  await openForm(page);
  await pickClient(page, A);
  await fillLine(page, '12');
  await page.locator('#imChallanNo').fill('301');
  await page.locator('[data-action="invSaveChallan"]').click();
  const dlg = page.locator('.inv-dialog').filter({ hasText: 'Possible duplicate challan' });
  await expect(dlg).toContainText('Same challan number already recorded');
  await dlg.locator('[data-action="invDupeSaveAnyway"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Challan saved');
  const saved = (await readStoredState(page)).incomingMaterial.find((m: any) => m.challanNo === '301' && m.id !== 'IM-301');
  expect(saved.dupeAck.matchedIds).toEqual(['IM-301']);
});

test('a content duplicate of a DIFFERENT challan is still asked, and the dialog says what was already shown', async ({ page }) => {
  await loadAppWithState(page, state());
  await openForm(page);
  await pickClient(page, A);
  await page.locator('#imChallanNo').fill('301');
  await page.locator('#imChallanNo').press('Tab');
  await expect(warn(page)).toBeVisible();
  // Same date and quantity as challan 310: the fingerprint catches it whatever the number says.
  await page.locator('#imChallanDate').fill(todayIso());
  await fillLine(page, '55');
  await page.waitForTimeout(1300);
  await page.locator('[data-action="invSaveChallan"]').click();
  const dlg = page.locator('.inv-dialog').filter({ hasText: 'Possible duplicate challan' });
  await expect(dlg).toContainText('exactly these quantities');
  await expect(dlg.locator('[data-dupe-row]')).toHaveCount(1);
  await expect(dlg.locator('[data-dupe-row]')).toContainText('Ch. 310');
  await expect(dlg.locator('[data-dupe-seen]')).toContainText('Already shown as the number was typed: Ch. 301');
  await dlg.locator('[data-action="invDupeSaveAnyway"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Challan saved');
  const saved = (await readStoredState(page)).incomingMaterial.find((m: any) => m.challanNo === '301' && m.id !== 'IM-301');
  expect(saved.dupeAck.matchedIds.sort()).toEqual(['IM-301', 'IM-310']);
});

test('editing a challan does not warn about itself', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageIM');
  await page.evaluate(() => (window as any).editChallan('IM-301'));
  await expect(page.locator('#imChallanNo')).toHaveValue('301');
  await page.locator('#imChallanNo').press('Tab');
  await expect(warn(page)).toHaveCount(0);
});
