import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * The printed tax invoice's type.
 *
 * The invoice was the one printed document still borrowing the app's UI
 * `--fs-*` rem tokens — the quality certificate and the credit note have
 * always declared their own point scales. That coupling ran both ways and
 * both ways were wrong: the invoice's type could not be set without moving
 * the whole interface, and the interface could not be scaled without
 * silently resizing a GST document.
 *
 * It now owns `--pi-fs-*`, in points. The load-bearing assertion is the
 * independence one: changing the root font size must not move the invoice
 * by a single pixel.
 *
 * The sizes themselves answer operator feedback that the reference numbers
 * were unreadable. They were 6.75pt monospaced — small AND mono, the worst
 * pairing for digits, on exactly the fields a recipient hunts for.
 */

const PT = 4 / 3; // 1pt = 4/3 CSS px at a 96dpi reference

function invoice(lines: number, challanNo = '804') {
  const items = Array.from({ length: lines }, (_, i) => ({
    partNumber: `2082 3240 ${4200 + i}`,
    desc: 'CLAMP 165X83 (NT) (40X6)',
    hsn: '998873', unit: 'KG', qty: 10.5 + i, rate: 5.4,
    amount: Number(((10.5 + i) * 5.4).toFixed(2)), nosQty: null,
  }));
  const taxable = items.reduce((s, i) => s + i.amount, 0);
  return {
    id: 'INV-1', invoiceNumber: '00812', displayNumber: 'SEP/2026-27/00812',
    date: todayIso(), status: 'active', invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1, clientName: 'SSS MEHTA ENGINEERING WORKS', clientGSTIN: '20AABCS1429B1ZQ',
    clientAddress: { add1: 'Plot 22, Road No. 4', add2: 'ADITYAPUR', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra', items, taxableValue: taxable,
    cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '',
    challanNo, challanDate: todayIso(), poNumber: 'PO/TML/4471', poDate: '', despatchDate: todayIso(),
    transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs(),
  };
}

function stateWith(lines: number, challanNo?: string): SepState {
  const s = emptyState();
  s.clients = [{ id: 1, name: 'SSS MEHTA ENGINEERING WORKS', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }];
  s.invoices = [invoice(lines, challanNo)];
  s.invNextNum = 2;
  return s;
}

/** Open the invoice's print preview and switch the page to print media. */
async function printPreview(page: Page) {
  await switchTab(page, 'pageRegister');
  await page.locator('#regList [data-action="invViewInvoiceDetail"][data-id="INV-1"]').first().click();
  // Scoped to the overlay: Home's recent list renders the same action as a
  // hidden print button, earlier in the DOM.
  await page.locator('.inv-overlay-scrim [data-action="invPreviewInvoice"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();
  await page.emulateMedia({ media: 'print' });
}

const px = (page: Page, sel: string, prop: string) =>
  page.locator(sel).first().evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p as string).trim(), prop);

/** Computed font-size in px. Browsers round the string (10.1333px), so a
 *  point-derived expectation has to be compared as a number, not text. */
const fontPx = async (page: Page, sel: string) =>
  parseFloat(await px(page, sel, 'font-size'));

test('P31: the invoice owns its type scale — the root font size cannot move it', async ({ page }) => {
  await loadAppWithState(page, stateWith(8));
  await printPreview(page);

  /* EVERY element in the sheet, not a hand-picked few. The first version of
     this test sampled four selectors and passed while two printed elements —
     the copy label and the quality declaration — were still on the app's rem
     tokens: the repointing pass had only rewritten declarations sitting on the
     same line as their selector, and a four-selector sample cannot see what it
     does not name. The claim is about the document, so the sweep has to be too. */
  const sample = () => page.evaluate(() =>
    [...document.querySelectorAll('.inv-print-invoice, .inv-print-invoice *')]
      .map((el, i) => `${i}:${el.className || el.tagName}=${getComputedStyle(el).fontSize}`));

  const before = await sample();
  expect(before.length).toBeGreaterThan(50); // the sweep found a document, not an empty node
  // Triple the app's root size. Every `--fs-*` token is rem, so the whole
  // interface moves; the invoice must not, because it is in points.
  await page.evaluate(() => { document.documentElement.style.fontSize = '48px'; });
  expect(await sample()).toEqual(before);

  // And the app itself really did move — otherwise the assertion above is
  // vacuous and would pass on a stylesheet that had stopped working.
  const appMoved = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.fontSize = 'var(--fs-sm)';
    document.body.appendChild(probe);
    const size = getComputedStyle(probe).fontSize;
    probe.remove();
    return size;
  });
  expect(appMoved).toBe('36px'); // 0.75rem at a 48px root, not the 12px default
});

test('P31: the reference numbers are 9pt, in the normal face, and never wrap', async ({ page }) => {
  await loadAppWithState(page, stateWith(8));
  await printPreview(page);

  // 9pt. The feedback that prompted this named exactly these fields.
  expect(await fontPx(page, '.inv-pi-info-grid .inv-pi-val')).toBeCloseTo(9 * PT, 2);
  expect(await fontPx(page, '.inv-pi-party-name')).toBeCloseTo(9 * PT, 2);

  // Not monospaced: mono buys column alignment, which a labelled grid does not
  // need, and costs legibility on the digits the reader is hunting for.
  expect(await px(page, '.inv-pi-info-grid .inv-pi-val', 'font-family')).not.toMatch(/Plex Mono/i);

  // nowrap is load-bearing: without it the row has no slack at this size and
  // the invoice number breaks mid-token ("SEP/2026-" / "27/00812").
  expect(await px(page, '.inv-pi-info-grid .inv-pi-val', 'white-space')).toBe('nowrap');
  const lines = await page.locator('.inv-pi-info-grid .inv-pi-val').first().evaluate(
    (el) => el.getClientRects().length);
  expect(lines).toBe(1);
});

test('P31: the certificate and the credit note keep their own scales', async ({ page }) => {
  // The invoice's new tokens must not leak. These two documents carry
  // Tata-approved and GST-facing layouts respectively.
  await loadAppWithState(page, stateWith(2));
  await switchTab(page, 'pageRegister');
  await page.locator('#regList [data-action="invViewInvoiceDetail"][data-id="INV-1"]').first().click();
  await page.locator('.inv-overlay-scrim [data-action="invQualityCert"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();
  await page.emulateMedia({ media: 'print' });

  // The certificate's body size is its own 7.6pt, untouched by --pi-fs-*.
  expect(await fontPx(page, '.inv-qc-page')).toBeCloseTo(7.6 * PT, 2);
  expect(await page.locator('.inv-qc-page').first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--pi-fs-ref').trim())).toBe('');
});

test('P31: the meta grid fits the sheet however many challans an invoice cites', async ({ page }) => {
  /* `white-space: nowrap` on every value made the row's MINIMUM width larger
     than the page, and a table that cannot shrink does not wrap — it
     overflows. Invoice 00866 carried four challan numbers and the grid ran to
     the paper edge with a right margin of -0.2mm. Eight is twice that load. */
  await loadAppWithState(page, stateWith(6, '834, 835, 838, 836, 841, 842, 851, 853'));
  // A4 at 96dpi. The project's phone viewport is far narrower than a sheet, so
  // an overflow that only happens at print width would go unseen.
  await page.setViewportSize({ width: 794, height: 1123 });
  await printPreview(page);

  const measure = () => page.evaluate(() => {
    const sheet = document.querySelector('.inv-print-invoice') as HTMLElement;
    const grid = sheet.querySelector('.inv-pi-info-grid') as HTMLElement;
    const cs = getComputedStyle(sheet);
    const printable = sheet.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return {
      printable: Math.round(printable),
      grid: Math.round(grid.getBoundingClientRect().width),
      // The widest a row wants to be. `width: 100%` hides an overflow in the
      // element box, so the sum of the cells' own content widths is what
      // actually says whether the row fits.
      rowMin: Math.round(Math.max(...[...grid.querySelectorAll('tr')].map((tr) =>
        [...tr.children].reduce((n, td) => n + (td as HTMLElement).scrollWidth, 0)))),
    };
  });

  const asShipped = await measure();
  expect(asShipped.rowMin).toBeLessThanOrEqual(asShipped.printable);

  /* And again in a DELIBERATELY WIDE face. This assertion is the point of the
     test: the first run measures whatever fonts the machine happens to have,
     which is why CI (no webfonts, different fallback) read 729px where a
     developer box read 703px — the same stylesheet, judged by two different
     rulers. The app also lets the webfont CSS fail rather than block the
     service worker install, so the fallback is a real print path.
     Nailing the face down makes the check mean the same thing everywhere.
     Pre-fix this reports ~786px against 703px. */
  await page.addStyleTag({ content: '.inv-print-invoice{--ff-base:"DejaVu Sans",sans-serif}' });
  const wideFace = await measure();
  expect(wideFace.rowMin).toBeLessThanOrEqual(wideFace.printable);

  // The list wraps; the atomic values do not. A break between "834," and
  // "835," reads correctly, a break inside a date does not.
  expect(await px(page, '.inv-pi-info-grid .inv-pi-val-wrap', 'white-space')).toBe('normal');
  const dateCell = page.locator('.inv-pi-info-grid .inv-pi-val:not(.inv-pi-val-wrap)').first();
  expect(await dateCell.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
});
