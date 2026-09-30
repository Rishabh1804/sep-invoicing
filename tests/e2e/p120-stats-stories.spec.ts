import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, switchTab, todayIso, recentTs, workingDaysBack } from './fixtures';

// P120 (owner, 30 Sep 2026): Stats → Overview opens on the owner's questions, each answered as a story: the figure, one
// sentence saying what it means, a small chart, and the way to the tab with the detail. Made-up names and figures.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(day: string, n: number) { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
/** The month `k` months before this one, YYYY-MM. */
function monthBack(k: number) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return iso(d).slice(0, 7); }
function monthEnd(ym: string) { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); }

type Line = { partNumber: string; desc?: string; unit?: string; qty: number; rate: number };
function kg(partNumber: string, qty: number, rate: number, desc?: string): Line { return { partNumber, desc, qty, rate }; }
function inv(id: string, clientId: number, clientName: string, lines: Line[], date = todayIso(), extra: Record<string, unknown> = {}) {
  const items = lines.map(l => ({ partNumber: l.partNumber, desc: l.desc ?? l.partNumber, hsn: '998873', unit: l.unit || 'KG',
    qty: l.qty, rate: l.rate, amount: Math.round(l.qty * l.rate * 100) / 100, nosQty: null }));
  const taxable = items.reduce((s, i) => s + i.amount, 0);
  return { id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date, status: 'active', invoiceState: 'created',
    clientId, clientName, gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items, taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(), ...extra };
}
function client(id: number, name: string, billingMode = 'weight', ratePerKg = 10) {
  return { id, name, billingMode, gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
}
function base(): any { const s: any = emptyState(); s.incomingMaterial = noSeedIM(); return s; }

test('Overview leads with the questions, each answered in a sentence, before the figures behind them', async ({ page }) => {
  const s = base();
  s.clients = [client(71, 'ALPHA WORKS'), client(72, 'BETA CLAMPS')];
  s.defaultCostPerKg = 10;
  s.invoices = [inv('00001', 71, 'ALPHA WORKS', [kg('BASE PLATE', 3000, 6)]), inv('00002', 72, 'BETA CLAMPS', [kg('CLAMP 165X83', 500, 14, 'CLAMP (40X6)')])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'overview');
  const stories = page.locator('#statsContent [data-story]');
  await expect(stories.first()).toHaveAttribute('data-story', 'money');
  for (const k of ['money', 'clients', 'plant', 'changed']) await expect(page.locator(`[data-story="${k}"]`)).toBeVisible();
  await expect(page.locator('[data-story="money"] [data-story-say]')).toContainText(/every kilo/);
  await expect(page.locator('[data-story="clients"] [data-story-say]').first()).toContainText('ALPHA WORKS fills');
  await expect(page.locator('[data-story="plant"] [data-story-say]')).toContainText(/two shifts/);
  // The stories come before the figures they read, and the insight list closes the page.
  const order = await page.locator('#statsContent > *').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.story || e.id || (e as HTMLElement).dataset.card || ''));
  expect(order.indexOf('money')).toBeLessThan(order.indexOf('statsOverview'));
  expect(order[order.length - 1]).toBe('statsInsights');
  // A story's link opens its tab.
  await page.locator('[data-story="clients"] [data-action="invStatsGo"]').click();
  await expect(page.locator('#statsToolbar [data-action="invStatsTab"][data-tab="clients"]')).toHaveAttribute('aria-selected', 'true');
});
