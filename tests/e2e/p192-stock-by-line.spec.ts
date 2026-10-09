import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P192 (owner, 9 Oct 2026: "Exactly", to the app reading the bath a stock message names; then "Go into 144"). PP3 of
// docs/PLANT_PICTURE.md, stock by line:
// - the supervisor's zinc line "use VAT A 2 / 25/09/26/ 150 kg VAT 1 / 28/09/26/ 175 kg berral use 75 kg" is three uses, one a
//   bath, each on the day the message gives it, where it was one 400 kg entry with the baths in its note;
// - a message an older reader saved reads differently where the bath splits or dates a use, never where its note already named
//   its one bath;
// - each line's zinc and chemicals so much a tonne plated and ₹ a kg plated: each addition against what the line plated until the
//   next went into the same bath, the last still in the bath "so far"; days with no record filled at the pace of those with one,
//   under half recorded nothing set; a use naming two baths shared by what each plated, evenly where one is not recorded; a use
//   naming none the plant's;
// - Stock → a line, Production → Lines and Floor's line card say it, and a use typed by hand takes its bath.
// The chemical names are the shop's (not private); the client and part are made up; every date is from today.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const T = () => todayIso();
// The k-th working day (Monday to Saturday) before today.
function W(k: number): string {
  const d = new Date(T() + 'T00:00:00');
  let n = 0;
  while (n < k) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0) n++; }
  return isoOf(d);
}
const dayBefore = (s: string) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - 1); return isoOf(d); };
// W(a) to W(b), oldest first.
const span = (a: number, b: number) => { const o: string[] = []; for (let k = a; k >= b; k--) o.push(W(k)); return o; };
// Two days as the screen spans them: the month once where they share it.
const spanText = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7) ? +a.slice(8, 10) + ' – ' + short(b) : short(a) + ' – ' + short(b);
const dmy = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) + '/';
const short = (s: string) => +s.slice(8, 10) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+s.slice(5, 7) - 1];
const g = (p: Page, js: string) => p.evaluate(src => (0, eval)(src), js);
const item = (id: string, name: string, key: string, unit: string, basis = 'draw') => ({ id, name, key, unit, basis, aliases: [], active: true, createdAt: 1 });

function plated(line: string, days: string[], kg: number) {
  return days.map(d => ({ id: 'P-' + line + '-' + d, kind: 'plated', date: d, line, lineSrc: 'written', slot: 'general', time: '09:00', to: '16:00',
    clientId: 31, client: 'NOVA FORGE', part: 'BRACKET 77', qty: kg, unit: 'KG', basis: 'relay', src: 'paste', at: 1 }));
}
const use = (id: string, itemId: string, kind: string, qty: number, date: string, extra: any = {}) =>
  ({ id, itemId, kind, qty, date, from: date, days: 1, seq: 2, at: 1, source: 'manual', by: 'Owner', ...extra });

/* VAT A1 plates 1,000 kg and VAT A2 500 kg on every working day of the last twenty; the barrel is recorded once. Zinc at ₹300 a kg
   goes into VAT A1 twice, VAT A2 once, the barrel once and nowhere named once; 106 Salt at ₹150 into VAT A1 over two messages. */
function book(a1Days?: string[]): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 31, name: 'NOVA FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 12, effectiveFrom: '2020-04-01' }], itemRates: [] }];
  s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
    ...plated('vat-a1', a1Days || span(20, 1), 1000), ...plated('vat-a2', span(20, 1), 500), ...plated('barrel', [W(15)], 300)] };
  s.stock = { items: [item('Z', 'Zinc', 'ZINC', 'kg', 'charge'), item('S', '106 Salt', '106 SALT', 'kg'), item('B', 'Brightener', 'BRIGHTENER', 'L')], pastes: [], entries: [
    { id: 'BZ', itemId: 'Z', kind: 'bill', qty: 500, price: 300, date: W(25), at: 1, source: 'manual', supplier: 'METAL CO', billNo: '1' },
    { id: 'BS', itemId: 'S', kind: 'bill', qty: 50, price: 150, date: W(25), at: 1, source: 'manual', supplier: 'CHEM CO', billNo: '2' },
    use('Z1', 'Z', 'charged', 60, W(20), { lines: ['vat-a1'], note: 'VAT A1' }),
    use('Z2', 'Z', 'charged', 50, W(10), { lines: ['vat-a1'], note: 'VAT A1' }),
    use('Z3', 'Z', 'charged', 40, W(12), { lines: ['vat-a2'], note: 'VAT A2' }),
    use('Z4', 'Z', 'charged', 30, W(16), { lines: ['barrel'], note: 'BARREL' }),
    use('Z5', 'Z', 'charged', 25, W(18)),
    use('S1', 'S', 'used', 20, W(16), { from: W(18), days: 3, lines: ['vat-a1'], note: 'VAT A1' }),
    use('S2', 'S', 'used', 10, W(6), { from: W(8), days: 3, lines: ['vat-a1'], note: 'VAT A1' }),
    use('B1', 'B', 'used', 12, W(5), { from: W(7), days: 3 }),
  ] };
  return s as SepState;
}
const byLine = (page: Page) => g(page, `(function () { var to = localDateStr(), r = stockByLine(isoAddDays(to, -59), to), o = {};
  PROD_LINES.forEach(function (l) { var L = r.lines[l]; o[l] = { rsKg: L.rsKg == null ? null : Math.round(L.rsKg * 1000) / 1000, soFar: L.soFar, items: {} };
    Object.keys(L.items).forEach(function (id) { var x = L.items[id]; o[l].items[id] = { qty: Math.round(x.qty * 100) / 100, perT: x.perT == null ? null : Math.round(x.perT * 1000) / 1000,
      soFar: x.soFar, est: x.est, on: x.on, rsKg: x.rsKg == null ? null : Math.round(x.rsKg * 1000) / 1000,
      runs: L.runs[id].map(function (u) { return [u.from, u.until, u.open, Math.round(u.qty * 100) / 100, Math.round(u.kg), u.days, u.work, u.perT == null ? null : Math.round(u.perT * 1000) / 1000]; }) }; }); });
  o.unnamed = Object.keys(r.unnamed.items).map(function (id) { return [id, r.unnamed.items[id].qty]; }); return o; })()`) as Promise<any>;

test.describe('P192: stock by line', () => {
  test('the reader: a use bath by bath, each on the day the message gives it; baths that do not add up stay one use', async ({ page }) => {
    await loadAppWithState(page, book());
    const read = (body: string) => g(page, `(function () { var r = parseStockLine(${JSON.stringify(body)}); return { U: r.U, parts: r.useParts && r.useParts.map(function (p) { return [p.qty, p.date, p.baths]; }), issues: r.issues.map(function (i) { return i.code; }) }; })()`) as Promise<any>;
    expect(await read(`ZINK 444 KG  use VAT A 2 / ${dmy(W(4))} 150 kg VAT 1 / ${dmy(W(1))} 175 kg berral use 75 kg available 44 kg`))
      .toEqual({ U: 400, parts: [[150, W(4), ['vat-a2']], [175, W(1), ['vat-a1']], [75, null, ['barrel']]], issues: [] });
    // Two baths before the figure share it; a date before "use" dates it; "use A 2" is the line, never A Salt.
    expect(await read('ZINK add 24/09/26/ 495 kg use berral & vat a1. 51 kg')).toEqual({ U: 51, parts: [[51, null, ['barrel', 'vat-a1']]], issues: [] });
    expect(await read(`106 SOLLT 70 kg ${dmy(W(3)).slice(0, 8)} use V A 1 20 KG available 50 kg`)).toEqual({ U: 20, parts: [[20, W(3), ['vat-a1']]], issues: [] });
    expect(await read('16 SOLLT use A 2 10-10=00 not available')).toEqual({ U: 10, parts: [[10, null, ['vat-a2']]], issues: [] });
    // A use naming no bath has no parts; baths whose figures miss the use stay one use and say so.
    expect(await read('A SOLLT 24-4=20 LTR available')).toEqual({ U: 4, parts: null, issues: [] });
    expect(await read('X 55-25=30 KG use V A 1 15KG V A 2 12 KG')).toEqual({ U: 25, parts: null, issues: ['baths'] });
  });

  test('a pasted message saves a use for each bath, each with its bath and its own words; the line says where it went', async ({ page }) => {
    const s: any = book();
    s.stock.entries = s.stock.entries.filter((e: any) => e.kind === 'bill');
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockPaste"]').first().click();
    await page.locator('#stockPasteText').fill(`Chemical used chemical stock ${dmy(W(4))} ${dmy(W(1))}\n\n1) ZINK 444 KG  use VAT A 2 / ${dmy(W(4))} 150 kg VAT 1 / ${dmy(W(1))} 175 kg berral use 75 kg available 44 kg`);
    await page.locator('[data-action="invStockRead"]').click();
    await page.locator('[data-action="invStockSavePaste"]').click();
    const z = (await readStoredState(page)).stock.entries.filter((e: any) => e.itemId === 'Z' && e.kind === 'charged');
    expect(z.map((e: any) => [e.qty, e.from, e.date, e.days, e.lines, e.note])).toEqual([
      [150, W(4), W(4), 1, ['vat-a2'], 'VAT A2'], [175, W(1), W(1), 1, ['vat-a1'], 'VAT A1'], [75, W(4), W(1), 4, ['barrel'], 'BARREL']]);
    await page.evaluate(() => { (window as any)._stockItemId = 'Z'; (window as any)._stockView = 'item'; (window as any).renderStock(); });
    const row = page.locator('#stockEntries [data-entry]').filter({ has: page.locator('.inv-row-title', { hasText: 'Charged to bath 150 kg' }) });
    await expect(row).toContainText('into VAT A2');
    // The note only names the bath, which "into" says: it is not said twice.
    expect((await row.innerText()).split('VAT A2').length - 1).toBe(1);
  });

  test('read again: a use the reader now splits by bath, or puts in its bath, is listed; one whose note named its one bath is not', async ({ page }) => {
    const s: any = book();
    s.stock.entries = s.stock.entries.filter((e: any) => e.kind === 'bill');
    s.stock.items.push(item('X', '16 Salt', '16 SALT', 'kg'));
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockPaste"]').first().click();
    await page.locator('#stockPasteText').fill(`Chemical used chemical stock ${dmy(W(4))} ${dmy(W(1))}\n\n1) ZINK 444 KG  use VAT A 2 / ${dmy(W(4))} 150 kg VAT 1 / ${dmy(W(1))} 175 kg berral use 75 kg available 44 kg\n\n` +
      '2) 106 SOLLT 70 kg use V A 1 20 KG available 50 kg\n\n3) 16 SOLLT use A 2 10-10=00 not available');
    await page.locator('[data-action="invStockRead"]').click();
    await page.locator('[data-action="invStockSavePaste"]').click();
    // What the reader before the bath was read saved: zinc as one charge with the baths in its note, the salts with no lines.
    await g(page, `(function () { var st = stockData(), z = st.entries.filter(function (e) { return e.itemId === 'Z' && e.kind === 'charged'; });
      var old = Object.assign({}, z[0], { id: 'OLDZ', qty: 400, from: '${W(4)}', date: '${W(1)}', days: 4, note: 'VAT A2 VAT A1 BARREL' }); delete old.lines;
      st.entries = st.entries.filter(function (e) { return z.indexOf(e) < 0; }).concat([old]);
      st.entries.forEach(function (e) { if (e.itemId === 'S' && e.kind === 'used') delete e.lines; if (e.itemId === 'X' && e.kind === 'used') { delete e.lines; e.note = 'A'; } });
      saveState(); })()`);
    const d: any = await g(page, `(function () { var d = stockRereadDiff(stockData().pastes[0]); return { drop: d.drop.map(function (h) { return stockRereadEntryText(h.cur); }), add: d.add.map(stockRereadEntryText) }; })()`);
    // 106 Salt's note named its one bath, VAT A1, as the new reading does: it is not listed.
    expect(d.drop.sort()).toEqual([`16 Salt: used 10 kg on ${short(W(1))}`, `Zinc: charged to bath 400 kg on ${short(W(1))}, into VAT A2 and VAT A1 and Barrel`]);
    expect(d.add.sort()).toEqual([`16 Salt: used 10 kg on ${short(W(1))}, into VAT A2`, `Zinc: charged to bath 150 kg on ${short(W(4))}, into VAT A2`,
      `Zinc: charged to bath 175 kg on ${short(W(1))}, into VAT A1`, `Zinc: charged to bath 75 kg on ${short(W(1))}, into Barrel`]);
    // Stock → To check lists it, and the new reading puts every bath in place.
    await page.evaluate(() => { (window as any)._stockView = 'check'; (window as any).renderStock(); });
    const rr = page.locator('#stockReread [data-paste]');
    await expect(rr).toContainText(`Read now: Zinc: charged to bath 150 kg on ${short(W(4))}, into VAT A2`);
    await rr.locator('[data-action="invStockReread"]').click();
    await answerAsk(page, 'ok');
    const live = (await readStoredState(page)).stock.entries.filter((e: any) => !e.voided && (e.kind === 'charged' || e.kind === 'used'));
    expect(live.map((e: any) => [e.itemId, e.qty, e.lines]).sort()).toEqual([['S', 20, undefined], ['X', 10, ['vat-a2']], ['Z', 150, ['vat-a2']], ['Z', 175, ['vat-a1']], ['Z', 75, ['barrel']]].sort());
  });

  test('so much a tonne: each addition until the next into the same bath, the last still in it apart; ₹ a kg at the price paid', async ({ page }) => {
    await loadAppWithState(page, book());
    const r = await byLine(page);
    // VAT A1, zinc: 60 kg drawn on to the day before the next, ten working days of 1,000 kg, 6 kg a tonne; the 50 kg after it is
    // still in the bath, 5 so far, and kept out of the line's figure. ₹300 × 60 over 10,000 kg.
    expect(r['vat-a1'].items.Z).toEqual({ qty: 110, perT: 6, soFar: false, est: false, on: 1, rsKg: 1.8,
      runs: [[W(20), dayBefore(W(10)), false, 60, 10000, 10, 10, 6], [W(10), T(), true, 50, 10000, 10, 10, 5]] });
    // 106 Salt over a message's days is an addition too: 20 kg until the next message's first day, then 10 so far.
    expect(r['vat-a1'].items.S).toEqual({ qty: 30, perT: 2, soFar: false, est: false, on: 1, rsKg: 0.3,
      runs: [[W(18), dayBefore(W(8)), false, 20, 10000, 10, 10, 2], [W(8), T(), true, 10, 8000, 8, 8, 1.25]] });
    expect(r['vat-a1'].rsKg).toBe(2.1);
    // VAT A2's only addition is still in the bath: its figure is so far, and the line has no rupees a kilogram yet.
    expect(r['vat-a2'].items.Z).toMatchObject({ qty: 40, perT: 6.667, soFar: true, on: 1 });
    expect([r['vat-a2'].rsKg, r['vat-a2'].soFar]).toEqual([null, 1]);
    // The barrel is recorded on one of the sixteen working days since its zinc went in: nothing is set against it.
    expect(r.barrel.items.Z).toMatchObject({ qty: 30, perT: null, on: 0 });
    expect(r.barrel.items.Z.runs[0].slice(5)).toEqual([1, 16, null]);
    // What names no bath is the plant's.
    expect(r.unnamed).toEqual([['Z', 25], ['B', 12]]);
  });

  test('days with no record are filled at the pace of those with one, said as an estimate; a shared use goes by what each plated', async ({ page }) => {
    const s: any = book(span(20, 1).filter(d => d !== W(13) && d !== W(12)));
    // 30 kg into VAT A1 and VAT A2 together on a day both plated; 10 kg into VAT A1 and the barrel on a day the barrel has no record.
    s.stock.entries.push(use('Z6', 'Z', 'charged', 30, W(4), { lines: ['vat-a1', 'vat-a2'] }), use('Z7', 'Z', 'charged', 12, W(3), { lines: ['vat-a1', 'barrel'] }));
    await loadAppWithState(page, s);
    const r = await byLine(page);
    // Eight of the ten days recorded: the 8,000 kg read as 10,000 at their pace, so the 60 kg is still 6 a tonne, an estimate. The
    // line's figure is every addition drawn on to the next: 60 + 50 + 20 kg over 10,000 + 6,000 + 1,000 kg, the last still in the bath.
    expect(r['vat-a1'].items.Z.runs[0]).toEqual([W(20), dayBefore(W(10)), false, 60, 8000, 8, 10, 6]);
    expect([r['vat-a1'].items.Z.perT, r['vat-a1'].items.Z.est, r['vat-a1'].items.Z.on]).toEqual([7.647, true, 3]);
    // 1,000 against 500 kg on the day: 20 and 10. The barrel not recorded that day: evenly, 6 and 6.
    const a1 = r['vat-a1'].items.Z.runs.map((x: any) => [x[0], x[3]]), a2 = r['vat-a2'].items.Z.runs.map((x: any) => [x[0], x[3]]);
    expect(a1.filter((x: any) => x[0] === W(4) || x[0] === W(3))).toEqual([[W(4), 20], [W(3), 6]]);
    expect(a2.filter((x: any) => x[0] === W(4))).toEqual([[W(4), 10]]);
    expect(r.barrel.items.Z.runs.filter((x: any) => x[0] === W(3)).map((x: any) => x[3])).toEqual([6]);
  });

  test('no figure says why: a line recorded with nothing weighed, apart from one recorded too seldom', async ({ page }) => {
    const s: any = book();
    // The barrel recorded every day, in pieces of a part nothing weighs.
    s.production.entries = s.production.entries.filter((e: any) => e.line !== 'barrel').concat(span(20, 1).map(d => ({ id: 'PB-' + d, kind: 'plated', date: d,
      line: 'barrel', lineSrc: 'written', slot: 'general', time: '09:00', to: '16:00', clientId: 31, client: 'NOVA FORGE', part: 'WIDGET X', qty: 100, unit: 'NOS',
      basis: 'relay', src: 'paste', at: 1 })));
    await loadAppWithState(page, s);
    expect(await g(page, `(function () { var to = localDateStr(), L = stockByLine(isoAddDays(to, -59), to).lines.barrel.items.Z; return [L.perT, L.why]; })()`)).toEqual([null, 'no plating weighed']);
    await loadAppWithState(page, book());
    expect(await g(page, `(function () { var to = localDateStr(), L = stockByLine(isoAddDays(to, -59), to).lines.barrel.items.Z; return [L.perT, L.why]; })()`)).toEqual([null, 'too few days recorded']);
  });

  test('the line’s rupees a kilogram says what it leaves out: a stock line with no price reads it low', async ({ page }) => {
    const s: any = book();
    s.stock.entries.push(use('B2', 'B', 'used', 6, W(14), { lines: ['vat-a1'] }), use('B3', 'B', 'used', 4, W(4), { lines: ['vat-a1'] }));
    await loadAppWithState(page, s);
    await page.evaluate(() => { (window as any)._prodLine = 'vat-a1'; (window as any).prodSetTab('lines'); (window as any).switchTab('pageProduction'); });
    const t = page.locator('#prodLineStock [data-prod-line-stock-total]');
    await expect(t.locator('.inv-row-end')).toHaveText('₹2.10/kg');
    await expect(t.locator('.inv-row-meta')).toHaveText('1 with no price: reads low');
    await expect(page.locator('#prodLineStock [data-prod-line-stock="B"] .inv-row-meta')).toHaveText('no price · 2 additions');
  });

  // Drawn as an analysis (§6.27): a row a line, its figure at the end; what it rests on folded under it, one fact a row.
  const facts = (loc: any) => loc.evaluateAll((els: Element[]) => els.map(r => [r.querySelector('.inv-row-title')!.textContent!.trim(),
    (r.querySelector('.inv-row-meta') || { textContent: '' }).textContent!.trim(), r.querySelector('.inv-row-end')!.textContent!.trim()]));

  test('Stock → Zinc: a row a line with its figure, the additions folded under it, what named no bath apart', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate(() => { (window as any)._stockItemId = 'Z'; (window as any)._stockView = 'item'; (window as any).switchTab('pageStock'); });
    const p = page.locator('#stockByLine');
    expect(await facts(p.locator('summary[data-stock-line], [data-stock-unnamed]'))).toEqual([
      ['VAT A1', '₹1.80/kg · 2 additions', '6 kg/t'],
      ['VAT A2 so far', '≈ ₹2.00/kg · 1 addition', '≈ 6.7 kg/t'],
      ['Barrel', 'too few days recorded', '—'],
      ['No bath named', 'the plant’s', '25 kg']]);
    // Shut until opened: each addition against what the line plated until the next, the last so far.
    const a1 = p.locator('details:has(> summary[data-stock-line="vat-a1"])');
    await expect(a1).not.toHaveAttribute('open', '');
    await a1.locator('summary').click();
    expect(await facts(a1.locator('[data-stock-add]'))).toEqual([
      [`${short(W(20))} · 60 kg`, `10.0 t to ${short(dayBefore(W(10)))}`, '6 kg/t'],
      [`${short(W(10))} · 50 kg`, '10.0 t so far', '5 kg/t']]);
    expect(await facts(p.locator('[data-stock-add="barrel"]'))).toEqual([[`${short(W(16))} · 30 kg`, '1 of 16 days recorded', '—']]);
    // A chemical whose uses name no bath says how one can.
    await page.evaluate(() => { (window as any)._stockItemId = 'B'; (window as any).renderStock(); });
    await expect(page.locator('#stockByLine')).toContainText('None of the 12 L used names its bath');
  });

  test('Production → Lines: into the bath, so much a tonne and ₹ a kg plated; ₹ only for a role that sees money', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate(() => { (window as any)._prodLine = 'vat-a1'; (window as any).prodSetTab('lines'); (window as any).switchTab('pageProduction'); });
    const p = page.locator('#prodLineStock');
    expect(await facts(p.locator('.inv-row'))).toEqual([
      ['Zinc', '₹1.80/kg · 2 additions', '6 kg/t'],
      ['106 Salt', '₹0.30/kg · 2 additions', '2 kg/t'],
      ['All of it', '', '₹2.10/kg'],
      ['No bath named', 'the plant’s, not in these', '2 uses']]);
    // A row opens the stock line's page.
    await p.locator('[data-prod-line-stock="S"]').click();
    await expect(page.locator('#stockByLine summary[data-stock-line="vat-a1"]')).toContainText('2 additions');
    // VAT A2: every stock line still on its first addition, so the line has no figure yet.
    await page.evaluate(() => { (window as any)._prodLine = 'vat-a2'; (window as any).prodSetTab('lines'); (window as any).switchTab('pageProduction'); });
    expect(await facts(page.locator('#prodLineStock .inv-row'))).toEqual([
      ['Zinc so far', '≈ ₹2.00/kg · 1 addition', '≈ 6.7 kg/t'],
      ['All of it', 'each still on a first addition', '—'],
      ['No bath named', 'the plant’s, not in these', '2 uses']]);
    // A role that does not see money sees the quantities and no rupee.
    await page.evaluate(() => { (window as any)._prodLine = 'vat-a1'; (window as any).grdSeesMoney = () => false; (window as any).renderProduction(); });
    expect(await facts(page.locator('#prodLineStock .inv-row'))).toEqual([['Zinc', '2 additions', '6 kg/t'], ['106 Salt', '2 additions', '2 kg/t'], ['No bath named', 'the plant’s, not in these', '2 uses']]);
    await expect(page.locator('#prodLineStock')).not.toContainText('₹');
  });

  test('Floor: a line’s card says what went into its bath that day, a fact a row; a use over several days on the day it ends', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate((d) => { (window as any).flrSetDay(d); (window as any).switchTab('pageFloor'); }, W(10));
    expect(await facts(page.locator('.inv-hero[data-line="vat-a1"] [data-flr-bath]'))).toEqual([['Zinc into the bath', '', '50 kg']]);
    await expect(page.locator('.inv-hero[data-line="vat-a2"] [data-flr-bath]')).toHaveCount(0);
    await page.evaluate((d) => { (window as any).flrSetDay(d); (window as any).renderFloor(); }, W(16));
    expect(await facts(page.locator('.inv-hero[data-line="vat-a1"] [data-flr-bath]'))).toEqual([['106 Salt into the bath', spanText(W(18), W(16)), '20 kg']]);
    expect(await facts(page.locator('.inv-hero[data-line="barrel"] [data-flr-bath]'))).toEqual([['Zinc into the bath', '', '30 kg']]);
  });

  test('a use typed by hand takes its bath from Into', async ({ page }) => {
    const s: any = book();
    s.stock.entries = s.stock.entries.filter((e: any) => e.kind === 'bill');
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockManual"]').first().click();
    await page.locator('[data-action="invStockMode"][data-mode="used"]').click();
    await page.locator('#stockManBath').fill('V A1');
    await page.locator('[data-stock-qty="S"]').fill('5');
    await page.locator('[data-action="invStockSaveManual"]').click();
    const e = (await readStoredState(page)).stock.entries.find((x: any) => x.itemId === 'S' && x.kind === 'used');
    expect([e.qty, e.lines, e.note]).toEqual([5, ['vat-a1'], 'V A1']);
    await expect(page.locator('#stockDayEntries')).toContainText('into VAT A1');
  });
});
