import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P164 (owner, 6 Oct 2026): "On the phone screen access to many tabs are missing. Insights has no direct link to open it?" and
// "earlier we used to see the recently created invoices for quick print, now to print a recent invoice is 4 clicks".
// Insights is on the phone bar; Today → Needs you lists the last invoices, each a tap from its print preview.

function book(n = 7): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA PRESS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] }];
  s.invoices = [];
  for (let i = 1; i <= n; i++) {
    s.invoices.push({ id: 'INV' + i, invoiceNumber: i, displayNumber: 'SEP/T-' + String(i).padStart(5, '0'), date: todayIso(), status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'ALPHA PRESS', items: [{ partNumber: 'BRACKET', desc: 'BRACKET', unit: 'KG', qty: 10, rate: 13, amount: 130 }],
      taxableValue: 130, grandTotal: 153.4, createdAt: Date.now() - (n - i) * 60000 });
  }
  return s;
}

test.describe('P164 the phone reaches every screen, and a recent invoice prints from Today', () => {
  test('Insights is on the bar and opens its five views', async ({ page }) => {
    await loadAppWithState(page, book());
    const item = page.locator('.inv-navbar-item[data-ws="insights"]');
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
    await expect(item).toHaveClass(/inv-navbar-item-on/);
    await expect(page.locator('#wsTabs .inv-viewtab')).toHaveText(['Stats', 'Reports', 'Planner', 'History', 'Knowledge']);
    await page.locator('#wsTabs [data-tab="pagePlanner"]').click();
    await expect(page.locator('#pagePlanner')).toHaveClass(/inv-page-active/);
    // Six items still fit the phone, each a whole touch target.
    const boxes = await page.locator('.inv-navbar > .inv-navbar-item').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height, r.right]; }));
    expect(boxes.length).toBe(6);
    for (const [w, h, right] of boxes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44); expect(right).toBeLessThanOrEqual(page.viewportSize()!.width + 1); }
  });

  test('Needs you lists the last five invoices, newest first, and the print button opens the preview', async ({ page }) => {
    await loadAppWithState(page, book());
    const card = page.locator('#homeNeeds [data-card="recent"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-recent-inv]')).toHaveCount(5);
    await expect(card.locator('[data-recent-inv]').first()).toHaveAttribute('data-recent-inv', 'INV7');
    await card.locator('[data-recent-inv="INV7"] [data-action="invPreviewInvoice"]').click();
    await expect(page.locator('#invPrintBody')).toContainText('SEP/T-00007');
    await expect(page.locator('[data-action="invPrint"]').first()).toBeVisible();
  });

  test('with no invoices, Needs you shows no empty recent card', async ({ page }) => {
    await loadAppWithState(page, book(0));
    await expect(page.locator('#homeNeeds [data-card="inputs"]')).toBeVisible();
    await expect(page.locator('#homeNeeds [data-card="recent"]')).toHaveCount(0);
  });
});
