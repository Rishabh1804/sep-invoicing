import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { closeFilter, emptyState, loadAppWithState, noSeedIM, openSales, phoneFilter, readStoredState, switchTab, todayIso, toolbarMore } from './fixtures';
import { book as flowBook } from './p204-flow.fixture';
import { PINS, unlock, withUsers } from './p140-guard.fixture';
import { longBook } from './load-fixture';

// P215: the QA chain on Office and the flow thread (PR 146). Each test fails on the build before its fix: the phone's Invoices
// Filter brought a cleared range back over the month picked; a lone open line's own wanted-by day could be neither changed nor
// taken off, and the badge read a challan's day no open line was held to; a day before the challan came in was saved; a job
// wanted by Saturday read "0 working days late" on the Sunday; Floor's Turnaround was amber however far past; an invoice past
// its terms was red while a receipt was unplaced; Performance set realisation against the cost for a role with no margins, put a
// 1 on a flag that counts nothing and coloured an empty group; the Clients card counted a client once a challan; Parts counted
// parts billed by the kilo as wanting a weight, and its Derive weights ran another tool; a challan dated ahead read "received
// today"; Pipeline's card kept this year in its words; the Quotations card ignored the reprice moves it holds. Made-up names and
// figures; every date from today, or the clock is set.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const monthBack = (n: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - n); return iso(d).slice(0, 7); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* A day as a row says it: "3 Nov", with its year when the year is not this one (stock.js stockDayLabel). */
const dayLabel = (d: string) => (+d.slice(8)) + ' ' + MON[+d.slice(5, 7) - 1] + (d.slice(0, 4) !== todayIso().slice(0, 4) ? ' ' + d.slice(0, 4) : '');
const toneOf = (cls: string, kind: string) => (new RegExp('inv-' + kind + '-(danger|warning|ok|info|neutral)').exec(cls) || [])[1] || 'neutral';
const tone = (page: Page, sel: string, kind: string) => page.locator(sel).first().evaluate(el => el.className).then(c => toneOf(c, kind));

const NOVA = 'NOVA GEARS', ORION = 'ORION FORGE';
const client = (id: number, name: string, mode = 'weight') => ({ id, name, billingMode: mode, gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 12, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] });
type Line = { part: string; unit?: string; qty: number; priority?: string };
function challan(id: string, clientId: number, name: string, date: string, lines: Line[], extra: Record<string, unknown> = {}) {
  return { id, challanNo: id.replace(/^IM-/, ''), challanDate: date, clientId, clientName: name, vehicleNo: '', receivedDate: date, notes: '', createdAt: 1,
    items: lines.map((l, i) => ({ id: id + '-' + i, partNumber: l.part, desc: l.part, hsn: '998873', unit: l.unit || 'KG', qty: l.qty, rate: 12, amount: l.qty * 12,
      nosQty: null, invoiced: false, invoiceId: null, ...(l.priority ? { priority: l.priority } : {}) })), ...extra };
}
/* An invoice of `qty` kg at ₹12; naming a challan line (`imItemId`) bills it whole. */
function inv(id: string, clientId: number, name: string, date: string, state: string, qty = 100, imItemId?: string) {
  const taxable = qty * 12, tax = Math.round(taxable * 9) / 100;
  return { id, invoiceNumber: id.replace(/\D/g, '').padStart(5, '0'), displayNumber: 'SEP/TEST-' + id.replace(/\D/g, '').padStart(5, '0'), date, status: 'active',
    invoiceState: state, clientId, clientName: name, clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'BRACKET A', desc: 'BRACKET A', hsn: '998873', unit: 'KG', qty, rate: 12, amount: taxable, nosQty: null, ...(imItemId ? { imItemId } : {}) }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: taxable + 2 * tax, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: date, transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime() };
}
function base(): any {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [client(1, NOVA), client(2, ORION)];
  return s;
}
const flowTasks = (page: Page, rule: string) => ev(page, `todoAppAll().filter(function(t) { return t.rule === '${rule}'; }).map(function(t) { return { key: t.key, tone: t.tone, sub: t.sub }; })`) as Promise<any[]>;

test.describe('P215: Office and the flow thread, the QA chain', () => {
  test('Invoices’ phone Filter: a month picked after a range stands when another filter changes, and a range picked after a month', async ({ page }) => {
    const s = base(), thisMonth = todayIso().slice(0, 7), lastMonth = monthBack(1);
    s.invoices = [inv('INV-1', 1, NOVA, thisMonth + '-01', 'created'), inv('INV-2', 1, NOVA, lastMonth + '-15', 'created')];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageRegister');
    const dlg = page.locator('[data-tb-filter-dialog]');
    const set = async (sel: string, v: string) => { const el = dlg.locator(sel); await el.fill(v); await el.dispatchEvent('change'); };
    const row = (id: string) => page.locator(`#pageRegister [data-action="invViewInvoiceDetail"][data-id="${id}"]`);
    await phoneFilter(page);
    // A range in last month, then this month picked: the range goes, from the filter and from its fields in the open dialog.
    await set('#regDateFrom', lastMonth + '-01');
    await set('#regDateTo', lastMonth + '-28');
    await set('#regMonthFilter', thisMonth);
    await expect(dlg.locator('#regDateFrom')).toHaveValue('');
    await expect(dlg.locator('#regDateTo')).toHaveValue('');
    // Another filter changed: the range read back from its fields would win over the month.
    await dlg.locator('#regStateFilter').selectOption('created');
    await closeFilter(page);
    expect(await ev(page, '[regFilter.month, regFilter.dateFrom, regFilter.dateTo]')).toEqual([thisMonth, '', '']);
    await expect(row('INV-1')).toHaveCount(1);
    await expect(row('INV-2')).toHaveCount(0);
    await expect(page.locator('#pageRegister .inv-tokens')).toContainText('Month');
    await expect(page.locator('#pageRegister .inv-tokens')).not.toContainText('Range');
    // The other way: a range picked after the month stands, and the month does not come back from its field.
    await phoneFilter(page);
    await set('#regDateFrom', lastMonth + '-01');
    await expect(dlg.locator('#regMonthFilter')).toHaveValue('');
    await set('#regDateTo', lastMonth + '-28');
    await dlg.locator('#regStateFilter').selectOption('');
    await closeFilter(page);
    expect(await ev(page, '[regFilter.month, regFilter.dateFrom, regFilter.dateTo]')).toEqual(['', lastMonth + '-01', lastMonth + '-28']);
    await expect(row('INV-2')).toHaveCount(1);
    await expect(row('INV-1')).toHaveCount(0);
  });

  test('Wanted by: a lone open line’s own day is drawn, so it can be changed and taken off', async ({ page }) => {
    const s = base();
    // Line 0 is invoiced whole; line 1, the only one open, is wanted by a day of its own.
    s.incomingMaterial = [challan('IM-1', 1, NOVA, day(-1), [{ part: 'BRACKET A', qty: 100 }, { part: 'BRACKET B', qty: 50, priority: day(2) }])];
    s.invoices = [inv('INV-1', 1, NOVA, day(-1), 'dispatched', 100, 'IM-1-0')];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await expect(page.locator('[data-im="IM-1"] [data-flow-wanted]')).toHaveAttribute('data-flow-wanted', day(2));
    await page.locator('[data-action="invToggleIM"][data-id="IM-1"]').click();
    await page.locator('[data-action="invFlowPrio"][data-id="IM-1"]').click();
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog').last();
    const own = dlg.locator('[data-flow-prio="IM-1-1"]');
    await expect(own).toHaveValue(day(2));
    // Taken off: nothing is wanted any more.
    await own.fill('');
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect.poll(async () => (await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-1').items[1].priority).toBeUndefined();
    await expect(page.locator('[data-im="IM-1"] [data-flow-wanted]')).toHaveCount(0);
  });

  test('Wanted by: the badge reads each open line’s own day, else the challan’s, as the task does', async ({ page }) => {
    const s = base();
    // The challan was wanted yesterday, but both open lines have later days of their own, which win.
    s.incomingMaterial = [challan('IM-2', 1, NOVA, day(-3), [{ part: 'BRACKET A', qty: 10, priority: day(3) }, { part: 'BRACKET B', qty: 20, priority: day(5) }], { priority: day(-1) })];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    const badge = page.locator('[data-im="IM-2"] [data-flow-wanted]');
    await expect(badge).toHaveAttribute('data-flow-wanted', day(3));
    expect(await tone(page, '[data-im="IM-2"] [data-flow-wanted]', 'badge')).toBe('info');
    // And nothing is asked of it today.
    expect(await flowTasks(page, 'flowPriority')).toEqual([]);
  });

  test('Wanted by: a day before the challan came in is refused for a line in the dialog, as for the whole challan', async ({ page }) => {
    const s = base();
    s.incomingMaterial = [challan('IM-4', 1, NOVA, day(-2), [{ part: 'BRACKET A', qty: 10 }, { part: 'BRACKET B', qty: 20 }])];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    // A line's day is held to it as the whole challan's is: refused, said, the dialog left open and nothing saved.
    await page.locator('[data-action="invToggleIM"][data-id="IM-4"]').click();
    await page.locator('[data-action="invFlowPrio"][data-id="IM-4"]').click();
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog').last();
    await dlg.locator('[data-flow-prio="IM-4-0"]').fill(day(-5));
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('A line wanted a day before the challan came in');
    await expect(dlg).toBeVisible();
    expect((await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-4').items[0].priority).toBeUndefined();
  });

  test('Wanted by: a day before the challan came in is refused on the challan form', async ({ page }) => {
    const s = base();
    s.incomingMaterial = [challan('IM-3', 1, NOVA, day(-2), [{ part: 'BRACKET A', qty: 10 }])];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invToggleIM"][data-id="IM-3"]').click();
    await page.locator('[data-action="invEditChallan"][data-id="IM-3"]').click();
    await page.locator('#imWantedBy').fill(day(-5));
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Wanted by a day before the challan came in');
    expect((await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-3').priority).toBeUndefined();
  });

  test('Wanted by Saturday, read on the Sunday: red, and never "0 working days late"', async ({ page }) => {
    // Sunday 18 Oct 2026; the challan came in on the Friday and was wanted by the Saturday.
    await page.clock.install({ time: new Date('2026-10-18T11:00:00+05:30') });
    const s = base();
    s.incomingMaterial = [challan('IM-5', 1, NOVA, '2026-10-16', [{ part: 'BRACKET A', qty: 10 }], { priority: '2026-10-17' })];
    await loadAppWithState(page, s);
    expect(await flowTasks(page, 'flowPriority')).toEqual([{ key: 'flowPriority:IM-5', tone: 'red', sub: '1 line with no plating recorded' }]);
  });

  test('Floor’s Turnaround: a line more than two working days past its target is red, the card and its row, as the task reads it', async ({ page }) => {
    await loadAppWithState(page, flowBook());
    // The book's challan 104 is four working days past its one-day target: its task is red.
    expect((await flowTasks(page, 'flowLate')).find(t => t.key === 'flowLate:11').tone).toBe('red');
    await switchTab(page, 'pageFloor');
    const hero = '#flrHeroes > [data-card="flr-flow"]';
    expect(await tone(page, hero, 'hero')).toBe('danger');
    await page.locator(hero + ' > summary').click();
    expect(await tone(page, hero + ' [data-flow-late] .inv-dot', 'dot')).toBe('danger');
  });

  test('A client’s page: an invoice past its terms is amber, not red, while a receipt is unplaced', async ({ page }) => {
    const s: any = flowBook();
    s.bank.rows.push({ id: 'BK-LOOSE', date: day(-3), valueDate: day(-3), narration: 'NEFT-UNKNOWN PAYER', chq: '', dr: 0, cr: 5000, balance: 105000, dayIdx: 99,
      importId: 'BI-F', set: { cat: 'receipt' } });
    await loadAppWithState(page, s);
    expect(await ev(page, 'finCtx().loose()')).toBeGreaterThan(0);
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invEditClient"][data-id="11"]').click();
    const past = page.locator('[data-client-flow="11"] [data-flow-invoice="INV-91"]');
    await expect(past).toHaveAttribute('data-flow-pay', 'past');
    await expect(past.locator('.inv-row-end')).toHaveText('Past terms');
    expect(await tone(page, '[data-client-flow="11"] [data-flow-invoice="INV-91"] .inv-dot', 'dot')).toBe('warning');
  });

  test('Performance: a role with no margins sees realisation with no cost against it; the owner sees the cost', async ({ page }) => {
    const s = base(), thisMonth = todayIso().slice(0, 7);
    s.invoices = [inv('INV-1', 1, NOVA, thisMonth + '-01', 'dispatched', 100), inv('INV-2', 1, NOVA, monthBack(1) + '-10', 'filed', 50)];
    await loadAppWithState(page, s);
    const open = async () => {
      await switchTab(page, 'pageClients');
      await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
      await page.locator('#cpClientSelect').selectOption('1');
    };
    const real = page.locator('#clientPerfArea [data-cp-trend] .inv-tile').filter({ hasText: 'Realisation' });
    await open();
    await expect(page.locator('#cpVerdict .inv-hero-title')).toContainText(' cost');
    await expect(real).toContainText('cost');
    // Office: invoices and clients, "no wages, bank or margins" (docs/GUARD.md).
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await open();
    await expect(page.locator('#cpVerdict .inv-hero-title')).toContainText('/kg');
    await expect(page.locator('#cpVerdict .inv-hero-title')).not.toContainText('cost');
    await expect(real).toContainText('/kg');
    await expect(real).not.toContainText('cost');
    expect(await real.evaluate(el => el.querySelector('.inv-fig-ok, .inv-fig-warning, .inv-fig-danger') !== null)).toBe(false);
  });

  test('Performance → By the hour: a role with no margins reads each round’s earnings with no hour’s cost against them', async ({ page }) => {
    const s = base(), thisMonth = todayIso().slice(0, 7);
    s.invoices = [inv('INV-1', 1, NOVA, thisMonth + '-01', 'dispatched', 100), inv('INV-2', 1, NOVA, monthBack(1) + '-10', 'filed', 50)];
    // A part's round set on the client, so By the hour is drawn.
    s.clients[0].partTimes = [{ id: 'PT-1', base: 'BRACKET A', gauge: '', name: 'BRACKET A', line: 'vat-a2', pieces: 50, pickleMin: 10, plateMin: 30, at: 1 }];
    await loadAppWithState(page, s);
    const open = async () => {
      await switchTab(page, 'pageClients');
      await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
      await page.locator('#cpClientSelect').selectOption('1');
    };
    const hours = page.locator('#clientPerfArea [data-card="hours"]');
    await open();
    await expect(hours.locator('[data-cp-hour-ref]')).toContainText('An hour costs the plant');
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await open();
    await expect(hours).toContainText('BRACKET A');
    await expect(hours.locator('[data-cp-hour-ref]')).toHaveCount(0);
    await expect(hours).not.toContainText('costs the plant');
    await expect(hours).not.toContainText('cost about');
  });

  test('Performance: a cadence group with nothing in it is drawn plain; one holding parts keeps its tone', async ({ page }) => {
    const s = base();
    // Parts billed this month only: new, and nothing stopped or steady.
    s.invoices = [inv('INV-1', 1, NOVA, todayIso().slice(0, 7) + '-01', 'dispatched', 100)];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
    await page.locator('#cpClientSelect').selectOption('1');
    const dot = (k: string) => tone(page, `#clientPerfArea details[data-cp-group="${k}"] .inv-dot`, 'dot');
    await expect(page.locator('#clientPerfArea details[data-cp-group="stopped"] .inv-dot')).toHaveText('Stopped · 0');
    expect(await dot('stopped')).toBe('neutral');
    expect(await dot('steady')).toBe('neutral');
    await expect(page.locator('#clientPerfArea details[data-cp-group="new"] .inv-dot')).toHaveText('New · 1');
    expect(await dot('new')).toBe('info');
  });

  test('Performance: a flag’s tile is its amount for a role that sees money, else its count, else a dash, never a 1', async ({ page }) => {
    const s = base(), thisMonth = todayIso().slice(0, 7);
    s.invoices = [inv('INV-1', 1, NOVA, thisMonth + '-01', 'dispatched', 100)];
    // A challan waiting six days (to bill: no amount and no count of its own), and one wanted today, two lines (a count, ₹360).
    s.incomingMaterial = [challan('IM-6', 1, NOVA, day(-6), [{ part: 'BRACKET A', qty: 10 }]),
      challan('IM-7', 1, NOVA, todayIso(), [{ part: 'BRACKET A', qty: 10 }, { part: 'BRACKET B', qty: 20 }], { priority: todayIso() })];
    await loadAppWithState(page, s);
    const open = async () => {
      await switchTab(page, 'pageClients');
      await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
      await page.locator('#cpClientSelect').selectOption('1');
      const v = page.locator('#cpVerdict');
      if (!(await v.evaluate(el => (el as HTMLDetailsElement).open))) await v.locator(':scope > summary').click();
    };
    const fig = (key: string) => page.locator(`#cpVerdict [data-key="${key}"] .inv-tile-value`);
    await open();
    await expect(fig('challan:1')).toHaveText('—');
    await expect(fig('flowPriority:IM-7')).toHaveText('₹360');
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await open();
    await expect(fig('challan:1')).toHaveText('—');
    await expect(fig('flowPriority:IM-7')).toHaveText('2');
    await expect(page.locator('#cpVerdict .inv-tiles')).not.toContainText('₹');
  });

  test('Clients: the card counts each client once a rule (two challans wanted by a day are one client)', async ({ page }) => {
    const s = base();
    // Two challans of one client wanted today: two tasks, one client.
    s.incomingMaterial = [challan('IM-8', 1, NOVA, todayIso(), [{ part: 'BRACKET A', qty: 10 }], { priority: todayIso() }),
      challan('IM-9', 1, NOVA, todayIso(), [{ part: 'BRACKET B', qty: 10 }], { priority: todayIso() })];
    await loadAppWithState(page, s);
    expect((await flowTasks(page, 'flowPriority')).length).toBe(2);
    await switchTab(page, 'pageClients');
    await expect(page.locator('#clientsVerdict .inv-hero-title')).toHaveText('2 clients · 1 wanted by a day');
  });

  test('Clients: the card is drawn again when a client is added or saved, with its flags read again', async ({ page }) => {
    const s = base();
    // A challan six days old, past the one-day turnaround; the unbilled-challan rule is switched off, so it is the one flag.
    s.incomingMaterial = [challan('IM-8', 1, NOVA, day(-6), [{ part: 'BRACKET A', qty: 10 }])];
    s.todoCheck = { challan: false };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageClients');
    const title = page.locator('#clientsVerdict .inv-hero-title'), flag = page.locator('#clientList .inv-row', { hasText: NOVA }).locator('[data-client-flag]');
    await expect(title).toHaveText('2 clients · 1 past turnaround');
    await expect(flag).toHaveAttribute('data-client-flag', 'flowLate');
    await page.locator('[data-action="invAddClient"]').click();
    await page.locator('#ceditName').fill('PAVO TOOLS');
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('#clientList')).toContainText('PAVO TOOLS');
    await expect(title).toHaveText('3 clients · 1 past turnaround');
    // A turnaround of its own saved on the client: the flag it cleared goes from the card and the row.
    await page.locator('[data-action="invEditClient"][data-id="1"]').click();
    await page.locator('#ceditTurn').fill('30');
    await page.locator('[data-action="invSaveClient"][data-mode="edit"]').click();
    await expect(title).toHaveText('3 clients');
    await expect(flag).toHaveCount(0);
  });

  test('Parts: a part billed by the kilo is weighed by its kilos, so it is not counted, listed or marked as wanting a weight', async ({ page }) => {
    const s = base();
    s.items = [{ id: 1, partNumber: 'KILO PART', desc: 'by the kilo', hsn: '998873', unit: 'KG', rate: 12, stdWeightKg: null },
      { id: 2, partNumber: 'PIECE PART', desc: 'by the piece', hsn: '998873', unit: 'NOS', rate: 3, stdWeightKg: 0.25 }];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').click();
    const v = page.locator('#itemsVerdict');
    await expect(v).toHaveAttribute('data-items-noweight', '0');
    await expect(v.locator('.inv-hero-title')).toHaveText('2 parts, every one weighed');
    expect(await tone(page, '#itemsVerdict', 'hero')).toBe('ok');
    await expect(page.locator('[data-item-row="1"]')).not.toContainText('No weight');
    // A part billed by the piece with no weight still is.
    await ev(page, `S.items[1].stdWeightKg = null; saveState(); renderClientsPage()`);
    await expect(v).toHaveAttribute('data-items-noweight', '1');
    await expect(page.locator('[data-item-row="2"]')).toContainText('No weight');
  });

  test('Parts: More → Derive weights fills what a piece client’s rate card allows', async ({ page }) => {
    const s = base();
    s.clients = [{ ...client(1, NOVA, 'piece'), rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2026-04-01' }] }];
    s.items = [{ id: 1, partNumber: 'C-CLAMP 66X42 (UT)', desc: '', gauge: '30X6', hsn: '998873', unit: 'NOS', rate: 0.95, stdWeightKg: null }];
    s.invoices = [{ ...inv('INV-1', 1, NOVA, day(-5), 'dispatched'),
      items: [{ partNumber: 'C-CLAMP 66X42 (UT)', desc: '', hsn: '998873', unit: 'NOS', qty: 100, rate: 0.95, amount: 95, nosQty: null }], taxableValue: 95 }];
    // The pass at the start has run (an item added after it is what the button is for).
    s._deriveWeights1 = true;
    await loadAppWithState(page, s);
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').click();
    await toolbarMore(page, 'Derive weights');
    // 0.95 ÷ 5.40 a kilo.
    await expect.poll(async () => (await readStoredState(page)).items[0].stdWeightKg).toBeCloseTo(0.1759, 4);
  });

  test('A challan dated after today says its date, never "received today": its row, Pipeline’s client and its stage', async ({ page }) => {
    const s = base(), ahead = day(4);
    s.incomingMaterial = [challan('IM-10', 1, NOVA, ahead, [{ part: 'BRACKET A', qty: 10 }])];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    const meta = page.locator('[data-im="IM-10"] .inv-row-meta').first();
    await expect(meta).toContainText('dated ' + dayLabel(ahead));
    await expect(meta).not.toContainText('received today');
    // The status dot's title says it too, never "0 days waiting".
    await expect(page.locator('[data-im="IM-10"] .inv-row-end .inv-dot').first()).toHaveAttribute('title', 'dated ' + dayLabel(ahead));
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('[data-pipe-stage="awaiting"] [data-pipe-word]')).toHaveText('dated ' + dayLabel(ahead));
    await expect(page.locator('[data-pipe-client="1"]')).toContainText('dated ' + dayLabel(ahead));
    await expect(page.locator('[data-pipe-client="1"]')).not.toContainText('received today');
  });

  test('Pipeline’s card says a GSTR-1 day without this year’s number, as its tile does', async ({ page }) => {
    const s = base(), y = todayIso().slice(0, 4), m = +todayIso().slice(5, 7);
    // An invoice whose return falls due this year (the 11th of the month after it): this month's, or November's in December.
    const date = m <= 11 ? todayIso().slice(0, 7) + '-01' : y + '-11-15', due = MON[(m <= 11 ? m : 11) % 12];
    s.incomingMaterial = [challan('IM-11', 1, NOVA, date, [{ part: 'BRACKET A', qty: 100 }])];
    s.invoices = [inv('INV-1', 1, NOVA, date, 'delivered', 100, 'IM-11-0')];
    await loadAppWithState(page, s);
    await switchTab(page, 'pagePipeline');
    const title = page.locator('#pipelineContent [data-verdict] .inv-hero-title');
    await expect(title).toHaveText('1 invoice delivered, to file · GSTR-1 due 11 ' + due);
    await expect(page.locator('[data-pipe-stage="delivered"] [data-pipe-word]')).toContainText('GSTR-1 due 11 ' + due);
  });

  test('Quotations: the card is in the worst tone of the reprice moves it holds', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openSales(page, 'quotes');
    const tones: string[] = await ev(page, 'qtRepriceMoves().map(function(m) { return m.tone; })');
    expect(tones.length).toBeGreaterThan(0);
    expect(await tone(page, '#qtVerdict', 'hero')).toBe(tones.indexOf('red') >= 0 ? 'danger' : 'warning');
  });

  test('The flow thread returns only the fields its screens read', async ({ page }) => {
    await loadAppWithState(page, flowBook());
    const keys = await ev(page, `[Object.keys(flowStats(11)), Object.keys(flowExpectChallan(S.incomingMaterial.find(function(m) { return m.id === 'IM-104'; })))]`) as string[][];
    for (const k of ['since', 'own', 'done']) expect(keys[0]).not.toContain(k);
    for (const k of ['due', 'pace', 'target']) expect(keys[1]).not.toContain(k);
    expect(keys[0]).toEqual(expect.arrayContaining(['lines', 'toPickle', 'toPlate', 'toDespatch', 'usual', 'within', 'terms']));
    expect(keys[1]).toEqual(expect.arrayContaining(['date', 'over', 'late', 'usual', 'usualPlant', 'stage', 'line', 'ahead', 'priority']));
  });
});
