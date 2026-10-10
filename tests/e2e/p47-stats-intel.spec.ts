import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, openStatsTab, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P47: Stats in grouped tabs, the period in one line at the live cost (Today → Pulse since the tab map, TM2b: it was Stats →
// Overview), and contribution by client. With nothing recorded, every cost is a model figure (labour ₹3.55, zinc ₹2.21,
// chemicals ₹1.57, power ₹0.81, other ₹0.42 = ₹8.56/kg) and the card says so.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function inv(id: string, clientId: number, clientName: string, qty: number, rate: number) {
  const t = todayIso();
  return { id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date: t, status: 'active', invoiceState: 'created',
    clientId, clientName, gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P' + id, desc: 'P', unit: 'KG', qty, rate, amount: qty * rate }],
    taxableValue: qty * rate, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: qty * rate, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs() };
}
function state(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [...s.clients, { id: 71, name: 'ALPHA WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 72, name: 'BETA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.invoices = [inv('00001', 71, 'ALPHA WORKS', 1000, 13), inv('00002', 72, 'BETA CLAMPS', 3000, 5)];
  s.invNextNum = 3;
  s.creditNotes = [{ id: 'CN-1', cnNumber: '001', displayNumber: 'CN/001/26-27', clientId: 72, clientName: 'BETA CLAMPS', status: 'active',
    invoiceIds: ['00002'], periodFrom: todayIso(), periodTo: todayIso(), discountPct: 2, taxableValue: 300, createdAt: 1 }];
  return s;
}

test.describe('P47: Stats tabs, the overview and the margin by client', () => {
  test('Stats is three tabs over one period, and remembers the one open', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStats');
    await expect(page.locator('#statsToolbar .inv-viewtab')).toHaveText(['By client', 'Cost', 'Trends']);
    await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveText('By client');
    await expect(page.locator('#statsMargin')).toBeVisible();
    // The period in one line is Pulse's: not on Stats.
    await expect(page.locator('#pageStats #statsOverview')).toHaveCount(0);
    await expect(page.locator('#liveCost')).toHaveCount(0);
    await page.locator('[data-action="invStatsTab"][data-tab="cost"]').click();
    await expect(page.locator('#liveCost')).toBeVisible();
    await expect(page.locator('#statsMargin')).toHaveCount(0);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await switchTab(page, 'pageStats');
    await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveText('Cost');
  });

  test('in one line reads realisation against the live cost, and says what is model', async ({ page }) => {
    await loadAppWithState(page, state());
    await openPulse(page);
    const ov = page.locator('#statsOverview');
    // Its verdict says it shut: what a kilo lost against the live cost, and on the period.
    await expect(ov.locator(':scope > summary .inv-hero-title')).toHaveText('Every kilo lost ₹1.64 against the live cost');
    await expect(ov.locator(':scope > summary .inv-hero-fig')).toContainText('−₹1.64');    // ₹6.92 less the ₹8.56 live cost
    await expect(ov.locator(':scope > summary .inv-hero-sub')).toHaveText('−₹6,540.00 on the period');   // ₹27,700 less 4 t at ₹8.56
    await ov.locator(':scope > summary').click();
    await expect(ov.locator('[data-tile="realisation"]')).toContainText('₹6.92');   // ₹28,000 less the ₹300 note, on 4 t (net of credit notes, owner 30 Sep 2026)
    await expect(ov.locator('[data-tile="cost"]')).toContainText('₹8.56');          // every cost on its model figure
    // What is not measured is a badge on its tile; Stats → Cost names each component's source.
    await expect(ov.locator('[data-tile="cost"] .inv-badge-warning')).toHaveText('0% measured');
    await openStatsTab(page, 'cost');
    await expect(page.locator('#liveCost')).toContainText('model');
    await openStatsTab(page, 'trends');
    await expect(page.locator('#statsMonths tbody tr')).toHaveCount(6);
  });

  test('contribution by client: worst first, net of credit notes, and the worst large account settled both ways', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStatsTab(page, 'clients');
    const rows = page.locator('#statsMargin tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('BETA CLAMPS');
    await expect(rows.nth(0)).toContainText('net of ₹300.00 credit notes');
    await expect(rows.nth(0)).toContainText('4.90');       // (₹15,000 − ₹300) ÷ 3,000 kg
    await expect(rows.nth(0)).toContainText('−3.66');
    await expect(rows.nth(1)).toContainText('ALPHA WORKS');
    await expect(rows.nth(1)).toContainText('+4.44');
    const worst = page.locator('#statsWorst');
    await expect(worst).toContainText('BETA CLAMPS');
    // Nothing recorded, so labour cannot be split into fixed and variable: it says so rather than calling it all variable.
    await expect(worst).toContainText('split not known');
    // BETA's share of the plant's tonnage, and of the revenue net of its note (14,700 of 27,700), in the working.
    await expect(worst.locator('.inv-row').filter({ hasText: 'Share of the plant’s tonnage' })).toContainText('75%');
    await expect(worst.locator('.inv-row').filter({ hasText: 'Share of the revenue' })).toContainText('53%');
    const m = await g(page, `(function(){ var r = statsClientMargins('mtd', statsInvoices(), weighLines(statsInvoices())); return [r.fullKg, r.varKg, r.ranked[0].money]; })()`) as number[];
    expect(m[0]).toBeCloseTo(8.56, 2);
    expect(m[1]).toBeNull();
    expect(m[2]).toBeCloseTo(-10980, 0);
  });
});
