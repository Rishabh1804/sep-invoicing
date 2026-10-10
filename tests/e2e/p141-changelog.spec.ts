import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, openSettingsAt, readStoredState, recentTs, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { problems, sweep } from './sweep-fixture';

// P141: the change log (the guard, G1). Every save is compared with the book as the save before left it, record by
// record: what was added, changed (each field from → to) or removed, with who was signed in and on which device, kept in
// the book (S.changeLog) and listed in History under Changes. What is worked out from other records is not a change,
// a save that changed nothing adds nothing, a book loaded whole is never logged record by record, a secret is said to
// have changed and never shown, and the log keeps 120 days and 4,000 entries at most, saying how many it let go.
// Every name here is made up; dates are built from today. The gate (guard.js) is another builder's: its signed-in user
// is stood in for by grdUserId, set in the page, and the users below include no owner, so the gate stays off.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const pad = (n: number) => String(n).padStart(2, '0');
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const CLIENT = 'ALPHA PLATING WORKS';

function book(): SepState {
  const s: any = emptyState();
  const t = todayIso();
  s.clients = [{ id: 1, name: CLIENT, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
    add1: 'Plot 1', add2: 'Adityapur', add3: '', address: '', isActive: true, notes: '',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] }];
  s.items = [{ id: 1, partNumber: 'P1', desc: 'Bracket', unit: 'KG', rate: 13, hsn: '998873' }];
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: t, status: 'active', invoiceState: 'created',
    clientId: 1, clientName: CLIENT, clientGSTIN: '20ABCDE1234F1Z5', gstType: 'intra',
    clientAddress: { add1: 'Plot 1', add2: 'Adityapur', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 100, rate: 13, amount: 1300, nosQty: null }],
    taxableValue: 1300, cgstPer: 9, cgstAmt: 117, sgstPer: 9, sgstAmt: 117, igstPer: 0, igstAmt: 0, grandTotal: 1534,
    amountInWords: 'Rupees One Thousand Five Hundred Thirty Four Only', challanNo: '', challanDate: '', poNumber: '', poDate: '',
    despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs(3600000), updatedAt: recentTs(3600000) }];
  s.invNextNum = 2;
  s.incomingMaterial = [{ id: 'IM-1', challanNo: '301', challanDate: t, clientId: 1, clientName: CLIENT, vehicleNo: 'JH 05AN 0878',
    items: [{ id: 'IM-1-0', partNumber: 'P1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 50, rate: 13, amount: 650, nosQty: 200, invoiced: false, invoiceId: null }],
    receivedDate: t, notes: '', createdAt: recentTs(7200000) }];
  s.staff = [{ id: 1, name: 'Ramu Kumar', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true }];
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }],
    entries: [{ id: 'c1', itemId: 'N', kind: 'count', qty: 20, date: dayOff(-3), at: 1 }, { id: 'u1', itemId: 'N', kind: 'used', qty: 2, date: dayOff(-1), at: 2 }],
    pastes: [] };
  s.todo = { tasks: [], snoozes: {} };
  // Two IDs and no owner (the gate stays off); the secret is a stand-in of the shape the gate keeps.
  s.users = [
    { id: 'u-asha', name: 'Asha', role: 'office', active: true, createdAt: 1, secret: { alg: 'PBKDF2-SHA256', iter: 150000, salt: 'c2FsdC1vbmUtb25l', hash: 'aGFzaC1vbmUtb25l', digits: true } },
    { id: 'u-ravi', name: 'Ravi', role: 'supervisor', active: true, createdAt: 1, secret: { alg: 'PBKDF2-SHA256', iter: 150000, salt: 'c2FsdC10d28tdHdv', hash: 'aGFzaC10d28tdHdv', digits: true } },
  ];
  s.devices = [{ id: 'dev-office', name: 'Office PC' }];
  return s;
}

/* Who is signed in, and on which device: the gate's and the devices' own functions stood in for. */
async function as(page: Page, userId: string | null) {
  await page.evaluate(id => { (window as any).grdUserId = () => id; (window as any).devId = () => 'dev-office'; }, userId);
}
const log = (p: Page) => g(p, 'S.changeLog') as Promise<any[]>;
const field = (e: any, f: string) => (e.fields || []).find((x: any) => x.f === f);

async function load(page: Page, s: SepState = book()) {
  await loadAppWithState(page, s);
  await as(page, 'u-asha');
}

test.describe('P141: the change log', () => {
  test('each change is one entry with its op, store, record, label and fields; nothing worked out is logged', async ({ page }) => {
    await load(page);
    expect(await log(page)).toEqual([]);

    // An invoice's rate, edited on the form.
    await g(page, "editInvoice('INV-1')");
    await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
    await page.locator('input[data-field="rate"][data-idx="0"]').fill('13.2');
    await page.locator('#invSaveBtn').click();
    await expect.poll(async () => (await log(page)).length).toBe(1);
    let e = (await log(page))[0];
    expect(e).toMatchObject({ op: 'change', coll: 'invoices', rid: 'INV-1', by: 'u-asha', dev: 'dev-office', label: 'SEP/TEST-00001 · ' + CLIENT });
    expect(field(e, 'items[0].rate')).toEqual({ f: 'items[0].rate', from: 13, to: 13.2 });
    expect(field(e, 'items[0].amount')).toEqual({ f: 'items[0].amount', from: 1300, to: 1320 });
    expect(field(e, 'taxableValue')).toEqual({ f: 'taxableValue', from: 1300, to: 1320 });
    // updatedAt moves with every edit and is never a field.
    expect(field(e, 'updatedAt')).toBeUndefined();
    expect(typeof e.id).toBe('string');
    expect(e.at).toBeGreaterThan(Date.now() - 60000);

    // A challan added on its form. The client's recent vehicles move with it, and are not a change anybody made.
    await g(page, 'closeOverlay()');   // the edit lands on the invoice's sheet
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanClientSearch').fill('ALPHA');
    await page.locator('[data-action="invSelectChallanClient"]').first().click();
    await page.locator('#imChallanNo').fill('302');
    await page.locator('#imChallanDate').fill(todayIso());
    await page.locator('#imVehicleNo').fill('JH 05XY 4321');
    await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('P1');
    await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').fill('40');
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect.poll(async () => (await log(page)).length).toBe(2);
    e = (await log(page))[1];
    expect(e).toMatchObject({ op: 'add', coll: 'incomingMaterial', by: 'u-asha', cid: 1, fields: [] });
    expect(e.label).toContain('302 · ' + CLIENT);
    expect(await g(page, "S.clients[0].recentVehicles.indexOf('JH 05XY 4321') >= 0")).toBe(true);

    // An invoice raised from challan 301: the challan's billed share and the invoice counter move by themselves.
    await switchTab(page, 'pageCreate');
    await page.locator('#invClientSearch').fill('alpha');
    await page.locator('[data-action="invSelectClient"]').first().click();
    await page.locator('[data-action="invCreatePickChallan"][data-id="IM-1"]').check();
    await page.locator('#invSaveBtn').click();
    await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
    expect(await g(page, "S.incomingMaterial.find(function(m) { return m.id === 'IM-1'; }).items[0].invoiced")).toBe(true);
    let all = await log(page);
    expect(all).toHaveLength(3);
    expect(all[2]).toMatchObject({ op: 'add', coll: 'invoices', label: 'SEP/TEST-00002 · ' + CLIENT });
    expect(all.filter(x => x.coll === 'incomingMaterial' && x.op === 'change')).toHaveLength(0);
    expect(all.filter(x => x.coll === 'settings')).toHaveLength(0);

    // A stock entry voided (never deleted).
    await switchTab(page, 'pageStock');
    await page.locator('#stockLines [data-action="invStockOpen"]').filter({ hasText: 'Nitric acid' }).click();
    await page.locator('#stockEntries [data-entry="u1"] [data-action="invStockVoid"]').click();
    await page.locator('[data-action="invStockVoid"][aria-pressed="true"]').click();
    await expect.poll(async () => (await log(page)).length).toBe(4);
    e = (await log(page))[3];
    expect(e).toMatchObject({ op: 'change', coll: 'stock.entries', rid: 'u1' });
    expect(e.label).toBe('Nitric acid · used · 2 L · ' + await g(page, `formatDate('${dayOff(-1)}')`));
    expect(field(e, 'voided')).toEqual({ f: 'voided', from: null, to: 'set' });

    // A Settings section saved: one record, named by its section.
    await openSettingsAt(page, 'overtime');
    await page.locator('#setOtCap').fill('70');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="overtime"]').click();
    await expect.poll(async () => (await log(page)).length).toBe(5);
    e = (await log(page))[4];
    expect(e).toMatchObject({ op: 'change', coll: 'labour', rid: null, label: 'Settings → Overtime', fields: [{ f: 'otCap', from: 68.2, to: 70 }] });
    await page.locator('[data-action="invCloseSettings"]').click();

    // A payment recorded on Staff → Pay.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await page.locator('#payFormFold > summary').click();   // the form is one line on the phone until it is wanted (TM4b)
    await page.locator('#payWorker').selectOption('1');
    await page.locator('#payAmount').fill('500');
    await page.locator('[data-action="invPaySave"]').click();
    await expect.poll(async () => (await log(page)).length).toBe(6);
    e = (await log(page))[5];
    expect(e).toMatchObject({ op: 'add', coll: 'staffPayments' });
    expect(e.label).toContain('Ramu Kumar · payment · ₹500.00');

    // A save that changed nothing adds nothing; the log travels in the stored book.
    await g(page, 'saveState()');
    expect(await log(page)).toHaveLength(6);
    await expect.poll(async () => ((await readStoredState(page)).changeLog || []).length).toBe(6);
  });

  test('a removed record is named as it was; a book loaded again is not logged again', async ({ page }) => {
    await load(page);
    await g(page, "S.todo.tasks.push({ id: 'T9', text: 'Ring the plating supplier', due: '', note: '', link: null, createdAt: Date.now(), doneAt: null }); saveState()");
    await g(page, "S.todo.tasks = S.todo.tasks.filter(function(t) { return t.id !== 'T9'; }); saveState()");
    const all = await log(page);
    expect(all.map(x => [x.op, x.coll, x.rid, x.label])).toEqual([['add', 'todo.tasks', 'T9', 'Ring the plating supplier'], ['remove', 'todo.tasks', 'T9', 'Ring the plating supplier']]);

    // A reload starts from the stored book: nothing in it is logged again.
    await expect.poll(async () => ((await readStoredState(page)).changeLog || []).length).toBe(2);
    await page.reload();
    await waitForBoot(page);
    await as(page, 'u-asha');
    expect(await log(page)).toHaveLength(2);
    await g(page, 'saveState()');
    expect(await log(page)).toHaveLength(2);
    // Typed a key at a time: one entry, from what it was before the first key to what it is after the last.
    await g(page, "S.clients[0].notes = 'B'; saveState(); S.clients[0].notes = 'Be'; saveState(); S.clients[0].notes = 'Bes'; saveState()");
    const typed = (await log(page)).filter(x => x.coll === 'clients');
    expect(typed).toHaveLength(1);
    expect(typed[0].fields).toEqual([{ f: 'notes', from: '', to: 'Bes' }]);
    // And typed back to what it was, nothing changed.
    await g(page, "S.clients[0].notes = ''; saveState()");
    expect((await log(page)).filter(x => x.coll === 'clients')).toHaveLength(0);
  });

  test('a secret is said to have changed and never shown', async ({ page }) => {
    await load(page);
    await as(page, 'u-ravi');
    await g(page, "S.users[0].secret = { alg: 'PBKDF2-SHA256', iter: 150000, salt: 'bmV3LXNhbHQtbmV3', hash: 'bmV3LWhhc2gtbmV3', digits: true }; saveState()");
    const e = (await log(page))[0];
    expect(e).toMatchObject({ op: 'change', coll: 'users', rid: 'u-asha', by: 'u-ravi', label: 'Asha · office', fields: [{ f: 'secret', secret: true }] });
    await expect.poll(async () => ((await readStoredState(page)).changeLog || []).length).toBe(1);
    const stored = JSON.stringify((await readStoredState(page)).changeLog);
    for (const s of ['c2FsdC1vbmUtb25l', 'aGFzaC1vbmUtb25l', 'bmV3LXNhbHQtbmV3', 'bmV3LWhhc2gtbmV3', 'PBKDF2']) expect(stored).not.toContain(s);
    await switchTab(page, 'pageHistory');
    await page.locator('#historyToolbar [data-action="invHistoryType"][data-type="change"]').click();
    await expect(page.locator('#historyList [data-ev="chg"]').first()).toContainText('Ravi changed user Asha · office · secret changed');
  });

  test('History → Changes lists the log with names; Who narrows every row that carries a user', async ({ page }) => {
    await load(page);
    // Asha adds a challan by hand; Ravi changes a worker; a change made with no ID.
    await g(page, `S.incomingMaterial.push({ id: 'IM-9', challanNo: '309', challanDate: '${todayIso()}', clientId: 1, clientName: '${CLIENT}', vehicleNo: '',
      items: [{ id: 'IM-9-0', partNumber: 'P1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 12, rate: 13, amount: 156, nosQty: null, invoiced: false, invoiceId: null }],
      receivedDate: '${todayIso()}', notes: '', createdAt: Date.now() }); saveState()`);
    await as(page, 'u-ravi');
    await g(page, "S.staff[0].hourRate = 50; saveState()");
    await as(page, null);
    await g(page, "S.items[0].desc = 'Bracket, zinc'; saveState()");
    expect((await log(page)).map(x => x.by)).toEqual(['u-asha', 'u-ravi', null]);

    await switchTab(page, 'pageHistory');
    const list = page.locator('#historyList');
    // All: the challan's own row says who made it, and its entry is not listed twice.
    const challanRow = list.locator('[data-ev="challan"]').filter({ hasText: 'Challan 309' });
    await expect(challanRow).toContainText('by Asha');
    await expect(list.locator('[data-ev="chg"]').filter({ hasText: 'challan 309' })).toHaveCount(0);
    await expect(list.locator('[data-ev="chg"]').filter({ hasText: 'Ravi changed worker Ramu Kumar · hourRate 47.5 → 50' })).toHaveCount(1);

    // Changes: every entry, each ending in what it did.
    await page.locator('#historyToolbar [data-action="invHistoryType"][data-type="change"]').click();
    const rows = list.locator('[data-ev="chg"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Someone changed item P1 · desc Bracket → Bracket, zinc');
    await expect(rows.nth(1)).toContainText('Ravi changed worker Ramu Kumar');
    await expect(rows.nth(2)).toContainText('Asha added challan 309 · ' + CLIENT);
    await expect(rows.nth(2).locator('.inv-dot-ok')).toHaveText('Added');
    await expect(rows.nth(0).locator('.inv-dot-neutral')).toHaveText('Changed');
    await expect(rows.nth(2)).toContainText('on Office PC');
    // A row whose record is still there opens it.
    await expect(rows.nth(2)).toHaveAttribute('data-action', 'invHistoryJumpChallan');

    // Who: the users, and No ID. The sweep's checks hold on the rows and the filter (P76 walks a book with no IDs).
    const who = page.locator('#historyToolbar select#historyWho');
    await expect(who.locator('option')).toHaveText(['Everyone', 'Asha', 'Ravi', 'No ID']);
    expect(problems([await sweep(page, 'History › Changes')])).toEqual([]);
    await who.selectOption('u-ravi');
    await expect(list.locator('[data-ev="chg"]')).toHaveCount(1);
    await expect(list.locator('[data-ev="chg"]')).toContainText('Ravi changed');
    await page.locator('#historyToolbar select#historyWho').selectOption('_none');
    await expect(list.locator('[data-ev="chg"]')).toHaveCount(1);
    await expect(list.locator('[data-ev="chg"]')).toContainText('Someone changed item P1');
    // Every kind that carries a user: under All, Asha's challan is the event row, by Asha; rows nobody can name go.
    await page.locator('#historyToolbar [data-action="invHistoryType"][data-type="all"]').click();
    await page.locator('#historyToolbar select#historyWho').selectOption('u-asha');
    await expect(list.locator('[data-ev="challan"]')).toHaveCount(1);
    await expect(list.locator('[data-ev="challan"]')).toContainText('by Asha');
    await expect(list.locator('[data-ev="invoice"]')).toHaveCount(0);

    // The CSV carries who and the device.
    const csv: string = await page.evaluate(async () => {
      const w = window as any, orig = URL.createObjectURL;
      let text = '';
      (URL as any).createObjectURL = (b: Blob) => { b.text().then(t => { text = t; }); return 'blob:stub'; };
      try { w.exportHistoryCSV(); } finally { (URL as any).createObjectURL = orig; }
      await new Promise(r => setTimeout(r, 200));
      return text;
    });
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('Timestamp,Dated by,Type,Event,Amount,By,Device');
    expect(lines.some(l => /Challan 309 .*,Asha,Office PC$/.test(l))).toBe(true);
  });

  test('the cap keeps 120 days and 4,000 entries, drops the oldest first and says how many', async ({ page }) => {
    const s: any = book();
    const old = Date.now() - 130 * 86400000, recent = Date.now() - 86400000;
    s.changeLog = [
      ...[0, 1, 2].map(i => ({ id: 'old' + i, at: old + i, by: null, dev: null, op: 'change', coll: 'clients', rid: 1, label: CLIENT, fields: [{ f: 'notes', from: '', to: 'x' + i }] })),
      ...Array.from({ length: 4000 }, (_, i) => ({ id: 'r' + i, at: recent + i, by: null, dev: null, op: 'change', coll: 'items', rid: 1, label: 'P1', fields: [{ f: 'rate', from: i, to: i + 1 }] })),
    ];
    await load(page, s);
    await g(page, "S.clients[0].notes = 'kept'; saveState()");
    const after = await log(page);
    expect(after).toHaveLength(4000);
    expect(after.some(x => /^old/.test(x.id))).toBe(false);
    expect(after.some(x => x.id === 'r0')).toBe(false);
    expect(after[after.length - 1]).toMatchObject({ coll: 'clients', fields: [{ f: 'notes', from: '', to: 'kept' }] });
    expect(await g(page, 'S.changeLogDropped.n')).toBe(4);
    await switchTab(page, 'pageHistory');
    await page.locator('#historyToolbar [data-action="invHistoryType"][data-type="change"]').click();
    await expect(page.locator('#historyList [data-chg-dropped]')).toContainText('4 older changes were dropped to keep the book small');
  });

  test('a book loaded from another window is not logged twice; each window logs its own saves', async ({ page }) => {
    await load(page);
    const b = await page.context().newPage();
    await b.goto('/');
    await waitForBoot(b);
    await as(b, 'u-ravi');
    await g(page, "S.items[0].desc = 'Bracket A'; saveState()");
    await expect.poll(() => g(b, 'S.items[0].desc')).toBe('Bracket A');
    await g(b, "S.items[0].hsn = '998874'; saveState()");
    await expect.poll(async () => ((await readStoredState(page)).changeLog || []).length).toBe(2);
    const stored = (await readStoredState(page)).changeLog;
    expect(stored.map((x: any) => [x.by, x.fields[0].f])).toEqual([['u-asha', 'desc'], ['u-ravi', 'hsn']]);
  });

  test('an import is one line, and the book it brings is where the log starts', async ({ page }) => {
    await load(page);
    const next: any = book();
    next.invoices = [];
    next.changeLog = [{ id: 'CL-from-elsewhere', at: Date.now() - 5000, by: null, dev: null, op: 'add', coll: 'items', rid: 1, label: 'P1', fields: [] }];
    await g(page, `adoptState(${JSON.stringify(next)}); saveState()`);
    const all = await log(page);
    expect(all.map(x => x.id)[0]).toBe('CL-from-elsewhere');
    expect(all).toHaveLength(2);
    expect(all[1]).toMatchObject({ op: 'change', coll: 'book', rid: null, by: 'u-asha', label: 'the whole book, by an import', fields: [{ f: 'invoices', from: 1, to: 0 }] });
  });

  test('an error inside the log is counted and the save goes on', async ({ page }) => {
    await load(page);
    await g(page, "window.__chgCollect = chgCollect; chgCollect = function() { throw new Error('a test fault'); }");
    await g(page, "S.items[0].desc = 'Bracket B'; saveState()");
    await expect.poll(async () => (await readStoredState(page)).items[0].desc).toBe('Bracket B');
    expect(await g(page, '_chgHealth.errors')).toBe(1);
    expect(await g(page, 'chgHealthText()')).toContain('a test fault (the saves went on)');
    // The next save compares from the one that failed, not from before it.
    await g(page, "chgCollect = window.__chgCollect; S.items[0].hsn = '998875'; saveState()");
    expect((await log(page)).map(x => x.fields.map((f: any) => f.f))).toEqual([['hsn']]);
  });
});
