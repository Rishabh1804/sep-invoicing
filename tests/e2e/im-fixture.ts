import { emptyState, todayIso, recentTs, type SepState } from './fixtures';

// Challans for the IM specs (P55), phone and desktop alike.

const LONG = 'DILIP PRESS METAL & AGROTECH PRIVATE LIMITED';

function challan(id: string, clientId: number, clientName: string, invoiced: boolean, date = todayIso()) {
  return {
    id, challanNo: id.replace('IM-', ''), challanDate: date, clientId, clientName, vehicleNo: 'JH 05AN 0878',
    items: [{ id: `${id}-0`, partNumber: 'P-' + id, desc: 'P-' + id, hsn: '998873', unit: 'KG',
      qty: 100, rate: 13, amount: 1300, nosQty: null, invoiced, invoiceId: invoiced ? 'INV-1' : null }],
    receivedDate: date, notes: '', createdAt: recentTs(),
  };
}

export function imState(): SepState {
  const s = emptyState();
  s.clients = [
    { id: 1, name: LONG, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'BETA', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 5, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ] as never;
  // Invoiced material raised last, so an order by date alone would put it first.
  s.incomingMaterial = [challan('IM-101', 1, LONG, false, '2026-01-05'), challan('IM-102', 2, 'BETA', false),
    challan('IM-103', 1, LONG, true)] as never;
  // A billed line names a real invoice: boot repairs an invoiced line whose invoice is gone.
  s.invoices = [{
    id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: LONG, clientGSTIN: '', clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' }, gstType: 'intra',
    items: [{ partNumber: 'P-IM-103', desc: 'P-IM-103', hsn: '998873', unit: 'KG', qty: 100, rate: 13, amount: 1300, nosQty: null }],
    taxableValue: 1300, cgstPer: 9, cgstAmt: 117, sgstPer: 9, sgstAmt: 117, igstPer: 0, igstAmt: 0, grandTotal: 1534, amountInWords: '',
    challanNo: '103', challanDate: todayIso(), poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
    linkedIMIds: ['IM-103'], createdAt: recentTs(),
  }] as never;
  return s;
}
