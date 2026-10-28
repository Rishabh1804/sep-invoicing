import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openAttendance, openPulse, recentTs, setFilter, switchTab, todayIso, toolbarMoreLabels, type SepState, openWidget } from './fixtures';
import { longBook } from './load-fixture';

// P194 (docs/TAB_MAP.md TM6): across the app. A fact is drawn in one tone wherever it is drawn (TM6a: on site against the roster,
// heads against the day's number, what is owed by its age, a client below the cost); the period not yet ended is marked in every
// chart that has one (TM6b); History's toolbar is one row with its filters behind Filter (TM6c); Training says how its lessons stand
// and each row its own standing (TM6d); a row says two facts (TM6e); the screens no step had touched are in one look (TM6f). Names
// and figures are made up; dates are built from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };

/* The tone an element is drawn in: its own tone class (a hero, a tile, a figure, a dot), else its first toned descendant's. */
const toneOf = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => {
  const re = /^inv-(?:hero|tile|fig|dot)-(ok|warning|danger|info|neutral)$/;
  const of = (e: Element) => { for (const c of Array.from(e.classList)) { const m = re.exec(c); if (m) return m[1]; } return null; };
  const own = of(el);
  if (own) return own;
  for (const d of Array.from(el.querySelectorAll('*'))) { const t = of(d); if (t) return t; }
  return 'none';
});
/* Rows of a toolbar as P195 counts them: its controls standing side by side (their heights overlap) are one row. */
const toolbarRows = (page: Page, sel: string) => page.locator(sel).first().evaluate(tb => {
  const rs = Array.from(tb.children).map(c => (c as HTMLElement).getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top);
  let n = 0, bottom = -Infinity;
  rs.forEach(r => { if (r.top >= bottom - 1) { n++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom); });
  return n;
});

/* ---------- The floor: ten hands, `present` of them on site today ---------- */
function floorBook(present: number, extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const areas = ['vat-a1', 'vat-a1', 'vat-a1', 'vat-a2', 'vat-a2', 'barrel', 'barrel', 'barrel', 'office', 'gate'];
  s.staff = areas.map((a, i) => ({ id: i + 1, name: 'Hand ' + 'ABCDEFGHIJ'[i], comp: 'hourly', area: a, hourRate: 60, active: true, onFloor: a !== 'office' && a !== 'gate' }));
  const marks: any = {};
  // The absent are the last on the list (the office and the gate first), so the floor's heads stay as set.
  s.staff.forEach((w: any, i: number) => { marks[w.id] = (10 - i) <= (10 - present) ? { st: 'A', area: w.area, hours: 0, ot: 0 } : { st: 'P', area: w.area, hours: 8, ot: 0 }; });
  s.attendance = { [todayIso()]: { marks, extra: [], note: '' } };
  return Object.assign(s, extra);
}

test.describe('P194: TM6a, one tone per fact', () => {
  for (const [present, tone] of [[8, 'warning'], [7, 'danger']] as const) {
    test(`on site against the roster, ${present} of 10, is ${tone} on Floor, Attendance, Pulse and the day’s report`, async ({ page }) => {
      await loadAppWithState(page, floorBook(present));
      expect(await ev(page, `attOnSiteTone(attDaySummary('${todayIso()}'))`)).toBe(tone);
      await switchTab(page, 'pageFloor');
      expect(await toneOf(page, '#flrHeroes [data-card="flr-people"]'), 'Floor’s People').toBe(tone);
      expect(await toneOf(page, '#flrAtt [data-att-onsite]'), 'Floor’s attendance panel').toBe(tone);
      await switchTab(page, 'pageStaff');
      await openAttendance(page, 'day');
      expect(await toneOf(page, '#pageStaff [data-verdict]'), 'Attendance’s verdict').toBe(tone);
      expect(await toneOf(page, '#pageStaff .inv-tile:has(#attOnSite)'), 'Attendance’s On site').toBe(tone);
      await openPulse(page);
      expect(await toneOf(page, '#pageHome [data-card="attendance"]'), 'Pulse’s Attendance').toBe(tone);
      expect(await toneOf(page, '#homeAtt [data-att-onsite]'), 'Pulse’s attendance panel').toBe(tone);
      await switchTab(page, 'pageReports');
      await page.locator('[data-action="invRptKind"][data-kind="daily"]').click();
      expect(await toneOf(page, '#rptSheet [data-rpt-p="onsite"]'), 'the day’s report').toBe(tone);
    });
  }

  test('heads against the day’s number, per area: short a warning, met ok, over info, on every screen that draws them', async ({ page }) => {
    // VAT A1 three against four, VAT A2 two against two, the barrel three against one.
    await loadAppWithState(page, floorBook(10, { areaTargets: { 'vat-a1': 4, 'vat-a2': 2, barrel: 1 } }));
    const want: Record<string, string> = { 'vat-a1': 'warning', 'vat-a2': 'ok', barrel: 'info' };
    expect(await ev(page, `[areaNeedTone(3, 4), areaNeedTone(2, 2), areaNeedTone(3, 1), areaNeedTone(3, null)]`)).toEqual(['warning', 'ok', 'info', null]);
    expect(await ev(page, `[areaNeedWord(3, 4), areaNeedWord(2, 2), areaNeedWord(3, 1)]`)).toEqual(['Short 1', 'Met', '2 over']);
    await switchTab(page, 'pageFloor');
    for (const a of Object.keys(want)) {
      expect(await toneOf(page, `#flrLines [data-line="${a}"] [data-flr-staff]`), 'Floor’s ' + a + ' card').toBe(want[a]);
      expect(await toneOf(page, `#flrAtt [data-alloc="${a}"]`), 'Floor’s panel, ' + a).toBe(want[a]);
    }
    await switchTab(page, 'pageStaff');
    await openAttendance(page, 'day');
    for (const a of Object.keys(want)) {
      expect(await toneOf(page, `[data-att-area-card="${a}"] .inv-panel-head`), 'Day’s board, ' + a).toBe(want[a]);
      expect(await toneOf(page, `#attNeed [data-need-area="${a}"]`), 'Needed today, ' + a).toBe(want[a]);
    }
    await page.locator('[data-action="invAttView"][data-view="areas"]').click();
    for (const a of Object.keys(want)) expect(await toneOf(page, `[data-area-row="${a}"] .inv-row-end`), 'Areas, ' + a).toBe(want[a]);
    await openPulse(page);
    for (const a of Object.keys(want)) expect(await toneOf(page, `#homeAtt [data-alloc="${a}"]`), 'Pulse’s panel, ' + a).toBe(want[a]);
  });

  /* ---------- What is owed: two invoices 100 and 95 days old, nothing paid. A receipt with no client makes it a warning. ---------- */
  let seq = 0;
  function row(date: string, narration: string, dr: number, cr: number) {
    return { id: 'BK-T' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: seq, importId: 'BI-T' };
  }
  function inv(n: number, date: string, total: number) {
    const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
    return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
      clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
      taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
  }
  function owedBook(loose: boolean): SepState {
    seq = 0;
    const rows = [row(day(-120), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)];
    if (loose) rows.push(row(day(-5), 'NEFT-UNKNOWN PARTY', 0, 5000));
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '20AAAAA0000A1Z5', address: '', isActive: true, rates: [], itemRates: [],
      add1: 'PLOT 1', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20', mobile: '98765 43210' }];
    s.invoices = [inv(1, day(-100), 23600), inv(2, day(-95), 11800)];
    s.bank = { rows, imports: [{ id: 'BI-T', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
      parties: {}, opening: {}, gstNotes: {} };
    return s as SepState;
  }
  for (const [loose, tone] of [[false, 'danger'], [true, 'warning']] as const) {
    test(`owed over 90 days is ${tone}${loose ? ' while a receipt has no client' : ''} on Receivables, Money, Pulse, Pipeline, the client and the statement`, async ({ page }) => {
      await loadAppWithState(page, owedBook(loose));
      expect(await ev(page, `finCtx().loose()`)).toBe(loose ? 1 : 0);
      // Past 90 days danger, never while a receipt has no client; past 60 warning; younger, nothing to judge.
      expect(await ev(page, `[figToneOwed(100, false), figToneOwed(100, true), figToneOwed(70, true), figToneOwed(10, true)]`)).toEqual(['danger', 'warning', 'warning', null]);
      await switchTab(page, 'pageFinance');
      await page.locator('#pageFinance [data-action="invFinTab"][data-tab="receipts"]').click();
      expect(await toneOf(page, '#pageFinance [data-recv="1"] .inv-row-end'), 'Receivables').toBe(tone);
      await page.locator('#pageFinance [data-action="invFinTab"][data-tab="overview"]').click();
      expect(await toneOf(page, '#finOwed'), 'Money’s owed card').toBe(tone);
      await openWidget(page, 'money');   // the Money widget, put on Home's board: Pulse's presets hid it (TM2c)
      expect(await toneOf(page, '#homeFin [data-home-fin="Owed to us"]'), 'Home’s Money').toBe(tone);
      await switchTab(page, 'pagePipeline');
      expect(await toneOf(page, '[data-pipe-stage="owed"]'), 'Pipeline’s Owed to us').toBe(tone);
      // The client's Money panel: on its Performance (the phone opens a client there; the desktop's pane draws the same panel).
      await switchTab(page, 'pageClients');
      await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
      expect(await toneOf(page, '[data-client-money="1"] .inv-row-end'), 'the client’s Money').toBe(tone);
      await ev(page, `soaOpen(1)`);
      expect(await toneOf(page, '[data-soa-owed]'), 'the statement').toBe(tone);
    });
  }

  test('below the cost: a reprice move is red where Stats draws the client in danger, amber where in warning', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const r: any = await ev(page, `(function() {
      var ctx = advCtx(statsPulseArgs('qtd')), m = ctx.margins(), out = [];
      (m ? m.ranked : []).filter(function(x) { return x.vsFull < 0; }).forEach(function(x) {
        var mv = advRepriceMove(ctx, x);
        out.push({ id: String(x.id), judge: figToneAgainst(x.net, m.fullKg, 5), move: mv.tone });
      });
      return out;
    })()`);
    expect(r.length, 'a client below the cost in the long book').toBeGreaterThan(0);
    for (const x of r) expect(x.move, 'client ' + x.id).toBe(x.judge === 'danger' ? 'red' : 'amber');
    // Where the old rule (red only below the variable cost) and the one judge part: 20% under the full cost and over the variable
    // cost is red; 2% under it, amber.
    const parted: any = await ev(page, `(function() {
      var ctx = advCtx(statsPulseArgs('qtd')), c = S.clients[0];
      ctx.margins = function() { return { fullKg: 10, varKg: 7, kg: 1000, c: { measuredShare: 1 }, ranked: [] }; };
      return [advRepriceMove(ctx, { id: c.id, name: c.name, net: 8, kg: 500, vsFull: -2, vsVar: 1 }).tone,
        advRepriceMove(ctx, { id: c.id, name: c.name, net: 9.8, kg: 500, vsFull: -0.2, vsVar: 2.8 }).tone];
    })()`);
    expect(parted).toEqual(['red', 'amber']);
    // Stats → By client draws the same judge on the same figure.
    await ev(page, `_statsPeriod = 'qtd'`);
    await switchTab(page, 'pageStats');
    await page.locator('[data-action="invStatsTab"][data-tab="clients"]').click();
    for (const x of r) {
      const cell = `#pageStats tr[data-client-id="${x.id}"] [data-margin-net]`;
      if (await page.locator(cell).count()) expect(await toneOf(page, cell), 'Stats, client ' + x.id).toBe(x.judge);
    }
  });
});

test.describe('P194: TM6b, the period to date', () => {
  test('every chart with a period not yet ended marks it: dashed or lighter, labelled to date', async ({ page }) => {
    test.setTimeout(180_000);
    await loadAppWithState(page, longBook());
    const marked = (where: string) => expect.poll(() => page.locator('.inv-page-active .inv-chart-todate').count(), where).toBeGreaterThan(0);
    await openPulse(page);
    // Home's cards mark it where they draw a period still running (U2R, §24f): Month to date's small bars at Small, this month
    // hatched and lighter, its bar's title saying "to date".
    await page.evaluate(() => { const w = window as any; ['desk', 'phone'].forEach((l: string) => w.wdgItemsPut('home', l, [['mtd', 's'], ['q-money', 's']])); w.renderHome(); });
    await marked('Home’s small bars');
    await expect(page.locator('#homeBoard [data-w="mtd"] .inv-minibar.inv-chart-todate')).toHaveCount(1);
    await expect(page.locator('#homeBoard [data-w="mtd"] .inv-minibar-slot:has(.inv-chart-todate) title')).toContainText('to date');
    await switchTab(page, 'pageStats');
    await page.locator('[data-action="invStatsTab"][data-tab="trends"]').click();
    await marked('Trends');
    await expect(page.locator('#pageStats text.inv-chart-axis', { hasText: 'to date' }).first()).toBeAttached();
    await switchTab(page, 'pageFinance');
    await page.locator('#pageFinance [data-action="invFinTab"][data-tab="overview"]').click();
    await marked('Money’s Overview');
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
    await marked('Performance');
    await switchTab(page, 'pagePower');
    await marked('Power’s cuts by month');
    // The long book's marks end yesterday, so on a Sunday or a Monday the pay week still running holds no day and draws no
    // bar to mark: today is marked as the last day was.
    await ev(page, `(function () { var last = Object.keys(S.attendance).sort().pop();
      S.attendance[localDateStr()] = JSON.parse(JSON.stringify(S.attendance[last])); })()`);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await marked('Pay’s weekly payout');
    // The helpers: a point named past the series, or none, marks nothing.
    expect(await ev(page, `[chartToDateAt(['2026-08', '2026-09'], '2026-09'), chartToDateAt(['2026-08'], '2026-09'), chartToDateLabel('Oct')]`)).toEqual([1, null, 'Oct to date']);
  });
});

test.describe('P194: TM6c–TM6f', () => {
  test('History is one toolbar row on the phone: search, Filter and More; a filter applied is a token under it', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').first().click();
    await page.locator('#pageHistory.inv-page-active').waitFor();
    expect(await toolbarRows(page, '#pageHistory [data-history-toolbar]')).toBe(1);
    await expect(page.locator('#pageHistory [data-history-toolbar] [data-action="invTbFilter"]')).toBeVisible();
    expect(await toolbarMoreLabels(page)).toEqual(['Export CSV']);
    await setFilter(page, '#historyType', 'invoice');
    await expect(page.locator('#pageHistory .inv-tokens [data-clear="kind"]')).toBeVisible();
    expect(await toolbarRows(page, '#pageHistory [data-history-toolbar]')).toBe(1);
    // A change in the log says its record, then what moved: two facts, never a chain of them.
    expect(await ev(page, `chgText({ by: null, op: 'change', coll: 'invoices', rid: 'X', label: 'SEP/T/00001 · ALPHA', fields: [{ f: 'rate', from: 13, to: 13.2 }, { f: 'qty', from: 3, to: 4 }, { f: 'note', from: 'a', to: 'b' }] }, false, { rec: function() { return null; } })`))
      .toMatch(/^.* changed invoice SEP\/T\/00001, ALPHA: .*13 → 13\.2; .*3 → 4; \+1 more$/);
    // A void says why, in the words typed (who is the head's); a record's name too long for a row loses its last parts, and the
    // whole is the row's title, the pane's and the CSV's (TM6e). A made-up record.
    const entry = `{ by: null, op: 'change', coll: 'production.entries', rid: 'P1', label: 'plated, VAT A1, ALPHA PRESSINGS PRIVATE LIMITED, L Bracket Assembly 2207, 1000 NOS, 10 Oct 2026',
      fields: [{ f: 'voidedAt', from: null, to: 1 }, { f: 'voidReason', from: null, to: 'Incorrect part number' }, { f: 'voidBy', from: null, to: 'Clerk' }] }`;
    const row: string = await ev(page, `chgText(${entry}, false, { rec: function() { return null; } })`);
    expect(row.length, row).toBeLessThanOrEqual(110);
    expect(row).toMatch(/^Someone voided production entry plated, VAT A1, .*, …: “Incorrect part number”$/);
    expect(row).not.toContain('Clerk');
    const whole: string = await ev(page, `chgText(${entry}, true, { rec: function() { return null; } })`);
    expect(whole).toContain('L Bracket Assembly 2207, 1000 NOS, 10 Oct 2026: reason — → Incorrect part number; by — → Clerk');
  });

  test('Training leads with how its lessons stand, and each row says its own standing in its tone', async ({ page }) => {
    const art = (id: string, title: string, version: number) => ({ id, kind: 'guide', title, summary: 'About ' + title, body: 'Text.', tags: [], links: [], roles: [], status: 'published',
      version, versions: [], src: 'app', by: 'Owner', at: 1 });
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.staff = [{ id: 1, name: 'Hand A', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true }];
    s.kb = { articles: [art('G1', 'Rinsing', 2), art('G2', 'Racking', 1), art('G3', 'Drying', 1)],
      trained: [{ id: 't1', staffId: 1, name: 'Hand A', articleId: 'G1', v: 1, at: 5, on: day(-30) }, { id: 't3', staffId: 1, name: 'Hand A', articleId: 'G3', v: 1, at: 6, on: day(-30) }],
      paths: [{ id: 'kbp-t', title: 'Floor basics', role: 'floor', articles: ['G1', 'G2', 'G3'] }] };
    await loadAppWithState(page, s as SepState);
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="training"]').click();
    const v = page.locator('#knowContent > [data-verdict]').first();
    // The app's own paths for the other roles are counted too (never taught, here); the book's path replaces the floor's.
    await expect(v.locator('.inv-hero-title')).toHaveText(/^1 due again · \d+ never taught · 1 up to date$/);
    expect(await toneOf(page, '#knowContent > [data-verdict]')).toBe('warning');
    expect(await toneOf(page, '[data-kb-lesson="G1"] .inv-row-end')).toBe('warning');
    expect(await toneOf(page, '[data-kb-lesson="G2"] .inv-row-end')).toBe('info');
    expect(await toneOf(page, '[data-kb-lesson="G3"] .inv-row-end')).toBe('ok');
    // The verdict first, then the one toolbar row.
    await expect(page.locator('#knowContent > [data-verdict] + .inv-toolbar')).toHaveCount(1);
  });

  test('Knowledge: Start’s heroes; the Library’s verdict, one row with the kinds behind Filter, Write the primary, Export and Import behind More', async ({ page }) => {
    const art = (id: string, kind: string, title: string, extra: any = {}) => ({ id, kind, title, summary: 'About ' + title, body: 'Text.', tags: [], links: [], roles: [],
      status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra });
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.kb = { articles: [art('A1', 'guide', 'Washing the jigs', { status: 'pending' }), art('A2', 'process', 'Pickling', { status: 'draft' }),
      art('A3', 'decision', 'A second rectifier', { decidedOn: day(-40), reviewOn: day(-1) }), art('A4', 'fault', 'Peeling', { symptom: 'The deposit peels', causes: [] }),
      art('A5', 'incident', 'Peeling on VAT A1', { on: day(-3), faultId: 'A4' })], trained: [], paths: [] };
    await loadAppWithState(page, s as SepState);
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="start"]').click();
    // Start: heroes, the first carrying the verdict; what waits on the owner opens on its rows.
    // Only what holds something (training due again holds nothing here).
    await expect(page.locator('#kbStartHeroes > .inv-hero')).toHaveCount(3);
    await expect(page.locator('#kbWaiting')).toHaveAttribute('data-verdict', '');
    expect(await toneOf(page, '#kbWaiting')).toBe('warning');
    await expect(page.locator('#kbWaiting [data-kb-row="A1"]')).toBeVisible();
    expect(await toneOf(page, '#kbDrafts')).toBe('info');
    expect(await toneOf(page, '#kbReviewDue')).toBe('warning');
    await expect(page.locator('#kbTrainDue')).toHaveCount(0);
    // A card says its count in its line, never again as a figure over it, and a fact only where it is news (I10).
    await expect(page.locator('#kbStartHeroes .inv-hero-fig')).toHaveCount(0);
    await expect(page.locator('#kbWaiting .inv-hero-title')).toHaveText('1 article to approve');
    await expect(page.locator('#kbDrafts .inv-hero-sub')).toHaveCount(0);
    await expect(page.locator('#kbReviewDue .inv-hero-sub')).toHaveText('the first due ' + await ev(page, `formatDate('${day(-1)}')`));
    // On the phone the first card opens on its rows; the rest wait shut, their line saying what they hold.
    expect(await page.locator('#kbDrafts').evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    expect(await page.locator('#kbReviewDue').evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    // The Library: its verdict, then one row.
    await page.locator('#knowContent .inv-viewtab[data-tab="library"]').click();
    await expect(page.locator('#knowContent [data-kb-verdict="library"] .inv-hero-title')).toHaveText(/^\d+ articles · 1 waiting for approval$/);
    expect(await toolbarRows(page, '#knowContent [data-kb-toolbar]')).toBe(1);
    await expect(page.locator('#knowContent [data-kb-toolbar] [data-action="invKbNew"].inv-btn-primary')).toHaveText('Write');
    expect(await toolbarMoreLabels(page)).toEqual(['Export', 'Import']);
    await expect(page.locator('#knowContent .inv-chip[data-action="invKbKind"]')).toHaveCount(0);
    await setFilter(page, '#kbKindFilter', 'guide');
    await expect(page.locator('#knowContent [data-kb-tokens] [data-clear="kind"]')).toContainText('How-tos');
    await expect(page.locator('#kbLibrary [data-kb-row="A2"]')).toHaveCount(0);
    await expect(page.locator('#kbLibrary [data-kb-row="A1"]')).toBeVisible();
    await page.locator('#knowContent [data-kb-tokens] [data-clear="kind"]').click();
    // With nothing picked the Library leads with its shelves (KB2-1).
    await expect(page.locator('#kbShelves [data-kb-card="A2"]')).toBeVisible();
    // Troubleshoot: an incident in the last 30 days is a warning; Log an incident the primary, Write a fault behind More.
    await page.locator('#knowContent .inv-viewtab[data-tab="troubleshoot"]').click();
    await expect(page.locator('#knowContent [data-kb-verdict="troubleshoot"] .inv-hero-title')).toHaveText('1 fault written · 1 incident in 30 days');
    expect(await toneOf(page, '#knowContent [data-kb-verdict="troubleshoot"]')).toBe('warning');
    await expect(page.locator('#knowContent [data-kb-toolbar] .inv-btn-primary')).toHaveText('Log an incident');
    expect(await toolbarMoreLabels(page)).toEqual(['Write a fault']);
    // Records: a decision due for review.
    await page.locator('#knowContent .inv-viewtab[data-tab="records"]').click();
    await expect(page.locator('#knowContent [data-kb-verdict="records"] .inv-hero-title')).toContainText('1 decision due for review');
  });

  test('Knowledge’s Start with nothing waiting is one card saying so', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="start"]').click();
    await expect(page.locator('#kbStartHeroes > .inv-hero')).toHaveCount(1);
    await expect(page.locator('#kbAllClear')).toHaveAttribute('data-verdict', '');
    await expect(page.locator('#kbAllClear .inv-hero-title')).toHaveText('Nothing waits on you');
  });

  test('Reports: Print is the action bar’s, the toolbar two rows on the phone; Invoiced leads with its verdict', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    const rows = await page.locator('#reportsContent > .inv-toolbar').evaluateAll(tbs => {
      const rs: [number, number][] = [];
      tbs.forEach(tb => Array.from(tb.children).forEach(c => { const r = (c as HTMLElement).getBoundingClientRect(); if (r.width && r.height) rs.push([r.top, r.bottom]); }));
      rs.sort((a, b) => a[0] - b[0]);
      let n = 0, bottom = -Infinity;
      rs.forEach(([t, b]) => { if (t >= bottom - 1) { n++; bottom = b; } else bottom = Math.max(bottom, b); });
      return n;
    });
    expect(rows).toBeLessThanOrEqual(2);
    await expect(page.locator('#reportsContent .inv-actionbar [data-action="invRptPrint"].inv-btn-primary')).toBeVisible();
    await expect(page.locator('#reportsContent .inv-toolbar [data-action="invRptPrint"]')).toHaveCount(0);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
    await expect(page.locator('#imVerdict [data-im-invoiced] .inv-hero-title')).toHaveText(/^\d+ challans? invoiced in [A-Z][a-z]{2} \d{4} · ₹/);
    await expect(page.locator('#imVerdict [data-im-invoiced]')).toContainText('by challan date');
    // One toolbar: the month ‹ › inside its row, Filter and More, which holds Add challan on this view (the Scan came out).
    await expect(page.locator('#pageIM .inv-toolbar')).toHaveCount(1);
    await expect(page.locator('#pageIM [data-im-toolbar] [data-im-month]')).toBeVisible();
    expect(await toolbarMoreLabels(page)).toEqual(['Add challan', 'Duplicate check']);
  });

  test('a row says two facts: the day board, the insights, a power cut’s why', async ({ page }) => {
    await loadAppWithState(page, floorBook(9));
    await switchTab(page, 'pageStaff');
    await openAttendance(page, 'day');
    const facts = (t: string) => t.split('·').map(x => x.trim()).filter(Boolean).length;
    for (const m of await page.locator('#attMarks [data-att-row] .inv-row-meta').allTextContents()) expect(facts(m), m).toBeLessThanOrEqual(2);
    // Present is the pressed P and is not said; an absence is.
    await expect(page.locator('[data-att-row="1"] .inv-row-meta')).toHaveText('Hourly · 8 h');
    await expect(page.locator('[data-att-row="10"] .inv-row-meta')).toHaveText('Hourly · Absent');
    // The insights' subs, with how sure where one is said.
    const subs: string[] = await ev(page, `(function() {
      var out = [];
      [{ rule: 'x', sub: 'Median of the 6 before: ₹8.32', conf: { level: 'early', say: '9 working days into the month' } }].forEach(function(t) { out.push(todoConfApply(t).sub); });
      return out;
    })()`);
    for (const s of subs) expect(facts(s), s).toBeLessThanOrEqual(2);
    // A cut's why: the reason with where it hit, a unit and its line one fact, then what brought it back.
    const why: string = await ev(page, `(function() {
      if (!S.plant || typeof S.plant !== 'object') S.plant = {};
      if (!Array.isArray(S.plant.units)) S.plant.units = [];
      S.plant.units.push({ id: 'U9', name: 'Rectifier 9', station: 'vat-a1', kind: 'rectifier', status: 'run', since: '${day(-30)}' });
      S.power = S.power || {}; S.power.causes = [{ id: 'C1', kind: 'reason', name: 'Breaker trip', scope: 'plant', spellings: [] }, { id: 'C2', kind: 'fix', name: 'Reset the breaker', spellings: [] }];
      var el = document.createElement('div');
      el.innerHTML = pcsCutWhyHtml({ ids: ['X1'], reason: 'C1', fix: 'C2', unitId: 'U9', where: null, open: false });
      return el.querySelector('.inv-row-meta').textContent;
    })()`);
    expect(why).toBe('Breaker trip (in the plant), hit Rectifier 9 (VAT A1) · brought back by Reset the breaker');
    expect(facts(why)).toBe(2);
  });
});
