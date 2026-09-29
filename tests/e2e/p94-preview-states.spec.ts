import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, todayIso, recentTs, type SepState } from './fixtures';

// P94: the print preview is the printed page, and an invoice's state is coloured by how long it has sat there.
// (Owner, 29 Sep 2026.) The preview drew the tax invoice in the phone's 520px column against a layout that needs the
// page's 186mm: on a phone the totals were cut off, on the desktop the grid ran past the sheet's border, while the
// print itself was right. Each document is now laid out at its paper width and zoomed to fit the screen. And a
// Printed state sits between Created and Dispatched; every state but Filed turns amber, then red, with age.

const items = Array.from({ length: 6 }, (_, i) => ({ partNumber: 'CLAMP ' + (100 + i) + 'X83 (NT)', desc: 'CLAMP ' + (100 + i) + 'X83 (NT) (40X6)',
  hsn: '998873', unit: 'KG', qty: 10 + i, rate: 13, amount: (10 + i) * 13, nosQty: null }));
const inv = (id: string, o: any = {}) => ({ id, invoiceNumber: id.slice(4).padStart(5, '0'), displayNumber: 'SEP/TEST-' + id.slice(4).padStart(5, '0'),
  date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '20ABCDE1234F1Z5',
  clientAddress: { add1: 'A-4, Road No. 2', add2: 'ADITYAPUR, JAMSHEDPUR', add3: '', state: 'JHARKHAND', stateCode: '20' }, gstType: 'intra', items,
  taxableValue: 1000, cgstPer: 9, cgstAmt: 90, sgstPer: 9, sgstAmt: 90, igstPer: 0, igstAmt: 0, grandTotal: 1180, amountInWords: '',
  challanNo: '834, 835, 838', challanDate: todayIso(), poNumber: 'DA1/00834', poDate: todayIso(), despatchDate: '', transport: 'JH05AB1234',
  remarks: '', linkedIMIds: [], createdAt: recentTs(), ...o });
function state(invoices: any[]): SepState {
  const s: any = emptyState();
  s.invoices = invoices;
  s.invNextNum = invoices.length + 1;
  s.bankDetails = 'SBI ADITYAPUR';
  return s;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
/* Everything drawn inside the sheet stays inside it, and the sheet inside the screen. */
const fit = (p: Page) => p.evaluate(() => {
  const sheet = document.querySelector('.inv-print-invoice') as HTMLElement;
  const r = sheet.getBoundingClientRect();
  let out = 0;
  sheet.querySelectorAll('*').forEach(el => { const b = el.getBoundingClientRect(); if (b.width && b.right > r.right + 1) out++; });
  return { out, sheetRight: r.right, sheetLeft: r.left, vw: document.documentElement.clientWidth,
    zoom: getComputedStyle(document.getElementById('invPrintBody')!).getPropertyValue('--pp-zoom').trim() };
});

test.describe('P94: the preview is the page', () => {
  test('on a phone the A4 sheet is scaled to fit, with nothing past its edge', async ({ page }) => {
    await loadAppWithState(page, state([inv('INV-1')]));
    await g(page, 'showPrintPreview("INV-1")');
    const f = await fit(page);
    expect(f.out).toBe(0);
    expect(f.sheetLeft).toBeGreaterThanOrEqual(0);
    expect(f.sheetRight).toBeLessThanOrEqual(f.vw);
    expect(parseFloat(f.zoom)).toBeLessThan(1);
    // The totals, cut off before, are on screen.
    await expect(page.locator('.inv-print-invoice').first().getByText('Total Amount')).toBeInViewport();
  });

  test('on a desktop window it is life size; in print nothing is zoomed or sized for the screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state([inv('INV-1')]));
    await g(page, 'showPrintPreview("INV-1")');
    const f = await fit(page);
    expect(f.out).toBe(0);
    expect(f.zoom).toBe('1');
    await page.emulateMedia({ media: 'print' });
    const p = await page.locator('.inv-print-invoice').first().evaluate(el => ({ zoom: getComputedStyle(el).zoom, minH: getComputedStyle(el).minHeight }));
    expect(p.zoom).toBe('1');
    expect(p.minH).toBe('0px');
  });

  test('the other documents are fitted too: a credit note preview stays on the screen', async ({ page }) => {
    await loadAppWithState(page, state([inv('INV-1')]));
    await g(page, 'showPrintPreview("INV-1"); closePrintPreview(); document.getElementById("invPrintBody").innerHTML = \'<div class="inv-cn-doc">x</div>\'; document.getElementById("invPrintView").classList.add("inv-print-view-active"); printFit()');
    const r = await page.locator('.inv-cn-doc').evaluate(el => el.getBoundingClientRect().right);
    expect(r).toBeLessThanOrEqual(await g(page, 'document.documentElement.clientWidth') as number);
  });
});

test.describe('P94: Printed, and a state coloured by its age', () => {
  test('Print on a Created invoice\'s preview marks it Printed; a later state is left alone', async ({ page }) => {
    await loadAppWithState(page, state([inv('INV-1'), inv('INV-2', { invoiceState: 'dispatched', dispatchedAt: recentTs() })]));
    await g(page, 'window.print = function() {}');
    for (const id of ['INV-1', 'INV-2']) {
      await g(page, `showPrintPreview("${id}")`);
      await page.locator('[data-action="invPrint"]').click();
      await g(page, 'closePrintPreview()');
    }
    const st = await g(page, 'S.invoices.map(function(i){ return [i.invoiceState, !!i.printedAt]; })');
    expect(st).toEqual([['printed', true], ['dispatched', false]]);
    // A credit note or certificate in the same preview marks nothing.
    expect(await g(page, '_printInvId')).toBeNull();
  });

  test('each state turns amber, then red, at its days; Delivered follows the GSTR-1 due date; Filed is done', async ({ page }) => {
    await loadAppWithState(page, state([inv('INV-1')]));
    const tones = await g(page, `(function() {
      var D = 86400000, now = new Date(2026, 8, 20, 12).getTime();
      var t = function(o) { return invStateTone(Object.assign({ status: 'active', date: '2026-09-01' }, o), now); };
      return {
        created: [t({ invoiceState: 'created', createdAt: now - 0.5 * D }), t({ invoiceState: 'created', createdAt: now - 1 * D }), t({ invoiceState: 'created', createdAt: now - 2 * D })],
        printed: [t({ invoiceState: 'printed', printedAt: now - 0.2 * D }), t({ invoiceState: 'printed', printedAt: now - 1.5 * D }), t({ invoiceState: 'printed', printedAt: now - 3 * D })],
        dispatched: [t({ invoiceState: 'dispatched', dispatchedAt: now - 2 * D }), t({ invoiceState: 'dispatched', dispatchedAt: now - 3 * D }), t({ invoiceState: 'dispatched', dispatchedAt: now - 7 * D })],
        // September's return is due 11 Oct: 20 Sep is well before; 8 Oct is 3 days out; 12 Oct is past.
        delivered: [t({ invoiceState: 'delivered', deliveredAt: now }),
          invStateTone({ status: 'active', date: '2026-09-01', invoiceState: 'delivered' }, new Date(2026, 9, 8, 12).getTime()),
          invStateTone({ status: 'active', date: '2026-09-01', invoiceState: 'delivered' }, new Date(2026, 9, 12, 12).getTime())],
        filed: t({ invoiceState: 'filed', filedAt: now - 90 * D }),
        cancelled: t({ status: 'cancelled' }),
        // An invoice from before Printed existed, with no stamp for its state, is aged from the one before it.
        legacy: t({ invoiceState: 'printed', createdAt: now - 5 * D })
      };
    })()`);
    expect(tones).toEqual({
      created: ['neutral', 'warning', 'danger'],
      printed: ['neutral', 'warning', 'danger'],
      dispatched: ['neutral', 'warning', 'danger'],
      delivered: ['neutral', 'warning', 'danger'],
      filed: 'ok', cancelled: 'danger', legacy: 'danger',
    });
    // The days are Settings'.
    const moved = await g(page, `S.invStateCheck.dispatchedAmber = 10; S.invStateCheck.dispatchedRed = 20;
      invStateTone({ status: 'active', invoiceState: 'dispatched', dispatchedAt: Date.now() - 7 * 86400000 })`);
    expect(moved).toBe('neutral');
  });

  test('the detail offers Mark printed and Mark dispatched; the bulk bar prints and dispatches from Created or Printed', async ({ page }) => {
    await loadAppWithState(page, state([inv('INV-1'), inv('INV-2'), inv('INV-3', { invoiceState: 'printed', printedAt: recentTs() })]));
    const html = await g(page, 'invoiceDetailHtml(S.invoices[0])') as string;
    expect(html).toContain('data-state="printed">Mark printed');
    expect(html).toContain('data-state="dispatched">Mark dispatched');
    await g(page, 'advanceInvoiceState("INV-1", "dispatched")');
    expect(await g(page, 'getInvState(S.invoices[0])')).toBe('dispatched');

    await g(page, '_regSelected = { "INV-2": true, "INV-3": true }; regBulkSetState("dispatched")');
    const st = await g(page, 'S.invoices.map(function(i){ return i.invoiceState; })');
    expect(st).toEqual(['dispatched', 'dispatched', 'dispatched']);
    // Numbers only become spent from Dispatched: a Printed invoice still returns its number to the series if deleted.
    expect(await g(page, 'invStateIdx("printed") < invStateIdx("dispatched")')).toBe(true);
  });
});
