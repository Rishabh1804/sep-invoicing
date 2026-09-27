import { emptyState, todayIso, recentTs, type SepState } from './fixtures';

// P77: a challan invoiced in parts (owner, 26 Sep 2026: "Samarth Engg sends 600 nos of an
// item ... we dispatch 200 in one day, then 300 and then 100"). Made-up client and parts.

export const SAMARTH = 'SAMARTH TEST ENGG';

const addr = { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' };

export function partState(): SepState {
  const s = emptyState();
  s.clients = [
    { id: 1, name: SAMARTH, billingMode: 'piece', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 14.5, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'KG TEST WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ] as never;
  s.incomingMaterial = [
    { id: 'IM-301', challanNo: '301', challanDate: todayIso(), clientId: 1, clientName: SAMARTH, vehicleNo: 'JH 05ZZ 0001',
      items: [{ id: 'IM-301-0', partNumber: 'TEST BRACKET 77', desc: 'TEST BRACKET 77', hsn: '998873', unit: 'NOS',
        qty: 600, rate: 2.5, amount: 1500, nosQty: null, invoiced: false, invoiceId: null }],
      receivedDate: todayIso(), notes: '', createdAt: recentTs() },
    { id: 'IM-401', challanNo: '401', challanDate: todayIso(), clientId: 2, clientName: 'KG TEST WORKS', vehicleNo: '',
      items: [{ id: 'IM-401-0', partNumber: 'TEST PLATE 40', desc: 'TEST PLATE 40', hsn: '998873', unit: 'KG',
        qty: 100, rate: 13, amount: 1300, nosQty: 400, invoiced: false, invoiceId: null }],
      receivedDate: todayIso(), notes: '', createdAt: recentTs() },
  ] as never;
  return s;
}

/* An invoice already billing `qty` of challan 301's line. */
export function partInvoice(n: number, qty: number, extra: Record<string, unknown> = {}) {
  const amount = qty * 2.5, tax = Math.round(amount * 9) / 100;
  return {
    id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: SAMARTH, clientGSTIN: '',
    clientAddress: addr, gstType: 'intra',
    items: [{ partNumber: 'TEST BRACKET 77', desc: 'TEST BRACKET 77', hsn: '998873', unit: 'NOS', qty, rate: 2.5, amount,
      nosQty: null, imItemId: 'IM-301-0' }],
    taxableValue: amount, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: amount + 2 * tax, amountInWords: '', challanNo: '301', challanDate: todayIso(), poNumber: '', poDate: '',
    despatchDate: '', transport: '', remarks: '', linkedIMIds: ['IM-301'], createdAt: recentTs(10 - n), updatedAt: recentTs(),
    ...extra,
  };
}

/* The state with invoices for the given quantities already raised (the sync derives the rest at boot). */
export function partStateBilled(...qtys: number[]): SepState {
  const s = partState();
  s.invoices = qtys.map((q, i) => partInvoice(i + 1, q)) as never;
  s.invNextNum = qtys.length + 1;
  return s;
}
