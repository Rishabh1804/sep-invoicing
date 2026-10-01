import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P131 (desktop): Clients → Quotations is the Register's list and pane. A row opens its quotation in the pane, which has
// an address (?id=) and only secondary buttons (the page's one primary is New quotation); an act there redraws it.
// Names are made up.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const draft = (id: string) => ({
  id, num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: todayIso(), clientId: 1,
  to: { name: 'ALPHA FORGINGS', address: 'Plot 1', gstin: '', state: '', attn: '' }, intro: 'Further to our discussions.',
  lines: [{ item: 'BRACKET', partNumber: 'B1', desc: '', basis: 'kg', rate: 22, refWeightKg: null, note: '' }],
  gstPct: 18, sac: '998873', transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15,
  terms: ['Job work.'], status: 'draft', createdAt: 1, at: 1,
});

test('a quotation opens in the pane with its address, and Issue there numbers it in place', async ({ page }) => {
  const s = { ...emptyState(), incomingMaterial: noSeedIM(), quotations: [draft('A')],
    clients: [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true, rates: [{ ratePerKg: 11, effectiveFrom: '2025-04-01' }], itemRates: [] }] } as SepState;
  await loadAppWithState(page, s);
  await switchTab(page, 'pageClients');
  await page.locator('#pageClients .inv-viewtab[data-view="quotes"]').click();
  await page.locator('#qtMaster [data-action="invQtOpen"]').first().click();
  const pane = page.locator('#qtPane');
  await expect(pane).toContainText('Draft');
  await expect.poll(() => page.evaluate(() => location.search)).toContain('id=A');
  await expect(page.locator('#pageClients .inv-btn-primary:visible')).toHaveText(['New quotation']);
  await pane.locator('[data-action="invQtIssue"]').click();
  await answerAsk(page, 'ok');
  const fy = (() => { const t = todayIso(), y = +t.slice(0, 4), m = +t.slice(5, 7), a = m >= 4 ? y : y - 1; return `${a}-${String((a + 1) % 100).padStart(2, '0')}`; })();
  await expect(pane.locator('.inv-pane-head')).toContainText(`SEP/QTN/${fy}/001`);
  await expect(pane.locator('[data-action="invQtRevise"]')).toBeVisible();
  expect(await g(page, `qtFind('A').status`)).toBe('issued');
  // A reload opens the same quotation in the pane.
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await expect(page.locator('#qtPane')).toContainText(`SEP/QTN/${fy}/001`);
});
