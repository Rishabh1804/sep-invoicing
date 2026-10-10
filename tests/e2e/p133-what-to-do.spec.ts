import { test, expect, type Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse as openToday, readStoredState, switchTab, todayIso, recentTs } from './fixtures';
import { sweepState } from './sweep-fixture';
import { adviceState, dayOff, LYRA_TEL, ORION, ORION_KGPC, ORION_MONTH_KG, VEGA, VEGA_TEL } from './p133-what-to-do.fixture';

// P133 (Direction B, step 1; owner, 1 Oct 2026): "In the pulse, we have a question that asks who's driving it and there is
// an answer with a reason, with no possible solutions and steps to be taken to ensure smooth running of our plant." Every
// question the app answers ends in the moves that answer it: each worked out from the book, saying what it is worth and
// what it rests on, with one button to the place it is made. Nothing is applied. Made-up names; dates from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

/** Today → Pulse over the whole book: the period every figure below is read for (the questions were Stats → Overview's until
 *  the tab map, TM2b). */
async function openPulse(page: Page) {
  await openToday(page);
  const all = page.locator('[data-tdy-pulse-head] [data-action="invStatsPeriod"][data-period="all"]');
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
}
/** A question opens to its story and its moves (each is a hero, shut until opened). */
async function openQ(page: Page, key: string) {
  const q = page.locator(`[data-tdy-q="${key}"]`);
  if (!(await q.evaluate(el => (el as HTMLDetailsElement).open))) await q.locator(':scope > summary').click();
  return q;
}
/** A task on Needs you, opened to its dialog: its group opened, and its card shown where the deck held it back. */
async function openTask(page: Page, key: string) {
  await switchTab(page, 'pageHome');
  await page.locator('#wsTabs [data-v="needs"]').click();
  const btn = page.locator(`#homeNeeds [data-action="invTodoOpenApp"][data-key="${key}"]`);
  await btn.evaluate(b => { const d = b.closest('details'); if (d) (d as HTMLDetailsElement).open = true; });
  const more = page.locator('#homeNeeds [data-tdy-group]').filter({ has: btn }).locator('[data-action="invShowMore"]');
  if (await btn.evaluate(b => !!b.closest('[hidden]')) && (await more.count())) await more.first().click();
  await btn.click();
}

test.describe('P133: what to do', () => {
  test('the six questions in order, each ending in its moves; the reprice, the draft, the call and the list', async ({ page }) => {
    await loadAppWithState(page, adviceState());
    await openPulse(page);

    // The six questions, in the plan's order.
    const order = await page.locator('#homeQuestions [data-tdy-q]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.tdyQ));
    expect(order).toEqual(['smooth', 'money', 'clients', 'plant', 'cash', 'changed']);
    for (const k of order as string[]) await expect(page.locator(`[data-tdy-q="${k}"] [data-adv-head]`)).toHaveCount(k === 'changed' ? 0 : 1);

    // 1. Is the plant running smoothly? What could stop it, soonest first: the line that is out, with its reorder list.
    const smooth = await openQ(page, 'smooth');
    await expect(smooth.locator('[data-story-say]')).toContainText('Pickling acid out');
    const first = smooth.locator('[data-adv-move]').first();
    await expect(first).toHaveAttribute('data-adv-move', 'stock:PA');
    await expect(first).toContainText('Order Pickling acid: it is out');
    await expect(first.locator('[data-action="invAdvGo"]')).toHaveText('Reorder list');
    // The cut today and VAT A1 short of its four are on it too (behind "Show more" where the payout falls due this week).
    const keys = await smooth.locator('[data-adv-move]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.advMove));
    expect(keys).toContain('power:' + todayIso().slice(0, 7));
    expect(keys).toContain('staff:vat-a1');
    // The area's worth is the EXTRA it booked on the days it was short: 4 days × 16 h × ₹47.50.
    await expect(smooth.locator('[data-adv-move="staff:vat-a1"] [data-adv-worth]')).toHaveText('−₹3,040.00');

    // 3. Who is driving it? Ask the account that fills the plant below the cost for the full cost: the live cost's ₹/kg,
    // worth (full − what it pays) × its kilos a month at the last three months' pace.
    // The figures worked out here from the live cost and the book, rounded the app's way (gstRound).
    const want = await g(page, `(function() {
      var a = statsPulseArgs('all'), r = statsRangeIso('all'), c = liveCost(r.from, r.to, a.tonnage.kg);
      var x = statsClientMargins('all', a.filtered, a.tonnage).ranked.find(function(y) { return y.id === 1; });
      var full = gstRound(c.perKg);
      return { full: full, net: x.net, share: x.kg / a.tonnage.kg, fullText: formatCurrency(full),
        worthText: formatCurrency(gstRound((full - 2) * ${ORION_MONTH_KG})),
        rates: { clamp: gstRound(full * ${ORION_KGPC['CLAMP 101X50']}), bracket: gstRound(full * ${ORION_KGPC['BRACKET 77']}) } };
    })()`) as { full: number; net: number; share: number; fullText: string; worthText: string; rates: { clamp: number; bracket: number } };
    expect(want.net).toBeCloseTo(2, 6);
    expect(want.share).toBeGreaterThan(0.55);
    expect(want.full).toBeGreaterThan(2);
    await openQ(page, 'clients');
    const reprice = page.locator('[data-tdy-q="clients"] [data-adv-move="reprice:1"]');
    await expect(reprice).toContainText(`Ask ${ORION} for ${want.fullText}/kg, the full cost`);
    await expect(reprice.locator('[data-adv-worth]')).toHaveText('+' + want.worthText);
    await expect(reprice).toContainText('a month at the last three months’ tonnage');
    // The labour question it turns on is one of the moves, settled on the contribution table.
    await expect(page.locator('[data-tdy-q="clients"] [data-adv-move="labour:1"] [data-action="invAdvGo"]')).toHaveText('Contribution');

    // 5. Is cash coming in? The debt over 90 days is a call: a real tel: link with the client's number.
    const call = page.locator('[data-tdy-q="cash"] [data-adv-move="owed:3"] a[href^="tel:"]');
    await expect(call).toHaveAttribute('href', LYRA_TEL);
    await expect(call).toHaveText('Call');

    // Add to my list: one task of the owner's own carrying the move's place; the move then says it is on the list.
    await smooth.locator('[data-adv-move="stock:PA"] [data-action="invAdvTask"]').click();
    await expect(smooth.locator('[data-adv-move="stock:PA"] [data-adv-listed]')).toHaveText('On your list');
    const tasks = (await readStoredState(page)).todo.tasks;
    expect(tasks.length).toBe(1);
    expect(tasks[0]).toMatchObject({ text: 'Order Pickling acid', due: todayIso(), advKey: 'stock:PA', go: { kind: 'reorder' }, goLabel: 'Reorder list', doneAt: null });
    // Drawn again, it still is.
    await g(page, 'renderHome()');
    await expect(page.locator('[data-tdy-q="smooth"] [data-adv-move="stock:PA"] [data-adv-listed]')).toBeVisible();
    await expect(page.locator('[data-tdy-q="smooth"] [data-adv-move="stock:PA"] [data-action="invAdvTask"]')).toHaveCount(0);
    // The task's button lands on the place: the task is on Needs you, due today.
    await page.locator('#wsTabs [data-v="needs"]').click();
    const mine = page.locator('#homeNeeds [data-todo="mine"]').filter({ hasText: 'Order Pickling acid' });
    await mine.locator('[data-action="invTodoGo"]').click();
    await expect(page.locator('#pageStock.inv-page-active')).toBeVisible();
    await expect(page.locator('#stockContent .inv-pagehead-title')).toHaveText('Reorder list');

    // Draft quotation opens the form on a new, unsaved draft: its largest parts by the piece at the target × kg a piece,
    // the part with no weight by the kilo. Nothing is stored until Save draft.
    await openPulse(page);
    await openQ(page, 'clients');
    await page.locator('[data-tdy-q="clients"] [data-adv-move="reprice:1"] [data-action="invAdvGo"]').click();
    await expect(page.locator('#pageClients.inv-page-active')).toBeVisible();
    await expect(page.locator('#clientsPageContent .inv-pagehead-title')).toHaveText('New quotation');
    await expect(page.locator('#clientsPageContent [data-qt-draft-note]')).toContainText(want.fullText + '/kg, the full cost then');
    const form = await g(page, `({ q: _qtForm.q, stored: getQuotations().length })`) as any;
    expect(form.stored).toBe(0);
    expect(form.q.clientId).toBe(1);
    expect(form.q.to.name).toBe(ORION);
    expect(form.q.lines.map((l: any) => [l.partNumber, l.basis, l.rate, l.refWeightKg])).toEqual([
      ['CLAMP 101X50', 'piece', want.rates.clamp, ORION_KGPC['CLAMP 101X50']],
      ['BRACKET 77', 'piece', want.rates.bracket, ORION_KGPC['BRACKET 77']],
      ['WASHER 9', 'kg', want.full, null],
    ]);
    await expect(page.locator('#qtL0rate')).toHaveValue(String(form.q.lines[0].rate));
    await expect(page.locator('[data-action="invQtBasis"][data-i="0"][data-v="piece"]')).toHaveAttribute('aria-pressed', 'true');
    expect((await readStoredState(page)).quotations || []).toEqual([]);
    await page.locator('[data-action="invQtSaveDraft"]').click();
    const qs = (await readStoredState(page)).quotations;
    expect(qs.length).toBe(1);
    expect(qs[0]).toMatchObject({ status: 'draft', num: null, clientId: 1 });
    expect(qs[0].draftNote).toContain('Drafted from the Pulse');
  });

  test('an app task’s dialog lists its moves above what clears it, and a move lands on its place', async ({ page }) => {
    await loadAppWithState(page, adviceState());
    await openTask(page, 'insQuiet:2');
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog');
    const moves = dlg.locator('[data-adv-moves]');
    await expect(moves.locator('.inv-panel-title')).toHaveText('What you can do');
    // Above What clears it.
    const at = await dlg.evaluate(d => { const m = d.querySelector('[data-adv-moves]')!, c = d.querySelector('[data-todo-clears]')!; return !!(m.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); });
    expect(at).toBe(true);
    // Call them (the client's number as a real link), see what stopped, see what they owe.
    await expect(moves.locator('[data-adv-move="call:2:quiet"] a[href^="tel:"]')).toHaveAttribute('href', VEGA_TEL);
    await expect(moves.locator('[data-adv-move="perf:2:materials"]')).toContainText(`See what ${VEGA} stopped sending`);
    await expect(moves.locator('[data-adv-move="owes:2"]')).toContainText(`See what ${VEGA} owes`);
    // The dialog's own button is still its one primary.
    await expect(dlg.locator('.inv-dialog-foot .inv-btn-primary')).toHaveText('Open the client');
    await moves.locator('[data-adv-move="perf:2:materials"] [data-action="invAdvGo"]').click();
    await expect(page.locator('#pageClients.inv-page-active')).toBeVisible();
    await expect(page.locator('#cpClientSelect')).toHaveValue('2');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);

    // An unbilled-challan task invoices them: a new invoice for the client, its challans ticked, nothing saved.
    await openTask(page, 'challan:2');
    await page.locator('[data-adv-move="invoice:2"] [data-action="invAdvGo"]').click();
    await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
    const f = await g(page, `({ client: invoiceForm.clientId, ims: (invoiceForm._linkedIMIds || []).slice().sort(), lines: invoiceForm.items.length, stored: S.invoices.length })`) as any;
    expect(f.client).toBe(2);
    expect(f.ims).toEqual(['IM-V0', 'IM-V1', 'IM-V2', 'IM-V3', 'IM-V4', 'IM-V5']);
    expect(f.lines).toBe(6);
    expect(f.stored).toBe(6);
  });

  test('the jumps a move needs land on their places', async ({ page }) => {
    await loadAppWithState(page, adviceState());
    const go = (js: string) => g(page, `todoGo(${js})`);
    await go(`{ kind: 'reorder' }`);
    await expect(page.locator('#stockContent .inv-pagehead-title')).toHaveText('Reorder list');
    await go(`{ kind: 'powerCase' }`);
    await expect(page.locator('#pagePower.inv-page-active [data-power-case]')).toBeVisible();
    await go(`{ kind: 'areas' }`);
    await expect(page.locator('#pageStaff.inv-page-active [data-action="invAttView"][data-view="areas"]')).toHaveAttribute('aria-selected', 'true');
    await go(`{ kind: 'payWeek' }`);
    await expect(page.locator('#pageStaff.inv-page-active [data-action="invAttView"][data-view="pay"]')).toHaveAttribute('aria-selected', 'true');
    await go(`{ kind: 'liveCost', key: 'labour' }`);
    await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveAttribute('data-tab', 'cost');
    await expect(page.locator('#statsContent details[data-cost="labour"]')).toHaveJSProperty('open', true);
    await go(`{ kind: 'prodLines', line: 'vat-a2', day: '${dayOff(-1)}' }`);
    await expect(page.locator('#pageProduction.inv-page-active [data-action="invProdLine"][data-line="vat-a2"]')).toHaveAttribute('aria-pressed', 'true');
    await go(`{ kind: 'quotes', status: 'issued' }`);
    // The status is Quotations' filter, behind Filter on the phone and said as its token (the tab map, TM5g).
    expect(await page.evaluate(() => (0, eval)('_qtStatus'))).toBe('issued');
    await expect(page.locator('#pageClients .inv-token[data-action="invQtStatusClear"]')).toHaveCount(1);
    await go(`{ kind: 'stats', tab: 'clients', anchor: 'statsWorst' }`);
    await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveAttribute('data-tab', 'clients');
    await go(`{ kind: 'register', clientId: 2, month: '${dayOff(-40).slice(0, 7)}' }`);
    await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
    expect(await g(page, `({ c: regFilter.clientId, m: regFilter.month })`)).toEqual({ c: '2', m: dayOff(-40).slice(0, 7) });
    // A selection the bulk bar marks: exactly the invoices named.
    await go(`{ kind: 'regState', state: '', ids: ['INV-1', 'INV-2'] }`);
    expect(await g(page, `Object.keys(_regSelected).sort()`)).toEqual(['INV-1', 'INV-2']);
  });

  test('no move without its data: without the weights the reprice is by the kilo, and the line says what would make it by the piece', async ({ page }) => {
    const s: any = adviceState();
    s.clients[0].pieceWeights = [];
    await loadAppWithState(page, s);
    await openPulse(page);
    const full = await g(page, `(function() { var a = statsPulseArgs('all'), r = statsRangeIso('all'); return gstRound(liveCost(r.from, r.to, a.tonnage.kg).perKg); })()`) as number;
    const lines = await g(page, `_advMoves['reprice:1'].go.lines.map(function(l) { return [l.partNumber, l.basis, l.rate]; })`);
    expect(lines).toEqual([['CLAMP 101X50', 'kg', full], ['BRACKET 77', 'kg', full], ['WASHER 9', 'kg', full]]);
    await expect(page.locator('[data-tdy-q="clients"] [data-adv-hint]')).toContainText(`A weight per piece for ${ORION}’s CLAMP 101X50, BRACKET 77, WASHER 9 quotes them by the piece`);
  });

  test('a book with no data shows no move, and each question says what would make one appear', async ({ page }) => {
    const s: any = emptyState();
    s.incomingMaterial = noSeedIM();
    // One invoice of an unweighed part: the stories are drawn, and nothing in the book can be worked into a move.
    s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'filed',
      clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'NO WEIGHT PART', desc: 'NO WEIGHT PART', hsn: '998873', unit: 'NOS', qty: 10, rate: 5, amount: 50, nosQty: null }],
      taxableValue: 50, cgstPer: 9, cgstAmt: 4.5, sgstPer: 9, sgstAmt: 4.5, igstPer: 0, igstAmt: 0, grandTotal: 59, amountInWords: '', createdAt: recentTs() }];
    s.invNextNum = 2;
    // A backup taken today: no week-old backup to ask for.
    await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* none */ } });
    await loadAppWithState(page, s);
    await openToday(page);
    const stories = await page.locator('#homeQuestions [data-tdy-q]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.tdyQ));
    expect(stories).toEqual(['smooth', 'money', 'clients', 'plant', 'changed']);
    await expect(page.locator('#homeQuestions [data-adv-move]')).toHaveCount(0);
    for (const k of stories as string[]) await expect(page.locator(`[data-tdy-q="${k}"] [data-adv-none]`)).toHaveCount(1);
    await expect(page.locator('[data-tdy-q="smooth"] [data-story-say]')).toContainText('nothing stands in the way');
    await expect(page.locator('[data-tdy-q="money"] [data-adv-none]')).toContainText('A weight per piece');
    expect(await g(page, `advQuestions('mtd').map(function(q) { return q.moves.length; })`)).toEqual([0, 0, 0, 0, 0]);
  });

  test('the questions take well under 150 ms on the sweep book', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    // The first call compiles every function it reaches (the Stats page pays that once, whatever it draws); after it, five
    // calls timed one by one, judged by their median so one garbage collection or a busy machine does not decide it.
    const res = await g(page, `(function() {
      var q = advQuestions('mtd'), runs = [];
      for (var k = 0; k < 5; k++) { var t0 = performance.now(); q = advQuestions('mtd'); runs.push(performance.now() - t0); }
      return { runs: runs, n: q.length, moves: q.reduce(function(s, x) { return s + x.moves.length; }, 0) };
    })()`) as { runs: number[]; n: number; moves: number };
    const sorted = res.runs.slice().sort((a, b) => a - b), median = sorted[2];
    console.log(`P133: advQuestions on the sweep book: median ${median.toFixed(1)} ms (${res.runs.map(x => x.toFixed(1)).join(', ')}) for ${res.n} questions and ${res.moves} moves`);
    expect(res.n).toBe(6);
    expect(median).toBeLessThan(150);
  });
});
