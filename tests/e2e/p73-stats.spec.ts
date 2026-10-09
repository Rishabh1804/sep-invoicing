import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, openStatsTab, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P73 (phone): Stats on the v2.0 components (design principles §7, §9 step 3), in one look since the tab map (TM2b). Three view
// tabs, each led by its verdict card; the period an inv-seg pressed with aria-pressed; every card a flush panel named by
// data-card, its figures tiles and rows; the live cost's components rows that fold open to their parts, the source a badge; the
// client drill-down tiles on the front and rows on the back. Billing's cards moved to their homes (Pipeline, Money → GST). No
// v1.0 class is drawn on any of it.

function inv(id: string, clientId: number, clientName: string, qty: number, rate: number, state = 'created') {
  return { id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date: todayIso(), status: 'active', invoiceState: state,
    clientId, clientName, gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P' + id, desc: 'P', unit: 'KG', qty, rate, amount: qty * rate }],
    taxableValue: qty * rate, cgstPer: 9, cgstAmt: qty * rate * 0.09, sgstPer: 9, sgstAmt: qty * rate * 0.09, igstPer: 0, igstAmt: 0,
    grandTotal: qty * rate * 1.18, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs() };
}
function state(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [...s.clients, { id: 71, name: 'ALPHA WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 72, name: 'BETA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.invoices = [inv('00001', 71, 'ALPHA WORKS', 1000, 13, 'filed'), inv('00002', 72, 'BETA CLAMPS', 3000, 5)];
  s.invNextNum = 3;
  return s;
}

const V1 = '#pageStats [class*="inv-stats-"], #pageStats [class*="inv-kpi"], #pageStats [class*="inv-ov-"], #pageStats [class*="inv-cost-"], ' +
  '#pageStats [class*="inv-age-"], #pageStats [class*="inv-revbar"], #pageStats [class*="inv-state-"], #pageStats [class*="inv-pay-"], ' +
  '#pageStats [class*="inv-area-gap"], #pageStats .inv-card, #pageStats .inv-chip, #pageStats .inv-empty-state, #pageStats .inv-td-list';
const tab = (page: Page, t: string) => page.locator(`#statsToolbar .inv-viewtab[data-tab="${t}"]`);

test.describe('P73: Stats', () => {
  test('three view tabs and the period as a segmented control; every card a panel; no v1.0 class on any tab', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStats');
    await expect(page.locator('#statsToolbar .inv-viewtabs[role="tablist"] .inv-viewtab')).toHaveText(['By client', 'Cost', 'Trends']);
    const mtd = page.locator('#statsToolbar .inv-seg [data-action="invStatsPeriod"][data-period="mtd"]');
    await expect(mtd).toHaveAttribute('aria-pressed', 'true');
    for (const t of ['clients', 'cost', 'trends']) {
      await tab(page, t).click();
      await expect(tab(page, t)).toHaveAttribute('aria-selected', 'true');
      // Led by its verdict card, between the tabs and the period.
      await expect(page.locator('#statsToolbar > .inv-hero[data-verdict]')).toHaveCount(1);
      await expect(page.locator(V1)).toHaveCount(0);
      // Every card on the page is a panel.
      const cards = await page.locator('#statsContent > *').evaluateAll((els) => els.map((e) => e.classList.contains('inv-panel')));
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.every(Boolean)).toBe(true);
    }
    await page.locator('#statsToolbar [data-action="invStatsPeriod"][data-period="all"]').click();
    await expect(page.locator('#statsToolbar [data-period="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(mtd).toHaveAttribute('aria-pressed', 'false');
  });

  test('Trends’ verdict carries the headline’s four tiles; below cost is a badge, a line and a toned margin', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStatsTab(page, 'trends');
    const head = page.locator('#statsHeadline');
    await expect(head.locator('.inv-tile')).toHaveCount(4);
    await expect(head.locator('[data-tile="tonnage"] .inv-tile-value')).toHaveText('4.00 t');
    // ₹28,000 on 4 t = ₹7.00/kg, under the ₹8.56 model: the margin reads −₹ in the danger tone, badged below cost.
    await expect(head.locator('[data-tile="margin"]')).toHaveClass(/inv-tile-danger/);
    await expect(head.locator('[data-tile="margin"] .inv-tile-value')).toContainText('−₹');
    await expect(head.locator('[data-tile="margin"] .inv-badge-danger')).toHaveText('below cost');
    await expect(head.locator('[data-callout="below-cost"]')).toContainText('below full cost');
    await expect(head).toHaveClass(/inv-hero-danger/);
    await expect(page.locator('#statsMonths table.inv-table tbody tr')).toHaveCount(6);
    // The contribution a kilo is Pulse's In one line, in the danger tone.
    await openPulse(page);
    await expect(page.locator('#statsOverview > summary .inv-hero-fig .inv-fig-danger')).toContainText('−₹');
  });

  test('clients: rows that drill through, a dot and a word for below cost; the drill-down turns over to rows', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStatsTab(page, 'clients');
    const rows = page.locator('[data-card="realisation"] button.inv-row[data-client-row]');
    await expect(rows).toHaveCount(2);
    // Folded, shut on the phone: the contribution table above already ranks the clients.
    await page.locator('[data-card="realisation"] > summary').click();
    await expect(rows.nth(0)).toContainText('BETA CLAMPS');
    await expect(rows.nth(0).locator('.inv-dot-danger')).toHaveText('Below cost');
    // vs full and the ₹ on the period; vs var. is withheld while labour's split is not known (nothing recorded).
    await expect(page.locator('#statsMargin tbody tr').nth(0).locator('td.inv-num-neg')).toHaveCount(2);
    await expect(page.locator('[data-card="revenue"] .inv-seg [data-chart="bar"]')).toHaveAttribute('aria-pressed', 'true');
    await rows.nth(0).click();
    const card = page.locator('.inv-dialog[data-drill="72"]');
    await expect(card.locator('.inv-flip-front .inv-tile')).toHaveCount(6);
    await expect(card.locator('[data-tile="realisation"]')).toHaveClass(/inv-tile-danger/);
    await card.locator('.inv-flip-front [data-action="invFlipCard"]').click();
    await expect(card.locator('.inv-flip-back .inv-row')).toContainText('SEP/T-00002');
    await expect(card.locator('.inv-flip-back .inv-btn-primary')).toHaveText('Create invoice');
  });

  test('billing’s facts live at their homes: the states on Pipeline, the output tax on Money → GST', async ({ page }) => {
    await loadAppWithState(page, state());
    // Stats → Billing is gone (the tab map, TM2b, §5): its address lands on Pipeline.
    await page.goto('/?tab=pageStats&v=billing');
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    // The one invoice still in Created is that stage's; the filed one is in no stage, and Pipeline says so.
    await expect(page.locator('[data-pipe-stage="created"] .inv-panel-count')).toHaveText('1');
    await expect(page.locator('[data-pipe-note]')).toContainText('Filed and cancelled invoices are not stages');
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="gst"]').click();
    // Output tax on the month's two invoices: ₹28,000 at 18%.
    await expect(page.locator('#finGst')).toContainText('₹5,040.00');
  });

  test('live cost: each component a row that folds open to its parts, its source a badge', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStatsTab(page, 'cost');
    const labour = page.locator('#liveCost details.inv-row-fold[data-cost="labour"]');
    await expect(labour.locator('.inv-badge[data-src="model"]')).toHaveText('model');
    await expect(labour.locator('.inv-row-children')).toBeHidden();
    await labour.locator('summary').click();
    await expect(labour.locator('.inv-row-children .inv-row').first()).toBeVisible();
    await page.locator('#liveCost [data-action="invCostBillOpen"]').click();
    await expect(page.locator('#liveCost .inv-panel-body #costBillAmount')).toBeVisible();
    await expect(page.locator('#pageStats .inv-btn-primary:visible')).toHaveCount(1);
  });
});
