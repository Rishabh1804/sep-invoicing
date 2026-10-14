import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P164 (owner, 6 Oct 2026): "On the phone screen access to many tabs are missing. Insights has no direct link to open it?" and
// "earlier we used to see the recently created invoices for quick print, now to print a recent invoice is 4 clicks".
// Insights was put on the phone bar; since 8 Oct 2026 its five views are Office's review (owner: "Move insights into office tab,
// that way we have 5 icons again"). Today → Needs you lists the last invoices, each a tap from its print preview.

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
  test("the Insights are Today's, a tap from the bar; History and Knowledge are the top bar's on every screen", async ({ page }) => {
    // Office's review from 8 Oct 2026; Today's since the tab map (9 Oct 2026), History and Knowledge tools in the top bar.
    await loadAppWithState(page, book());
    await expect(page.locator('.inv-navbar-item[data-ws="insights"]')).toHaveCount(0);
    const item = page.locator('.inv-navbar-item[data-ws="today"]');
    await item.click();
    await expect(item).toHaveClass(/inv-navbar-item-on/);
    const labels = await page.locator('#wsTabs .inv-viewtab').allInnerTexts();
    expect(labels.slice(labels.indexOf('Stats'))).toEqual(['Stats', 'Reports', 'Planner']);
    await page.locator('#wsTabs [data-tab="pagePlanner"]').click();
    await expect(page.locator('#pagePlanner')).toHaveClass(/inv-page-active/);
    await expect(item).toHaveClass(/inv-navbar-item-on/);
    for (const [tool, id] of [['invGoHistory', 'pageHistory'], ['invKbHelp', 'pageKnow']]) {
      await page.locator(`.inv-topbar [data-action="${tool}"]:visible`).click();
      await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
    }
    // Five doors fit the phone, each a whole touch target, Add the centre one.
    const boxes = await page.locator('.inv-navbar > .inv-navbar-item').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height, r.right]; }));
    expect(boxes.length).toBe(5);
    for (const [w, h, right] of boxes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44); expect(right).toBeLessThanOrEqual(page.viewportSize()!.width + 1); }
    await expect(page.locator('.inv-navbar > .inv-navbar-item').nth(2)).toHaveAttribute('data-action', 'invAddOpen');
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
