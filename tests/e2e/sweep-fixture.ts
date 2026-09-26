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
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }, { id: 'Z', name: 'Caustic soda', key: 'CAUSTIC', unit: 'kg', active: true }],
    entries: [
      { id: 'c1', itemId: 'N', kind: 'count', qty: 12, date: dayOff(-7), at: 1 },
      { id: 'b1', itemId: 'N', kind: 'bill', qty: 50, price: 150, date: dayOff(-40), billDate: dayOff(-40), supplier: 'Delta Chemicals', billNo: 'A1', at: 1 },
      { id: 'b2', itemId: 'N', kind: 'bill', qty: 50, price: 165, date: dayOff(-20), billDate: dayOff(-20), supplier: 'Delta Chemicals', billNo: 'A2', at: 1 },
      { id: 'c2', itemId: 'Z', kind: 'count', qty: 500, date: dayOff(-7), at: 1 },
      ...[6, 5, 4, 3, 2, 1].flatMap(k => [{ id: 'u' + k, itemId: 'N', kind: 'used', qty: 2, date: dayOff(-k), at: 2 }, { id: 'z' + k, itemId: 'Z', kind: 'used', qty: 3, date: dayOff(-k), at: 2 }]),
    ], pastes: [] };
  const rows = [
    { id: 'R1', date: monthOff(-2, 1), valueDate: monthOff(-2, 1), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 90000, dayIdx: 0 },
    { id: 'R2', date: monthOff(-1, 14), valueDate: monthOff(-1, 14), narration: 'NEFT-RAMU KUMAR', chq: '', dr: 12500, cr: 0, balance: 77499, dayIdx: 0, set: { cat: 'wages', staffId: 1 } },
    { id: 'R3', date: monthOff(-1, 18), valueDate: monthOff(-1, 18), narration: 'BY INST 525428 CLG', chq: '525428', dr: 0, cr: 25000, balance: 102499, dayIdx: 0 },
    { id: 'R4', date: dayOff(-2), valueDate: dayOff(-2), narration: 'NEFT-ALPHA FORGINGS PRIVATE LIMITED', chq: '', dr: 0, cr: 30000, balance: 132499, dayIdx: 0 },
    { id: 'R5', date: dayOff(-1), valueDate: dayOff(-1), narration: 'TO SELF', chq: '', dr: 20000, cr: 0, balance: 112499, dayIdx: 0 }];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 'fake.xls', account: '', from: rows[0].date, to: rows[4].date, rows: 5, added: 5, closing: 112499 }],
    parties: {}, opening: {}, gstNotes: {} };
  s.todo = { tasks: [
    { id: 'T1', text: 'Call Beta about the June payment', due: dayOff(-1), note: '', link: null, createdAt: recentTs(), doneAt: null },
    { id: 'T2', text: 'Order nitric acid', due: '', note: '', link: null, createdAt: recentTs(), doneAt: null },
    { id: 'T3', text: 'File the monthly return', due: '', note: '', link: null, createdAt: recentTs(), doneAt: Date.now() }], snoozes: {} };
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

export type Stop = { where: string; v1: string[]; unstyled: string[]; selectAction: number; dupIds: string[]; blank: boolean; footNotLast: number; primaries: string[]; overflowX: number };

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

export const PAGES = ['pageHome', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pageTodo', 'pageFinance', 'pageStock', 'pageStaff', 'pageStats', 'pageHistory'];

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

export function problems(stops: Stop[]) {
  return stops.filter(s => s.v1.length || s.unstyled.length || s.selectAction || s.dupIds.length || s.blank || s.footNotLast || s.primaries.length > 1 || s.overflowX > 0)
    .map(s => `${s.where}: ${JSON.stringify({ v1: s.v1, unstyled: s.unstyled, selectAction: s.selectAction, dupIds: s.dupIds, blank: s.blank, footNotLast: s.footNotLast, primaries: s.primaries.length > 1 ? s.primaries : [], overflowX: s.overflowX })}`);
}
