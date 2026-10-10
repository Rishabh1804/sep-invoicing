import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P101: how much a screen shows (UX overhaul 2, step 6; owner, 29 Sep 2026: "clients detail is also one of those screens -
// Mehta and Dorabji scroll too far because they have many material IDs"). A long list shows its first rows and one row
// saying how many more, which shows them in place; group heads go with their rows; totals and counts cover the whole.
// A card of more than five rows on the client folds to its head; the fold is remembered on the device.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const day = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };

test.describe('P101: how much a screen shows', () => {
  test('a long list shows thirty and one row for the rest; a head goes with its row; shown stays shown', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const html = await g(page, `(function(){
      var rows = [];
      for (var i = 0; i < 35; i++) { if (i % 10 === 0) rows.push({ head: true, parts: ['<div class="inv-row-group">Group ' + i + '</div>'] }); rows.push({ parts: ['<div class="inv-row" data-r="' + i + '">Row ' + i + '</div>', '<div class="inv-row-children">kids ' + i + '</div>'] }); }
      return uiMoreHtml('p101', rows, { noun: 'rows' });
    })()`) as string;
    await g(page, `document.getElementById('pageHome').insertAdjacentHTML('afterbegin', '<div id="p101">' + ${JSON.stringify(html)} + '</div>')`);
    const box = page.locator('#p101');
    await expect(box.locator('[data-r]:visible')).toHaveCount(30);
    // Row 30's group head is held back with it; row 29's children are shown with it.
    await expect(box.locator('.inv-row-group:visible')).toHaveCount(3);
    await expect(box.getByText('kids 29')).toBeVisible();
    await expect(box.getByText('kids 30')).toBeHidden();
    await box.locator('[data-action="invShowMore"]').click();
    await expect(box.locator('[data-r]:visible')).toHaveCount(35);
    await expect(box.locator('[data-action="invShowMore"]')).toHaveCount(0);
    expect(await g(page, `uiMoreHtml('p101', [{parts:['<b>a</b>']}], { n: 0 })`)).toBe('<b>a</b>');
  });

  test("a client's Materials shows ten of each group with its count, each group a fold shut until asked", async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [{ id: 1, name: 'BIG CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true, rates: [{ ratePerKg: 10, effectiveFrom: '2020-04-01' }], itemRates: [] }];
    // 14 parts invoiced often until 120 days ago (stopped), 12 invoiced once, long ago (one-off).
    const inv = (id: string, date: string, part: string) => ({ id, invoiceNumber: id, displayNumber: 'SEP/T/' + id, date, status: 'active', invoiceState: 'filed', clientId: 1, clientName: 'BIG CLIENT',
      gstType: 'intra', items: [{ partNumber: part, desc: part, hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100 }], taxableValue: 100, grandTotal: 118, createdAt: recentTs() });
    s.invoices = [];
    for (let p = 0; p < 14; p++) for (let k = 0; k < 6; k++) s.invoices.push(inv(`S${p}-${k}`, day(-300 + k * 30), 'STOP-PART-' + p));
    for (let p = 0; p < 12; p++) s.invoices.push(inv(`O${p}`, day(-400), 'ONCE-PART-' + p));
    await loadAppWithState(page, s as SepState);
    await g(page, `setItemsSubView('performance')`);
    await switchTab(page, 'pageClients');
    // Each group is a fold, its head the count, shut until opened (the tab map, TM5f); open, it shows ten and the rest on asking.
    const stopped = page.locator('[data-cp-group="stopped"]');
    await expect(stopped.locator(':scope > summary')).toContainText('Stopped · 14');
    await expect(stopped.locator('[data-cp-mat]:visible')).toHaveCount(0);
    await stopped.locator(':scope > summary').click();
    await expect(stopped.locator('[data-cp-mat]:visible')).toHaveCount(10);
    await stopped.locator('[data-action="invShowMore"]').click();
    await expect(stopped.locator('[data-cp-mat]:visible')).toHaveCount(14);
    const once = page.locator('[data-cp-group="oneoff"]');
    await expect(once.locator(':scope > summary')).toContainText('One-off · 12');
    await expect(once.locator('[data-cp-mat]:visible')).toHaveCount(0);
    await once.locator(':scope > summary').click();
    await expect(once.locator('[data-cp-mat]:visible')).toHaveCount(10);
    await expect(once.locator('[data-action="invShowMore"]')).toContainText('Show 2 more parts');
  });

  test('a client card of more than five rows folds to its head, and the fold is remembered', async ({ page }) => {
    const s: any = emptyState();
    s.clients = [{ id: 1, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', gstin: '', isActive: true, rates: [{ ratePerKg: 5.4, effectiveFrom: '2020-04-01' }], itemRates: [],
      pieceRates: Array.from({ length: 8 }, (_, i) => ({ part: 'CLAMP ' + i, rate: 1 + i / 10, effectiveFrom: '2026-04-01' })),
      pieceWeights: [{ part: 'CLAMP 0', kgPerPiece: 0.2, effectiveFrom: '2026-04-01' }] }];
    await loadAppWithState(page, s as SepState);
    await g(page, `openClientEdit(1)`);
    const fold = page.locator('.inv-scrim-dialog [data-fold="client-ceditPieceRates"]');
    await expect(fold.locator('summary')).toContainText('Piece rates 8');
    await expect(fold).not.toHaveAttribute('open', '');
    // Piece weights has one row: a plain card.
    await expect(page.locator('.inv-scrim-dialog [data-fold="client-ceditPieceWeights"]')).toHaveCount(0);
    await fold.locator('summary').click();
    await expect(fold.locator('#ceditPieceRates .inv-row')).toHaveCount(8);
    await g(page, `closeOverlay(); openClientEdit(1)`);
    await expect(page.locator('.inv-scrim-dialog [data-fold="client-ceditPieceRates"]')).toHaveAttribute('open', '');
  });
});
