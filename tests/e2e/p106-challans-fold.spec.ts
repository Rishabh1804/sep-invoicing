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

test.describe('P106: the Items Master merges one part at one gauge, and its list tells the truth', () => {
  const inv = (id: string, state: string, lines: any[]) => ({ id, invoiceNumber: id, displayNumber: 'SEP/TEST-' + id, date: todayIso(), status: 'active',
    invoiceState: state, clientId: 3, clientName: 'PIECE PLANT', items: lines, taxableValue: 1, grandTotal: 1, createdAt: recentTs() });
  const mergeState = () => {
    const s = base();
    s.items = [
      { id: 1, partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', gauge: '35X6', unit: 'NOS', hsn: '998873' },
      { id: 2, partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', gauge: '40X6', unit: 'NOS', hsn: '998873' },
      { id: 3, partNumber: 'CLMP 165X83 (NT)', desc: 'CLAMP', gauge: '40X6', unit: 'NOS', hsn: '998873', stdWeightKg: 0.3 },
    ];
    const L = { partNumber: 'CLMP 165X83 (NT)', desc: 'CLAMP (40X6)', unit: 'NOS', qty: 10, rate: 4.89, amount: 48.9 };
    s.invoices = [inv('F1', 'filed', [{ ...L }]), inv('C1', 'created', [{ ...L }])];
    s.incomingMaterial.push(challan('IM-M', 3, todayIso(), [{ ...L }], { clientName: 'PIECE PLANT' }));
    s.partWeights = { 'CLMP 165X83 (NT)': 0.3 };
    s.clients[2].pieceRates = [{ partNumber: 'CLMP 165X83 (NT)', gauge: '40X6', rate: 4.89, effectiveFrom: '2020-04-01' }];
    return s;
  };
  async function openItems(page: Page) {
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
  }

  test('C1: two gauges are never a group, and a merge renames without touching a description or an issued invoice', async ({ page }) => {
    await loadAppWithState(page, mergeState());
    expect(await g(page, 'findDuplicateGroups(S.items).map(function(gr){ return gr.items.map(function(i){ return i.id; }); })')).toEqual([[2, 3]]);
    await openItems(page);
    await page.locator('[data-action="invOpenMergeTool"]').click();
    await expect(page.locator('#mergeGroup0 [data-gauge]').first()).toHaveText('40X6');
    await page.locator('[data-action="invMergeGroup"][data-group="0"]').click();
    await expect(page.locator('#mergeGroup0')).toContainText('Lines left as issued');
    await page.locator('[data-action="invMergeConfirm"]').click();
    const st = await readStoredState(page);
    expect(st.items.map((i: any) => i.id)).toEqual([1, 2]);
    expect(st.items[1].stdWeightKg).toBe(0.3);
    const f1 = st.invoices.find((i: any) => i.id === 'F1').items[0], c1 = st.invoices.find((i: any) => i.id === 'C1').items[0];
    expect([f1.partNumber, f1.desc]).toEqual(['CLMP 165X83 (NT)', 'CLAMP (40X6)']);
    expect([c1.partNumber, c1.desc]).toEqual(['CLAMP 165X83 (NT)', 'CLAMP (40X6)']);
    const line = st.incomingMaterial.find((m: any) => m.id === 'IM-M').items[0];
    expect(line.partNumber).toBe('CLAMP 165X83 (NT)');
    expect(line.corrections[0].from.partNumber).toBe('CLMP 165X83 (NT)');
    expect(st.partWeights['CLAMP 165X83 (NT)']).toBe(0.3);
    expect(st.partWeights['CLMP 165X83 (NT)']).toBe(0.3);   // the filed invoice still spells it
    expect(st.clients[2].pieceRates[0].partNumber).toBe('CLAMP 165X83 (NT)');
    await expect(page.locator('#itemsList [data-item-row="3"]')).toHaveCount(0);
  });

  test('C8, C15, C14: usage is read fresh, a hidden tick is dropped, a delete takes its tick, an edit cannot make a twin', async ({ page }) => {
    await loadAppWithState(page, mergeState());
    await openItems(page);
    await expect(page.locator('[data-action="invFilterUnused"]')).toHaveText('Unused (2)');
    await g(page, 'S.incomingMaterial.push({ id: "IM-N", clientId: 1, challanDate: "2026-09-01", items: [{ id: "IM-N-0", partNumber: "CLAMP 165X83 (NT)", unit: "NOS", qty: 1 }] }); renderClientsPage(); 1');
    await expect(page.locator('[data-action="invFilterUnused"]')).toHaveText('Unused (0)');
    await page.locator('[data-item-row="1"] .inv-row-tick').click();
    await page.locator('#itemsSearch').fill('CLMP');
    await expect(page.locator('#itemsSelBar .inv-selbar')).toHaveCount(0);
    await page.locator('#itemsSearch').fill('');
    await page.locator('[data-item-row="3"] .inv-row-tick').click();
    await g(page, 'deleteItem(3); 1');
    await answerAsk(page, 'ok');
    expect(await g(page, 'Object.keys(_itemsSelected).length')).toBe(0);
    await g(page, 'openItemEdit(1)');
    await page.locator('#itemEditGauge').fill('40x6');
    await page.locator('[data-action="invSaveItem"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Already exists');
    expect(await g(page, 'S.items.find(function(i){ return i.id === 1; }).gauge')).toBe('35X6');
  });

  test('CB6: a search that finds more than thirty shows the rest one tap away', async ({ page }) => {
    const s = base();
    s.items = Array.from({ length: 40 }, (_, i) => ({ id: 300 + i, partNumber: 'BRKT ' + (100 + i), desc: 'BRKT', unit: 'KG', hsn: '998873' }));
    await loadAppWithState(page, s);
    await openItems(page);
    await page.locator('#itemsSearch').fill('BRKT');
    const more = page.locator('#itemsList [data-action="invShowMore"][data-key="items-all|brkt"]');
    await expect(more).toContainText('Show 10 more items · 40 in all');
    await more.click();
    await expect(page.locator('#itemsList [data-item-row]:visible')).toHaveCount(40);
  });

  test('H6: an item delete answered after another window reloaded the book removes it from the book now held', async ({ page }) => {
    await loadAppWithState(page, mergeState());
    await g(page, 'deleteItem(1); 1');
    await expect(page.locator('[data-ui-ask]')).toBeVisible();
    await g(page, 'S = JSON.parse(JSON.stringify(S)); 1');
    await answerAsk(page, 'ok');
    expect(await g(page, 'S.items.some(function(i){ return i.id === 1; })')).toBe(false);
  });

  test('C13: a part held in two gauges is not promised a derived weight, and says why', async ({ page }) => {
    const s = mergeState();
    s.clients[2].rates = [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }];
    s.invoices = [inv('D1', 'filed', [{ partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', unit: 'NOS', qty: 10, rate: 4.89, amount: 48.9 }])];
    await loadAppWithState(page, s);
    await openItems(page);
    await page.locator('[data-action="invOpenWeightEntry"]').click();
    await expect(page.locator('[data-two-gauge]')).toContainText('held in two gauges');
    await expect(page.locator('[data-action="invDeriveWeights"]')).toHaveCount(0);
  });
});

test.describe('P106: a client\'s cards change without losing what was typed', () => {
  const clientOf = (p: Page) => g(p, 'S.clients.find(function(c){ return c.id === 1; })');

  test('C9: adding a card entry keeps the sheet and every typed field; Save takes a rate typed without Add', async ({ page }) => {
    await loadAppWithState(page, base());
    await g(page, 'openClientEdit(1)');
    await page.locator('#ceditName').fill('KILO WORKS LTD');
    await page.locator('#ceditPiecePart').fill('ROLLER 7');
    await page.locator('#ceditPieceRate').fill('1.10');
    await page.locator('[data-action="invAddPieceRate"]').click();
    await expect(page.locator('#ceditName')).toHaveValue('KILO WORKS LTD');
    await expect(page.locator('#ceditPiecePart')).toHaveValue('');
    await expect(page.locator('#ceditPieceRates')).toContainText('ROLLER 7');
    await page.locator('#ceditNewRate').fill('15');
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    const c = (await readStoredState(page)).clients.find((x: any) => x.id === 1);
    expect(c.name).toBe('KILO WORKS LTD');
    expect(c.rates.map((r: any) => r.ratePerKg)).toContain(15);
    expect(c.pieceRates).toHaveLength(1);
  });

  test('C9: a half-typed card entry stops the save and says what it lacks', async ({ page }) => {
    await loadAppWithState(page, base());
    await g(page, 'openClientEdit(1)');
    await page.locator('#ceditWtPart').fill('BRKT 9');
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Piece weights: enter the weight of one piece in kg');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
  });

  test('C9: removing a piece rate asks first', async ({ page }) => {
    const s = base();
    s.clients[0].pieceRates = [{ partNumber: 'ROLLER 7', gauge: '', rate: 1.1, effectiveFrom: '2020-04-01' }];
    await loadAppWithState(page, s);
    await g(page, 'openClientEdit(1)');
    await page.locator('#ceditName').fill('KILO WORKS LTD');
    await page.locator('[data-action="invRemovePieceRate"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Remove this piece rate?');
    expect((await clientOf(page)).pieceRates).toHaveLength(1);
    await page.locator('[data-action="invRemovePieceRate"]').click();
    await answerAsk(page, 'ok');
    expect((await clientOf(page)).pieceRates).toHaveLength(0);
    await expect(page.locator('#ceditName')).toHaveValue('KILO WORKS LTD');
  });

  test('C10: a ladder rate is removed on a confirm, and a rate on a date already there replaces it', async ({ page }) => {
    await loadAppWithState(page, base());
    await g(page, 'openClientEdit(1)');
    await page.locator('#ceditNewRate').fill('13.5');
    await page.locator('#ceditNewRateDate').fill('2020-04-01');
    await page.locator('[data-action="invAddRate"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Replace the rate from');
    expect((await clientOf(page)).rates).toEqual([{ ratePerKg: 13.5, ratePerPiece: null, effectiveFrom: '2020-04-01' }]);
    expect(await g(page, 'getLineItemRate(S.clients[0], "2026-09-01", "").ratePerKg')).toBe(13.5);
    await page.locator('[data-action="invRemoveRate"]').click();
    await answerAsk(page, 'ok');
    expect((await clientOf(page)).rates).toHaveLength(0);
  });

  test('C16: Fill from billing history counts two invoices of one number in two years as two', async ({ page }) => {
    const s = base();
    const I = (id: string, num: string, date: string, rate: number) => ({ id, invoiceNumber: num, displayNumber: 'SEP/X-' + num, date, status: 'active',
      clientId: 3, items: [{ partNumber: 'PAD 150X88X3', desc: 'PAD', unit: 'NOS', qty: 100, rate, amount: rate * 100 }] });
    s.invoices = [I('A', '00012', '2025-06-01', 1.67), I('B', '00012', '2026-06-01', 1.67), I('C', '00020', '2026-07-01', 1.49)];
    await loadAppWithState(page, s);
    const r = await g(page, 'pieceRatesFromHistory(S.clients[2])');
    expect(r.add.map((a: any) => a.rate)).toEqual([1.67]);
    expect(r.outliers.map((o: any) => o.invoiceNumber)).toEqual(['00020']);
  });
});

test.describe('P106: Performance reads silence, a month in progress and gauges as they are', () => {
  const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const I = (id: string, date: string, part: string, desc: string, qty = 100) => ({ id, invoiceNumber: id, displayNumber: 'SEP/TEST-' + id, date, status: 'active',
    invoiceState: 'filed', clientId: 1, clientName: 'KILO WORKS', items: [{ partNumber: part, desc, unit: 'KG', qty, rate: 14, amount: qty * 14 }],
    taxableValue: qty * 14, grandTotal: qty * 14, createdAt: recentTs() });
  async function openPerf(page: Page) {
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').first().click();
    await page.locator('#cpClientSelect').selectOption('1');
  }

  test('CB7, CB8: the series runs to this month, which is read against the same days last month and the live cost', async ({ page }) => {
    const s = base();
    const now = new Date(), prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLen = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    s.invoices = [I('A', todayIso(), 'P1', 'P1'), I('B', iso(prevStart), 'P1', 'P1')];
    // Last month's whole ran past today's date: against the whole month this month would read red.
    if (now.getDate() < prevLen) s.invoices.push(I('C', iso(new Date(now.getFullYear(), now.getMonth() - 1, prevLen)), 'P1', 'P1', 500));
    s.invoices.push(I('D', ago(200), 'P1', 'P1'));
    await loadAppWithState(page, s);
    await openPerf(page);
    const months = await g(page, 'cpMonthly(1, 12).map(function(m){ return m.month; })');
    expect(months[months.length - 1]).toBe(todayIso().slice(0, 7));
    const tile = page.locator('[data-cp-trend] .inv-tile').first();
    await expect(tile).toContainText('Month to date');
    await expect(tile).toContainText('level with same days last month');
    await expect(page.locator('[data-cp-trend] .inv-tile', { hasText: 'Realisation' })).toContainText('live cost');
    await expect(page.locator('[data-cp-trend] .inv-tile', { hasText: 'Average month' })).toContainText('full month');
  });

  test('CB7: a client quiet since its last invoice ends on this month, the silence shown', async ({ page }) => {
    const s = base();
    s.invoices = [I('A', ago(130), 'P1', 'P1'), I('B', ago(100), 'P1', 'P1')];
    await loadAppWithState(page, s);
    const rev = await g(page, 'cpMonthly(1, 12).map(function(m){ return m.revenue; })');
    expect(rev[rev.length - 1]).toBe(0);
  });

  test('CB9: one gauge stopping is not hidden by the other gauge carrying on', async ({ page }) => {
    const s = base();
    s.invoices = [
      ...[300, 280, 260, 240, 220, 200].map((d, i) => I('T' + i, ago(d), 'CLAMP 165X83 (NT)', 'CLAMP (35X6)')),
      ...[90, 70, 50, 30, 10].map((d, i) => I('F' + i, ago(d), 'CLAMP 165X83 (NT)', 'CLAMP (40X6)')),
    ];
    await loadAppWithState(page, s);
    await openPerf(page);
    const stopped = page.locator('[data-cp-group="stopped"]');
    await expect(stopped).toContainText('35X6');
    await expect(stopped).not.toContainText('Possibly renamed');
    await expect(page.locator('[data-cp-group="steady"]')).toContainText('40X6');
  });
});
