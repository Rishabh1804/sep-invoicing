import { emptyState, noSeedIM, todayIso, workingDaysBack, type SepState } from './fixtures';

// P133 (Direction B, step 1; owner, 1 Oct 2026): every question the app answers ends in the moves that answer it.
// A made-up book, every date built from today, with something for each question to act on:
// - ORION CLAMPS, billed by the piece at ₹2/kg, fills 60% of the tonnage, far below any full cost; its two largest parts
//   carry a weight per piece on its card, its third (WASHER 9) does not;
// - VEGA FASTENERS pays ₹40/kg, sent challans every week until 50 days ago and has gone quiet (a phone on its card);
// - LYRA PRESSINGS owes an invoice of 100 days, on a bank statement that reaches back past it (a phone on its card);
// - a stock line out, a power cut today, VAT A1 two hands short of its four on four working days with EXTRA booked,
//   and VEGA's challans waiting to be billed.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };

export const ORION = 'ORION CLAMPS';
export const VEGA = 'VEGA FASTENERS';
export const LYRA = 'LYRA PRESSINGS';
export const LYRA_TEL = 'tel:9835012345';
export const VEGA_TEL = 'tel:9123456789';
/* ORION's kilograms a piece on its card, and what it sent in the last 90 days: 6,060 kg, so 2,020 kg a month. */
export const ORION_KGPC: Record<string, number> = { 'CLAMP 101X50': 0.25, 'BRACKET 77': 0.4 };
export const ORION_MONTH_KG = 2020;

const addr = { add1: 'Plot 9', add2: 'Test Estate', add3: '', state: 'JHARKHAND', stateCode: '20' };

function invoice(n: number, date: string, clientId: number, clientName: string, items: any[]) {
  const taxable = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const tax = Math.round(taxable * 9) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date, status: 'active', invoiceState: 'filed', clientId, clientName, clientGSTIN: '', clientAddress: addr, gstType: 'intra', items,
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: Math.round((taxable + 2 * tax) * 100) / 100, amountInWords: '', challanNo: '', challanDate: date, poNumber: '', poDate: '',
    despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime() };
}
const nos = (partNumber: string, qty: number, rate: number) => ({ partNumber, desc: partNumber, hsn: '998873', unit: 'NOS', qty, rate, amount: Math.round(qty * rate * 100) / 100, nosQty: null });
const kg = (partNumber: string, qty: number, rate: number) => ({ partNumber, desc: partNumber, hsn: '998873', unit: 'KG', qty, rate, amount: Math.round(qty * rate * 100) / 100, nosQty: null });

export function adviceState(): SepState {
  const s: any = emptyState();
  s.clients = [
    { id: 1, name: ORION, billingMode: 'piece', gstType: 'intra', gstin: '', address: '', isActive: true, ...addr, mobile: '', phone: '', email: '',
      rates: [{ ratePerKg: 2, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
      pieceRates: [{ partNumber: 'CLAMP 101X50', gauge: '', rate: 0.5, effectiveFrom: '2020-04-01' }, { partNumber: 'BRACKET 77', gauge: '', rate: 0.8, effectiveFrom: '2020-04-01' },
        { partNumber: 'WASHER 9', gauge: '', rate: 0.1, effectiveFrom: '2020-04-01' }],
      pieceWeights: Object.keys(ORION_KGPC).map(p => ({ partNumber: p, gauge: '', kgPerPiece: ORION_KGPC[p], effectiveFrom: '2020-04-01' })) },
    { id: 2, name: VEGA, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, ...addr, mobile: '91234 56789', phone: '', email: '',
      rates: [{ ratePerKg: 40, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 3, name: LYRA, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, ...addr, mobile: '98350 12345', phone: '', email: '',
      rates: [{ ratePerKg: 30, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  s.invoices = [
    // ORION: 6,000 clamps (1,500 kg), 1,250 brackets (500 kg) and 400 washers (20 kg) on each of three invoices: ₹2/kg.
    ...[10, 20, 30].map((d, i) => invoice(1 + i, dayOff(-d), 1, ORION, [nos('CLAMP 101X50', 6000, 0.5), nos('BRACKET 77', 1250, 0.8), nos('WASHER 9', 400, 0.1)])),
    // VEGA: 3,000 kg in the last 90 days, none in the last 30.
    invoice(4, dayOff(-40), 2, VEGA, [kg('FLANGE 12', 1500, 40)]), invoice(5, dayOff(-60), 2, VEGA, [kg('FLANGE 12', 1500, 40)]),
    // LYRA: one invoice of 100 days, never paid.
    invoice(6, dayOff(-100), 3, LYRA, [kg('PLATE 30', 1000, 30)]),
  ];
  s.invNextNum = 7;
  // VEGA's challans, a week apart until 50 days ago, and not invoiced: its rhythm says quiet, and the work waits to be billed.
  s.incomingMaterial = [...noSeedIM(), ...[85, 78, 71, 64, 57, 50].map((d, i) => ({
    id: 'IM-V' + i, challanNo: String(500 + i), challanDate: dayOff(-d), clientId: 2, clientName: VEGA, vehicleNo: '',
    items: [{ id: 'IM-V' + i + '-0', partNumber: 'FLANGE 12', desc: 'FLANGE 12', hsn: '998873', unit: 'KG', qty: 100, rate: 40, amount: 4000, nosQty: null, invoiced: false, invoiceId: null }],
    receivedDate: dayOff(-d), notes: '', createdAt: new Date(dayOff(-d) + 'T09:00:00').getTime() }))];
  // The floor: six hands, VAT A1 needing four and standing two on the last four working days, with 16 h of EXTRA booked to it.
  s.staff = [
    { id: 1, name: 'Arun Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true },
    { id: 2, name: 'Bina Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true },
    { id: 3, name: 'Chetan Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a2', onFloor: true, active: true },
    { id: 4, name: 'Dipa Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a2', onFloor: true, active: true },
    { id: 5, name: 'Esha Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true },
    { id: 6, name: 'Faiz Test', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true },
  ];
  s.areaTargets = { 'vat-a1': 4 };
  s.labour = { extraRate: 47.5, modelPerKg: 3.55 };
  s.attendance = {};
  for (const d of workingDaysBack(4)) {
    const marks: any = {};
    s.staff.forEach((w: any) => { marks[w.id] = { st: 'P', ot: 0, hours: 8, area: w.area }; });
    s.attendance[d] = { marks, extra: [{ area: 'vat-a1', hours: 16 }], note: '' };
  }
  // A stock line counted at 50 L and used 10 L a day to nothing, bought at ₹80/L.
  const used = workingDaysBack(5);
  s.stock = { items: [{ id: 'PA', name: 'Pickling acid', key: 'PICKLING ACID', unit: 'L', active: true }], pastes: [],
    entries: [
      { id: 'pb1', itemId: 'PA', kind: 'bill', qty: 200, price: 80, date: dayOff(-40), billDate: dayOff(-40), supplier: 'Delta Test Chemicals', billNo: 'D1', at: 1 },
      { id: 'pc1', itemId: 'PA', kind: 'count', qty: 50, date: dayOff(-12), at: 1 },
      ...used.map((d, i) => ({ id: 'pu' + i, itemId: 'PA', kind: 'used', qty: 10, date: d, at: 2 })),
    ] };
  // A power cut today.
  s.production = { entries: [{ id: 'PD1', kind: 'downtime', date: todayIso(), time: '10:15', to: '10:45', downtime: { cause: 'power' }, basis: 'hand', src: 'hand', at: 1 }],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  // A statement from 120 days ago: no receipt, so LYRA still owes its invoice of 100 days.
  const rows = [
    { id: 'R1', date: dayOff(-120), valueDate: dayOff(-120), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 500000, dayIdx: 0 },
    { id: 'R2', date: dayOff(-2), valueDate: dayOff(-2), narration: 'TO SELF', chq: '', dr: 5000, cr: 0, balance: 494999, dayIdx: 0 },
  ];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 'fake.xls', account: '', from: rows[0].date, to: rows[1].date, rows: 2, added: 2, closing: 494999 }],
    parties: {}, opening: {}, gstNotes: {} };
  s.quotations = [];
  s.todo = { tasks: [], snoozes: {} };
  return s;
}
