import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P91: a list's selection bar is on screen on the phone. IM's Create invoice and the Register's bulk actions were drawn
// after the last row of the list, so with a long book they sat far below the screen (owner, 28 Sep 2026: "there is no
// option to create an invoice from IM tab in mobile"). They stay above the bottom bar now, however long the list.

async function onScreen(page: Page, sel: string) {
  return page.evaluate(s => {
    const bar = document.querySelector(s) as HTMLElement, nav = document.querySelector('.inv-navbar') as HTMLElement;
    const b = bar.getBoundingClientRect(), n = nav.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), navTop: Math.round(n.top), vh: innerHeight, scroll: document.documentElement.scrollHeight };
  }, sel);
}

test('IM: ticking a challan puts Create invoice on screen, above the bottom bar, at the top of a long list', async ({ page }) => {
  await loadAppWithState(page, emptyState() as SepState);   // the demo book: 50 challans, a list several screens long
  await switchTab(page, 'pageIM');
  await page.locator('#imList [data-action="invCheckIMChallan"]').first().check();
  const r = await onScreen(page, '#imSelBar .inv-selbar');
  expect(r.scroll).toBeGreaterThan(r.vh * 2);
  expect(r.top).toBeGreaterThan(0);
  expect(r.bottom).toBeLessThanOrEqual(r.navTop + 1);
  await expect(page.locator('#imSelBar [data-action="invCreateFromIM"]')).toBeInViewport();
});

test('Register: the selection bar is on screen above the bottom bar', async ({ page }) => {
  const s: any = emptyState();
  s.invoices = Array.from({ length: 60 }, (_, i) => ({ id: 'INV-' + i, invoiceNumber: String(i + 1).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(i + 1).padStart(5, '0'),
    date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130 }],
    taxableValue: 130, cgstAmt: 11.7, sgstAmt: 11.7, igstAmt: 0, grandTotal: 153.4, createdAt: recentTs() }));
  s.invNextNum = 61;
  await loadAppWithState(page, s as SepState);
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').first().click();
  await page.locator('[data-action="invRegSelectAll"]').first().click();
  const r = await onScreen(page, '#regSelBar .inv-selbar');
  expect(r.scroll).toBeGreaterThan(r.vh * 2);
  expect(r.top).toBeGreaterThan(0);
  expect(r.bottom).toBeLessThanOrEqual(r.navTop + 1);
});
