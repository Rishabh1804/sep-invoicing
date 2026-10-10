import type { Page } from '@playwright/test';
import { emptyState, recentTs, todayIso, workingDaysBack } from './fixtures';

// P204's book, shared by the phone and desktop specs (docs/ENTRY_FACES.md §5, the flow thread). Made-up names and figures; every
// date from today.

export const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
export const T = todayIso();
// wd[n]: the working day n working days before today (wd[0] is today, or Saturday on a Sunday); flow.js counts working days after a
// challan's day up to today, Sundays out.
export const wd = workingDaysBack(12);
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const day = (n: number) => addDays(T, n);
export const addWd = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n--; } return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const short = (iso: string) => (+iso.slice(8)) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+iso.slice(5, 7) - 1];

export const NOVA = 'NOVA CLAMPS', ORBIT = 'ORBIT ENGG', KAPPA = 'KAPPA MEHTA WORKS';
const client = (id: number, name: string, mode = 'weight') => ({ id, name, billingMode: mode, gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] });
function challan(id: string, clientId: number, name: string, date: string, lines: [string, string, number, number][]) {
  return { id, challanNo: id.replace('IM-', ''), challanDate: date, clientId, clientName: name, vehicleNo: '',
    items: lines.map(([part, unit, qty, amount], i) => ({ id: id + '-' + i, partNumber: part, desc: part, hsn: '998873', unit, qty, rate: amount / qty, amount, nosQty: null, invoiced: false, invoiceId: null })),
    receivedDate: date, notes: '', createdAt: recentTs() };
}
function inv(id: string, clientId: number, name: string, date: string, taxable: number, line?: [string, string, number]) {
  const tax = Math.round(taxable * 9) / 100;
  return { id, invoiceNumber: id.replace(/\D/g, '').padStart(5, '0'), displayNumber: 'T/' + id, date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: name, clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    // A line naming its challan line bills it whole (the same quantity), so the challan reads invoiced on that day.
    items: [{ partNumber: line ? line[1] : 'P', desc: line ? line[1] : 'P', hsn: '998873', unit: 'KG', qty: line ? line[2] : 1, rate: line ? taxable / line[2] : taxable, amount: taxable, nosQty: null, ...(line ? { imItemId: line[0] } : {}) }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: taxable + 2 * tax, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: date, transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs() };
}
let seq = 0;
const row = (date: string, narration: string, dr: number, cr: number, set?: any) => ({ id: 'BK-F' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: seq, importId: 'BI-F', ...(set ? { set } : {}) });

export function book() {
  seq = 0;
  const s: any = emptyState();
  s.clients = [client(11, NOVA), client(12, ORBIT, 'piece'), client(13, KAPPA)];
  s.incomingMaterial = [
    // Despatched: the same day, the next working day and three working days on; ₹1,000, ₹2,000 and ₹6,000.
    challan('IM-101', 11, NOVA, wd[10], [['BRACKET 1', 'KG', 100, 1000]]),
    challan('IM-102', 11, NOVA, wd[9], [['BRACKET 2', 'KG', 100, 2000]]),
    challan('IM-103', 11, NOVA, wd[8], [['BRACKET 3', 'KG', 300, 6000]]),
    // Open: five working days old (one line pickled the day after, one with no record), and today's.
    challan('IM-104', 11, NOVA, wd[5], [['BRACKET 7', 'KG', 50, 600], ['BRACKET 8', 'KG', 20, 240]]),
    challan('IM-105', 11, NOVA, T, [['BRACKET 9', 'KG', 10, 120]]),
    // Open two working days: one past the plant's one-day target.
    challan('IM-201', 12, ORBIT, wd[2], [['TINA 3302', 'NOS', 300, 900]]),
  ];
  s.invoices = [
    inv('INV-1', 11, NOVA, wd[10], 1000, ['IM-101-0', 'BRACKET 1', 100]), inv('INV-2', 11, NOVA, wd[8], 2000, ['IM-102-0', 'BRACKET 2', 100]),
    inv('INV-3', 11, NOVA, wd[5], 6000, ['IM-103-0', 'BRACKET 3', 300]),
    // Paid in 20 days; past the 45-day terms; slower than the 20 days its client pays in, within its terms.
    inv('INV-90', 11, NOVA, day(-60), 10000), inv('INV-91', 11, NOVA, day(-50), 5000), inv('INV-92', 11, NOVA, day(-25), 1000),
    // Past the 7-day terms the rebate buys; within the plant's 45.
    inv('INV-93', 13, KAPPA, day(-10), 2000), inv('INV-94', 12, ORBIT, day(-30), 1000),
  ];
  s.invNextNum = 100;
  s.production = { entries: [{ id: 'PK1', kind: 'pickled', date: wd[4], time: '09:00', clientId: 11, client: NOVA, part: 'BRACKET 7', qty: 50, unit: 'KG', basis: 'pickling', src: 'hand', at: 1 }],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  const rows = [row(day(-200), 'SMS CHARGES', 1, 0), row(day(-40), 'NEFT-NOVA CLAMPS', 0, 11800, { cat: 'receipt', clientId: 11 }), row(day(-1), 'SMS CHARGES', 1, 0)];
  s.bank = { rows, imports: [{ id: 'BI-F', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {} };
  return s;
}
export const tasks = (page: Page, rule: string) => ev(page, `todoAppAll().filter(function(t) { return t.rule === '${rule}'; }).map(function(t) { return { key: t.key, tone: t.tone, title: t.title, sub: t.sub, facts: t.facts }; })`) as Promise<any[]>;
export const bust = (page: Page) => ev(page, `_flowMemo = null`);
