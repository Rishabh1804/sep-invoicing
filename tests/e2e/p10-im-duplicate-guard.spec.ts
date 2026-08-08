import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, recentTs, SepState } from './fixtures';

/*
 * IM duplicate guard.
 *
 * The fingerprint is deliberately content-based — client + challan date + the
 * multiset of line quantities — because the two hardest real cases both defeat
 * an identifier key: one copy of Dorabji ch 146 had a blank challanNo, and
 * Dilip ch 47 carried the same 282.70 kg under an aliased part number. These
 * specs reproduce both shapes.
 */

const CHALLAN_DATE = '2026-04-28';

/** The challan form's client search filters on `isActive`, which emptyState omits. */
function activeClientState(): SepState {
  const state = emptyState();
  state.clients = state.clients.map((c) => ({ ...c, isActive: true }));
  return state;
}

/** Minimal invoice stub — init.js resets IM items pointing at absent invoices. */
function invoiceStub(id: string) {
  return {
    id, invoiceNumber: id, displayNumber: `SEP/TEST-${id}`,
    date: CHALLAN_DATE, status: 'active', invoiceState: 'filed',
    clientId: 1, clientName: 'TEST CLIENT KG', items: [],
    taxableValue: 0, grandTotal: 0, createdAt: recentTs(),
  };
}

function stateWithChallan(overrides: Record<string, unknown> = {}): SepState {
  const state = activeClientState();
  state.incomingMaterial = [{
    id: 'IM-DUPE-ORIG',
    challanNo: '47',
    challanDate: CHALLAN_DATE,
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    vehicleNo: '',
    items: [{
      id: 'IM-DUPE-ORIG-0',
      partNumber: '5181-3302', desc: '5181-3302', hsn: '998873',
      unit: 'KG', qty: 282.7, rate: 13, amount: 3675.1, nosQty: null,
      invoiced: false, invoiceId: null,
    }],
    receivedDate: CHALLAN_DATE,
    notes: '',
    createdAt: recentTs(86400000),
    ...overrides,
  }];
  return state;
}

/** Drive the Add Challan form to a saveable state with one KG line. */
async function fillChallan(page: Page, challanNo: string, qty: string, partName: string) {
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('TEST');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();

  await page.locator('#imChallanNo').fill(challanNo);
  await page.locator('#imChallanDate').fill(CHALLAN_DATE);
  await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill(partName);
  await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').fill(qty);
}

async function storedIM(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state') || '{}').incomingMaterial || []);
}

test('P10: an aliased part number on identical weights still trips the guard', async ({ page }) => {
  await loadAppWithState(page, stateWithChallan());
  await switchTab(page, 'pageIM');

  // Same client, same date, same 282.7 kg — different challan number, different
  // part string. An identifier key would wave this through; ch 47 is exactly
  // this shape and became the largest double-bill in the set.
  await fillChallan(page, '47-A', '282.7', 'BRACKET 3302');
  await page.locator('[data-action="invSaveChallan"]').click();

  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Possible duplicate challan');
  await expect(overlay).toContainText('Ch. 47');

  // Nothing written while the warning stands.
  expect(await storedIM(page)).toHaveLength(1);
});

test('P10: a blank challan number is raised in its own right', async ({ page }) => {
  // seed.js backfills 50 demo challans when incomingMaterial is empty, so this
  // starts from the one-record fixture. The quantity is deliberately unique —
  // a blank challan number is the only trigger under test here.
  await loadAppWithState(page, stateWithChallan());
  await switchTab(page, 'pageIM');

  await fillChallan(page, '', '100', 'SOME PART');
  await page.locator('[data-action="invSaveChallan"]').click();

  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('No challan number on this entry');
  await expect(overlay).not.toContainText('exactly these quantities');

  expect(await storedIM(page)).toHaveLength(1);
});

test('P10: Save Anyway writes the challan and stamps the acknowledgement', async ({ page }) => {
  await loadAppWithState(page, stateWithChallan());
  await switchTab(page, 'pageIM');

  await fillChallan(page, '47-A', '282.7', 'BRACKET 3302');
  await page.locator('[data-action="invSaveChallan"]').click();
  await expect(page.locator('.inv-overlay-scrim')).toBeVisible();

  await page.locator('[data-action="invDupeSaveAnyway"]').click();
  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);

  const im = await storedIM(page);
  expect(im).toHaveLength(2);
  const saved = im.find((m: any) => m.challanNo === '47-A');
  expect(saved.dupeAck).toBeTruthy();
  expect(saved.dupeAck.matchedIds).toContain('IM-DUPE-ORIG');
});

test('P10: a genuinely different quantity saves without a warning', async ({ page }) => {
  await loadAppWithState(page, stateWithChallan());
  await switchTab(page, 'pageIM');

  await fillChallan(page, '48', '190.5', 'BRACKET 3302');
  await page.locator('[data-action="invSaveChallan"]').click();

  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
  expect(await storedIM(page)).toHaveLength(2);
});

test('P10: the scan counts duplicate groups and separates billed-twice from unbilled', async ({ page }) => {
  const state = stateWithChallan();
  const orig = state.incomingMaterial[0] as any;

  // Second copy of the same receipt, invoiced to a DIFFERENT invoice than the
  // first — the ch 47 outcome, where both copies reached a customer's bill.
  state.incomingMaterial.push({
    ...orig,
    id: 'IM-DUPE-COPY',
    challanNo: '',
    items: [{ ...orig.items[0], id: 'IM-DUPE-COPY-0', invoiced: true, invoiceId: 'INV-B' }],
    createdAt: recentTs(),
  });
  orig.items[0].invoiced = true;
  orig.items[0].invoiceId = 'INV-A';
  state.invoices = [invoiceStub('INV-A'), invoiceStub('INV-B')];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageIM');

  await expect(page.locator('#imDupeCheck .inv-im-dupe-count')).toHaveText('1');

  await page.locator('#imDupeCheck').click();
  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Duplicate Check');
  await expect(overlay).toContainText('1 duplicate group');
  await expect(overlay).toContainText('Billed twice');
  // The blank challanNo on the second copy is listed separately too.
  await expect(overlay).toContainText('with no challan number');
});

test('P10: two copies collapsed into one invoice are not reported as billed twice', async ({ page }) => {
  const state = stateWithChallan();
  const orig = state.incomingMaterial[0] as any;
  state.incomingMaterial.push({
    ...orig,
    id: 'IM-DUPE-COPY',
    items: [{ ...orig.items[0], id: 'IM-DUPE-COPY-0', invoiced: true, invoiceId: 'INV-A' }],
    createdAt: recentTs(),
  });
  orig.items[0].invoiced = true;
  orig.items[0].invoiceId = 'INV-A';
  state.invoices = [invoiceStub('INV-A')];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageIM');
  await page.locator('#imDupeCheck').click();

  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toContainText('Collapsed into one invoice');
  await expect(overlay).not.toContainText('Billed twice');
});
