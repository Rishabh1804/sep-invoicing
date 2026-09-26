import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P65: Staff and Stock open on an Overview (docs/FINANCE_INTELLIGENCE_SPEC.md, 7a and 7b). Every date is built from
// today; names and figures are made up.

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ym = (k: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const sunday = (iso: string) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - d.getDay()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const A = { id: 1, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true };
const B = { id: 2, name: 'Gita Devi', comp: 'monthly', dayRate: 400, hourRate: 0, area: 'vat-a2', onFloor: true, active: true };

function staffState(): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.staff = [A, B];
  // Two full pay weeks recorded (three and one weeks back), the week between typed by nobody.
  const att: any = {}, thisWeek = sunday(todayIso());
  [-21, -7].forEach(off => {
    for (let k = 1; k <= 6; k++) {
      const iso = addDays(addDays(thisWeek, off), k);
      att[iso] = { marks: { 1: { st: 'P', ot: k === 1 ? 2 : 0, hours: k === 1 ? 10 : 8, area: 'vat-a1' }, 2: { st: 'P', ot: 0, hours: 8, area: 'vat-a2' } }, extra: [], note: '' };
    }
  });
  s.attendance = att;
  // The slip for two months back, and the bank paying Ramu ₹500 more than it.
  s.payrollPaid = [{ id: 'PP1', month: ym(-2), status: 'paid', at: 1, rows: [{ name: 'RAMU KUMAR', paid: 12000, dayPay: 12000, ot: 0 }] }];
  const rows = [
    { id: 'R1', date: ym(-3) + '-01', valueDate: ym(-3) + '-01', narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 90000, dayIdx: 0 },
    { id: 'R2', date: ym(-1) + '-14', valueDate: ym(-1) + '-14', narration: 'NEFT-RAMU KUMAR', chq: '', dr: 12500, cr: 0, balance: 80000, dayIdx: 0, set: { cat: 'wages', staffId: 1 } },
    { id: 'R3', date: day(-1), valueDate: day(-1), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 79999, dayIdx: 0 }];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[2].date, rows: 3, added: 3, closing: 79999 }], parties: {}, opening: {}, gstNotes: {} };
  return s;
}

function stockState(): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  const entries: any[] = [
    { id: 'c1', itemId: 'N', kind: 'count', qty: 20, date: day(-7), at: 1 },
    { id: 'b1', itemId: 'N', kind: 'bill', qty: 50, price: 150, date: day(-40), billDate: day(-40), supplier: 'Alpha', billNo: 'A1', at: 1 },
    { id: 'b2', itemId: 'N', kind: 'bill', qty: 50, price: 165, date: day(-20), billDate: day(-20), supplier: 'Alpha', billNo: 'A2', at: 1 },
    { id: 'b3', itemId: 'Z', kind: 'bill', qty: 100, price: 300, date: day(-30), billDate: day(-30), supplier: 'Beta', billNo: 'B1', at: 1 },
    { id: 'c2', itemId: 'Z', kind: 'count', qty: 500, date: day(-7), at: 1 }];
  for (let k = 6; k >= 1; k--) {
    entries.push({ id: 'u' + k, itemId: 'N', kind: 'used', qty: 3, date: day(-k), at: 2 });
    entries.push({ id: 'z' + k, itemId: 'Z', kind: 'used', qty: 2, date: day(-k), at: 2 });
  }
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }, { id: 'Z', name: 'Caustic soda', key: 'CAUSTIC', unit: 'kg', active: true }], entries, pastes: [] };
  return s;
}

test('Staff opens on Overview; the quick action still opens the Day', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await switchTab(page, 'pageStaff');
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'overview');
  await expect(page.locator('#dashStaffToday')).toBeVisible();
  await page.locator('[data-action="invDashOpenDay"]').click();
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'day');
  await switchTab(page, 'pageHome');
  await page.locator('[data-action="invHomeQuick"][data-go="attendance"]').click();
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'day');
});

test('Staff overview: a week nobody typed is a gap, OT sits in its area, and payroll meets the bank', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await switchTab(page, 'pageStaff');
  const weeks = await ev(page, `dashAttendanceByWeek(4).map(function(w) { return w.pct; })`) as any[];
  // Three weeks back full, two back nobody, last week full, this week so far: whatever today holds.
  expect(weeks.slice(0, 3)).toEqual([100, null, 100]);
  await expect(page.locator('#dashAttWeeks .inv-chart-pt[data-read*="100.0%"]')).toHaveCount(2);
  const ot = await ev(page, `areaHoursForRange(attAddDays(attWeekStartOf(localDateStr()), -21), localDateStr()).rows.find(function(r) { return r.id === 'vat-a1'; }).ot`);
  expect(ot).toBe(4);   // two recorded weeks inside the four, two hours each
  await expect(page.locator('#dashAreaHours .inv-chart-seg[data-read*="OT"]').first()).toBeVisible();
  const pb = await ev(page, `dashPayrollVsBank().find(function(x) { return x.month === '${ym(-2)}'; })`);
  expect(pb).toMatchObject({ payroll: 12000, bank: 12500, src: 'slip' });
  await expect(page.locator('#dashStaffRaised')).toContainText('differ from the slip');
});

test('Stock opens on Overview: days left opens the line, a supplier lists its bills, the price select redraws only its chart', async ({ page }) => {
  await loadAppWithState(page, stockState());
  await switchTab(page, 'pageStock');
  await expect(page.locator('[data-action="invDashStockView"][data-view="overview"]')).toHaveAttribute('aria-selected', 'true');
  const nitric = page.locator('#dashStockDays .inv-chart-ranked-row', { hasText: 'Nitric acid' });
  await expect(nitric.locator('.inv-chart-ranked-fill-danger')).toHaveCount(1);
  await nitric.click();
  await expect(page.locator('#stockContent')).toContainText('Price and pattern');
  await page.locator('[data-action="invStockBack"]').click();
  await page.locator('[data-action="invDashStockView"][data-view="overview"]').click();

  await page.locator('#dashSupplier .inv-chart-legend-row[data-key="Alpha"]').click();
  const list = page.locator('[data-dash-supplier="Alpha"]');
  await expect(list.locator('.inv-row')).toHaveCount(2);
  await expect(list).toContainText('A2');

  await expect(page.locator('#dashUsed')).toContainText('All lines');
  await page.evaluate(() => { document.getElementById('dashSupplier')!.setAttribute('data-mark', '1'); });
  await page.locator('#dashPriceLine').selectOption('Z');
  await expect(page.locator('#dashPriceChart')).toContainText('Caustic soda');
  await expect(page.locator('#dashSupplier')).toHaveAttribute('data-mark', '1');
  // The reorder panel reads the reorder list.
  await expect(page.locator('#dashReorder')).toContainText('Order, with GST');
});
