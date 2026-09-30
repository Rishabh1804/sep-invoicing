import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P106: the QA sweep of 29 Sep 2026 in Challans (IM), Items Master and Clients. Names and figures are made up.
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function base(): any {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 1, name: 'KILO WORKS', billingMode: 'weight', gstType: 'intra', gstin: '20AAACK1234K1Z5', isActive: true,
      rates: [{ ratePerKg: 14, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'NOS WEIGHT CO', billingMode: 'nos_to_weight', gstType: 'intra', gstin: '', isActive: true,
      rates: [{ ratePerKg: 14.5, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 3, name: 'PIECE PLANT', billingMode: 'piece', gstType: 'intra', gstin: '', isActive: true,
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  s.items = [
    { id: 201, partNumber: 'HINGE PIN', desc: 'HINGE PIN', unit: 'NOS', hsn: '998873' },
    { id: 202, partNumber: 'ROLLER 7', desc: 'ROLLER 7', unit: 'NOS', hsn: '998873' },
    { id: 203, partNumber: 'C-CLAMP 66X42', desc: 'C-Clamp', gauge: '30X6', unit: 'KG', hsn: '998873' },
  ];
  s.partWeights = { 'HINGE PIN': 0.25 };
  return s;
}
const line = (p: Page, f: string, i = 0) => p.locator(`[data-action="invUpdateChallanLine"][data-field="${f}"][data-idx="${i}"]`);
async function openForm(page: Page, client: string, part?: string) {
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill(client);
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  await page.locator('#imChallanNo').fill('77');
  await page.locator('#imChallanDate').fill(todayIso());
  if (part) {
    await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill(part);
    await page.locator('[data-action="invSelectChallanPart"]').first().click();
  }
}
const stored = async (p: Page) => ((await readStoredState(p)).incomingMaterial || []).filter((m: any) => m.id !== 'IM-SEED-BLOCK');
function challan(id: string, clientId: number, date: string, lines: any[], extra: any = {}) {
  return { id, challanNo: id.replace('IM-', ''), challanDate: date, clientId, clientName: 'KILO WORKS', vehicleNo: '',
    items: lines.map((l, i) => ({ id: id + '-' + i, partNumber: 'P' + i, desc: 'P' + i, hsn: '998873', unit: 'KG', qty: 10, rate: 14, amount: 140,
      nosQty: null, invoiced: false, invoiceId: null, ...l })), receivedDate: date, notes: '', createdAt: recentTs(), ...extra };
}

test.describe('P106: the challan form prices and names a line right', () => {
  test('C2: a nos_to_weight NOS line is pieces × kg per piece × ₹/kg, never pieces × ₹/kg', async ({ page }) => {
    await loadAppWithState(page, base());
    await openForm(page, 'NOS WEIGHT', 'HINGE');
    await line(page, 'qty').fill('100');
    await expect(line(page, 'amount')).toHaveValue('362.50');
    await page.locator('[data-action="invSaveChallan"]').click();
    expect((await stored(page))[0].items[0]).toMatchObject({ qty: 100, rate: 14.5, amount: 362.5 });
  });

  test('C3: a NOS line with no piece rate on record is not handed the ₹/kg', async ({ page }) => {
    await loadAppWithState(page, base());
    await openForm(page, 'KILO', 'ROLLER');
    await expect(line(page, 'rate')).toHaveValue('');
    await expect(page.locator('#imFill0')).not.toContainText('₹14.00');
  });

  test('C4: the Part field shows the part number; the description is said under the line', async ({ page }) => {
    await loadAppWithState(page, base());
    await openForm(page, 'KILO', 'C-CLAMP');
    await expect(page.locator('#imPart0')).toHaveValue('C-CLAMP 66X42');
    await expect(page.locator('#imDesc0 [data-line-desc]')).toContainText('C-Clamp (30X6)');
  });

  test('C11: choosing the client keeps a rate somebody typed', async ({ page }) => {
    await loadAppWithState(page, base());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await line(page, 'rate').fill('20');
    await page.locator('#imChallanClientSearch').fill('KILO');
    await page.locator('[data-action="invSelectChallanClient"]').first().click();
    await expect(line(page, 'rate')).toHaveValue('20.00');
  });

  test('C17: the client search finds a GSTIN typed in lower case', async ({ page }) => {
    await loadAppWithState(page, base());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanClientSearch').fill('20aaack');
    await expect(page.locator('#imChallanClientResults .inv-menu-item')).toHaveText(/KILO WORKS/);
  });
});

test.describe('P106: a challan is saved whole', () => {
  test('C5: a line with no part or no quantity, or no date, is refused and named', async ({ page }) => {
    await loadAppWithState(page, base());
    await openForm(page, 'KILO');
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect(page.locator('.inv-toast')).toHaveText('Line 1 has no part: pick one, or remove the line');
    await expect(page.locator('#imPart0')).toBeFocused();
    await page.locator('#imPart0').fill('P9');
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect(page.locator('.inv-toast')).toHaveText('Line 1 has no quantity');
    await line(page, 'qty').fill('12');
    await page.locator('#imChallanDate').fill('');
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect(page.locator('.inv-toast')).toHaveText('Enter the challan date');
    expect(await stored(page)).toHaveLength(0);
    await page.locator('#imChallanDate').fill(todayIso());
    await page.locator('[data-action="invSaveChallan"]').click();
    expect(await stored(page)).toHaveLength(1);
  });

  test('C12: an edit keeps each line\'s id and the corrections an invoice made to it', async ({ page }) => {
    const s = base();
    s.incomingMaterial.push(challan('IM-500', 1, todayIso(), [{}, { corrections: [{ at: 1, invoice: 'SEP/X', from: { nosQty: 33 }, to: { nosQty: 330 } }] }]));
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await g(page, 'editChallan("IM-500")');
    await page.locator('[data-action="invRemoveChallanLine"][data-idx="0"]').click();
    await page.locator('[data-action="invAddChallanLine"]').click();
    await page.locator('#imPart1').fill('NEW PART');
    await line(page, 'qty', 1).fill('5');
    await page.locator('[data-action="invSaveChallan"]').click();
    const im = (await stored(page)).find((m: any) => m.id === 'IM-500');
    expect(im.items.map((x: any) => x.id)).toEqual(['IM-500-1', 'IM-500-2']);
    expect(im.items[0].corrections).toHaveLength(1);
  });

  test('CB5: a save clears the typed flag and runs a layout switch that waited for the form', async ({ page }) => {
    await loadAppWithState(page, base());
    await openForm(page, 'KILO');
    await page.locator('#imPart0').fill('P1');
    await line(page, 'qty').fill('3');
    await g(page, '_pendingModeSwitch = true');
    expect(await g(page, '_pageTyped')).toBe(true);
    await page.locator('[data-action="invSaveChallan"]').click();
    expect(await g(page, '_pageTyped')).toBe(false);
    expect(await g(page, '_pendingModeSwitch')).toBe(false);
  });

  test('H6: a delete answered after another window reloaded the book removes the challan from the book now held', async ({ page }) => {
    const s = base();
    s.incomingMaterial.push(challan('IM-600', 1, todayIso(), [{}]));
    await loadAppWithState(page, s);
    await g(page, 'deleteChallan("IM-600"); 1');
    await expect(page.locator('[data-ui-ask]')).toBeVisible();
    await g(page, 'S = JSON.parse(JSON.stringify(S)); 1');
    await answerAsk(page, 'ok');
    expect(await g(page, 'S.incomingMaterial.some(function(m){ return m.id === "IM-600"; })')).toBe(false);
  });
});

test.describe('P106: the scanner hands the form numbers and the book\'s own client', () => {
  test('C6: text figures, "Kg", a written date and a spaced name are read; a string never reaches the billing', async ({ page }) => {
    const s = base();
    s.clients.push({ id: 7, name: 'SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true,
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] });
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    const f = await g(page, `(_applyScanResult({ clientName: 'S.S.S. Mehta Enterprises', challanNo: 41, challanDate: '04/08/2026', vehicleNo: 'JH05 1',
      items: [{ partNumber: 'P1', desc: 'P1', unit: 'Kg', qty: '282.70', nosQty: '40', rate: '5', amount: '1,413.50' }] }), _challanForm)`);
    expect(f.clientId).toBe(7);
    expect(f.challanNo).toBe('41');
    expect(f.challanDate).toBe('2026-08-04');
    expect(f.items[0]).toMatchObject({ unit: 'KG', qty: 282.7, nosQty: 40, rate: 5.4, amount: 1526.58 });
    await expect(page.locator('#imQty0')).toHaveValue('282.7');
    // An invoice line carrying text quantities no longer throws in the billing sync (it ran at every boot).
    const r = await g(page, `(function(){ S.incomingMaterial.push({ id: 'IM-T', clientId: 1, challanDate: '2026-08-04', items: [{ id: 'IM-T-0', unit: 'KG', qty: '10', amount: '140' }] });
      S.invoices.push({ id: 'I-T', status: 'active', date: '2026-08-05', clientId: 1, items: [{ imItemId: 'IM-T-0', unit: 'KG', qty: '4' }, { imItemId: 'IM-T-0', unit: 'KG', qty: '6' }] });
      imSyncBilled(); var it = S.incomingMaterial.find(function(m){ return m.id === 'IM-T'; }).items[0]; return [it.billedQty, it.invoiced, imChallanTotal({ items: [it] })]; })()`);
    expect(r).toEqual([10, true, 140]);
  });

  test('C6: a short name the book does not hold is never given another client\'s id', async ({ page }) => {
    const s = base();
    s.clients.push({ id: 8, name: 'GENERAL ENGINEERING CORPORATION', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true, rates: [], itemRates: [] });
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    // Raw substring read GENERAL AUTO PARTS as General Engineering (and the seed's id 2 names another client here).
    expect(await g(page, `(_applyScanResult({ clientName: 'General Auto Parts', challanDate: '2026-08-04', items: [] }), _challanForm.clientId)`)).toBeNull();
    expect(await g(page, `(_applyScanResult({ clientName: 'SSSMEHTA', challanDate: '2026-08-04', items: [] }), _challanForm.clientId)`)).toBeNull();
    expect(await g(page, `(_applyScanResult({ clientName: 'kilo works', challanDate: '2026-08-04', items: [] }), _challanForm.clientId)`)).toBe(1);
  });
});

test.describe('P106: the duplicate check and a jump to a challan say what is true', () => {
  const dupState = (inv: any[], copyB: any) => {
    const s = base();
    s.incomingMaterial.push(challan('IM-A', 1, '2026-08-01', [{ qty: 282.7 }]), challan('IM-B', 1, '2026-08-01', [{ qty: 282.7, ...copyB }]));
    s.invoices = inv;
    return s;
  };
  const invOf = (id: string, items: any[]) => ({ id, invoiceNumber: id, displayNumber: 'SEP/TEST-' + id, date: '2026-08-02', status: 'active',
    invoiceState: 'filed', clientId: 1, clientName: 'KILO WORKS', items, taxableValue: 0, grandTotal: 0, createdAt: recentTs() });
  const verdict = (p: Page) => g(p, 'imDuplicateVerdict(imDuplicateGroups()[0]).label');

  test('C7: one copy billed and one open is not "collapsed"', async ({ page }) => {
    await loadAppWithState(page, dupState([invOf('I1', [{ imItemId: 'IM-A-0', unit: 'KG', qty: 282.7, amount: 1 }])], {}));
    expect(await verdict(page)).toBe('1 billed, 1 still open — still preventable');
  });

  test('C7: both copies linked from one invoice is billed twice on it', async ({ page }) => {
    await loadAppWithState(page, dupState([invOf('I1', [{ imItemId: 'IM-A-0', unit: 'KG', qty: 282.7 }, { imItemId: 'IM-B-0', unit: 'KG', qty: 282.7 }])], {}));
    expect(await verdict(page)).toBe('Billed twice on one invoice');
  });

  test('C7: both marked on one invoice that does not carry the material is left to check', async ({ page }) => {
    const s = dupState([invOf('I1', [])], { invoiced: true, invoiceId: 'I1' });
    s.incomingMaterial[1].items[0].invoiced = true; s.incomingMaterial[1].items[0].invoiceId = 'I1';
    await loadAppWithState(page, s);
    expect(await verdict(page)).toBe('On one invoice — check it bills them once');
  });

  test('CB1, CB4: Locate drops a selection the jump hides, and shows a row kept under "Show more"', async ({ page }) => {
    const s = base();
    for (let i = 0; i < 35; i++) s.incomingMaterial.push(challan('IM-' + (700 + i), 1, '2026-08-' + String(10 + (i % 18)).padStart(2, '0'), [{}], { createdAt: 1000 + i }));
    s.incomingMaterial.push(challan('IM-900', 3, '2026-08-01', [{}], { clientName: 'PIECE PLANT' }));
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await g(page, 'toggleIMItem("IM-900-0")');
    expect(await g(page, 'Object.keys(_imSelected).length')).toBe(1);
    // The oldest of client 1's challans is the 31st row or later: under "Show more".
    await g(page, 'imLocateChallan("IM-700")');
    expect(await g(page, 'Object.keys(_imSelected).length')).toBe(0);
    await expect(page.locator('#imList [data-im="IM-700"]')).toBeVisible();
  });

  test('HB11: an Edit that cannot edit is shown disabled and still says why to a tap', async ({ page }) => {
    const s = base();
    s.incomingMaterial.push(challan('IM-800', 1, todayIso(), [{}, {}]));
    s.invoices = [{ id: 'I8', invoiceNumber: '8', displayNumber: 'SEP/TEST-8', date: todayIso(), status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'KILO WORKS', items: [{ imItemId: 'IM-800-0', partNumber: 'P0', unit: 'KG', qty: 10, rate: 14, amount: 140 }], taxableValue: 140, grandTotal: 165.2, createdAt: recentTs() }];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invToggleIM"][data-id="IM-800"]').click();
    const edit = page.locator('[data-action="invEditChallanGuard"]');
    await expect(edit).toHaveAttribute('aria-disabled', 'true');
    await edit.click({ force: true });   // aria-disabled reads as not enabled to Playwright; the pointer is not blocked
    await expect(page.locator('.inv-toast')).toContainText('Cannot edit: 1 item already invoiced');
  });
});
