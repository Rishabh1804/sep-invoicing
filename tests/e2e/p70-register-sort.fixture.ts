import { emptyState, noSeedIM, recentTs, todayIso, type SepState } from './fixtures';

// P70: the register sorts by invoice number. Numbers are raised out of order (a
// reissue, a backdated invoice), span two financial years' series, and are
// padded unevenly — 100 must sort after 00099, and 25-26 before 26-27.
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function inv(num: string, series: string, date: string, created: number) {
  return {
    id: 'INV-' + series + num, invoiceNumber: num, displayNumber: 'SEP/' + series + '/' + num,
    date, status: 'active', invoiceState: 'created', clientId: 1, clientName: 'ALPHA FORGINGS', clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' }, gstType: 'intra',
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100, nosQty: null }],
    taxableValue: 100, cgstPer: 9, cgstAmt: 9, sgstPer: 9, sgstAmt: 9, igstPer: 0, igstAmt: 0, grandTotal: 118,
    amountInWords: '', challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
    createdAt: recentTs(created),
  };
}

export function sortState(): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [] }];
  // Raising order (oldest first): 00099, 00101, 100, 25-26's 00950, 00098.
  s.invoices = [
    inv('00099', '26-27', day(3), 5000),
    inv('00101', '26-27', day(1), 4000),
    inv('100', '26-27', day(2), 3000),
    inv('00950', '25-26', day(9), 2000),
    inv('00098', '26-27', day(4), 1000),
  ];
  return s;
}

export const HIGH_FIRST = ['SEP/26-27/00101', 'SEP/26-27/100', 'SEP/26-27/00099', 'SEP/26-27/00098', 'SEP/25-26/00950'];
