import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, recentTs, switchTab, todayIso, waitForBoot,
  type SepState } from './fixtures';

// P123: the QA audit's billing findings (G1-1 … G1-13), each reproduced here before it was fixed: the invoice line's
// part and description, a reissue that keeps its challan lines and credit notes, the numbers Settings may issue again,
// a legacy line taken off in an edit, the financial year a number's series names, "Challan unit was wrong" on a new
// invoice, a piece client's share, a typed amount to the paisa, Next where the operator set it, and no negative figure
// on a challan. Made-up clients and parts.

const g = (page: Page, expr: string) => page.evaluate(x => (0, eval)(x), expr);
const ADDR = { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' };
const pad = (n: number) => String(n).padStart(5, '0');

const KG = { id: 1, name: 'KESTREL TEST WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
const PIECE = { id: 2, name: 'PLOVER TEST ENGG', billingMode: 'piece', gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 14.5, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };

type Line = { id: string; partNumber: string; desc?: string; unit: string; qty: number; rate: number; amount: number;
  nosQty?: number | null; invoiced?: boolean; invoiceId?: string | null };

function challan(id: string, clientId: number, lines: Line[]) {
  return { id, challanNo: id.replace('IM-', ''), challanDate: todayIso(), clientId, clientName: clientId === 2 ? PIECE.name : KG.name,
    vehicleNo: '', receivedDate: todayIso(), notes: '', createdAt: recentTs(),
    items: lines.map(l => ({ hsn: '998873', desc: l.partNumber, nosQty: null, invoiced: false, invoiceId: null, ...l })) };
}

function inv(n: number, o: Record<string, unknown> = {}) {
  const prefix = (o.prefix as string) || 'SEP/TEST-';
  const rest: Record<string, unknown> = { ...o };
  delete rest.prefix;
  const clientId = (o.clientId as number) || 1;
  const items = (o.items as any[]) || [{ partNumber: 'TEST PART 1', desc: 'TEST PART 1', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }];
  const taxable = items.reduce((t, i) => t + i.amount, 0);
  const tax = Math.round(taxable * 9) / 100;
  return { id: 'INV-' + n, invoiceNumber: pad(n), displayNumber: prefix + pad(n), date: todayIso(), status: 'active', invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null, clientId, clientName: clientId === 2 ? PIECE.name : KG.name, clientGSTIN: '',
    clientAddress: ADDR, gstType: 'intra', items, taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: taxable + 2 * tax, amountInWords: '', challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '',
    remarks: '', linkedIMIds: [], createdAt: recentTs(), updatedAt: recentTs(), ...rest };
}

function book(o: Record<string, unknown> = {}): SepState {
  const s = emptyState();
  s.clients = [KG, PIECE] as never;
  s.incomingMaterial = noSeedIM();
  return Object.assign(s, o) as SepState;
}

const imLine = async (page: Page, id: string) =>
  (await readStoredState(page)).incomingMaterial.flatMap((m: any) => m.items).find((it: any) => it.id === id);
const invoiceCount = async (page: Page) => (await readStoredState(page)).invoices.length;

async function pickClient(page: Page, q: string) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill(q);
  await page.locator('[data-action="invSelectClient"]').first().click();
}
async function pickChallan(page: Page, q: string, imId: string) {
  await pickClient(page, q);
  await page.locator(`[data-action="invCreatePickChallan"][data-id="${imId}"]`).check();
}
async function deleteAndReissue(page: Page, invId: string) {
  await g(page, `openInvoiceDetail('${invId}')`);
  await page.locator(`[data-inv-detail="${invId}"] [data-action="invDeleteInvoice"]`).click();
  await page.locator('#invDeleteReason').fill('rate corrected, reissued');
  await page.locator('[data-action="invConfirmReissue"]').click();
  await expect(page.locator('[data-reissue]')).toBeVisible();
}
async function deleteInvoice(page: Page, invId: string) {
  await g(page, `openInvoiceDetail('${invId}')`);
  await page.locator(`[data-inv-detail="${invId}"] [data-action="invDeleteInvoice"]`).click();
  await page.locator('#invDeleteReason').fill('typed against the wrong client');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
}

/* The financial year today falls in, and a prefix naming it: 'SEP/2026-27/'. */
const fyStart = (iso: string) => { const y = +iso.slice(0, 4); return +iso.slice(5, 7) >= 4 ? y : y - 1; };
const FY = fyStart(todayIso());
const fyLabel = (y: number) => `${y}-${String(y + 1).slice(2)}`;
const PREFIX = `SEP/${fyLabel(FY)}/`;
const BEFORE_FY = `${FY}-03-31`;   // the day before this series' year begins

/* ===== G1-1: the Part field holds the part number ===== */

test('G1-1: the invoice line shows its part number, and a keystroke never turns the description into the part', async ({ page }) => {
  await loadAppWithState(page, book({ incomingMaterial: [challan('IM-71', 1, [
    { id: 'IM-71-0', partNumber: '2715 2671 0140', desc: 'BRACKET', unit: 'KG', qty: 50, rate: 13, amount: 650 }])] }));
  await pickChallan(page, 'kestrel', 'IM-71');
  const part = page.locator('input[data-action="invEditLinePart"][data-idx="0"]');
  await expect(part).toHaveValue('2715 2671 0140');
  await expect(page.locator('#invDesc0 [data-line-desc]')).toContainText('BRACKET');

  // A space typed and taken back out.
  await part.focus();
  await part.press('End');
  await part.pressSequentially(' ');
  await part.press('Backspace');
  expect(await g(page, 'JSON.stringify([invoiceForm.items[0].partNumber, invoiceForm.items[0].desc])')).toBe(JSON.stringify(['2715 2671 0140', 'BRACKET']));
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(1);
  const st = await readStoredState(page);
  expect(st.invoices[0].items[0]).toMatchObject({ partNumber: '2715 2671 0140', desc: 'BRACKET', imItemId: 'IM-71-0' });
  const it = st.incomingMaterial[0].items[0];
  expect(it.partNumber).toBe('2715 2671 0140');
  expect(it.corrections).toBeUndefined();
});

test('G1-1: a part typed over a line whose description only repeated the part takes the description with it', async ({ page }) => {
  await loadAppWithState(page, book());
  await pickClient(page, 'kestrel');
  await page.locator('[data-action="invAddLineItem"]').click();
  const part = page.locator('input[data-action="invEditLinePart"][data-idx="0"]');
  await part.fill('TEST PIN 3');
  await part.fill('TEST PIN 30');
  expect(await g(page, 'JSON.stringify([invoiceForm.items[0].partNumber, invoiceForm.items[0].desc])')).toBe(JSON.stringify(['TEST PIN 30', 'TEST PIN 30']));
  await expect(page.locator('#invDesc0 [data-line-desc]')).toHaveCount(0);
});

/* ===== G1-2: a reissue keeps what the old invoice billed ===== */

test('G1-2: identical legacy lines against identical challan lines are linked in order, so a reissue keeps the challan billed', async ({ page }) => {
  const L = { partNumber: 'TEST WASHER 12', unit: 'KG', qty: 25, rate: 13, amount: 325 };
  await loadAppWithState(page, book({
    incomingMaterial: [challan('IM-81', 1, [{ id: 'IM-81-0', ...L, invoiced: true, invoiceId: 'INV-5' }, { id: 'IM-81-1', ...L, invoiced: true, invoiceId: 'INV-5' }])],
    invoices: [inv(5, { items: [0, 1].map(() => ({ ...L, desc: L.partNumber, hsn: '998873', nosQty: null })), challanNo: '81', linkedIMIds: ['IM-81'] })],
    invNextNum: 6,
  }));
  // Saved before invoice lines named their challan line: held whole by the invoice's id alone.
  expect(await g(page, 'S.incomingMaterial[0].items.map(function(i){ return i.billedLegacy; }).join()')).toBe('true,true');

  await deleteAndReissue(page, 'INV-5');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(1);
  const st = await readStoredState(page);
  const neu = st.invoices[0];
  expect(neu.id).not.toBe('INV-5');
  expect(neu.items.map((i: any) => i.imItemId)).toEqual(['IM-81-0', 'IM-81-1']);
  for (const it of st.incomingMaterial[0].items) expect(it).toMatchObject({ invoiced: true, billedQty: 25, invoiceIds: [neu.id] });
});

test('G1-2: one legacy line against two identical challan lines is still never guessed', async ({ page }) => {
  const L = { partNumber: 'TEST WASHER 12', unit: 'KG', qty: 25, rate: 13, amount: 325 };
  await loadAppWithState(page, book({
    incomingMaterial: [challan('IM-81', 1, [{ id: 'IM-81-0', ...L, invoiced: true, invoiceId: 'INV-5' }, { id: 'IM-81-1', ...L, invoiced: true, invoiceId: 'INV-5' }])],
    invoices: [inv(5, { items: [{ ...L, desc: L.partNumber, hsn: '998873', nosQty: null }], linkedIMIds: ['IM-81'] })],
    invNextNum: 6,
  }));
  expect(await g(page, "withChallanLinks(S.invoices[0]).map(function(l){ return l._imItemId || '-'; }).join()")).toBe('-');
});

test('G1-2: a legacy line no challan line can be matched to is carried to the reissued invoice, never freed', async ({ page }) => {
  await loadAppWithState(page, book({
    incomingMaterial: [challan('IM-82', 1, [{ id: 'IM-82-0', partNumber: 'CLAMP 165X83(40X6)', unit: 'KG', qty: 40, rate: 13, amount: 520, invoiced: true, invoiceId: 'INV-6' }])],
    invoices: [inv(6, { items: [{ partNumber: 'Clamp 165x83', desc: 'Clamp 165x83', hsn: '998873', unit: 'KG', qty: 40, rate: 13, amount: 520, nosQty: null }],
      linkedIMIds: ['IM-82'] })],
    invNextNum: 7,
  }));
  await deleteAndReissue(page, 'INV-6');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(1);
  const neu = (await readStoredState(page)).invoices[0];
  expect(await imLine(page, 'IM-82-0')).toMatchObject({ invoiced: true, invoiceId: neu.id, billedLegacy: true, billedQty: 40 });
  expect(await g(page, 'imLineOpen(S.incomingMaterial[0].items[0]).qty')).toBe(0);
});

/* ===== G1-3: a reissue keeps the credit notes ===== */

test('G1-3: a reissue carries the credit notes on the old invoice to the new one', async ({ page }) => {
  const s = book({ invoices: [inv(1, { invoiceState: 'dispatched', dispatchedAt: recentTs() }), inv(2, { invoiceState: 'dispatched', dispatchedAt: recentTs() })],
    invNextNum: 3 });
  (s as any).creditNotes = [{ id: 'CN-T1', cnNumber: '009', displayNumber: 'CN/009', date: todayIso(), clientId: 1, clientName: KG.name,
    invoiceIds: ['INV-1', 'INV-2'], invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00002'], invoiceDates: [todayIso(), todayIso()],
    againstInvoice: 'SEP/TEST-00002', againstInvoiceId: 'INV-2', againstInvoiceDate: todayIso(), discountPct: 2, batchTaxable: 260,
    taxableValue: 5.2, grandTotal: 6.14, status: 'active', createdAt: recentTs() }];
  await loadAppWithState(page, s);
  await deleteAndReissue(page, 'INV-2');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(2);
  const st = await readStoredState(page);
  const neu = st.invoices.find((i: any) => i.invoiceNumber === '00002');
  expect(neu.id).not.toBe('INV-2');
  expect(st.creditNotes[0]).toMatchObject({ againstInvoiceId: neu.id, invoiceIds: ['INV-1', neu.id], againstInvoice: 'SEP/TEST-00002' });
  expect(await g(page, 'TODO_RULE_FNS.cnMatch().length')).toBe(0);
  expect(await g(page, `cnLinksForInvoice(S.invoices.find(function(i){ return i.id === '${neu.id}'; })).map(function(l){ return l.role; }).join()`)).toBe('against');
});

/* ===== G1-4: what Settings may issue again ===== */

test('G1-4: Settings refuses a gap accounted for and a cancelled number, and asks when the return was due', async ({ page }) => {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 2);
  const twoMonthsBack = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const vd = (n: number, o: Record<string, unknown>) => ({ invoiceNumber: pad(n), displayNumber: 'SEP/TEST-' + pad(n), date: todayIso(), clientId: 1,
    clientName: KG.name, taxableValue: 130, grandTotal: 153.4, lastState: 'created', wasCancelled: false, reason: 'test', reserved: false,
    source: 'deleted', voidedAt: recentTs(), ...o });
  const s = book({ invoices: [inv(1), inv(5)], invNextNum: 6 });
  (s as any).voidedNumbers = [
    vd(2, { source: 'reconciled', lastState: 'unknown', reason: 'cancelled, filed in GSTR-1 at zero', reserved: true, date: '' }),
    vd(3, { wasCancelled: true, reserved: true, reason: 'cancelled copy cleared' }),
    vd(4, { date: twoMonthsBack, reason: 'typed twice' }),
  ];
  await loadAppWithState(page, s);
  await openSettingsAt(page, 'invoice');
  const save = page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]');
  const next = page.locator('#setNextNum');

  await next.fill('2');
  await save.click();
  await expect(page.locator('.inv-toast')).toContainText('SEP/TEST-00002 was accounted for as');
  await next.fill('3');
  await save.click();
  await expect(page.locator('.inv-toast')).toContainText('SEP/TEST-00003 was cancelled');
  expect((await readStoredState(page)).invNextNum).toBe(6);

  // Deleted before it left the building, but its month's GSTR-1 was due: asked, never refused.
  await next.fill('4');
  await save.click();
  const said = await answerAsk(page, 'cancel');
  expect(said).toContain('was due on');
  expect((await readStoredState(page)).invNextNum).toBe(6);
  await save.click();
  await answerAsk(page, 'ok');
  await expect.poll(async () => (await readStoredState(page)).invNextNum).toBe(4);
});

/* ===== G1-5: a legacy line removed in an edit ===== */

test('G1-5: a legacy line taken off an invoice in an edit frees its challan line', async ({ page }) => {
  const A = { partNumber: 'TEST HINGE 5', unit: 'KG', qty: 30, rate: 13, amount: 390 };
  const B = { partNumber: 'TEST LATCH 6', unit: 'KG', qty: 20, rate: 13, amount: 260 };
  await loadAppWithState(page, book({
    incomingMaterial: [challan('IM-91', 1, [{ id: 'IM-91-0', ...A, invoiced: true, invoiceId: 'INV-7' }, { id: 'IM-91-1', ...B, invoiced: true, invoiceId: 'INV-7' }])],
    invoices: [inv(7, { items: [A, B].map(l => ({ ...l, desc: l.partNumber, hsn: '998873', nosQty: null })), linkedIMIds: ['IM-91'] })],
    invNextNum: 8,
  }));
  await g(page, "editInvoice('INV-7')");
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await page.locator('[data-action="invRemoveLineItem"][data-idx="1"]').click();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  const st = await readStoredState(page);
  expect(st.invoices[0].items.map((i: any) => i.imItemId)).toEqual(['IM-91-0']);
  expect(await imLine(page, 'IM-91-0')).toMatchObject({ invoiced: true, invoiceIds: ['INV-7'] });
  const freed = await imLine(page, 'IM-91-1');
  expect(freed.invoiced).toBe(false);
  expect(freed.billedLegacy).toBeUndefined();
});

/* ===== G1-6: a document dated outside its series' financial year ===== */

test('G1-6: an invoice dated outside the year its series names is asked about, naming both', async ({ page }) => {
  await loadAppWithState(page, book({ invPrefix: PREFIX, invNextNum: 1 }));
  await pickClient(page, 'kestrel');
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-action="invEditLinePart"][data-idx="0"]').fill('TEST PART 6');
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('10');
  await page.locator('#invDate').fill(BEFORE_FY);
  await page.locator('#invSaveBtn').click();
  const said = await answerAsk(page, 'cancel');
  expect(said).toContain(fyLabel(FY - 1));
  expect(said).toContain(fyLabel(FY));
  expect(await invoiceCount(page)).toBe(0);
  await page.locator('#invSaveBtn').click();
  await answerAsk(page, 'ok');
  await expect.poll(() => invoiceCount(page)).toBe(1);
  expect((await readStoredState(page)).invoices[0]).toMatchObject({ date: BEFORE_FY, displayNumber: PREFIX + '00001' });

  // Dated inside the year, nothing is asked.
  await pickClient(page, 'kestrel');
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-action="invEditLinePart"][data-idx="0"]').fill('TEST PART 6');
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('10');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(2);
  await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
});

test('G1-6: a credit note dated outside its series\' year is asked about, from the register and from the Credit notes dialog', async ({ page }) => {
  const s = book({ invPrefix: PREFIX, invNextNum: 3,
    invoices: [1, 2].map(n => inv(n, { prefix: PREFIX, invoiceState: 'dispatched', dispatchedAt: recentTs() })) });
  await loadAppWithState(page, s);
  const notes = async () => ((await readStoredState(page)).creditNotes || []).length;

  // The batch note, from a Register selection.
  await g(page, "openCreditNoteForm(['INV-1', 'INV-2'])");
  await page.locator('#cnDate').fill(BEFORE_FY);
  await page.locator('[data-action="invCnSave"]').click();
  let said = await answerAsk(page, 'cancel');
  expect(said).toContain(fyLabel(FY - 1));
  expect(said).toContain(fyLabel(FY));
  expect(await notes()).toBe(0);
  await page.locator('[data-action="invCnSave"]').click();
  await answerAsk(page, 'ok');
  await expect.poll(notes).toBe(1);
  await g(page, 'closePrintPreview()');

  // A new note from Office → Invoices → Credit notes (the tab map, TM3a).
  await switchTab(page, 'pageRegister');
  await page.locator('#pageRegister [data-action="invCnList"]').click();
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  await page.locator('#cnfDate').fill(BEFORE_FY);
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('INV-1');
  await page.locator('#cnfReason').selectOption('rate');
  await page.locator('#cnfTaxable').fill('10');
  await page.locator('[data-action="invCnFormSave"]').click();
  said = await answerAsk(page, 'cancel');
  expect(said).toContain(fyLabel(FY - 1));
  expect(await notes()).toBe(1);

  // A note recorded from paper is in the year typed on it: dated in that year, nothing is asked.
  await page.locator('[data-action="invCnFormCancel"]').click();
  await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
  await page.locator('#cnfNum').fill('3');
  await page.locator('#cnfFy').fill(`${String(FY - 1).slice(2)}-${String(FY).slice(2)}`);
  await page.locator('#cnfDate').fill(BEFORE_FY);
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('__typed');
  await page.locator('#cnfInvNo').fill('000443');
  await page.locator('#cnfReason').selectOption('rate');
  await page.locator('#cnfTaxable').fill('10');
  await page.locator('[data-action="invCnFormSave"]').click();
  await expect.poll(notes).toBe(2);
  await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
});

/* ===== G1-7: "Challan unit was wrong" on a new invoice ===== */

test('G1-7: "Challan unit was wrong" on a new invoice carries the unit back to a whole challan line; a line billed in part keeps its own', async ({ page }) => {
  const P = { partNumber: 'TEST BRACKET 77', unit: 'NOS', qty: 600, rate: 2.5, amount: 1500 };
  await loadAppWithState(page, book({
    incomingMaterial: [challan('IM-301', 2, [{ id: 'IM-301-0', ...P }]), challan('IM-302', 2, [{ id: 'IM-302-0', ...P, partNumber: 'TEST BRACKET 78' }])],
    invoices: [inv(1, { clientId: 2, items: [{ ...P, partNumber: 'TEST BRACKET 78', desc: 'TEST BRACKET 78', hsn: '998873', qty: 200, amount: 500, nosQty: null, imItemId: 'IM-302-0' }] })],
    invNextNum: 2,
  }));
  const toKg = async (imId: string) => {
    await pickChallan(page, 'plover', imId);
    await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('KG');
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('150');
    await page.locator('input[data-field="rate"][data-idx="0"]').fill('14.5');
    await page.locator('#invImShare0 [data-action="invUnitReason"][data-reason="challan"]').click();
    await page.locator('#invSaveBtn').click();
  };
  await toKg('IM-301');
  await expect.poll(() => invoiceCount(page)).toBe(2);
  const it = await imLine(page, 'IM-301-0');
  expect(it).toMatchObject({ unit: 'KG', qty: 150, rate: 14.5, amount: 2175, invoiced: true });
  expect(it.corrections).toHaveLength(1);
  expect(it.corrections[0].from).toMatchObject({ unit: 'NOS', qty: 600 });

  // Another invoice bills part of this one: the unit cannot be the challan's mistake alone, so nothing travels.
  await toKg('IM-302');
  await expect.poll(() => invoiceCount(page)).toBe(3);
  const part = await imLine(page, 'IM-302-0');
  expect(part).toMatchObject({ unit: 'NOS', qty: 600, amount: 1500, invoiced: true });
  expect(part.corrections).toBeUndefined();
});

/* ===== G1-8 / G1-9: a piece client's share of a challan line ===== */

const THIRD = { partNumber: 'TEST THIRD', unit: 'NOS', qty: 3, rate: 33.33, amount: 100 };
function thirds(): SepState {
  const share = (n: number) => inv(n, { clientId: 2, items: [{ ...THIRD, desc: THIRD.partNumber, hsn: '998873', qty: 1, amount: 33.33, nosQty: null, imItemId: 'IM-3-0' }] });
  return book({
    incomingMaterial: [challan('IM-3', 2, [{ id: 'IM-3-0', ...THIRD }]), challan('IM-4', 2, [{ id: 'IM-4-0', ...THIRD, partNumber: 'TEST THIRD B' }])],
    invoices: [share(1), share(2)], invNextNum: 3,
  });
}

test('G1-8: a share priced from the challan\'s amount sends no rate back to the challan', async ({ page }) => {
  await loadAppWithState(page, thirds());
  const qty = page.locator('input[data-field="qty"][data-idx="0"]');
  const amt = page.locator('input[data-field="amount"][data-idx="0"]');
  // The last third, its quantity typed: it takes what is left of the amount.
  await pickChallan(page, 'plover', 'IM-3');
  await qty.fill('1');
  await expect(amt).toHaveValue('33.34');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(3);
  let it = await imLine(page, 'IM-3-0');
  expect(it).toMatchObject({ rate: 33.33, amount: 100, invoiced: true });
  expect(it.corrections).toBeUndefined();

  // Two of a fresh three: ₹66.67, and the challan's rate is still ₹33.33.
  await pickChallan(page, 'plover', 'IM-4');
  await qty.fill('2');
  await expect(amt).toHaveValue('66.67');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(4);
  it = await imLine(page, 'IM-4-0');
  expect(it).toMatchObject({ rate: 33.33, amount: 100, billedQty: 2 });
  expect(it.corrections).toBeUndefined();
});

test('G1-9: IM → Create invoice gives the share that completes a line what is left of its amount', async ({ page }) => {
  await loadAppWithState(page, thirds());
  await switchTab(page, 'pageIM');
  await g(page, "_imSelected = { 'IM-3-0': true }; createInvoiceFromIM();");
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('33.34');
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(3);
  const sum = (await readStoredState(page)).invoices.reduce((t: number, i: any) => t + i.items[0].amount, 0);
  expect(Math.round(sum * 100) / 100).toBe(100);
});

/* ===== G1-10: a typed amount, to the paisa ===== */

test('G1-10: an amount typed on an invoice line or a challan line is kept to the paisa', async ({ page }) => {
  await loadAppWithState(page, book());
  await pickClient(page, 'plover');
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-action="invEditLinePart"][data-idx="0"]').fill('TEST NUT 9');
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('NOS');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('10');
  await page.locator('input[data-field="amount"][data-idx="0"]').fill('763.998');
  expect(await g(page, 'invoiceForm.items[0].amount')).toBe(764);
  await page.locator('#invSaveBtn').click();
  await expect.poll(() => invoiceCount(page)).toBe(1);
  expect((await readStoredState(page)).invoices[0]).toMatchObject({ taxableValue: 764, items: [{ amount: 764 }] });

  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('plover');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  await page.locator('#imPart0').fill('TEST NUT 9');
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('#imUnit0').selectOption('NOS');
  await page.locator('#imQty0').fill('10');
  await page.locator('#imAmt0').fill('763.998');
  expect(await g(page, '_challanForm.items[0].amount')).toBe(764);
});

/* ===== G1-11: Next where it was set ===== */

test('G1-11: a Next set in Settings survives a delete, and accounting for a gap never moves it back', async ({ page }) => {
  await loadAppWithState(page, book({ invoices: [inv(1), inv(3)], invNextNum: 4 }));
  await openSettingsAt(page, 'invoice');
  await page.locator('#setNextNum').fill('10');
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice series saved');
  await page.locator('[data-action="invCloseSettings"]').click();

  // 00002 accounted for: it is spent, and Next stays where it was set.
  await g(page, "openAccountForNumber(2, 'SEP/TEST-00002')");
  await page.locator('#invGapReason').fill('spoiled, filed at zero');
  await page.locator('[data-action="invSaveGapReason"]').click();
  await expect.poll(async () => ((await readStoredState(page)).voidedNumbers || []).length).toBe(1);
  expect((await readStoredState(page)).invNextNum).toBe(10);
  await g(page, 'closeOverlay()');

  // 00003 was not the last number handed out (Next was moved on), so deleting it moves nothing.
  await deleteInvoice(page, 'INV-3');
  expect((await readStoredState(page)).invNextNum).toBe(10);
});

test('G1-11: deleting the last numbers handed out walks Next back over them, never over a spent one', async ({ page }) => {
  await loadAppWithState(page, book({ invoices: [inv(1, { invoiceState: 'dispatched', dispatchedAt: recentTs() }), inv(2), inv(3)], invNextNum: 4 }));
  await deleteInvoice(page, 'INV-2');
  expect((await readStoredState(page)).invNextNum).toBe(4);
  await deleteInvoice(page, 'INV-3');
  expect((await readStoredState(page)).invNextNum).toBe(2);
  // 00001 reached the customer: deleted, it stays spent and Next does not come back to it.
  await deleteInvoice(page, 'INV-1');
  expect((await readStoredState(page)).invNextNum).toBe(2);
});

/* ===== G1-12: a Next set on an empty book ===== */

test('G1-12: a Next set on an empty book survives a restart; a book nobody set still starts at 1', async ({ page }) => {
  await loadAppWithState(page, book({ invNextNum: 1 }));
  await openSettingsAt(page, 'invoice');
  await page.locator('#setNextNum').fill('500');
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice series saved');
  await expect.poll(async () => (await readStoredState(page)).invNextNum).toBe(500);
  await page.reload();
  await waitForBoot(page);
  expect(await g(page, 'S.invNextNum')).toBe(500);
  expect((await readStoredState(page)).invNextNum).toBe(500);

  // A stale Next on a book with no invoices that nobody set is still put back to 1.
  await loadAppWithState(page, book({ invNextNum: 7 }));
  expect(await g(page, 'S.invNextNum')).toBe(1);
});

/* ===== G1-13: no negative figure on a challan ===== */

test('G1-13: the challan form takes no negative rate, amount or piece count', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('kestrel');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  await page.locator('#imPart0').fill('TEST ROD 4');
  await g(page, 'dismissAllAutocomplete()');
  await page.locator('#imQty0').fill('10');
  await page.locator('#imRate0').fill('-5');
  await page.locator('#imNos0').fill('-3');
  expect(await g(page, 'JSON.stringify([_challanForm.items[0].rate, _challanForm.items[0].amount, _challanForm.items[0].nosQty])')).toBe(JSON.stringify([0, 0, null]));
  await expect(page.locator('#imRate0')).toHaveValue('');

  // A negative that reached the form another way (a scanned challan) is refused at the save, naming the line.
  const before = (await readStoredState(page)).incomingMaterial.length;
  await g(page, '_challanForm.items[0].rate = 13; _challanForm.items[0].amount = -130;');
  await page.locator('[data-action="invSaveChallan"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Line 1: the amount cannot be negative');
  expect((await readStoredState(page)).incomingMaterial.length).toBe(before);
});
