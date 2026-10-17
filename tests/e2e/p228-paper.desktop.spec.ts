import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loadAppWithState, todayIso } from './fixtures';
import { sweepState } from './sweep-fixture';

// P228, paper (docs/UI_PASS_3.md §17 I12): UI pass 3 changes how the screens look, and none of it may reach paper. The invoice,
// the test certificate (its format is Tata Motors QA's, approved: "No alterations are permissible"), the credit note, the sales
// register, the quotation, the statement, the pay slips, the attendance and stock sheets and the ID cards print exactly as they
// did. Each document is drawn in the print view under print media, and every element under its paper root is read for the
// properties that make how it prints (colours, fills, edges, corners, shadows, spacing, type) and not for its laid-out size (which
// a machine's fonts move). The record was taken on the build before UI pass 3 (PAPER_RECORD=1 writes it) on Teal, the default
// palette until then, and is compared on Teal; any difference after fails, naming the document and the element. Paper reads no
// palette either: the second test draws every document on each palette and holds the ink to Teal's (an element's own text, a
// border drawn, a fill), the screens' palette being a device's choice and paper being the same for everyone.

const RECORD = path.join(__dirname, '..', 'fixtures', 'paper-looks.json');
const PROPS = ['color', 'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color',
  'border-right-width', 'border-right-style', 'border-right-color', 'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
  'border-left-width', 'border-left-style', 'border-left-color', 'border-top-left-radius', 'border-bottom-right-radius', 'box-shadow',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'text-transform', 'letter-spacing',
  'white-space', 'display', 'opacity', 'fill', 'stroke'];

/* Each document, put into the print view the way its own Print does. */
const DOCS: [string, string][] = [
  ['invoice', `showPrintPreview('INV-17')`],
  ['certificate', `showQualityCertificates(['INV-17'])`],
  ['credit-note', `paperShow(buildCreditNoteHtml(S.creditNotes.find(function(c) { return c.id === 'CN1'; })))`],
  ['sales-register', `paperShow(buildSalesRegisterHtml({ invoices: S.invoices.filter(function(i) { return i.clientId === 1; }), fromSelection: true }))`],
  ['quotation', `qtPrint('Q2')`],
  ['statement', `paperShow(soaDocHtml(soaCompute((bankReceivables()[0] || { client: { id: 1 } }).client.id)))`],
  ['pay-slips', `_attWeekStart = attWeekStartOf(localDateStr()); paperShow(psSheetsHtml(psRows()))`],
  ['attendance-sheets', `paperShow(attSheetShyamHtml(isoAddDays(localDateStr(), -1), attSheetFillFor(isoAddDays(localDateStr(), -1)), '') + attSheetDeepakHtml(isoAddDays(localDateStr(), -1), true))`],
  ['stock-sheets', `paperShow(stockSheetSupHtml(localDateStr(), false, '') + stockSheetDeepakHtml(localDateStr(), false))`],
  ['id-cards', `paperShow(idcSheetsHtml(S.staff.slice(0, 3).map(function(w, i) { return { w: w, card: 'SEP-000' + (i + 1) }; }), true))`],
];

async function looksOf(page: Page, js: string, palette = 'teal') {
  return page.evaluate(([src, props, pal]) => {
    document.documentElement.dataset.palette = pal;
    const w = window as any;
    // The print view's own way in (qtPrint's): the document in #invPrintBody, the view on, fitted.
    w.paperShow = (html: string) => {
      const body = document.getElementById('invPrintBody')!;
      body.innerHTML = html;
      document.getElementById('invPrintView')!.classList.add('inv-print-view-active');
      w.printFit?.();
    };
    w.closeOverlay?.();
    (0, eval)(src);
    const root = document.getElementById('invPrintBody')!;
    const out: Record<string, string[]> = {};
    // The ink: what reaches paper from an element shown in print, its own text's colour, a border it draws, a fill it lays.
    const ink: string[] = [];
    const els = [root, ...Array.from(root.querySelectorAll('*'))];
    els.forEach((el, i) => {
      const cls = Array.from(el.classList).filter(c => c.startsWith('inv-')).sort().join('.');
      const sig = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
      const cs = getComputedStyle(el);
      const style = props.map(p => p + ':' + cs.getPropertyValue(p)).join(';');
      (out[sig] = out[sig] || []);
      if (!out[sig].includes(style)) out[sig].push(style);
      if (!(el as HTMLElement).checkVisibility?.()) return;
      const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent || '').trim());
      const parts: string[] = [];
      if (own || el.tagName === 'svg' || el.closest('svg')) parts.push('ink ' + cs.color + ' ' + cs.fill + ' ' + cs.stroke);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (cs.getPropertyValue('border-' + side + '-style') !== 'none' && parseFloat(cs.getPropertyValue('border-' + side + '-width')) > 0) parts.push(side + ' ' + cs.getPropertyValue('border-' + side + '-color'));
      }
      if (!/rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== 'transparent') parts.push('fill ' + cs.backgroundColor);
      if (cs.backgroundImage !== 'none') parts.push('image ' + cs.backgroundImage);
      if (parts.length) ink.push(i + ' ' + sig + ' ' + parts.join(' | '));
    });
    Object.keys(out).forEach(k => out[k].sort());
    return { n: els.length, looks: out, ink };
  }, [js, PROPS, palette] as const);
}

test('paper prints as it did before UI pass 3: every document, every element, every property that prints', async ({ page }) => {
  test.setTimeout(180000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, sweepState());
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const now: Record<string, Record<string, string[]>> = {};
  for (const [name, js] of DOCS) {
    const r = await looksOf(page, js);
    expect(r.n, name + ' drew a document').toBeGreaterThan(10);
    now[name] = r.looks;
  }
  expect(errs, 'no page error drawing a document').toEqual([]);
  if (process.env.PAPER_RECORD) {
    fs.writeFileSync(RECORD, JSON.stringify(now, null, 1) + '\n');
    return;
  }
  const was = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
  const diffs: string[] = [];
  for (const name of Object.keys(was)) {
    const a = was[name], b = now[name] || {};
    for (const sig of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = JSON.stringify(a[sig] || []), y = JSON.stringify(b[sig] || []);
      if (x !== y) diffs.push(name + ' · ' + sig + (a[sig] ? '' : ' (new)') + (b[sig] ? '' : ' (gone)'));
    }
  }
  expect(diffs.slice(0, 40), 'paper unchanged').toEqual([]);
});

test('paper reads no palette: every document prints the same ink on Zinc & brass and Terracotta as on Teal', async ({ page }) => {
  test.setTimeout(180000);
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, sweepState());
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const diffs: string[] = [];
  for (const [name, js] of DOCS) {
    const teal = (await looksOf(page, js, 'teal')).ink;
    for (const pal of ['zinc', 'terracotta']) {
      const other = (await looksOf(page, js, pal)).ink;
      expect(other.length, name + ' on ' + pal).toBe(teal.length);
      teal.forEach((t, i) => { if (t !== other[i]) diffs.push(name + ' on ' + pal + ': ' + t + '  ≠  ' + other[i]); });
    }
  }
  expect(diffs.slice(0, 20), 'no palette reaches paper').toEqual([]);
});
