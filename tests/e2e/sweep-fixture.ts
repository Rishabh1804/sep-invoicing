import { expect, type Page } from '@playwright/test';
import { emptyState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// The whole-app sweep for P76 (design system step 4): a book with something on every screen, a walker that opens
// every page, every view tab on it and every dialog, and the checks run at each stop. Every name and figure is
// made up; every date is built from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const monthOff = (k: number, dd: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); d.setDate(dd); return iso(d); };

const CLIENTS = [
  { id: 1, name: 'ALPHA FORGINGS PRIVATE LIMITED', rate: 13 },
  { id: 2, name: 'BETA AUTO COMPONENTS', rate: 9.5 },
  { id: 3, name: 'GAMMA PRESS WORKS', rate: 11 },
];

function inv(n: number, date: string, c: typeof CLIENTS[number], kg: number, state: string, status = 'active') {
  const taxable = Math.round(kg * c.rate * 100) / 100;
  const tax = Math.round(taxable * 0.09 * 100) / 100;
  return {
    id: 'INV-' + n, invoiceNumber: pad(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date, status, invoiceState: state, clientId: c.id, clientName: c.name, clientGSTIN: '20ABCDE1234F1Z5', gstType: 'intra',
    clientAddress: { add1: 'Plot 1', add2: 'Adityapur', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'BRKT-' + (n % 4), desc: 'Bracket ' + (n % 4), hsn: '998873', unit: 'KG', qty: kg, rate: c.rate, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: Math.round((taxable + 2 * tax) * 100) / 100, amountInWords: '',
    challanNo: String(700 + n), challanDate: date, poNumber: 'PO/' + n, poDate: '', despatchDate: '', transport: 'JH 05AN 0878', remarks: '',
    linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime(),
    ...(status === 'cancelled' ? { cancelledAt: recentTs() } : {}),
  };
}

function challan(n: number, c: typeof CLIENTS[number], date: string, invoiced: string | null) {
  return {
    id: 'IM-' + n, challanNo: String(800 + n), challanDate: date, clientId: c.id, clientName: c.name, vehicleNo: 'JH 05AN 0878',
    items: [
      { id: `IM-${n}-0`, partNumber: 'BRKT-' + (n % 4), desc: 'Bracket ' + (n % 4), hsn: '998873', unit: 'KG', qty: 120 + n, rate: c.rate,
        amount: Math.round((120 + n) * c.rate * 100) / 100, nosQty: 400, invoiced: !!invoiced, invoiceId: invoiced },
      { id: `IM-${n}-1`, partNumber: 'CLAMP 66X42', desc: 'C-Clamp 30X6', hsn: '998873', unit: 'KG', qty: 40, rate: c.rate,
        amount: Math.round(40 * c.rate * 100) / 100, nosQty: 150, invoiced: false, invoiceId: null },
    ],
    receivedDate: date, notes: '', createdAt: new Date(date + 'T09:00:00').getTime(),
  };
}

export function sweepState(): SepState {
  const s = emptyState() as any;
  s.clients = CLIENTS.map(c => ({
    id: c.id, name: c.name, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
    add1: 'Plot 1', add2: 'Adityapur', add3: '', address: '', isActive: true, notes: '',
    rates: [{ ratePerKg: c.rate, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [],
  }));
  s.items = [
    { id: 1, partNumber: 'BRKT-0', desc: 'Bracket 0', unit: 'KG', rate: 13, hsn: '998873' },
    { id: 2, partNumber: 'BRKT-1', desc: 'Bracket 1', unit: 'KG', rate: 13, hsn: '998873' },
    { id: 3, partNumber: 'CLAMP 66X42', desc: 'C-Clamp', gauge: '30X6', unit: 'NOS', rate: 1.2, hsn: '998873' },
    { id: 4, partNumber: 'CLAMP 66X42 ', desc: 'C-Clamp', gauge: '30X6', unit: 'NOS', rate: 1.2, hsn: '998873' },
  ];
  // Six months of billing, this month included, one cancelled and one still Created.
  const invoices: any[] = [];
  let n = 1;
  for (let k = -5; k <= 0; k++) {
    CLIENTS.forEach((c, i) => {
      const date = k === 0 ? dayOff(-i) : monthOff(k, 5 + i * 7);
      invoices.push(inv(n, date, c, 800 + 150 * i + 40 * (k + 5), k === 0 ? (i === 0 ? 'created' : 'dispatched') : 'filed', k === -2 && i === 2 ? 'cancelled' : 'active'));
      n++;
    });
  }
  s.invoices = invoices;
  s.invNextNum = n + 1;
  // One number deleted with its reason, one simply missing: the audit has both to show.
  s.voidedNumbers = [{ invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'), date: dayOff(-3),
    clientId: 2, clientName: CLIENTS[1].name, taxableValue: 0, grandTotal: 0, lastState: 'dispatched', wasCancelled: false,
    reason: 'duplicate of an earlier invoice', reserved: true, source: 'deleted', voidedAt: recentTs() }];
  s.invoices = s.invoices.filter((x: any) => x.id !== 'INV-4');
  s.creditNotes = [{ id: 'CN1', cnNumber: '001', displayNumber: 'CN/001/26-27', kind: 'rebate', date: dayOff(-10), clientId: 1, clientName: CLIENTS[0].name,
    invoiceIds: ['INV-1', 'INV-7'], invoiceNumbers: ['SEP/TEST-00001', 'SEP/TEST-00007'], invoiceDates: [invoices[0].date, invoices[6].date],
    discountPct: 2, batchTaxable: 20000, taxableValue: 400, cgstAmt: 36, sgstAmt: 36, igstAmt: 0, grandTotal: 472, qty: 30.77, rate: 13, status: 'active', gstType: 'intra' }];
  s.incomingMaterial = [challan(1, CLIENTS[0], dayOff(-1), null), challan(2, CLIENTS[1], dayOff(-2), null), challan(3, CLIENTS[2], dayOff(-9), null),
    challan(4, CLIENTS[0], dayOff(-12), 'INV-16')];
  // A floor: three hands, two weeks of marks, a booked EXTRA row.
  s.staff = [
    { id: 1, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true },
    { id: 2, name: 'Gita Devi', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a2', onFloor: true, active: true },
    { id: 3, name: 'Sarat Mahato', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true },
  ];
  const att: any = {};
  for (let k = 1; k <= 12; k++) {
    const d = dayOff(-k);
    if (new Date(d + 'T00:00:00').getDay() === 0) continue;
    att[d] = { marks: { 1: { st: 'P', ot: k % 3 ? 0 : 2, hours: k % 3 ? 8 : 10, area: 'vat-a1' }, 2: { st: k === 4 ? 'A' : 'P', ot: 0, hours: 8, area: 'vat-a2' },
      3: { st: k === 5 ? 'H' : 'P', ot: 0, hours: k === 5 ? 4 : 8, area: 'barrel' } }, extra: k === 2 ? [{ area: 'vat-a2', hours: 8, kind: 'general' }] : [], note: '' };
  }
  s.attendance = att;
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }, { id: 'Z', name: 'Caustic soda', key: 'CAUSTIC', unit: 'kg', active: true },
    { id: 'ZN', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', active: true }],
    entries: [
      // Zinc from two suppliers, one bill on a day with no LME kept: the market-against-bills panel with every part drawn.
      { id: 'zb1', itemId: 'ZN', kind: 'bill', qty: 1000, price: 352, date: dayOff(-9), supplier: 'Alpha Metals', billNo: 'AM/1', at: 1 },
      { id: 'zb2', itemId: 'ZN', kind: 'bill', qty: 500, price: 356, date: dayOff(-4), supplier: 'Beta Zinc Traders Private Limited', billNo: 'BZ/1', at: 1 },
      { id: 'zb3', itemId: 'ZN', kind: 'bill', qty: 200, price: 340, date: dayOff(-40), supplier: 'Alpha Metals', billNo: 'AM/0', at: 1 },
      { id: 'c1', itemId: 'N', kind: 'count', qty: 12, date: dayOff(-7), at: 1 },
      { id: 'b1', itemId: 'N', kind: 'bill', qty: 50, price: 150, date: dayOff(-40), billDate: dayOff(-40), supplier: 'Delta Chemicals', billNo: 'A1', at: 1 },
      { id: 'b2', itemId: 'N', kind: 'bill', qty: 50, price: 165, date: dayOff(-20), billDate: dayOff(-20), supplier: 'Delta Chemicals', billNo: 'A2', at: 1 },
      { id: 'c2', itemId: 'Z', kind: 'count', qty: 500, date: dayOff(-7), at: 1 },
      ...[6, 5, 4, 3, 2, 1].flatMap(k => [{ id: 'u' + k, itemId: 'N', kind: 'used', qty: 2, date: dayOff(-k), at: 2 }, { id: 'z' + k, itemId: 'Z', kind: 'used', qty: 3, date: dayOff(-k), at: 2 }]),
    ], pastes: [] };
  // The market on the ten days before today, as Refresh keeps it (INR/kg).
  s.zinc = { ratePerKg: 300, premiumPerKg: 15, upliftPct: 10, basis: 'lme', updatedAt: Date.now(), source: 'metals.dev · metals.zinc',
    lmeHistory: Object.fromEntries([300, 304, 308, 312, 316, 320, 316, 310, 304, 300].map((v, k) => [dayOff(-10 + k), v])) };
  const rows = [
    { id: 'R1', date: monthOff(-2, 1), valueDate: monthOff(-2, 1), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 90000, dayIdx: 0 },
    { id: 'R2', date: monthOff(-1, 14), valueDate: monthOff(-1, 14), narration: 'NEFT-RAMU KUMAR', chq: '', dr: 12500, cr: 0, balance: 77499, dayIdx: 0, set: { cat: 'wages', staffId: 1 } },
    { id: 'R3', date: monthOff(-1, 18), valueDate: monthOff(-1, 18), narration: 'BY INST 525428 CLG', chq: '525428', dr: 0, cr: 25000, balance: 102499, dayIdx: 0 },
    { id: 'R4', date: dayOff(-2), valueDate: dayOff(-2), narration: 'NEFT-ALPHA FORGINGS PRIVATE LIMITED', chq: '', dr: 0, cr: 30000, balance: 132499, dayIdx: 0 },
    { id: 'R5', date: dayOff(-1), valueDate: dayOff(-1), narration: 'TO SELF', chq: '', dr: 20000, cr: 0, balance: 112499, dayIdx: 0 }];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 'fake.xls', account: '', from: rows[0].date, to: rows[4].date, rows: 5, added: 5, closing: 112499 }],
    parties: {}, opening: {}, gstNotes: {} };
  // A floor record: VAT A1 plated from a register photo, a barrel list, pickled loads with no line yet, a power cut.
  const pe: any[] = [];
  for (let k = 1; k <= 6; k++) {
    const d = dayOff(-k);
    if (new Date(d + 'T00:00:00').getDay() === 0) continue;
    pe.push({ id: 'PA' + k, kind: 'plated', date: d, time: '09:20', to: '16:40', slot: 'general', line: 'vat-a1', lineSrc: 'written', clientId: 1, client: 'Alpha',
      part: 'BRKT-1', qty: 110 + k, unit: 'KG', basis: 'register', src: 'photo', at: 1 });
    pe.push({ id: 'PB' + k, kind: 'plated', date: d, slot: 'day', line: 'barrel', lineSrc: 'written', clientId: 2, client: 'Beta auto', part: 'CLAMP 66X42 (30X6)',
      gauge: '30X6', qty: 150, unit: 'NOS', basis: 'relay', src: 'paste', raw: 'Beta auto CLAMP 66X42(30X6)--150 nos', at: 1 });
    pe.push({ id: 'PP' + k, kind: 'pickled', date: d, time: '08:40', clientId: 1, client: 'ALPHA FORGINGS', part: 'BRKT-1', qty: 400, unit: 'NOS',
      basis: 'pickling', src: 'paste', raw: 'BRKT-1--400 nos', at: 1 });
  }
  pe.push({ id: 'PD1', kind: 'downtime', date: dayOff(-2), time: '10:55', to: '11:15', downtime: { cause: 'power' }, basis: 'pickling', src: 'paste', at: 1 });
  pe.push({ id: 'PX1', kind: 'pickled', date: dayOff(-1), time: '10:40', client: 'SIYA ENTERPRISES', part: 'Buckle hook', qty: 200, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 });
  s.production = { entries: pe, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  // Quotations (P131): a draft, a live one and a superseded one, so Clients → Quotations has every group to draw.
  const qt = (id: string, over: any) => ({ id, num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: dayOff(-3), clientId: 1,
    to: { name: CLIENTS[0].name, address: 'Plot 1\nAdityapur', gstin: '20ABCDE1234F1Z5', state: '(20) JHARKHAND', attn: 'The Director' }, intro: 'Further to our discussions.',
    lines: [{ item: 'MOUNT BRACKET', partNumber: 'MB-1', desc: 'Zinc electroplating', basis: 'piece', rate: 12.5, refWeightKg: 0.795, note: '' }],
    gstPct: 18, sac: '998873', transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15, terms: ['Job work.', 'Valid 30 days.'],
    status: 'draft', createdAt: recentTs(), at: recentTs(), ...over });
  s.quotations = [qt('Q1', {}), qt('Q2', { num: 2, fy: '2026-27', displayNumber: 'SEP/QTN/2026-27/002', status: 'issued', issuedAt: recentTs(), clientId: 2, to: { name: CLIENTS[1].name, address: '', gstin: '', state: '', attn: '' } }),
    qt('Q3', { num: 1, fy: '2026-27', displayNumber: 'SEP/QTN/2026-27/001', status: 'superseded', issuedAt: recentTs(), supersededBy: 'Q2', supersededAt: recentTs() })];
  s.todo = { tasks: [
    { id: 'T1', text: 'Call Beta about the June payment', due: dayOff(-1), note: '', link: null, createdAt: recentTs(), doneAt: null },
    { id: 'T2', text: 'Order nitric acid', due: '', note: '', link: null, createdAt: recentTs(), doneAt: null },
    { id: 'T3', text: 'File the monthly return', due: '', note: '', link: null, createdAt: recentTs(), doneAt: Date.now() }], snoozes: {} };
  return s;
}

/* The same book with a client name longer than any real one and one invoice of ₹12,34,56,789.00: the figures and
   names that break a layout at 393px (the polish pass, 27 Sep 2026). */
export function bigSweepState(): SepState {
  const s = sweepState() as any;
  const long = 'ALPHA FORGINGS AND HEAVY ENGINEERING COMPONENTS PRIVATE LIMITED (UNIT II, GAMHARIA)';
  s.clients[0].name = long;
  for (const x of [...s.invoices, ...s.incomingMaterial, ...s.creditNotes]) if (x.clientId === 1) x.clientName = long;
  const big = s.invoices.find((x: any) => x.id === 'INV-16');
  Object.assign(big.items[0], { qty: 9496676.07, amount: 104623430.51 });
  Object.assign(big, { taxableValue: 104623430.51, cgstAmt: 9416108.75, sgstAmt: 9416108.75, grandTotal: 123456789.0 });
  return s;
}

/* A v1.0 class is any the design system retired (§6's "Replaces" lists, and what step 4 removed). */
const V1_PREFIX = ['inv-stk-', 'inv-td-', 'inv-kpi', 'inv-att-', 'inv-stats-', 'inv-overlay-', 'inv-form-', 'inv-card', 'inv-numaudit-',
  'inv-area-', 'inv-lab-', 'inv-pay-', 'inv-rl-', 'inv-client-', 'inv-im-', 'inv-reg-', 'inv-set-', 'inv-cp-', 'inv-confirm-', 'inv-detail-',
  'inv-total', 'inv-svg-', 'inv-text-', 'inv-master', 'inv-rm-', 'inv-zero-', 'inv-pred-', 'inv-ov-', 'inv-more-', 'inv-history-', 'inv-cost-',
  'inv-dupe-', 'inv-quick-', 'inv-header', 'inv-sidebar', 'inv-ac-', 'inv-autocomplete-', 'inv-search-', 'inv-sel-', 'inv-subview-', 'inv-state-',
  'inv-item-', 'inv-items-', 'inv-rate-', 'inv-reissue-', 'inv-merge-', 'inv-weight-', 'inv-desktop-table', 'inv-link-btn', 'inv-checkbox-',
  'inv-check-row', 'inv-empty-state', 'inv-chart-empty', 'inv-fab', 'inv-tabs', 'inv-mono', 'inv-btn-bar', 'inv-line-item', 'inv-selected-client',
  'inv-error', 'inv-kbd-hint', 'inv-diag-', 'inv-sync-', 'inv-zinc-', 'inv-qa', 'inv-unbilled-', 'inv-recent-', 'inv-chip-active', 'inv-flex-',
  'inv-flip-kpi', 'inv-flip-container', 'inv-flip-inner'];
const V1_EXACT = ['inv-tab', 'inv-td', 'inv-th', 'inv-tr', 'inv-detail', 'inv-preview-container', 'inv-trend-svg', 'inv-viewtab-on'];
/* Classes drawn only as hooks for code or tests: no rule styles them, and none is a retired name. */
const HOOKS = ['inv-booted', 'inv-desktop', 'inv-tablet', 'inv-lines', 'inv-navbar-more', 'inv-flip-front', 'inv-row-note', 'inv-build-id',
  'inv-disk-summary', 'inv-save-status'];

export type Stop = { where: string; v1: string[]; unstyled: string[]; selectAction: number; dupIds: string[]; blank: boolean; footNotLast: number; primaries: string[]; overflowX: number;
  offscreen: string[]; smallTargets: string[]; cutFigures: string[]; brokenFigures: string[]; cutMeta: string[]; untitled: string[] };

/* Everything checked at one stop, read from the rendered DOM (the page and whatever dialog is open). */
export async function sweep(page: Page, where: string): Promise<Stop> {
  const r = await page.evaluate(([prefix, exact, hooks]) => {
    const styled = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        const sel = (rule as CSSStyleRule).selectorText;
        if (sel) for (const m of sel.match(/\.inv-[A-Za-z0-9_-]+/g) || []) styled.add(m.slice(1));
        if ((rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules); } catch { /* cross-origin font CSS */ } }
    const used = new Set<string>();
    document.querySelectorAll('[class]').forEach(el => el.classList.forEach(c => { if (c.startsWith('inv-')) used.add(c); }));
    const all = [...used];
    const ids: Record<string, number> = {};
    document.querySelectorAll('[id]').forEach(el => { ids[el.id] = (ids[el.id] || 0) + 1; });
    const active = document.querySelector('.inv-page-active') as HTMLElement | null;
    return {
      v1: all.filter(c => (exact as string[]).includes(c) || (prefix as string[]).some(p => c.startsWith(p))),
      unstyled: all.filter(c => !styled.has(c) && !(hooks as string[]).includes(c) && !/^inv-(pi|qc|cn|sr)-/.test(c)),
      selectAction: document.querySelectorAll('select[data-action]').length,
      dupIds: Object.keys(ids).filter(k => ids[k] > 1),
      blank: !!active && active.innerText.trim().length === 0,
      // A dialog's foot is sticky at its bottom edge, so anything after it would scroll under it.
      // One primary per view (DR-3): the top dialog if one is open, else the page. A folded section's Save is not shown.
      primaries: (() => {
        const dlg = document.querySelectorAll('.inv-scrim-dialog');
        const root = dlg.length ? dlg[dlg.length - 1] : active;
        return root ? Array.from(root.querySelectorAll('.inv-btn-primary')).filter(b => (b as HTMLElement).checkVisibility()).map(b => (b as HTMLElement).innerText.trim()) : [];
      })(),
      // Nothing pushes the page wider than the screen (a long name, a row of controls).
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      footNotLast: Array.from(document.querySelectorAll('.inv-dialog-foot')).filter(f => f.parentElement && f.parentElement.lastElementChild !== f).length,
      // The polish pass (27 Sep 2026). Nothing on the view runs past the screen's right edge unless it sits in a scroller
      // (a wide table, the view tabs): a figure or a name cut off by the glass, not by an ellipsis, says nothing.
      offscreen: (() => {
        const dlg = document.querySelectorAll('.inv-scrim');
        const root = dlg.length ? dlg[dlg.length - 1] : active;
        if (!root) return [];
        const vw = document.documentElement.clientWidth;
        const inScroller = (el: Element) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
        return Array.from(root.querySelectorAll('*')).filter(el => {
          const h = el as HTMLElement;
          if (!h.checkVisibility()) return false;
          const b = h.getBoundingClientRect();
          return b.width > 0 && (b.right > vw + 1 || b.left < -1) && !inScroller(h);
        }).map(el => el.tagName.toLowerCase() + '.' + (el as HTMLElement).className + ' ' + ((el as HTMLElement).innerText || '').trim().slice(0, 40));
      })(),
      // A headline figure is never cut by its box: a tile's value or the action bar's total wraps or takes the row.
      cutFigures: Array.from(document.querySelectorAll('.inv-tile-value, .inv-actionbar-value')).filter(el => {
        const h = el as HTMLElement;
        return h.checkVisibility() && h.clientWidth > 0 && h.scrollWidth > h.clientWidth + 1;
      }).map(el => (el as HTMLElement).innerText.trim()),
      // On the phone every control in the bars, tabs, toolbars, segmented controls, panel heads and dialog feet, every
      // row's tick box and button, and every search field, is a 44px touch target (§3.5).
      smallTargets: document.body.classList.contains('inv-desktop') ? [] : Array.from(document.querySelectorAll(
        ':is(.inv-navbar, .inv-topbar, .inv-viewtabs, .inv-toolbar, .inv-seg, .inv-panel-head, .inv-dialog-foot, .inv-pagehead) :is(button, a[href], select, input:not([type=checkbox]):not([type=radio]):not(.inv-search input)), ' +
        '.inv-row-tick, button.inv-row-main, .inv-search input, summary.inv-panel-head, button.inv-chart-legend-row, .inv-chart-legend-row[data-action]')).filter(el => {
        const h = el as HTMLElement;
        if (!h.checkVisibility()) return false;
        const b = h.getBoundingClientRect();
        return b.width > 0 && b.height < 43.5;
      }).map(el => el.tagName.toLowerCase() + '.' + (el as HTMLElement).className + ' "' + ((el as HTMLElement).innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '" ' + Math.round(el.getBoundingClientRect().height) + 'px'),
      // The open items (27 Sep 2026). A tile's or the action bar's figure breaks only after a comma group, never inside it
      // or its paise: a line may not end in a digit or a point when the next begins with one ("655." / "51").
      brokenFigures: Array.from(document.querySelectorAll('.inv-tile-value, .inv-actionbar-value')).filter(el => (el as HTMLElement).checkVisibility()).flatMap(el => {
        const chars: Array<{ c: string; top: number }> = [];
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) {
          for (let i = 0; i < n.textContent!.length; i++) {
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
            const b = r.getClientRects()[0];
            if (b) chars.push({ c: n.textContent![i], top: Math.round(b.top) });
          }
        }
        const bad: string[] = [];
        for (let i = 1; i < chars.length; i++) {
          if (chars[i].top > chars[i - 1].top + 2 && /[\d.]/.test(chars[i - 1].c) && /[\d.]/.test(chars[i].c)) bad.push((el as HTMLElement).innerText.trim());
        }
        return bad;
      }),
      // On the phone a row's meta line takes up to two lines; none is cut past them on the sweep book (a date or an
      // amount after a long name was the thing hidden).
      cutMeta: document.body.classList.contains('inv-desktop') ? [] : Array.from((() => {
        const dlg = document.querySelectorAll('.inv-scrim');
        const root = dlg.length ? dlg[dlg.length - 1] : active;
        return root ? root.querySelectorAll('.inv-row-meta:not(.inv-row-wrap)') : [];
      })()).filter(el => {
        const h = el as HTMLElement;
        return h.checkVisibility() && h.clientWidth > 0 && (h.scrollHeight > h.clientHeight + 1 || h.scrollWidth > h.clientWidth + 1);
      }).map(el => (el as HTMLElement).innerText.trim().slice(0, 80)),
      // Whatever an ellipsis still cuts carries its full text in a title (§5.3), anywhere on screen.
      untitled: Array.from(document.querySelectorAll('body *')).filter(el => {
        const h = el as HTMLElement;
        if (getComputedStyle(h).textOverflow !== 'ellipsis' || !h.checkVisibility() || !h.clientWidth) return false;
        const cut = h.scrollWidth > h.clientWidth + 1 || h.scrollHeight > h.clientHeight + 1;
        return cut && !h.closest('[title]');
      }).map(el => el.tagName.toLowerCase() + '.' + (el as HTMLElement).className + ' "' + (el as HTMLElement).innerText.trim().slice(0, 50) + '"'),
    };
  }, [V1_PREFIX, V1_EXACT, HOOKS] as const);
  return { where, ...r };
}

export async function shot(page: Page, name: string) {
  const dir = process.env.SEP_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: !(await page.locator('.inv-scrim-dialog').count()) });
}

export const PAGES = ['pageHome', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pageTodo', 'pageFinance', 'pageProduction', 'pagePower', 'pageStock', 'pageStaff', 'pageStats', 'pageReports', 'pageHistory',
  'pageFloor', 'pagePipeline'];

/* Every page, then every view tab on it (re-read after each click, since a tab can redraw the row). */
export async function walkPages(page: Page, tag: string, stops: Stop[]) {
  for (const id of PAGES) {
    await switchTab(page, id);
    stops.push(await sweep(page, id));
    await shot(page, `${tag}-${id}`);
    const tabs = page.locator(`#${id} .inv-viewtab:visible`);
    const n = await tabs.count();
    for (let i = 1; i < n; i++) {
      const t = page.locator(`#${id} .inv-viewtab:visible`).nth(i);
      if (!(await t.count())) break;
      const label = ((await t.innerText()).trim().split('\n')[0] || String(i)).replace(/[^A-Za-z0-9]+/g, '-');
      await t.click();
      await page.waitForTimeout(50);
      stops.push(await sweep(page, `${id} › ${label}`));
      await shot(page, `${tag}-${id}-${label}`);
    }
  }
  await walkProduction(page, tag, stops);
  await walkQuoteForm(page, tag, stops);
  await walkZinc(page, tag, stops);
}

/* Stock → Overview's price trend on Zinc: the market against the bills, which the page opens on another line. Drawn as it
   opens, then with a supplier's bills listed under it. */
export async function walkZinc(page: Page, tag: string, stops: Stop[]) {
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invDashStockView"][data-view="overview"]').first().click();
  await page.locator('#dashPriceLine').selectOption('ZN');
  await expect(page.locator('#dashPrice [data-zinc-suppliers]')).toBeVisible();
  stops.push(await sweep(page, 'pageStock › zinc market'));
  await shot(page, `${tag}-pageStock-zinc`);
  await page.locator('#dashPrice [data-action="invDashZincSupplier"]').first().click();
  await expect(page.locator('#dashPrice [data-zinc-bill]').first()).toBeVisible();
  stops.push(await sweep(page, 'pageStock › zinc market › a supplier open'));
  await shot(page, `${tag}-pageStock-zinc-supplier`);
}

/* Production's sub-views, which no view tab reaches: the paste check (a red row among them), the register photo's
   check (a struck row, a picker) and the form by hand. */
const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
export async function walkProduction(page: Page, tag: string, stops: Stop[]) {
  const d = todayIso().split('-');
  const dmy = `${d[2]}/${d[1]}/${d[0].slice(2)}`;
  const paste = `${dmy}, 9:40 am - Pickler: ALPHA FORGINGS\nBRKT-1--400 nos\nPickling Time 9:00AM\n${dmy}, 11:05 am - Pickler: SIYA ENTERPRISES\nBuckle hook--200 nos\nPickling time 10:40am\n` +
    `${dmy}, 8:21 pm - Supervisor: ${dmy}/berral production\nBeta auto CLAMP 66X42(30X6)--150 nos`;
  const photo = JSON.stringify({ date: dmy, line: null, dayTotal: 999, rows: [
    { time: '9:20', customer: 'Alpha', part: 'BRKT-1', rackSize: 4, rounds: 25, qty: 108 },
    { time: '2:30', customer: 'Unknown works', part: 'CLAMP 66x42', dim: '30x6', qty: 300, struck: true }] });
  const views: Array<[string, string]> = [
    ['paste-check', `prodOpenPaste(${JSON.stringify(paste)})`],
    ['photo-check', `_prodPhoto = { name: 'register.png', bytes: 68, url: '${PNG_URL}', sha: 'sweep', json: ${photo}, meta: {}, choices: {}, photoDate: '${todayIso()}', dupSha: null }; switchTab('pageProduction'); prodSetView('photo')`],
    ['hand', `switchTab('pageProduction'); prodOpenHand(null)`],
  ];
  for (const [name, js] of views) {
    await page.evaluate(src => (0, eval)(src), js);
    await expect(page.locator('#productionContent .inv-pagehead')).toBeVisible();
    stops.push(await sweep(page, 'pageProduction › ' + name));
    await shot(page, `${tag}-pageProduction-${name}`);
    await page.evaluate(() => (0, eval)(`_prodReview = null; _prodPhoto = null; _prodHand = null; prodSetView('main')`));
  }
}

/* Clients → Quotations' form, which no view tab reaches. */
export async function walkQuoteForm(page: Page, tag: string, stops: Stop[]) {
  await page.evaluate(() => (0, eval)(`qtOpenForm('Q1')`));
  await expect(page.locator('#clientsPageContent .inv-pagehead')).toBeVisible();
  stops.push(await sweep(page, 'pageClients › quotation form'));
  await shot(page, `${tag}-pageClients-quote-form`);
  await page.evaluate(() => (0, eval)(`_qtForm = null; _pageTyped = false; setItemsSubView('clients'); renderClientsPage()`));
}

/* Every dialog, opened the way its button does. */
export const DIALOGS: Array<[string, string]> = [
  ['settings', `openSettings()`],
  ['client-add', `openClientAdd()`],
  ['client-edit', `openClientEdit(1)`],
  ['item-edit', `openItemEdit(1)`],
  ['merge', `openMergeTool()`],
  ['part-weights', `openPartWeights()`],
  ['weight-entry', `openWeightEntry()`],
  ['dupe-scan', `runIMDuplicateScan()`],
  ['dupe-warning', `showChallanDuplicateWarning({ content: [S.incomingMaterial[0]], number: [], blankNo: true })`],
  ['number-audit', `showNumberAudit()`],
  ['account-for', `openAccountForNumber('4')`],
  ['credit-notes', `renderCreditNoteList()`],
  ['cn-against', `cnSetAgainstInvoice('CN1')`],
  ['cn-raise', `openCreditNoteForm(['INV-16'])`],
  ['invoice-detail', `openInvoiceDetail('INV-17')`],
  ['invoice-cancel', `cancelInvoice('INV-17')`],
  ['invoice-delete', `deleteInvoice('INV-17')`],
  ['worker-edit', `openWorkerEdit(1)`],
  ['collisions', `showCollisionReport({ collided: 1, fromName: 'Ramu K', intoName: 'Ramu Kumar', collisionDays: ['${todayIso()}'] })`],
  ['stats-drill', `openClientDrillOverlay(1)`],
  ['todo-new', `todoOpenEdit(null)`],
  ['todo-edit', `todoOpenEdit('T1')`],
  // An app task with What you can do (P133): the first the sweep book raises that carries moves.
  ['todo-app-moves', `todoOpenApp((todoAppAll().find(function(t) { return advTaskMoves(t).length; }) || {}).key)`],
  ['add', `addOpen()`],
  // Add with what the clipboard held named under its row (drawn as addClipCheck draws it once the browser hands the text over).
  ['add-clipboard', `addOpen(); (function(t) { var o = document.getElementById('addClipOut'); o.innerHTML = addClipHtml(addDescribe(t), t); o.classList.remove('inv-hidden'); })(${
    JSON.stringify(`${todayIso().split('-').reverse().join('/')}/ camical use\n1) NITRIC 10-2=8 L\n2) ZINC 40-5=35 KG`)})`],
  ['ask-confirm', `uiConfirm({ title: 'Delete this challan?', body: 'Challan 301 from SAMARTH, 2 lines. This cannot be undone.', okLabel: 'Delete challan', danger: true })`],
  ['ask-prompt', `uiPrompt({ title: 'Void this payment', body: 'It is kept on the record, not deleted.', label: 'Why is this payment void?', required: true })`],
  ['ask-alert', `uiAlert({ title: 'Copy the order', body: 'Select the text below and copy it.' })`],
  ['quote-detail', `qtOpen('Q2')`],
  ['quote-draft', `qtOpen('Q1')`],
  ['search', `searchOpen()`],
  ['search-results', `searchOpen('alpha')`],
  ['keys', `srchKeysOpen()`],
  ['more-sheet', `openMoreSheet()`],
];

export async function walkDialogs(page: Page, tag: string, stops: Stop[]) {
  for (const [name, js] of DIALOGS) {
    if (name === 'more-sheet' && await page.locator('body.inv-desktop').count()) continue;
    await page.evaluate(src => { (window as any).closeOverlay(); (window as any).closeSettings?.(); (0, eval)(src); }, js);
    await expect(page.locator('.inv-scrim')).not.toHaveCount(0);
    stops.push(await sweep(page, 'dialog ' + name));
    await shot(page, `${tag}-dialog-${name}`);
    await page.evaluate(() => { (window as any).closeSettings?.(); (window as any).closeOverlay(); (window as any).closeMoreSheet(); });
  }
}

/* `cutMeta: false` for the crore book: its 80-character client name fills a meta line's two lines on a phone by itself,
   and what the clamp cuts there must carry a title (untitled), which is still checked. */
export function problems(stops: Stop[], opts: { cutMeta?: boolean } = {}) {
  const meta = opts.cutMeta !== false;
  return stops.filter(s => s.v1.length || s.unstyled.length || s.selectAction || s.dupIds.length || s.blank || s.footNotLast || s.primaries.length > 1 || s.overflowX > 0 ||
      s.offscreen.length || s.smallTargets.length || s.cutFigures.length || s.brokenFigures.length || (meta && s.cutMeta.length) || s.untitled.length)
    .map(s => `${s.where}: ${JSON.stringify({ v1: s.v1, unstyled: s.unstyled, selectAction: s.selectAction, dupIds: s.dupIds, blank: s.blank, footNotLast: s.footNotLast, primaries: s.primaries.length > 1 ? s.primaries : [], overflowX: s.overflowX,
      offscreen: s.offscreen, smallTargets: s.smallTargets, cutFigures: s.cutFigures, brokenFigures: s.brokenFigures, cutMeta: s.cutMeta, untitled: s.untitled })}`);
}
