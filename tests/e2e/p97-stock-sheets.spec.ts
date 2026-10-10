import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState, toolbarMore } from './fixtures';

// P97: the stock paper route (owner, 29 Sep 2026: "the same for Stock as that has enter by hand option as well. Plus,
// we need physical copy for record keeping"). Stock → Print sheets, for a day: the supervisor's sheet (his WhatsApp stock
// message, numbered as his last message numbered the lines), Deepak's sheet (Enter by hand: the app's level at the start
// of the day, count, received with ₹/unit, used, charged, the bill) and a copy filled with the day's entries and the level
// after. Each page one A4 sheet.

const iso = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function state(): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    stock: {
      items: [
        { id: 'Q', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [], lastPos: 2 },
        { id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [], lastPos: 6 },
        { id: 'H', name: 'HCL', key: 'HCL', unit: 'L', basis: 'draw', aliases: [], lastPos: 7 },
        { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [], lastPos: 1 },
        { id: 'B', name: 'Brightener', key: 'BRIGHTENER', unit: 'L', basis: 'draw', aliases: [] },   // never in a message
      ],
      entries: [
        { id: 'q1', itemId: 'Q', kind: 'count', qty: 40, date: iso(-5), at: 1, seq: 3 },
        { id: 'q2', itemId: 'Q', kind: 'used', qty: 10, days: 1, from: iso(0), date: iso(0), at: 2, seq: 2, source: 'manual' },
        { id: 'q3', itemId: 'Q', kind: 'received', qty: 50, price: 300, supplier: 'Alpha Chem', billNo: 'A/17', billDate: iso(-1), date: iso(0), at: 3, seq: 1, source: 'manual' },
        { id: 'z1', itemId: 'Z', kind: 'count', qty: 400, date: iso(-3), at: 1, seq: 3 },
        { id: 'z2', itemId: 'Z', kind: 'charged', qty: 40, days: 1, from: iso(0), date: iso(0), at: 2, seq: 2, note: 'VAT A1' },
        { id: 'h1', itemId: 'H', kind: 'used', qty: 99, date: iso(0), at: 2, seq: 2, voided: true },   // voided: not on paper
      ],
      pastes: [],
    },
  } as unknown as SepState;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const cells = (row: any) => row.locator('td').allInnerTexts();

test.describe('P97: stock sheets', () => {
  test('Stock → Print sheets previews the three for the day, each page one A4 sheet', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await toolbarMore(page, 'Print sheets');   // Stock's More (TM4d)
    await expect(page.locator('#stockSheetDate')).toHaveValue(todayIso());
    await page.locator('[data-action="invStockSheetPreview"]').click();
    const pages = page.locator('.inv-print-view-active .inv-as-page');
    expect(await pages.evaluateAll(ps => ps.map(p => (p as HTMLElement).dataset.sheet))).toEqual(['stock-sup', 'stock-deepak', 'stock-filled']);
    await page.emulateMedia({ media: 'print' });
    for (const h of await pages.evaluateAll(ps => ps.map(p => p.getBoundingClientRect().height / (96 / 25.4)))) expect(h).toBeLessThanOrEqual(297);
  });

  test("the supervisor's sheet numbers the lines as his last message did; a line never sent follows", async ({ page }) => {
    await loadAppWithState(page, state());
    await g(page, `document.getElementById('invPrintBody').innerHTML = stockSheetSupHtml('${todayIso()}')`);
    const rows = page.locator('[data-sheet="stock-sup"] tbody tr');
    const lead = await rows.evaluateAll(rs => rs.map(r => [r.children[0].textContent, r.children[1].textContent]));
    expect(lead).toEqual([['1)', 'Zinc'], ['2)', 'Q558'], ['6)', 'Nitric acid'], ['7)', 'HCL'], ['8)', 'Brightener'], ['9)', ''], ['10)', ''], ['11)', '']]);
    await expect(page.locator('[data-sheet="stock-sup"] .inv-as-sign')).toContainText('Handed to Deepak at');
  });

  test("Deepak's sheet carries the app's level at the start of the day; the filled copy the day's entries and the level after", async ({ page }) => {
    await loadAppWithState(page, state());
    await g(page, `document.getElementById('invPrintBody').innerHTML = stockSheetDeepakHtml('${todayIso()}', false) + stockSheetDeepakHtml('${todayIso()}', true)`);
    const blank = page.locator('[data-sheet="stock-deepak"] tbody').first();
    // Q558: counted 40, nothing else before today.
    expect(await cells(blank.locator('tr', { hasText: 'Q558' }))).toEqual(['2', 'Q558', 'kg', '40', '', '', '', '', '']);
    await expect(page.locator('[data-sheet="stock-deepak"] .inv-as-sign')).toContainText('Checked by Deepak');

    const filled = page.locator('[data-sheet="stock-filled"]');
    const t = filled.locator('tbody').first();
    // 40 + 50 received − 10 used = 80 after the day.
    expect(await cells(t.locator('tr', { hasText: 'Q558' }))).toEqual(['2', 'Q558', 'kg', '40', '', '50', '300.00', '10', '', '80']);
    expect(await cells(t.locator('tr', { hasText: 'Zinc' }))).toEqual(['1', 'Zinc', 'kg', '400', '', '', '', '', '40 (VAT A1)', '360']);
    // A voided entry never reaches paper.
    expect(await cells(t.locator('tr', { hasText: 'HCL' }))).toEqual(['7', 'HCL', 'L', '', '', '', '', '', '', '']);
    const bill = filled.locator('tbody').nth(1).locator('tr').first();
    expect((await cells(bill))[0]).toBe('Alpha Chem');
    expect((await cells(bill))[1]).toBe('A/17');
    expect((await cells(bill))[3]).toBe('Q558');
  });

  test("the supervisor's sheet for an earlier day with stock recorded comes out filled, as a worked example", async ({ page }) => {
    const s: any = state();
    s.stock.entries.push({ id: 'q9', itemId: 'Q', kind: 'used', qty: 12, days: 3, from: iso(-4), date: iso(-2), at: 5, seq: 2 });
    s.stock.pastes = [{ id: 'P1', at: 1, from: iso(-4), to: iso(-2), text: '' }];
    await loadAppWithState(page, s);
    expect(await g(page, `!!stockSheetFillFor('${iso(-2)}') + '|' + !!stockSheetFillFor('${iso(-6)}')`)).toBe('true|false');
    await g(page, `document.getElementById('invPrintBody').innerHTML = stockSheetSupHtml('${iso(-2)}', true)`);
    const sheet = page.locator('[data-sheet="stock-sup"]');
    await expect(sheet).toHaveAttribute('data-filled', '');
    // From and To are the window the message covered.
    expect(await sheet.locator('.inv-as-grid .inv-as-fill').count()).toBe(2);
    // Q558: 40 counted on day −5, 12 used over 3 days: opening 40, 3 × 4 = 12, available 28.
    expect(await sheet.locator('tbody tr', { hasText: 'Q558' }).locator('td').allInnerTexts()).toEqual(['2)', 'Q558', 'kg', '40', '', '3 × 4 = 12', '28', '']);
    // A line with nothing that day stays blank.
    expect(await sheet.locator('tbody tr', { hasText: 'Zinc' }).locator('.inv-as-fill').count()).toBe(0);
  });
});
