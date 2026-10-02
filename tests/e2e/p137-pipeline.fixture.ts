import { expect, type Page } from '@playwright/test';
import { emptyState, switchTab, todayIso, type SepState } from './fixtures';
import { sweep, type Stop } from './sweep-fixture';

// P137: Office → Pipeline. A made-up book with something at every stage, each around its thresholds: challans open and
// one part-invoiced, invoices created, printed, dispatched and delivered at ages either side of the days set in Settings
// (set here away from the defaults, so a figure that reads them cannot pass on the defaults), one filed and one
// cancelled (neither a stage), and a statement under a debt over 90 days. Every name and figure is made up; every date
// is built from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
/* The 10th of the month before this one: a delivered invoice whose GSTR-1 falls due on the 11th of this month. */
export const lastMonth10 = () => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - 1); d.setDate(10); return iso(d); };
/* A stamp `days` whole days and an hour ago: an invoice that has sat that many days in its state. */
const ago = (days: number) => Date.now() - days * 86400000 - 3600000;

export const CLIENTS = [
  { id: 1, name: 'KAPPA PRESSINGS', rate: 12 },
  { id: 2, name: 'LAMBDA TOOLS', rate: 10 },
  { id: 3, name: 'MU AUTO PARTS', rate: 14 },
];
const addr = { add1: 'Plot 9', add2: 'Test Estate', add3: '', state: 'JHARKHAND', stateCode: '20' };

/* Days set in Settings → Checks & alerts: away from the defaults (1/2, 1/2, 3/7; challans 5). */
export const STATE_CHECK = { createdAmber: 2, createdRed: 4, printedAmber: 1, printedRed: 3, dispatchedAmber: 3, dispatchedRed: 6, fileWarnDays: 3 };
export const CHALLAN_DAYS = 4;

type Line = { partNumber: string; unit: string; qty: number; rate: number; imItemId?: string };
function inv(id: string, n: number, date: string, clientId: number, state: string, lines: Line[], extra: Record<string, unknown> = {}) {
  const c = CLIENTS.find(x => x.id === clientId)!;
  const items = lines.map(l => ({ partNumber: l.partNumber, desc: l.partNumber, hsn: '998873', unit: l.unit, qty: l.qty, rate: l.rate,
    amount: Math.round(l.qty * l.rate * 100) / 100, nosQty: null, ...(l.imItemId ? { imItemId: l.imItemId } : {}) }));
  const taxable = Math.round(items.reduce((t, i) => t + i.amount, 0) * 100) / 100;
  const tax = Math.round(taxable * 0.09 * 100) / 100;
  return {
    id, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), date, status: 'active',
    invoiceState: state, clientId, clientName: c.name, clientGSTIN: '20ABCDE1234F1Z5', gstType: 'intra', clientAddress: addr, items,
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: Math.round((taxable + 2 * tax) * 100) / 100, amountInWords: '', challanNo: '', challanDate: date, poNumber: '', poDate: '',
    despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime(), ...extra,
  };
}
function challan(id: string, no: string, date: string, clientId: number, lines: Array<{ unit: string; qty: number; rate: number; nos?: number }>) {
  const c = CLIENTS.find(x => x.id === clientId)!;
  return {
    id, challanNo: no, challanDate: date, clientId, clientName: c.name, vehicleNo: 'JH 05ZZ 0137',
    items: lines.map((l, i) => ({ id: id + '-' + i, partNumber: 'PART ' + no + '-' + i, desc: 'PART ' + no + '-' + i, hsn: '998873', unit: l.unit,
      qty: l.qty, rate: l.rate, amount: Math.round(l.qty * l.rate * 100) / 100, nosQty: l.nos || null, invoiced: false, invoiceId: null })),
    receivedDate: date, notes: '', createdAt: new Date(date + 'T09:00:00').getTime(),
  };
}

export function pipeState(): SepState {
  const s = emptyState() as any;
  s.clients = CLIENTS.map(c => ({ id: c.id, name: c.name, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND',
    stateCode: '20', add1: 'Plot 9', add2: 'Test Estate', add3: '', address: '', isActive: true, notes: '',
    rates: [{ ratePerKg: c.rate, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }));
  s.invStateCheck = { ...STATE_CHECK };
  s.todoCheck = { challanDays: CHALLAN_DAYS };
  // Awaiting invoice: one fresh, one part-invoiced and one past the amber days (none past the red, twice them).
  s.incomingMaterial = [
    challan('IM-1', '701', dayOff(-1), 1, [{ unit: 'KG', qty: 100, rate: 12 }, { unit: 'KG', qty: 50, rate: 12 }]),
    challan('IM-2', '702', dayOff(-5), 1, [{ unit: 'NOS', qty: 600, rate: 2 }]),
    challan('IM-3', '703', dayOff(-6), 2, [{ unit: 'KG', qty: 80, rate: 10 }]),
    challan('IM-4', '704', dayOff(-12), 3, [{ unit: 'KG', qty: 50, rate: 14 }]),
  ];
  s.invoices = [
    // Filed: the debt over 90 days, and the invoice that billed challan 704 whole. Neither is a stage.
    inv('INV-OLD', 1, dayOff(-100), 3, 'filed', [{ partNumber: 'PART OLD', unit: 'KG', qty: 400, rate: 14 }]),
    inv('INV-F1', 2, dayOff(-11), 3, 'filed', [{ partNumber: 'PART 704-0', unit: 'KG', qty: 50, rate: 14, imItemId: 'IM-4-0' }]),
    // Created: past the red days, at the amber days, and today.
    inv('INV-C1', 3, dayOff(-5), 1, 'created', [{ partNumber: 'PART C1', unit: 'KG', qty: 30, rate: 12 }], { createdAt: ago(5) }),
    inv('INV-C2', 4, dayOff(-2), 2, 'created', [{ partNumber: 'PART C2', unit: 'KG', qty: 25, rate: 10 }], { createdAt: ago(2) }),
    inv('INV-C3', 5, todayIso(), 3, 'created', [{ partNumber: 'PART C3', unit: 'KG', qty: 20, rate: 14 }], { createdAt: ago(0) }),
    // Printed a day ago: amber at one day.
    inv('INV-P2', 6, dayOff(-3), 2, 'printed', [{ partNumber: 'PART P2', unit: 'KG', qty: 40, rate: 10 }], { createdAt: ago(3), printedAt: ago(1) }),
    // Dispatched: two days ago (part of challan 702: 200 of its 600 pieces) and today, both under the amber days.
    inv('INV-P1', 7, dayOff(-4), 1, 'dispatched', [{ partNumber: 'PART 702-0', unit: 'NOS', qty: 200, rate: 2, imItemId: 'IM-2-0' }], { createdAt: ago(4), dispatchedAt: ago(2) }),
    inv('INV-D1', 8, dayOff(-1), 3, 'dispatched', [{ partNumber: 'PART D1', unit: 'KG', qty: 10, rate: 14 }], { createdAt: ago(1), dispatchedAt: ago(0) }),
    // Delivered: last month's (GSTR-1 due the 11th of this month) and this month's.
    inv('INV-L1', 9, lastMonth10(), 1, 'delivered', [{ partNumber: 'PART L1', unit: 'KG', qty: 60, rate: 12 }]),
    inv('INV-L2', 10, todayIso(), 2, 'delivered', [{ partNumber: 'PART L2', unit: 'KG', qty: 15, rate: 10 }]),
    // Cancelled: bills nothing, in no stage.
    inv('INV-X1', 11, dayOff(-7), 1, 'created', [{ partNumber: 'PART X1', unit: 'KG', qty: 99, rate: 12 }], { status: 'cancelled', cancelledAt: ago(6) }),
  ];
  s.invNextNum = 12;
  // A statement from before the book: receivables start at the book's first invoice, 100 days ago, and nothing has been
  // received since, so every client owes all of its invoices.
  const rows = [
    { id: 'R1', date: dayOff(-120), valueDate: dayOff(-120), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 50000, dayIdx: 0 },
    { id: 'R2', date: dayOff(-3), valueDate: dayOff(-3), narration: 'TO SELF', chq: '', dr: 5000, cr: 0, balance: 44999, dayIdx: 0 },
  ];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 'fake.xls', account: '', from: rows[0].date, to: rows[1].date, rows: 2, added: 2, closing: 44999 }],
    parties: {}, opening: {}, gstNotes: {} };
  return s;
}

/* The same book with nothing red anywhere (no invoice past its red days, no GSTR-1 date that can have passed) and nothing
   printed, and no statement: nothing owed can be judged. */
export function pipeStateCalm(): SepState {
  const s = pipeState() as any;
  s.invoices = s.invoices.filter((i: any) => !['INV-C1', 'INV-L1', 'INV-P2'].includes(i.id));
  delete s.bank;
  return s;
}

/* Created and Dispatched each holding `n` invoices more, today's: two lists longer than the screen. */
export function pipeStateLong(n = 60): SepState {
  const s = pipeState() as any;
  for (let k = 0; k < 2 * n; k++) {
    const st = k < n ? 'created' : 'dispatched';
    s.invoices.push(inv('INV-N' + k, 100 + k, todayIso(), 1 + (k % 3), st, [{ partNumber: 'PART N' + k, unit: 'KG', qty: 10 + k, rate: 12 }],
      st === 'created' ? { createdAt: ago(0) } : { createdAt: ago(0), dispatchedAt: ago(0) }));
  }
  s.invNextNum = 100 + 2 * n;
  return s;
}

/* P76's sweep at the pipeline and at every stage's list (the sweep's own walk sees only the stage that opens first). */
export async function sweepStages(page: Page, tag: string, stops: Stop[]) {
  await switchTab(page, 'pagePipeline');
  stops.push(await sweep(page, `${tag} pipeline`));
  const keys = await page.locator('#pagePipeline button[data-pipe-stage]').evaluateAll(els => els.map(e => e.getAttribute('data-pipe-stage')!));
  for (const k of keys) {
    await page.locator(`#pagePipeline button[data-pipe-stage="${k}"]`).click();
    await expect(page.locator(`#pipeList [data-pipe-list="${k}"]`)).toBeVisible();
    stops.push(await sweep(page, `${tag} pipeline › ${k}`));
  }
}
