import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSales, openSettingsAt, switchTab, todayIso, type SepState } from './fixtures';

// P131: the quotation generator (owner, 1 Oct 2026), Clients → Quotations, built to the register's rules
// (soma-internal operations/quotations/README.md): a draft holds no number and prints DRAFT; issue takes the next number
// of the quotation's financial year, never reusing one (voids included); an issued quotation is never edited, a revision
// (with its reason) carries the same number as Rev 1 and supersedes the old on issue; a void keeps its number with its
// reason; two live prices for one item ask; an accepted per-piece rate for a weight-billed client posts to itemRates and
// never touches billingMode; the terms follow the options; the face reads S.company; one A4 page. Names are made up.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const fyStart = (iso: string) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 4 ? y : y - 1; };
const fyLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const FY = fyLabel(fyStart(todayIso()));

function state(extra: Record<string, unknown> = {}): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    clients: [
      { id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
        add1: 'Plot 1', add2: 'Adityapur', add3: '', isActive: true, rates: [{ ratePerKg: 11, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] },
      { id: 2, name: 'BETA PRESS', billingMode: 'piece', gstType: 'intra', gstin: '', state: 'JHARKHAND', stateCode: '20',
        add1: 'Plot 2', add2: '', add3: '', isActive: true, rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [], pieceRates: [] },
    ],
    ...extra,
  } as SepState;
}

/* A draft as the form saves it, for the specs that test what happens to one. */
function draft(id: string, over: Record<string, unknown> = {}) {
  return {
    id, num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: todayIso(), clientId: 1,
    to: { name: 'ALPHA FORGINGS', address: 'Plot 1\nAdityapur', gstin: '20ABCDE1234F1Z5', state: '(20) JHARKHAND', attn: 'The Director' },
    intro: 'Further to our discussions.', lines: [{ item: 'BRACKET MAXI', partNumber: 'TM5181', desc: 'Zinc electroplating', basis: 'piece', rate: 12.5, refWeightKg: 0.795, note: '' }],
    gstPct: 18, sac: '998873', transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15,
    terms: ['Job work.', 'Valid 30 days.'], status: 'draft', createdAt: 1, at: 1, ...over,
  };
}
async function issue(page: Page, id: string, ...answers: Array<'ok' | 'cancel'>) {
  const done = g(page, `qtIssue('${id}')`);
  for (const a of answers) await answerAsk(page, a);
  return done;
}
/* Office → Sales → Quotations (the tab map, 9 Oct 2026; Clients' own row until then). */
async function openQuotes(page: Page) {
  await openSales(page, 'quotes');
}

test.describe('P131: quotations', () => {
  test('a draft made on the form holds no number, lists as Draft and prints DRAFT', async ({ page }) => {
    await loadAppWithState(page, state());
    await openQuotes(page);
    await page.locator('[data-action="invQtNew"]').click();
    await page.locator('#qtClient').selectOption('1');
    await expect(page.locator('#qtToName')).toHaveValue('ALPHA FORGINGS');
    await page.locator('#qtL0item').fill('MOUNT REAR CORNER');
    await page.locator('#qtL0rate').fill('115');
    await page.locator('#qtL0wt').fill('1.2');
    // A piece rate with a weight shows what it comes to a kilo.
    await expect(page.locator('#qtLineInfo0')).toContainText('₹95.83/kg');
    await page.locator('[data-action="invQtSaveDraft"]').click();
    const q = await g(page, 'S.quotations[0]') as any;
    expect(q.num).toBeNull();
    expect(q.status).toBe('draft');
    await expect(page.locator('#qtList .inv-row-title').first()).toHaveText('Draft · ALPHA FORGINGS');
    await g(page, `qtPrint('${q.id}')`);
    await expect(page.locator('.inv-print-view-active [data-qt-mark]')).toContainText('DRAFT');
    await expect(page.locator('.inv-print-view-active [data-qt-ref]')).toHaveText('Draft');
  });

  test('issue numbers 001, then 002, and never reuses a void number; a quotation dated in the year before takes that series', async ({ page }) => {
    const prevDate = `${fyStart(todayIso()) - 1}-06-15`;
    await loadAppWithState(page, state({ quotations: [draft('A'), draft('B', { lines: [{ item: 'PIN', partNumber: 'P1', basis: 'kg', rate: 22 }] }),
      draft('C', { lines: [{ item: 'NUT', partNumber: 'N1', basis: 'kg', rate: 18 }] }), draft('D', { date: prevDate, lines: [{ item: 'WASHER', partNumber: 'W1', basis: 'kg', rate: 16 }] })] }));
    expect(await issue(page, 'A', 'ok')).toBe(true);
    expect(await g(page, `qtFind('A').displayNumber`)).toBe(`SEP/QTN/${FY}/001`);
    expect(await issue(page, 'B', 'ok')).toBe(true);
    expect(await g(page, `qtFind('B').displayNumber`)).toBe(`SEP/QTN/${FY}/002`);
    // Void 002: it keeps its number with the reason, and the next issue does not take it.
    const v = g(page, `qtVoid('B')`);
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('never used again');
    await v;
    expect(await g(page, `qtFind('B').status`)).toBe('issued');
    const v2 = g(page, `qtVoid('B')`);
    await answerAsk(page, 'ok', 'Rate typed wrong, never sent');
    await v2;
    expect(await g(page, `[qtFind('B').status, qtFind('B').num, qtFind('B').voidReason].join('|')`)).toBe('void|2|Rate typed wrong, never sent');
    expect(await issue(page, 'C', 'ok')).toBe(true);
    expect(await g(page, `qtFind('C').displayNumber`)).toBe(`SEP/QTN/${FY}/003`);
    expect(await issue(page, 'D', 'ok')).toBe(true);
    expect(await g(page, `qtFind('D').displayNumber`)).toBe(`SEP/QTN/${fyLabel(fyStart(todayIso()) - 1)}/001`);
    // History has the issue and the void with its reason.
    await switchTab(page, 'pageHistory');
    await expect(page.locator('#historyList')).toContainText(`SEP/QTN/${FY}/002 (ALPHA FORGINGS) voided — Rate typed wrong, never sent`);
  });

  test('an issued quotation is never edited; Revise needs a reason and gives Rev 1 on the same number, superseding the old on issue', async ({ page }) => {
    await loadAppWithState(page, state({ quotations: [draft('A')] }));
    await issue(page, 'A', 'ok');
    await g(page, `qtOpenForm('A')`);
    await expect(page.locator('#qtL0item')).toHaveCount(0);
    await openQuotes(page);
    await page.locator('#qtList [data-action="invQtOpen"]').first().click();
    const dlg = page.locator('[data-qt-detail="A"]');
    await expect(dlg.locator('[data-action="invQtEdit"]')).toHaveCount(0);
    await dlg.locator('[data-action="invQtRevise"]').click();
    // The reason is required: an empty answer is not taken.
    const ask = page.locator('[data-ui-ask]').last();
    await ask.locator('[data-ans="ok"]').click();
    await expect(ask.locator('[data-ui-ask-err]')).toBeVisible();
    await ask.locator('[data-ui-ask-input]').fill('New price after negotiation');
    await ask.locator('[data-ans="ok"]').click();
    // The revision is a draft on the form, with the same number, Rev 1.
    await expect(page.locator('#qtL0rate')).toBeVisible();
    const rev = await g(page, `S.quotations.find(function(q){ return q.revOf === 'A'; })`) as any;
    expect([rev.num, rev.rev, rev.displayNumber, rev.status]).toEqual([1, 1, `SEP/QTN/${FY}/001 Rev 1`, 'draft']);
    expect(await g(page, `qtFind('A').status`)).toBe('issued');
    await page.locator('#qtL0rate').fill('11.75');
    await page.locator('[data-action="invQtIssueForm"]').click();
    expect(await answerAsk(page, 'ok')).toContain('superseded');
    await expect.poll(() => g(page, `qtFind('A').status`)).toBe('superseded');
    expect(await g(page, `qtFind('A').supersededBy`)).toBe(rev.id);
    expect(await g(page, `[qtFind('${rev.id}').status, qtFind('${rev.id}').lines[0].rate].join('|')`)).toBe('issued|11.75');
    // The series moved by nothing: the next number is still 002.
    expect(await g(page, `qtNextNum('${FY}')`)).toBe(2);
  });

  test('two live prices for the same item ask whether the older is superseded', async ({ page }) => {
    await loadAppWithState(page, state({ quotations: [draft('A'), draft('B', { to: { name: 'Alpha Forgings', address: '', gstin: '', state: '', attn: '' }, clientId: null })] }));
    await issue(page, 'A', 'ok');
    const done = g(page, `qtIssue('B')`);
    await answerAsk(page, 'ok');
    const said = await answerAsk(page, 'ok');
    expect(said).toContain('Two live prices');
    expect(said).toContain(`SEP/QTN/${FY}/001`);
    await done;
    expect(await g(page, `[qtFind('A').status, qtFind('A').supersededBy].join('|')`)).toBe('superseded|B');
    // A different item does not ask.
    await g(page, `S.quotations.push(${JSON.stringify(draft('C', { lines: [{ item: 'OTHER', partNumber: 'X9', basis: 'kg', rate: 20 }] }))})`);
    expect(await issue(page, 'C', 'ok')).toBe(true);
    expect(await g(page, `qtFind('B').status`)).toBe('issued');
  });

  test('accepted: a per-piece rate for a weight-billed client is offered as an itemRates row, and the billing mode never moves', async ({ page }) => {
    await loadAppWithState(page, state({ quotations: [draft('A')] }));
    await issue(page, 'A', 'ok');
    const acc = g(page, `qtAccept('A')`);
    const said = await answerAsk(page, 'ok');
    await acc;
    expect(said).toContain('item rate override');
    expect(said).toContain('billing mode stays Weight');
    const c = await g(page, 'S.clients[0]') as any;
    expect(c.billingMode).toBe('weight');
    expect(c.itemRates).toEqual([{ partPattern: 'TM5181', rate: 12.5, unit: 'piece', label: `BRACKET MAXI (SEP/QTN/${FY}/001)` }]);
    expect(await g(page, `[qtFind('A').status, !!qtFind('A').lines[0].postedAt].join('|')`)).toBe('accepted|true');
    // The invoice now prices the part at it.
    expect(await g(page, `getLineItemRate(S.clients[0], '${todayIso()}', 'TM5181-20').rate`)).toBe(12.5);
    // A piece client's rate goes to its dated piece-rate card instead.
    await g(page, `S.quotations.push(${JSON.stringify(draft('B', { clientId: 2, to: { name: 'BETA PRESS', address: '', gstin: '', state: '', attn: '' } }))})`);
    await issue(page, 'B', 'ok');
    const acc2 = g(page, `qtAccept('B')`);
    await answerAsk(page, 'ok');
    await acc2;
    expect(await g(page, `S.clients[1].pieceRates.map(function(r){ return r.partNumber + '@' + r.rate; }).join()`)).toBe('TM5181@12.5');
    expect(await g(page, 'S.clients[1].billingMode')).toBe('piece');
  });

  test('the terms are written from the options: included transport names its minimum, no weight means no weight term', async ({ page }) => {
    await loadAppWithState(page, state());
    const t = await g(page, `qtTermsFor(Object.assign(qtBlank(), { transport: 'included', minConsignmentKg: 300, lines: [{ item: 'CASTINGS', basis: 'kg', rate: 22 }] }))`) as string[];
    expect(t.some(x => x.includes('not less than 300 kg'))).toBe(true);
    expect(t.some(x => x.includes('reference weight'))).toBe(false);
    expect(t.some(x => x.includes('actual received weight'))).toBe(true);
    const w = await g(page, `qtTermsFor(Object.assign(qtBlank(), { transport: 'loading', lotPcs: 300, lines: [{ item: 'MOUNT', basis: 'piece', rate: 115, refWeightKg: 1.2 }] }))`) as string[];
    expect(w.some(x => x.includes('reference weight of 1.2 kg per piece'))).toBe(true);
    expect(w.some(x => x.includes('consignment of 300 pieces'))).toBe(true);
    expect(w.some(x => x.includes('loading and unloading'))).toBe(true);
    // On the form: the terms follow the transport choice until one is edited, and Reset brings them back.
    await openQuotes(page);
    await page.locator('[data-action="invQtNew"]').click();
    await page.locator('[data-action="invQtTransport"][data-v="included"]').click();
    await page.locator('#qtMinKg').fill('300');
    await expect(page.locator('#qtTerms')).toContainText('not less than 300 kg');
    await page.locator('#qtTerm0').fill('Our own first term.');
    await page.locator('[data-action="invQtTransport"][data-v="excluded"]').click();
    await expect(page.locator('#qtTerm0')).toHaveValue('Our own first term.');
    await page.locator('[data-action="invQtTermsReset"]').click();
    await expect(page.locator('#qtTerms')).toContainText('ex-works');
  });

  test("the face reads the company from S.company and the recipient escaped; a three-line quotation with eleven terms is one A4 page", async ({ page }) => {
    const lines = [1, 2, 3].map(i => ({ item: 'BRACKET ASSY ' + i, partNumber: 'TM26806520014' + i, desc: 'Zinc electroplating — job work', basis: 'piece', rate: 1.06 * i, refWeightKg: 0.065, note: '' }));
    await loadAppWithState(page, state({ quotations: [draft('A', { lines, transport: 'included', minConsignmentKg: 300, lotPcs: 500, clientId: null,
      to: { name: '<b>x</b>', address: 'Plot 9\nAdityapur Industrial Area\nJamshedpur 832109', gstin: '', state: '(20) Jharkhand', attn: 'The Director' } })] }));
    await g(page, `qtFind('A').terms = qtTermsFor(qtFind('A'))`);
    expect(await g(page, `qtFind('A').terms.length`)).toBe(11);
    await g(page, `qtPrint('A')`);
    const doc = page.locator('.inv-print-view-active .inv-qt-doc');
    await expect(doc.locator('.inv-qt-co')).toHaveText('SOMA ELECTRO PRODUCTS');
    await expect(doc.locator('[data-qt-to-name]')).toHaveText('M/s <b>x</b>');
    await expect(doc.locator('[data-qt-to-name] b')).toHaveCount(0);
    // No GSTIN written: none on the face.
    await expect(doc.locator('.inv-qt-to')).not.toContainText('GSTIN');
    await expect(doc.locator('.inv-qt-terms li')).toHaveCount(11);
    // Measured at the sheet's own width (210mm = 794px), as the paper lays it out: the phone's 393px is not a page.
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: 'print' });
    const mm = await doc.evaluate(d => d.getBoundingClientRect().height / (96 / 25.4));
    expect(mm).toBeLessThanOrEqual(297);
    // And the print path itself makes one page of it.
    const pdf = (await page.pdf({ format: 'A4', printBackground: true })).toString('latin1');
    expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
    // The signature sits inside the sheet, on the page with the terms.
    const inside = await doc.evaluate(d => { const s = d.querySelector('.inv-qt-line')!.getBoundingClientRect(), r = d.getBoundingClientRect(); return s.bottom <= r.bottom && s.top >= r.top; });
    expect(inside).toBe(true);
    await page.emulateMedia({ media: 'screen' });
    // Another company name, another face.
    await g(page, `S.company.name = 'GAMMA PLATERS'; closePrintPreview(); qtPrint('A')`);
    await expect(page.locator('.inv-print-view-active .inv-qt-co')).toHaveText('GAMMA PLATERS');
    await expect(page.locator('.inv-print-view-active .inv-qt-for')).toHaveText('For GAMMA PLATERS');
    expect(await page.title()).toContain('Draft - <b>x</b>');
    // The list escapes it too.
    await g(page, `closePrintPreview()`);
    await openQuotes(page);
    await expect(page.locator('#qtList .inv-row-title').first()).toHaveText('Draft · <b>x</b>');
  });

  test('Settings → Business → Quotations saves its own section and shows the next number', async ({ page }) => {
    await loadAppWithState(page, state());
    await openSettingsAt(page, 'quotes');
    await expect(page.locator(`[data-qt-next="${FY}"]`)).toHaveText(`SEP/QTN/${FY}/001`);
    await page.locator('#setQtSign').fill('A. Kumar');
    await page.locator('#setQtTitle').fill('Partner');
    await page.locator('#setQtFoot').fill('Factory licence TEST/1');
    // Five already issued on paper this year: the app's first is 006, never 001 again.
    await page.locator('#setQtOutside').fill('5');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="quotes"]').click();
    expect(await g(page, 'JSON.stringify(S.qtnCfg)')).toBe(JSON.stringify({ signatory: 'A. Kumar', signTitle: 'Partner', footNote: 'Factory licence TEST/1', outside: { [FY]: 5 } }));
    expect(await g(page, `qtDisplay('${FY}', qtNextNum('${FY}'), 0)`)).toBe(`SEP/QTN/${FY}/006`);
    await g(page, `closeSettings(); S.quotations.push(${JSON.stringify(draft('A'))}); qtPrint('A')`);
    await expect(page.locator('.inv-print-view-active .inv-qt-line')).toHaveText('A. Kumar — Partner');
    await expect(page.locator('.inv-print-view-active .inv-qt-foot')).toHaveText('Factory licence TEST/1');
  });

  test('a client lists its quotations, and a row opens the quotation', async ({ page }) => {
    await loadAppWithState(page, state({ quotations: [draft('A')] }));
    await switchTab(page, 'pageClients');
    await g(page, 'openClientEdit(1)');
    const panel = page.locator('[data-card="clientQuotes"]');
    await expect(panel).toContainText('Draft');
    await panel.locator('[data-action="invQtOpen"]').click();
    await expect(page.locator('[data-qt-detail="A"]')).toBeVisible();
  });

  test('the form asks before a tap leaves it with typed work, and has an address', async ({ page }) => {
    await loadAppWithState(page, state());
    await openQuotes(page);
    await page.locator('[data-action="invQtNew"]').click();
    await expect.poll(() => page.evaluate(() => location.search)).toContain('v=quotes%2Fform');
    await page.locator('#qtL0item').fill('HALF TYPED');
    await page.locator('[data-action="invQtBack"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#qtL0item')).toHaveValue('HALF TYPED');
    await page.locator('[data-action="invQtBack"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-action="invQtNew"]')).toBeVisible();
    expect(await g(page, 'S.quotations.length')).toBe(0);
  });
});
