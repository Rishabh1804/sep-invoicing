import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import zlib from 'zlib';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openStatsTab, readStoredState, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { adviceState, ORION } from './p133-what-to-do.fixture';

// P150: the QA chain of 2 Oct 2026 over Quotations, Reports and What to do (QA5-1 … QA5-14), and the rate-pricing code
// they reach. Each test names its finding. Names, parts and figures are made up; every date is built from today.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const fyStart = (iso: string) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 4 ? y : y - 1; };
const FY = (() => { const y = fyStart(todayIso()); return `${y}-${pad((y + 1) % 100)}`; })();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const lastMonth = (() => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - 1); return isoOf(d).slice(0, 7); })();

/* ---------- The book the rate findings read ---------- */
// GAMMA PRESS is billed by weight from pieces at ₹14.50/kg, with a ₹16/kg override on P3302 (0.2 kg a piece) and on P9
// (no weight on record). DELTA FORGE is billed by the kilo at ₹11/kg, with a ₹3.83 a piece override on TM5181.
function rateState(extra: Record<string, unknown> = {}): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    partWeights: { P3302: 0.2, P3303: 0.5 },
    items: [
      { id: 1, partNumber: 'P3302', desc: 'BRACKET', unit: 'NOS', hsn: '998873', rate: 0, gauge: '' },
      { id: 2, partNumber: 'TM5181', desc: 'MOUNT', unit: 'KG', hsn: '998873', rate: 0, gauge: '' },
    ],
    clients: [
      { id: 1, name: 'GAMMA PRESS', billingMode: 'nos_to_weight', gstType: 'intra', gstin: '', isActive: true, add1: 'Plot 3', add2: '', add3: '',
        rates: [{ ratePerKg: 14.5, ratePerPiece: null, effectiveFrom: '2020-04-01' }],
        itemRates: [{ partPattern: 'P3302', rate: 16, unit: 'kg', label: 'BRACKET' }, { partPattern: 'P9', rate: 18, unit: 'kg', label: 'NO WEIGHT' },
          { partPattern: '7701', rate: 2, unit: 'piece', label: 'OLD FAMILY RATE' }] },
      { id: 2, name: 'DELTA FORGE', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true, add1: 'Plot 4', add2: '', add3: '',
        rates: [{ ratePerKg: 11, ratePerPiece: null, effectiveFrom: '2020-04-01' }],
        itemRates: [{ partPattern: 'TM5181', rate: 3.83, unit: 'piece', label: 'MOUNT' }] },
    ],
    ...extra,
  } as SepState;
}
const challan = (id: string, clientId: number, clientName: string, items: Array<[string, string, number]>) => ({
  id, challanNo: id, challanDate: dayOff(-5), clientId, clientName, vehicleNo: '', receivedDate: dayOff(-5), notes: '', createdAt: 1,
  items: items.map(([partNumber, unit, qty], i) => ({ id: id + '-' + i, partNumber, desc: partNumber, hsn: '998873', unit, qty, rate: 0, amount: 0, nosQty: null, invoiced: false, invoiceId: null })),
});

/* A quotation as the form saves it. */
function quote(id: string, over: Record<string, unknown> = {}) {
  return {
    id, num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: todayIso(), clientId: 1,
    to: { name: 'GAMMA PRESS', address: 'Plot 3', gstin: '', state: '(20) JHARKHAND', attn: '' }, intro: 'Further to our discussions.',
    lines: [{ item: 'BRACKET', partNumber: 'P3303', desc: '', basis: 'kg', rate: 17, refWeightKg: null, note: '' }],
    gstPct: 18, sac: '998873', transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15,
    terms: ['Job work.', 'Valid 30 days.'], status: 'draft', createdAt: 1, at: 1, ...over,
  };
}
const issued = (id: string, num: number, over: Record<string, unknown> = {}) =>
  quote(id, { num, fy: FY, displayNumber: `SEP/QTN/${FY}/${String(num).padStart(3, '0')}`, status: 'issued', issuedAt: 1, ...over });

/* Each page's text, from the PDF the print path makes: the pages in /Kids order, each content stream inflated, every text
   matrix's baseline and font size, in CSS px from that page's top. Chrome draws a page in CSS px under a `s 0 0 s 0 f cm`
   whose f/s is the page's offset in the flow. A page's stream carries two of them, the page's background at offset 0 and
   then its content: the content's is the one that moves the page down the flow, so the largest offset is taken (the first
   draft of this read the background's and measured page 2's text 298 mm from its top on the build with the defect). */
function pdfPageText(pdf: Buffer): Array<{ top: number; bottom: number }> {
  const s = pdf.toString('latin1'), objs: Record<string, string> = {};
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) objs[m[1]] = m[2];
  const root = Object.values(objs).find(o => /\/Type\s*\/Pages\b/.test(o) && /\/Kids/.test(o))!;
  const kids = [...root.match(/\/Kids\s*\[([^\]]*)\]/)![1].matchAll(/(\d+) 0 R/g)].map(k => k[1]);
  return kids.map(k => {
    const c = objs[k].match(/\/Contents\s+(\d+) 0 R/)!;
    const body = objs[c[1]], st = body.indexOf('stream'), en = body.lastIndexOf('endstream');
    const raw = Buffer.from(body.slice(st + 6, en).replace(/^\r?\n/, ''), 'latin1');
    let txt: string;
    try { txt = zlib.inflateSync(raw).toString('latin1'); } catch { txt = raw.toString('latin1'); }
    const offset = Math.max(...txt.match(/([\d.]+) 0 0 \1 0 (-?[\d.]+) cm/g)!.map(x => x.split(' ').map(Number)).filter(n => n[0] > 1).map(n => -n[5] / n[0]));
    let top = Infinity, bottom = -Infinity, size = 0;
    for (const t of txt.matchAll(/\/F\w+ ([\d.]+) Tf|1 0 0 -1 [\d.]+ ([\d.]+) Tm/g)) {
      if (t[1]) { size = Number(t[1]); continue; }
      const y = Number(t[2]) - offset;
      top = Math.min(top, y - size * 0.8);
      bottom = Math.max(bottom, y + size * 0.25);
    }
    return { top, bottom };
  });
}
const pxToMm = (px: number) => px * 25.4 / 96;

test.describe('P150: the QA chain on Quotations, Reports and What to do', () => {
  test('QA5-1: an item rate override prices a line only in its own unit, and the check never calls another unit a match', async ({ page }) => {
    await loadAppWithState(page, rateState());
    const r = await g(page, `(function(){
      var C = function(id){ return S.clients.find(function(c){ return c.id === id; }); }, d = localDateStr();
      var priced = function(c, it){ it = Object.assign({ desc: '', qty: 0, rate: 0, amount: 0 }, it); it.rate = defaultLineRate(C(c), d, it); linePrice(it, C(c), d);
        var m = rateMatch(C(c), d, it); return [it.rate, it.amount, m && m.status]; };
      return {
        // ₹16/kg on 600 pieces of 0.2 kg: 600 × 0.2 × 16 = ₹1,920, the way the ₹/kg ladder prices them (was 600 × 16 = ₹9,600).
        n2wPieces: priced(1, { partNumber: 'P3302', unit: 'NOS', qty: 600 }),
        // Per kg with no weight a piece on record: it cannot price pieces, so the line is the client's own and the check says so.
        n2wNoWeight: priced(1, { partNumber: 'P9', unit: 'NOS', qty: 600 }),
        n2wKgLine: priced(1, { partNumber: 'P3302', unit: 'KG', qty: 50 }),
        // ₹3.83 a piece never prices a kilo: 150 kg at the client's ₹11/kg (was 150 × 3.83).
        pieceOnKg: priced(2, { partNumber: 'TM5181', unit: 'KG', qty: 150 }),
        pieceOnNos: priced(2, { partNumber: 'TM5181', unit: 'NOS', qty: 100 }),
        note: rateMatchNote(rateMatch(C(2), d, { partNumber: 'TM5181', unit: 'KG', qty: 150, rate: 11 }))
      };
    })()`) as any;
    expect(r.n2wPieces).toEqual([16, 1920, 'match']);
    expect(r.n2wNoWeight).toEqual([14.5, 0, 'unit']);
    expect(r.n2wKgLine).toEqual([16, 800, 'match']);
    expect(r.pieceOnKg).toEqual([11, 1650, 'unit']);
    expect(r.pieceOnNos).toEqual([3.83, 383, 'match']);
    expect(r.note).toContain('Another unit');
    expect(r.note).toContain('On record ₹3.83/pc for this part');
    expect(r.note).not.toContain('Matches');
  });

  test('QA5-1: the invoice form, the challan form and the scanner all price by the override\'s unit', async ({ page }) => {
    await loadAppWithState(page, rateState());
    // The invoice form: the part chosen from the Items Master on a NOS line of the client billed by weight from pieces.
    await g(page, 'createForClient(1)');
    await page.locator('[data-action="invAddLineItem"]').click();
    await g(page, 'selectPartForLine(0, 1)');
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('600');
    expect(await g(page, `[invoiceForm.items[0].unit, invoiceForm.items[0].rate, invoiceForm.items[0].amount]`)).toEqual(['NOS', 16, 1920]);
    await expect(page.locator('#invRateMatch0 .inv-verdict .inv-dot')).toHaveText('Matches');
    // A part typed on a KG line of the client billed by the kilo: the per-piece override is not put on it.
    await g(page, 'initCreateForm(); createForClient(2)');
    await page.locator('[data-action="invAddLineItem"]').click();
    await page.locator('input[data-action="invEditLinePart"][data-idx="0"]').fill('TM5181');
    await g(page, 'dismissAllAutocomplete()');
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('150');
    expect(await g(page, `[invoiceForm.items[0].unit, invoiceForm.items[0].rate, invoiceForm.items[0].amount, !!invoiceForm.items[0]._override]`)).toEqual(['KG', 11, 1650, false]);
    await expect(page.locator('#invRateMatch0 .inv-verdict .inv-dot')).toHaveText('Another unit');
    await expect(page.locator('input[data-field="rate"][data-idx="0"]')).toHaveAttribute('data-verdict', 'unit');
    // Billed in pieces, the override applies; switched back to KG, its ₹3.83 does not stay on the kilos.
    await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('NOS');
    expect(await g(page, `[invoiceForm.items[0].rate, invoiceForm.items[0].amount]`)).toEqual([3.83, 574.5]);
    await expect(page.locator('#invRateMatch0 .inv-verdict .inv-dot')).toHaveText('Matches');
    await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('KG');
    expect(await g(page, `[invoiceForm.items[0].rate, invoiceForm.items[0].amount]`)).toEqual([11, 1650]);
    await g(page, 'initCreateForm()');
    // The challan form: the part typed on its KG line keeps the client's ₹/kg.
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanClientSearch').fill('DELTA');
    await page.locator('[data-action="invSelectChallanClient"]').first().click();
    await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('TM5181');
    expect(await g(page, '[_challanForm.items[0].unit, _challanForm.items[0].rate]')).toEqual(['KG', 11]);
    await page.locator('#imUnit0').selectOption('NOS');
    expect(await g(page, '[_challanForm.items[0].unit, _challanForm.items[0].rate]')).toEqual(['NOS', 3.83]);
    await page.locator('#imUnit0').selectOption('KG');
    expect(await g(page, '[_challanForm.items[0].unit, _challanForm.items[0].rate]')).toEqual(['KG', 11]);
    // The scanner: a kilo line at the ladder, a piece line at the override, pieces of 0.2 kg at ₹16/kg.
    const scanned = await g(page, `(_applyScanResult({ clientName: 'DELTA FORGE', challanDate: '${todayIso()}', items: [
      { partNumber: 'TM5181', unit: 'Kg', qty: 150 }, { partNumber: 'TM5181', unit: 'Nos', qty: 100 }] }),
      _challanForm.items.map(function(i){ return [i.unit, i.rate, i.amount]; }))`);
    expect(scanned).toEqual([['KG', 11, 1650], ['NOS', 3.83, 383]]);
    const n2w = await g(page, `(_applyScanResult({ clientName: 'GAMMA PRESS', challanDate: '${todayIso()}', items: [{ partNumber: 'P3302', unit: 'Nos', qty: 600 }] }),
      _challanForm.items.map(function(i){ return [i.unit, i.rate, i.amount]; }))`);
    expect(n2w).toEqual([['NOS', 16, 1920]]);
  });

  test('QA5-1: an accepted rate that cannot price the client\'s lines as they are billed is named "set by hand", never written', async ({ page }) => {
    await loadAppWithState(page, rateState({
      // DELTA's challans bill TM9000 by the kilo; GAMMA has no weight a piece for P77.
      incomingMaterial: [...noSeedIM(), challan('C1', 2, 'DELTA FORGE', [['TM9000', 'KG', 300]])],
      quotations: [
        issued('Q1', 1, { lines: [{ item: 'PIN', partNumber: 'P77', desc: '', basis: 'kg', rate: 17, refWeightKg: null, note: '' }] }),
        issued('Q2', 2, { clientId: 2, to: { name: 'DELTA FORGE', address: '', gstin: '', state: '', attn: '' },
          lines: [{ item: 'HUB', partNumber: 'TM9000', desc: '', basis: 'piece', rate: 4.1, refWeightKg: null, note: '' }] }),
        issued('Q3', 3, { lines: [{ item: 'BRACKET', partNumber: 'P3303', desc: '', basis: 'kg', rate: 17, refWeightKg: null, note: '' }] }),
      ],
    }));
    const plan = await g(page, `JSON.stringify([qtPostPlan(qtFind('Q1')), qtPostPlan(qtFind('Q2')), qtPostPlan(qtFind('Q3'))].map(function(p){ return { post: p.post.map(function(x){ return x.text; }), hand: p.hand }; }))`);
    const [p1, p2, p3] = JSON.parse(plan as string);
    expect(p1.post).toEqual([]);
    expect(p1.hand[0]).toContain('bills P77 in pieces (NOS) with no weight a piece on record');
    expect(p2.post).toEqual([]);
    expect(p2.hand[0]).toContain('bills TM9000 by the kilo (KG), which it cannot price');
    // One that fits says which lines it prices.
    expect(p3.post[0]).toContain('P3303 at ₹17.00/kg, for its lines billed in pieces, at 0.500 kg a piece');
    // Accepting the first says so, in a dialog, and writes nothing.
    const acc = g(page, `qtAccept('Q1')`);
    const said = await answerAsk(page, 'ok');
    await acc;
    expect(said).toContain('Set the rate by hand');
    expect(said).toContain('P77');
    expect(await g(page, `S.clients[0].itemRates.map(function(r){ return r.partPattern; })`)).toEqual(['P3302', 'P9', '7701']);
  });

  test('QA5-2: a posted rate goes before the rows it is more specific than, and its confirm names what it reaches and what it does not', async ({ page }) => {
    await loadAppWithState(page, rateState({
      incomingMaterial: [...noSeedIM(), challan('C1', 1, 'GAMMA PRESS', [['5206 P3303X', 'KG', 80], ['7701 P3304', 'KG', 40]])],
      quotations: [
        issued('Q1', 1, { clientId: 2, to: { name: 'DELTA FORGE', address: '', gstin: '', state: '', attn: '' },
          lines: [{ item: 'MOUNT 20', partNumber: 'TM5181-20', desc: '', basis: 'piece', rate: 12.5, refWeightKg: null, note: '' }] }),
        issued('Q2', 2, { lines: [{ item: 'BRACKET', partNumber: 'P3303', desc: '', basis: 'kg', rate: 17, refWeightKg: null, note: '' }] }),
        issued('Q3', 3, { lines: [{ item: 'COVER', partNumber: 'P3304', desc: '', basis: 'kg', rate: 19, refWeightKg: null, note: '' }] }),
      ],
    }));
    // TM5181 at ₹3.83 used to shadow a TM5181-20 posted after it: the toast said "Rate posted" and the line stayed at 3.83.
    let acc = g(page, `qtAccept('Q1')`);
    let said = await answerAsk(page, 'ok');
    await acc;
    expect(said).toContain('It goes before TM5181 at ₹3.83/piece');
    const d = todayIso();
    expect(await g(page, `S.clients[1].itemRates.map(function(r){ return r.partPattern; })`)).toEqual(['TM5181-20', 'TM5181']);
    expect(await g(page, `[getLineItemRate(S.clients[1], '${d}', 'TM5181-20').rate, getLineItemRate(S.clients[1], '${d}', 'TM5181-10').rate]`)).toEqual([12.5, 3.83]);
    // P3303 also prices 5206 P3303X, a part on the client's challans: said before it is written.
    acc = g(page, `qtAccept('Q2')`);
    said = await answerAsk(page, 'ok');
    await acc;
    expect(said).toContain('It also prices 5206 P3303X, which contains P3303');
    // P3304 cannot reach 7701 P3304: the family row 7701 comes first, and the confirm says so.
    acc = g(page, `qtAccept('Q3')`);
    said = await answerAsk(page, 'ok');
    await acc;
    expect(said).toContain('It does not reach 7701 P3304 (by 7701 at ₹2.00/piece, which comes first)');
  });

  test('QA5-3: two windows never issue the same quotation number', async ({ page }) => {
    await loadAppWithState(page, rateState({ quotations: [quote('A'), quote('B', { lines: [{ item: 'COVER', partNumber: 'P3304', desc: '', basis: 'kg', rate: 19, refWeightKg: null, note: '' }] })] }));
    const b = await page.context().newPage();
    await b.goto('/');
    await waitForBoot(b);
    // Window A asks to issue A: the question is open over a book in which 001 is free.
    const doneA = g(page, `qtIssue('A')`);
    await expect(page.locator('[data-ui-ask]').last()).toContainText(`SEP/QTN/${FY}/001`);
    // Meanwhile window B issues B as 001, and A loads the book B saved.
    const doneB = g(b, `qtIssue('B')`);
    await answerAsk(b, 'ok');
    expect(await doneB).toBe(true);
    await expect.poll(() => g(page, `qtFind('B').status`)).toBe('issued');
    await answerAsk(page, 'ok');
    expect(await doneA).toBe(true);
    expect(await g(page, `qtFind('A').displayNumber`)).toBe(`SEP/QTN/${FY}/002`);
    await expect(page.locator('.inv-toast')).toContainText(`SEP/QTN/${FY}/001 was issued in another window meanwhile`);
    const stored = ((await readStoredState(page)).quotations as any[]).map(q => q.displayNumber).sort();
    expect(stored).toEqual([`SEP/QTN/${FY}/001`, `SEP/QTN/${FY}/002`]);
  });

  test('QA5-4: a quotation running to a second page starts it below the gutter, and one page stays one', async ({ page }) => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ item: 'BRACKET ASSY ' + (i + 1), partNumber: 'TM2680652001' + i, desc: 'Zinc electroplating — job work',
      basis: 'piece', rate: 1.06 * (i + 1), refWeightKg: 0.065, note: '' }));
    await loadAppWithState(page, rateState({ quotations: [
      quote('FIVE', { clientId: null, lines: lines(5), transport: 'included', minConsignmentKg: 300, lotPcs: 500,
        to: { name: 'ALPHA FORGINGS', address: 'Plot 9\nAdityapur Industrial Area\nJamshedpur 832109', gstin: '', state: '(20) Jharkhand', attn: 'The Director' } }),
      quote('THREE', { clientId: null, lines: lines(3), transport: 'included', minConsignmentKg: 300, lotPcs: 500,
        to: { name: 'ALPHA FORGINGS', address: 'Plot 9\nAdityapur Industrial Area\nJamshedpur 832109', gstin: '', state: '(20) Jharkhand', attn: 'The Director' } }),
    ] }));
    await page.setViewportSize({ width: 794, height: 1123 });
    const print = async (id: string) => {
      await g(page, `qtFind('${id}').terms = qtTermsFor(qtFind('${id}')); closePrintPreview(); qtPrint('${id}')`);
      await page.emulateMedia({ media: 'print' });
      const pages = pdfPageText(await page.pdf({ format: 'A4', printBackground: true }));
      await page.emulateMedia({ media: 'screen' });
      return pages;
    };
    const five = await print('FIVE');
    expect(five.length).toBe(2);
    // The instrument reads a page's own top: page one's first text is under its gutter on every build.
    expect(pxToMm(five[0].top)).toBeGreaterThan(11);
    // The second page's first text sits under the frame's 12 mm head row, not at the paper's edge (was about 3 mm).
    expect(pxToMm(five[1].top)).toBeGreaterThan(11);
    // And the first page's last text ends above the 10 mm foot row.
    expect(pxToMm(five[0].bottom)).toBeLessThan(297 - 9);
    const three = await print('THREE');
    expect(three.length).toBe(1);
    // In print the sheet has no top or bottom padding of its own: the frame's rows are the gutters, and repeat.
    await page.emulateMedia({ media: 'print' });
    const css = await page.evaluate(() => {
      const doc = document.querySelector('.inv-print-view-active .inv-qt-doc')!, cs = getComputedStyle(doc);
      const head = getComputedStyle(doc.querySelector('.inv-qt-frame-head')!), foot = getComputedStyle(doc.querySelector('.inv-qt-frame-foot')!);
      return { pt: cs.paddingTop, pb: cs.paddingBottom, head: parseFloat(head.height), foot: parseFloat(foot.height),
        thead: getComputedStyle(doc.querySelector('.inv-qt-frame > thead')!).display, tfoot: getComputedStyle(doc.querySelector('.inv-qt-frame > tfoot')!).display };
    });
    await page.emulateMedia({ media: 'screen' });
    expect(css).toMatchObject({ pt: '0px', pb: '0px', thead: 'table-header-group', tfoot: 'table-footer-group' });
    expect(css.head).toBeGreaterThan(40);
    expect(css.foot).toBeGreaterThan(30);
  });

  test('QA5-5: one decision is one key, each move says which full cost it asks for, and a tap acts on the move under it', async ({ page }) => {
    await loadAppWithState(page, adviceState());
    await openStatsTab(page, 'overview');
    await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
    // The question asks for the period's full cost, and says it is the period's.
    await expect(page.locator('[data-story="clients"] [data-adv-move="reprice:1"]')).toContainText(`Ask ${ORION} for`);
    await expect(page.locator('[data-story="clients"] [data-adv-move="reprice:1"]')).toContainText('the full cost over the whole book');
    // An insight's move asks for its month's, says so, and is the same decision.
    const ins = await g(page, `advTaskMoves({ rule: 'insBelowVar', key: 'insBelowVar:1', clientId: 1, month: '${lastMonth}', net: 2, varKg: 5, fullKg: 9.22, kg: 1000 })
      .map(function(m){ return [m.key, m.say, m.task]; })`) as string[][];
    const monthName = MON[+lastMonth.slice(5, 7) - 1] + ' ' + lastMonth.slice(0, 4);
    expect(ins.map(x => x[0])).toEqual(['reprice:1', 'labour:1']);
    expect(ins[0][1]).toBe(`Ask ${ORION} for ₹9.22/kg, the full cost in ${monthName}`);
    expect(ins[0][2]).toBe(ins[0][1]);
    // Its draft says which full cost it was drafted at, too.
    expect(await g(page, `advTaskMoves({ rule: 'insBelowVar', key: 'insBelowVar:1', clientId: 1, month: '${lastMonth}', net: 2, varKg: 5, fullKg: 9.22, kg: 1000 })[0].go.note`))
      .toContain(`₹9.22/kg, the full cost in ${monthName}`);
    // The stock task's move is the Pulse's stock move.
    expect(await g(page, `advTaskMoves({ rule: 'stock', key: 'stock:PA', itemId: 'PA', tone: 'red' })[0].key`)).toBe('stock:PA');
    // Two rows of one decision, each with its own draft: a tap opens the one under it, Add to my list takes its words.
    await g(page, `(function(){
      var a = { key: 'reprice:9', tone: 'red', say: 'Ask X for ₹1.00/kg, the full cost this month', worth: null, basis: '', goLabel: 'Draft quotation', task: 'first task',
        go: { kind: 'quoteDraft', clientId: 1, lines: [{ item: 'A', partNumber: 'A', basis: 'kg', rate: 1 }], note: 'first draft' } };
      var b = Object.assign({}, a, { say: 'Ask X for ₹2.00/kg, the full cost in ${monthName}', task: 'second task',
        go: { kind: 'quoteDraft', clientId: 1, lines: [{ item: 'B', partNumber: 'B', basis: 'kg', rate: 2 }], note: 'second draft' } });
      var host = document.createElement('div'); host.id = 'p150Moves';
      host.innerHTML = advMovesHtml([a], 'p150a') + advMovesHtml([b], 'p150b');
      document.getElementById('statsContent').prepend(host);
    })()`);
    await page.locator('#p150Moves [data-adv-move="reprice:9"]').first().locator('[data-action="invAdvGo"]').click();
    await expect(page.locator('#clientsPageContent [data-qt-draft-note]')).toHaveText('first draft');
    expect(await g(page, '_qtForm.q.lines[0].rate')).toBe(1);
    await g(page, `_qtForm = null; _pageTyped = false; switchTab('pageStats')`);
    await g(page, `(function(){ var host = document.createElement('div'); host.id = 'p150Moves';
      host.innerHTML = advMovesHtml([_advRows['reprice:9#Ask X for ₹1.00/kg, the full cost this month']], 'p150a') + advMovesHtml([_advRows['reprice:9#Ask X for ₹2.00/kg, the full cost in ${monthName}']], 'p150b');
      document.getElementById('statsContent').prepend(host); })()`);
    await page.locator('#p150Moves [data-adv-move="reprice:9"]').nth(1).locator('[data-action="invAdvTask"]').click();
    const tasks = (await readStoredState(page)).todo.tasks.filter((t: any) => t.advKey === 'reprice:9');
    expect(tasks.map((t: any) => t.text)).toEqual(['second task']);
    // One decision: both rows read On your list.
    await expect(page.locator('#p150Moves [data-adv-move="reprice:9"] [data-adv-listed]')).toHaveCount(2);
    // A task added before the keys were one (order:<id>, reprice:<client>:<month>) is the same decision: no second task.
    await g(page, `todoData().tasks.push({ id: 'T-OLD', text: 'Order Pickling acid', due: '', note: '', link: null, advKey: 'order:PA', createdAt: 1, doneAt: null },
      { id: 'T-OLD2', text: 'Ask for the full cost', due: '', note: '', link: null, advKey: 'reprice:1:${lastMonth}', createdAt: 1, doneAt: null }); renderStats()`);
    await expect(page.locator('[data-story="smooth"] [data-adv-move="stock:PA"] [data-adv-listed]')).toBeVisible();
    await expect(page.locator('[data-story="clients"] [data-adv-move="reprice:1"] [data-adv-listed]')).toBeVisible();
  });

  test('QA5-6: the report reads attendance by Staff → Overview\'s rule: Monday to Saturday, a half day half, over the marks typed', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.staff = [1, 2, 3, 4].map(i => ({ id: i, name: 'Hand ' + i, comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a1', onFloor: true, active: true }));
    // Last pay week: the Sunday worked by two, Monday three present and one half, Tuesday two present, one absent, one unmarked.
    const ws = (() => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - d.getDay() - 7); return isoOf(d); })();
    const add = (n: number) => { const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
    const mk = (st: string) => ({ st, ot: 0, hours: st === 'P' ? 8 : st === 'H' ? 4 : 0, area: 'vat-a1' });
    s.attendance = {
      [add(0)]: { marks: { 1: mk('P'), 2: mk('P') }, extra: [], note: '' },
      [add(1)]: { marks: { 1: mk('P'), 2: mk('P'), 3: mk('P'), 4: mk('H') }, extra: [], note: '' },
      [add(2)]: { marks: { 1: mk('P'), 2: mk('P'), 3: mk('A') }, extra: [], note: '' },
    };
    await loadAppWithState(page, s);
    const overview = await g(page, `dashAttendanceByWeek(2)[0]`) as any;
    expect(overview.start).toBe(ws);
    // 3 + ½ + 2 present over 7 marks typed = 78.6%.
    expect(Math.round(overview.pct)).toBe(79);
    await switchTab(page, 'pageReports');
    await page.locator('[data-action="invRptKind"][data-kind="weekly"]').click();
    await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
    const doc = page.locator('#rptSheet [data-rpt-doc]');
    await expect(doc).toHaveAttribute('data-from', ws);
    await expect(doc.locator('[data-rpt-tile="attendance"] .inv-rpt-tile-v')).toHaveText('79%');
    await expect(doc.locator('[data-rpt-tile="attendance"]')).toContainText('as Staff → Overview reads it');
    // By day: the Sunday is not attendance; Monday 3.5 of 4, Tuesday 2 of 3; the foot is the week's own figure.
    const rows = doc.locator('[data-rpt-table="breakdown"] tbody tr');
    await expect(rows.nth(0).locator('td').nth(6)).toHaveText('—');
    await expect(rows.nth(1).locator('td').nth(6)).toHaveText('88%');
    await expect(rows.nth(2).locator('td').nth(6)).toHaveText('67%');
    await expect(doc.locator('[data-rpt-table="breakdown"] tfoot td').nth(6)).toHaveText('79%');
  });

  test('QA5-7: a revision of a void quotation never issues on the void number', async ({ page }) => {
    await loadAppWithState(page, rateState({ quotations: [issued('A', 1)] }));
    // A revision drafted, then the original voided: the question says the draft goes with it, and it does.
    const rev = g(page, `qtRevise('A')`);
    await answerAsk(page, 'ok', 'Price after negotiation');
    await rev;
    const draftId = await g(page, `getQuotations().find(function(q){ return q.revOf === 'A'; }).id`);
    await g(page, `_qtForm = null; _pageTyped = false`);
    const v = g(page, `qtVoid('A')`);
    const said = await answerAsk(page, 'ok', 'Never sent');
    await v;
    expect(said).toContain(`Its revision drafted, SEP/QTN/${FY}/001 Rev 1, is deleted with it`);
    expect(await g(page, `[qtFind('A').status, !!qtFind('${draftId}')]`)).toEqual(['void', false]);
    // A book carrying such a draft anyway (another window, an older build): Issue refuses, and says why.
    await g(page, `S.quotations.push(Object.assign(qtCopy(qtFind('A')), { id: 'R2', rev: 2, revOf: 'A', status: 'draft', displayNumber: qtDisplay('${FY}', 1, 2), voidReason: '' }))`);
    const iss = g(page, `qtIssue('R2')`);
    const refused = await answerAsk(page, 'ok');
    expect(await iss).toBe(false);
    expect(refused).toContain('was voided (Never sent)');
    expect(refused).toContain('a void number is never used again');
    expect(await g(page, `qtFind('R2').status`)).toBe('draft');
  });

  test('QA5-8 and QA5-9: the rebate move counts rebates only, and a worth for the period is ranked as the period\'s', async ({ page }) => {
    const s: any = adviceState();
    s.creditNotes = [
      { id: 'CN1', displayNumber: 'CN/001/26-27', status: 'active', kind: 'adjustment', reason: 'rate', clientId: 1, clientName: ORION, date: dayOff(-5), taxableValue: 900, invoiceIds: ['INV-1'] },
      { id: 'CN2', displayNumber: 'CN/002/26-27', status: 'active', clientId: 1, clientName: ORION, date: dayOff(-6), taxableValue: 300, invoiceIds: ['INV-2'] },
    ];
    await loadAppWithState(page, s);
    const rebate = await g(page, `advRebateMove({ today: localDateStr() }, { id: 1 }, '${ORION}')`) as any;
    expect(rebate.say).toContain('₹300.00 credited in 90 days');
    expect(rebate.basis).toContain('1 rebate note');
    await g(page, `S.creditNotes = S.creditNotes.filter(function(n){ return n.id === 'CN1'; })`);
    expect(await g(page, `advRebateMove({ today: localDateStr() }, { id: 1 }, '${ORION}')`)).toBeNull();
    // Quote new work: its worth is the period's spare tonnes, ranked per month like every other period's worth.
    const q = await g(page, `(function(){ var a = statsPulseArgs('all'), ctx = advCtx(a); ctx.cards = statsStoryCards(a, ctx);
      var mv = ctx.plantMoves().find(function(m){ return m.key === 'quote:new'; });
      var days = isoDaysBetween(ctx.r.from, ctx.r.to) + 1;
      return mv ? { per: mv.worth.per, rank: advRankValue(mv, ctx), want: mv.worth.amount * 30 / Math.max(1, days) } : null; })()`) as any;
    expect(q).not.toBeNull();
    expect(q.per).toBe('period');
    expect(q.rank).toBeCloseTo(q.want, 6);
  });

  test('QA5-10 and QA5-11: the breakdown foots only what its rows carry, and the day lists each invoice as issued', async ({ page }) => {
    const t = todayIso(), s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    const inv = (n: number, qty: number, rate: number) => ({ id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
      date: t, status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', clientAddress: {},
      items: [{ partNumber: 'PLATE ' + n, desc: 'PLATE', hsn: '998873', unit: 'KG', qty, rate, amount: qty * rate }],
      taxableValue: qty * rate, cgstPer: 9, cgstAmt: qty * rate * 0.09, sgstPer: 9, sgstAmt: qty * rate * 0.09, igstPer: 0, igstAmt: 0, grandTotal: qty * rate * 1.18, createdAt: Date.now() });
    s.invoices = [inv(1, 100, 13), inv(2, 200, 14)];
    s.invNextNum = 3;
    s.creditNotes = [{ id: 'CN1', displayNumber: 'CN/001/26-27', status: 'active', kind: 'adjustment', reason: 'rate', clientId: 1, clientName: 'TEST CLIENT KG', date: t, taxableValue: 100, invoiceIds: ['INV-1'] }];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageReports');
    await page.locator('[data-action="invRptKind"][data-kind="monthly"]').click();
    const doc = page.locator('#rptSheet [data-rpt-doc]');
    const foot = doc.locator('[data-rpt-table="breakdown"] tfoot td');
    // ₹/kg over every row: the weighed revenue (net) over 300 kg, the tonnage tile's own figure.
    const real = await g(page, `formatNum(weighLines(statsInvoices()).revKnown / 300, 2)`);
    await expect(foot.nth(3)).toHaveText(real as string);
    await expect(doc.locator('[data-rpt-tile="tonnage"] .inv-rpt-tile-v')).toContainText(real as string);
    // No floor record: the cuts, present and plated columns are dashes and so are their totals (cuts read 0).
    await expect(foot.nth(5)).toHaveText('—');
    await expect(foot.nth(6)).toHaveText('—');
    await expect(foot.nth(7)).toHaveText('—');
    // The day: the invoice as issued, ₹1,300.00 on its face, though the period reads it net of the ₹100 note.
    await page.locator('[data-action="invRptKind"][data-kind="daily"]').click();
    await expect(doc.locator('[data-rpt-table="dayinvoices"] tbody tr').first()).toContainText('₹1,300.00');
    await expect(doc.locator('[data-rpt-tile="invoiced"] .inv-rpt-tile-v')).toHaveText('₹4,000.00');
  });

  test('QA5-12: an insight\'s moves open its own month; a question\'s move opens the period it was worked out for', async ({ page }) => {
    await loadAppWithState(page, adviceState());
    const moves = await g(page, `JSON.stringify([
      advTaskMoves({ rule: 'insBelowVar', key: 'insBelowVar:1', clientId: 1, month: '${lastMonth}', net: 2, varKg: 5, fullKg: 9.22, kg: 1000 })[1].go,
      advTaskMoves({ rule: 'insLabour', key: 'insLabour:${lastMonth}', month: '${lastMonth}', perKg: 5, model: 3.55, kg: 1000 })[0].go,
      advTaskMoves({ rule: 'insRealLow', key: 'insRealLow:x', month: '${todayIso().slice(0, 7)}' })[0].go])`);
    const [labour, lab2, mix] = JSON.parse(moves as string);
    expect(labour).toEqual({ kind: 'report', report: 'monthly', from: lastMonth + '-01', sec: 'clients' });
    expect(lab2).toEqual({ kind: 'report', report: 'monthly', from: lastMonth + '-01', sec: 'staff' });
    expect(mix).toEqual({ kind: 'report', report: 'monthly', from: todayIso().slice(0, 7) + '-01', sec: 'clients' });
    await g(page, `todoGo(${JSON.stringify(labour)})`);
    await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#rptSheet [data-rpt-doc]')).toHaveAttribute('data-from', lastMonth + '-01');
    await expect(page.locator('#rptSheet [data-rpt-doc]')).toHaveAttribute('data-kind', 'monthly');
    // The question's labour move carries its period: Stats opens there, whatever the chip held.
    await openStatsTab(page, 'overview');
    await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
    const go = await g(page, `_advRows[document.querySelector('[data-story="clients"] [data-adv-move="labour:1"] [data-action="invAdvGo"]').dataset.advRow].go`) as any;
    expect(go).toMatchObject({ kind: 'stats', tab: 'clients', anchor: 'statsWorst', period: 'all' });
    await page.locator('[data-action="invStatsPeriod"][data-period="mtd"]').click();
    await g(page, `todoGo(${JSON.stringify(go)})`);
    expect(await g(page, '_statsPeriod')).toBe('all');
    await expect(page.locator('[data-action="invStatsPeriod"][data-period="all"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('QA5-13: a rate keeps its four places and prints as typed; a quotation with no GST rate is not issued', async ({ page }) => {
    await loadAppWithState(page, rateState());
    await switchTab(page, 'pageClients');
    await page.locator('#pageClients .inv-viewtab[data-view="quotes"]').click();
    await page.locator('[data-action="invQtNew"]').click();
    await page.locator('#qtClient').selectOption('1');
    await page.locator('#qtL0item').fill('WASHER');
    await page.locator('#qtL0rate').fill('0.125');
    await page.locator('[data-action="invQtSaveDraft"]').click();
    const q = await g(page, 'S.quotations[0]') as any;
    expect(q.lines[0].rate).toBe(0.125);
    await expect(page.locator('#qtList .inv-row-meta').first()).toContainText('₹0.125/pc');
    await g(page, `qtPrint('${q.id}')`);
    await expect(page.locator('.inv-print-view-active [data-qt-rate]')).toHaveText('₹ 0.125');
    await g(page, 'closePrintPreview()');
    // A blank GST field is refused at issue, not printed as 0%.
    await g(page, `qtFind('${q.id}').gstPct = null`);
    const iss = g(page, `qtIssue('${q.id}')`);
    const said = await answerAsk(page, 'ok');
    expect(await iss).toBe(false);
    expect(said).toContain('Enter the GST rate');
    expect(await g(page, `qtFind('${q.id}').status`)).toBe('draft');
  });

  test('QA5-14: the picker names the year shown, Stats\' All says the report is a year, and the report reads S.company only', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1,
      clientName: 'TEST CLIENT KG', gstType: 'intra', clientAddress: {}, items: [{ partNumber: 'PLATE', desc: 'PLATE', hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100 }],
      taxableValue: 100, cgstPer: 9, cgstAmt: 9, sgstPer: 9, sgstAmt: 9, igstPer: 0, igstAmt: 0, grandTotal: 118, createdAt: Date.now() }];
    s.invNextNum = 2;
    await loadAppWithState(page, s);
    await switchTab(page, 'pageReports');
    await page.locator('[data-action="invRptKind"][data-kind="yearly"]').click();
    for (let k = 0; k < 3; k++) await page.locator('[data-action="invRptStep"][data-step="-1"]').click();
    const doc = page.locator('#rptSheet [data-rpt-doc]');
    await expect(doc).toHaveAttribute('data-from', `${fyStart(todayIso()) - 3}-04-01`);
    await expect(page.locator('#rptPick')).toHaveValue(`${fyStart(todayIso()) - 3}-04-01`);
    // A quarter three years back is in its picker too.
    await page.locator('[data-action="invRptKind"][data-kind="quarterly"]').click();
    const qFrom = await doc.getAttribute('data-from');
    await expect(page.locator('#rptPick')).toHaveValue(qFrom!);
    // Stats over the whole book: the report is the year to date, and it says so.
    await openStatsTab(page, 'overview');
    await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
    await page.locator('#statsMakeReport').click();
    await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
    await expect(doc).toHaveAttribute('data-kind', 'yearly');
    await expect(page.locator('.inv-toast')).toContainText('not the whole book Stats showed');
    // No company name: none printed, rather than one written into the build.
    await g(page, `S.company.name = ''; renderReports()`);
    await expect(doc.locator('.inv-rpt-co')).toHaveCount(0);
    expect(await doc.innerHTML()).not.toMatch(/Soma Electro/i);
    expect((await doc.locator('.inv-rpt-frame-head').textContent())!.startsWith('Yearly report')).toBe(true);
  });
});
