import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, todayIso, recentTs } from './fixtures';

// P120 (owner, 30 Sep 2026): the owner's questions, each answered as a story: the figure, one sentence saying what it means, a
// small chart. Stats → Overview opened on them; since the tab map (TM2b) they are Pulse's, each a hero that opens to its story,
// and the figures behind them (In one line) follow. Made-up names and figures.

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

test('Pulse leads with the questions, each answered in a sentence, before the figures behind them', async ({ page }) => {
  const s = base();
  s.clients = [client(71, 'ALPHA WORKS'), client(72, 'BETA CLAMPS')];
  s.defaultCostPerKg = 10;
  s.invoices = [inv('00001', 71, 'ALPHA WORKS', [kg('BASE PLATE', 3000, 6)]), inv('00002', 72, 'BETA CLAMPS', [kg('CLAMP 165X83', 500, 14, 'CLAMP (40X6)')])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openPulse(page);
  const qs = page.locator('#homeQuestions [data-tdy-q]');
  // Is the plant running smoothly? leads (Direction B, P133), then the questions this spec was written for.
  await expect(qs.first()).toHaveAttribute('data-tdy-q', 'smooth');
  for (const k of ['smooth', 'money', 'clients', 'plant', 'changed']) await expect(page.locator(`[data-tdy-q="${k}"]`)).toBeVisible();
  // Each opens to its story: the sentence that says what it means.
  for (const k of ['money', 'clients', 'plant']) await page.locator(`[data-tdy-q="${k}"] > summary`).click();
  await expect(page.locator('[data-tdy-q="money"] [data-story-say]')).toContainText(/every kilo/);
  await expect(page.locator('[data-tdy-q="clients"] [data-story-say]').first()).toContainText('ALPHA WORKS fills');
  await expect(page.locator('[data-tdy-q="plant"] [data-story-say]')).toContainText(/two shifts/);
  // The questions come before the figures they read (In one line, under Do first); the insights are tasks on Needs you.
  const order = await page.locator('#homeQuestions > *').evaluateAll(els => els.map(e => e.matches('[data-tdy-questions]') ? 'questions'
    : e.querySelector('#statsOverview') ? 'figures' : (e as HTMLElement).dataset.card || ''));
  expect(order.indexOf('questions')).toBeGreaterThanOrEqual(0);
  expect(order.indexOf('questions')).toBeLessThan(order.indexOf('figures'));
  await expect(page.locator('#statsInsights')).toHaveCount(0);
});
