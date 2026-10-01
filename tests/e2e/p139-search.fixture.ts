import { type Page, expect } from '@playwright/test';
import { emptyState, recentTs, todayIso } from './fixtures';

// P139's made-up book: three clients, invoices 00834 / 08341 / 00900 / 00901, challans 834 / 8341 / 0877/26-27, a credit note and
// an invoice of 5,902.12, a cheque deposit numbered 525428, a hand, a stock line. Every date is built from today.

const pad = (n: number) => String(n).padStart(2, '0');
export const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

export const CLIENTS = [
  { id: 1, name: 'ALPHA FORGINGS PRIVATE LIMITED', rate: 13, phone: '0657-2234567', mobile: '9876543210' },
  { id: 2, name: 'BETA AUTO COMPONENTS', rate: 9.5, phone: '', mobile: '' },
  { id: 3, name: 'GAMMA PRESS WORKS', rate: 11, phone: '', mobile: '' },
];

export function inv(id: string, n: number, c: typeof CLIENTS[number], date: string, taxable: number, extra: Record<string, unknown> = {}) {
  const tax = Math.round(taxable * 0.09 * 100) / 100;
  return {
    id, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'created',
    clientId: c.id, clientName: c.name, clientGSTIN: '20ABCDE1234F1Z5', gstType: 'intra',
    items: [{ partNumber: 'BRKT-1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 10, rate: c.rate, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: Math.round((taxable + 2 * tax) * 100) / 100,
    challanNo: '', challanDate: date, poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime(),
    ...extra,
  };
}
export function challan(id: string, no: string, c: typeof CLIENTS[number], date: string, part = 'CLAMP 66X42') {
  return {
    id, challanNo: no, challanDate: date, clientId: c.id, clientName: c.name, vehicleNo: '',
    items: [{ id: id + '-0', partNumber: part, desc: 'C-Clamp 30X6', hsn: '998873', unit: 'KG', qty: 40, rate: c.rate, amount: 40 * c.rate, nosQty: 150, invoiced: false, invoiceId: null }],
    receivedDate: date, notes: '', createdAt: new Date(date + 'T09:00:00').getTime(),
  };
}

export function searchBook() {
  const s = emptyState() as any;
  s.clients = CLIENTS.map(c => ({ id: c.id, name: c.name, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE123' + c.id + 'F1Z5', state: 'JHARKHAND', stateCode: '20',
    add1: 'Plot ' + c.id, add2: 'Adityapur', add3: '', phone: c.phone, mobile: c.mobile, email: '', isActive: true, notes: '',
    rates: [{ ratePerKg: c.rate, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] }));
  s.items = [
    { id: 1, partNumber: 'CLAMP 66X42', desc: 'C-Clamp', gauge: '30X6', unit: 'NOS', rate: 1.2, hsn: '998873' },
    { id: 2, partNumber: 'BRKT-1', desc: 'Bracket', unit: 'KG', rate: 13, hsn: '998873' },
  ];
  s.invoices = [
    inv('INV-834', 834, CLIENTS[0], dayOff(-2), 1000, { challanNo: '834' }),
    inv('INV-8341', 8341, CLIENTS[1], dayOff(-3), 2000),
    inv('INV-900', 900, CLIENTS[0], dayOff(-1), 5001.80, { grandTotal: 5902.12, poNumber: 'DA1/00877' }),
    inv('INV-901', 901, CLIENTS[2], dayOff(-1), 3000),
  ];
  s.invNextNum = 8342;
  s.incomingMaterial = [
    challan('IM-834', '834', CLIENTS[0], dayOff(-4)),
    challan('IM-8341', '8341', CLIENTS[1], dayOff(-5)),
    challan('IM-877', '0877/26-27', CLIENTS[2], dayOff(-6)),
  ];
  s.creditNotes = [{ id: 'CN7', cnNumber: '007', displayNumber: 'CN/007/26-27', kind: 'rebate', date: dayOff(-3), clientId: 2, clientName: CLIENTS[1].name,
    invoiceIds: ['INV-8341'], invoiceNumbers: ['SEP/TEST-08341'], invoiceDates: [dayOff(-3)], discountPct: 2, batchTaxable: 295106, taxableValue: 5902.12,
    cgstAmt: 531.19, sgstAmt: 531.19, igstAmt: 0, grandTotal: 6964.50, qty: 1092.98, rate: 5.4, status: 'active', gstType: 'intra', createdAt: recentTs() }];
  s.staff = [{ id: 1, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true, relayNames: ['RAMOO'] }];
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true, aliases: ['NITRIK'] }], entries: [], pastes: [] };
  const rows = [
    { id: 'R1', date: dayOff(-6), valueDate: dayOff(-6), narration: 'BY INST 525428 CLG', chq: '525428', dr: 0, cr: 25000, balance: 125000, dayIdx: 0 },
    { id: 'R2', date: dayOff(-2), valueDate: dayOff(-2), narration: 'NEFT-GAMMA PRESS WORKS', chq: '', dr: 0, cr: 10000, balance: 135000, dayIdx: 0 },
    { id: 'R3', date: dayOff(-1), valueDate: dayOff(-1), narration: 'SMS CHARGES', chq: '', dr: 17.7, cr: 0, balance: 134982.3, dayIdx: 0 },
  ];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 'fake.xls', account: '', from: rows[0].date, to: rows[2].date, rows: 3, added: 3, closing: 134982.3 }],
    parties: {}, opening: {}, gstNotes: {} };
  return s;
}

/* The palette, opened the way the phone opens it (the search icon in the top bar); on the desktop by its key. */
export async function openSearch(page: Page) {
  if (await page.locator('body.inv-desktop').count()) await page.keyboard.press('Control+k');
  else await page.locator('.inv-topbar [data-action="invSearchOpen"]:visible').first().click();
  await expect(page.locator('[data-search]')).toBeVisible();
  await expect(page.locator('#srchInput')).toBeFocused();
}
export async function search(page: Page, q: string) {
  await page.locator('#srchInput').fill(q);
}
/* The titles of the results on screen, of one kind (its group) or all. */
export const titles = (page: Page, kind?: string) =>
  page.locator(kind ? `#srchList [role="group"][aria-labelledby="srchG-${kind}"] [role="option"] .inv-row-title` : '#srchList [role="option"] .inv-row-title').allInnerTexts();
