import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openPulse, openSettingsAt, openStatsTab, openWidget, phoneFilter, readStoredState, recentTs, setFilter, switchTab, todayIso, toolbarMore, toolbarMoreLabels, workdayIso, type SepState, openNeeds } from './fixtures';
import { PINS, lockNow, unlock, withUsers } from './p140-guard.fixture';
import { sweep } from './sweep-fixture';

// P211: the QA chain before PR 146, the shell, Today, Stats, Reports and the Planner. The change log names the turnaround and
// terms; Pulse's More offers only what the role opens; Add names People and Attendance → Month; the Filter's count is a count;
// a planner row's more actions go through the one helper; Needs you's field keeps a task once, and only for whoever typed it;
// the Snoozed fold reads the rules only when something is snoozed; Edit Home is brought into sight; the price against the cost is
// judged one way on Pulse, Stats and the report; the By client and Cost cards' figures agree with their cards; the weighed line
// names the live cost; a figure over its mark is drawn in the info tone; the code and the rules nothing uses are gone.
// Every name and figure is made up; dates are built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

type Line = { partNumber: string; unit?: string; qty: number; rate: number };
function inv(id: string, clientId: number, clientName: string, lines: Line[]) {
  const items = lines.map(l => ({ partNumber: l.partNumber, desc: l.partNumber, hsn: '998873', unit: l.unit || 'KG', qty: l.qty, rate: l.rate,
    amount: Math.round(l.qty * l.rate * 100) / 100, nosQty: null }));
  const taxable = items.reduce((s, i) => s + i.amount, 0);
  return { id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date: todayIso(), status: 'active', invoiceState: 'created', clientId, clientName, gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }, items, taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9,
    sgstAmt: 0, igstPer: 0, igstAmt: 0, grandTotal: taxable, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs() };
}
function client(id: number, name: string, ratePerKg: number) {
  return { id, name, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
}
function base(): any { const s: any = emptyState(); s.incomingMaterial = noSeedIM(); return s; }
/* Two clients billed by the kilo this month. With nothing recorded the live cost is the model's, ₹8.56/kg. */
function priced(nova: [number, number], orion: [number, number]): SepState {
  const s = base();
  s.clients = [client(1, 'NOVA GEARS', nova[1]), client(2, 'ORION PRESS', orion[1])];
  s.invoices = [inv('00001', 1, 'NOVA GEARS', [{ partNumber: 'NG-1', qty: nova[0], rate: nova[1] }]), inv('00002', 2, 'ORION PRESS', [{ partNumber: 'OP-1', qty: orion[0], rate: orion[1] }])];
  s.invNextNum = 3;
  return s;
}
/* The colour the app's info tone resolves to, read off its own badge. */
const infoColour = (page: Page) => page.evaluate(() => {
  const p = document.createElement('span');
  p.className = 'inv-badge inv-badge-info';
  document.body.appendChild(p);
  const c = getComputedStyle(p).color;
  p.remove();
  return c;
});

test.describe('P211: the shell, navigation, More and Filter, the change log', () => {
  test('A1-3: a turnaround or terms change is logged under its Settings section, in words', async ({ page }) => {
    const s: any = base();
    s.clients = [client(1, 'NOVA GEARS', 12)];
    await loadAppWithState(page, s);
    await openSettingsAt(page, 'flow');
    await page.locator('#setFlowTurn').fill('2');
    await page.locator('#setFlowTurn').dispatchEvent('input');
    await page.locator('#setFlowTerms').fill('30');
    await page.locator('#setFlowTerms').dispatchEvent('input');
    await page.locator('details[data-sec="flow"] [data-action="invSaveSettingsSec"]').click();
    await expect.poll(async () => ((await readStoredState(page)).flowCfg || {}).termsDays).toBe(30);
    const e = await g(page, `S.changeLog.filter(function (x) { return x.coll === 'flowCfg'; }).pop()`) as any;
    // It read "Someone changed flowCfg: turnDays 1 → 2; termsDays 45 → 30".
    expect(e.label).toBe('Settings → Turnaround and terms');
    expect(await g(page, `chgText(S.changeLog.filter(function (x) { return x.coll === 'flowCfg'; }).pop())`))
      .toBe('Someone changed Settings → Turnaround and terms: turnaround target 1 → 2; payment terms 45 → 30');
    // A client's own terms read the same words.
    await g(page, `S.clients[0].payTermsDays = 7; saveState()`);
    await expect.poll(() => g(page, `S.changeLog.filter(function (x) { return x.coll === 'clients'; }).length`)).toBe(1);
    expect(await g(page, `chgText(S.changeLog.filter(function (x) { return x.coll === 'clients'; }).pop())`)).toBe('Someone changed client NOVA GEARS: payment terms — → 7');
  });

  test('A1-4: Home’s More offers only the screens the role opens', async ({ page }) => {
    await loadAppWithState(page, priced([1000, 9], [50, 9]));
    // Office given the money, and still no Stats or Reports among its pages.
    await withUsers(page, { roles: { office: { finance: true } } });
    await unlock(page, 'U-off', PINS.office);
    await openPulse(page);
    // The questions are money: drawn for an office given it (a widget each since UI pass 3, U2).
    expect(await page.locator('#homeBoard [data-tdy-questions]').count()).toBeGreaterThan(0);
    expect(await toolbarMoreLabels(page)).toEqual(['Reset Home']);
    // The owner opens both.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await openPulse(page);
    expect(await toolbarMoreLabels(page)).toEqual(['Make a report', 'Open Stats', 'Reset Home']);
  });

  test('A1-7: Add names the screens as the app calls them now: People, and Attendance → Month', async ({ page }) => {
    await loadAppWithState(page, base());
    // A register file brought to the roster's Import is named where it is imported.
    await page.evaluate(t => (0, eval)('importRosterText')(t, 'brought.json'), JSON.stringify({ kind: 'sep-att-register', version: 1, months: [] }));
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('It is imported on People → Attendance → Month.');
    // A roll on the clipboard is read on People.
    const d = new Date(), dmy = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2);
    await page.evaluate(t => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.resolve(t) } }),
      `${dmy}/ in time\n----8:30 AM---\n---VAT A 1---\n1) RAVI TEST\n2) SOHAN TEST`);
    await page.locator('[data-action="invAddOpen"]:visible').first().click();
    await page.locator('[data-add-sec="clipboard"]').click();
    await expect(page.locator('#addClipOut [data-add-clip-where]')).toHaveText('Read in People and checked there before anything is saved.');
  });

  test('A1-10: the Filter’s count is a plain count, and its dialog draws no class without a rule', async ({ page }) => {
    await loadAppWithState(page, base());
    await switchTab(page, 'pageHistory');
    await setFilter(page, '#historyType', 'audit');
    const badge = page.locator('#historyToolbar [data-action="invTbFilter"] .inv-badge');
    await expect(badge).toHaveText('1');
    await expect(badge).toHaveClass(/inv-badge-neutral/);
    await expect(badge).not.toHaveClass(/inv-badge-info/);
    // The dialog's body is a styled component, not a name no rule reads.
    await phoneFilter(page);
    const body = page.locator('[data-tb-filter-dialog] .inv-dialog-body');
    await expect(body).toHaveCount(1);
    expect(await body.evaluate(el => getComputedStyle(el).overflowWrap)).toBe('break-word');
    expect((await sweep(page, 'History → Filter')).unstyled).not.toContain('inv-dialog-body');
  });

  test('A1-9: a planner row’s second and third actions are drawn by the one helper', async ({ page }) => {
    await loadAppWithState(page, base());
    const r = await g(page, `(function () {
      var n = 0, f = window.uiRowMoreHtml;
      window.uiRowMoreHtml = function (a) { n++; return f(a); };
      try { var h = plnRowHtml({ key: 'p211', title: 'Bath heater', facts: ['one fact', 'another fact', 'a third'], actions: ['<button class="inv-btn">Plan it</button>'] }); }
      finally { window.uiRowMoreHtml = f; }
      return { n: n, more: h.indexOf('data-row-more') >= 0 };
    })()`) as any;
    expect(r).toEqual({ n: 1, more: true });
  });
});

test.describe('P211: Today', () => {
  test('A2-2: a task saved from Details leaves the field empty, so the next Add does not make it twice', async ({ page }) => {
    await loadAppWithState(page, base());
    await openNeeds(page);
    const field = page.locator('#todoNew');
    await field.fill('Call NOVA GEARS about the rate');
    await page.locator('[data-action="invTodoNew"]').click();
    await expect(page.locator('#todoText')).toHaveValue('Call NOVA GEARS about the rate');
    await page.locator('[data-action="invTodoSave"]').click();
    await expect.poll(async () => ((await readStoredState(page)).todo || { tasks: [] }).tasks.length).toBe(1);
    await expect(page.locator('#todoNew')).toHaveValue('');
    await page.locator('[data-action="invTodoAdd"]').click();
    expect((await readStoredState(page)).todo.tasks.map((t: any) => t.text)).toEqual(['Call NOVA GEARS about the rate']);
  });

  test('A2-2: the field drawn for another ID after the lock starts empty; the same person keeps what they typed', async ({ page }) => {
    await loadAppWithState(page, base());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await openNeeds(page);
    await page.locator('#todoNew').fill('Owner half task');
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await openNeeds(page);
    await expect(page.locator('#todoNew')).toHaveValue('Owner half task');
    await lockNow(page);
    await unlock(page, 'U-off', PINS.office);
    await expect(page.locator('#pageHome [data-card="tasks"]')).toBeVisible();
    await openNeeds(page);
    await expect(page.locator('#todoNew')).toHaveValue('');
  });

  test('A2-7: with nothing snoozed the Snoozed fold reads no rule; with a snooze, one pass lists it', async ({ page }) => {
    await loadAppWithState(page, base());
    const count = () => g(page, `(function () {
      var n = 0, f = window.todoAppAll;
      window.todoAppAll = function () { n++; return f.apply(this, arguments); };
      try { var h = tdySnoozedHtml(); } finally { window.todoAppAll = f; }
      return { n: n, h: h };
    })()`) as Promise<{ n: number; h: string }>;
    let r = await count();
    expect(r).toEqual({ n: 0, h: '' });
    // Snooze a task the book raises (the backup one, on a book never backed up) to the week after.
    const key = await g(page, `todoAppAll()[0].key`) as string;
    const title = await g(page, `todoAppAll()[0].title`) as string;
    await g(page, `todoData().snoozes['${key}'] = { until: isoAddDays(localDateStr(), 7) }`);
    r = await count();
    expect(r.n).toBe(1);
    expect(r.h).toContain(title);
  });

  test('A2-8: arranging Home is on screen where it starts: its toolbar’s Done and the first widget’s handle', async ({ page }) => {
    await loadAppWithState(page, priced([1000, 9], [50, 9]));
    await openPulse(page);
    // Edit Home opened at the page's foot until UI pass 3 (U2); Customise arranges the board in place.
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await expect(page.locator('[data-home-toolbar] [data-action="invWdgDone"]')).toBeInViewport();
    await expect(page.locator('#homeBoard [data-wdg-handle]').first()).toBeInViewport();
  });
});

test.describe('P211: the price against the cost, judged one way', () => {
  test('A2-4: Who is driving it? judges a large account a little under the cost as Stats does: a warning', async ({ page }) => {
    // NOVA GEARS fills the plant at ₹8.30/kg against ₹8.56: 3% under, Just under cost on Stats.
    await loadAppWithState(page, priced([1000, 8.3], [50, 9]));
    await openStatsTab(page, 'clients');
    await expect(page.locator('#statsMargin [data-margin-net] .inv-fig-warning')).toHaveText('8.30');
    await openPulse(page);
    const q = page.locator('[data-tdy-q="clients"]');
    await expect(q).toHaveClass(/inv-hero-warning/);
    await expect(q.locator('[data-story-say] .inv-dot-warning')).toHaveCount(1);
    await expect(q.locator('.inv-meter-warning')).toHaveCount(1);
    // The clients ranked by tonnage are the question's own story, opened from the widget's head (UI pass 3, U2: the card holds
    // the answer and its sentence; its bars and tiles are a tap away).
    await q.locator('.inv-widget-door').click();
    const open = page.locator('[data-tdy-q-open="clients"]');
    await expect(open.locator('.inv-chart-ranked-fill-warning')).toHaveCount(1);
    await expect(open.locator('.inv-chart-ranked-fill-danger')).toHaveCount(0);
    await expect(open.locator('[data-story-say] .inv-dot-warning')).toHaveCount(1);
  });

  test('A7-15: a loss within 5% of the live cost is a warning on Home, on Stats’ Cost and Trends, and on the report', async ({ page }) => {
    // ₹8,750 for 1,050 kg: ₹8.33/kg against ₹8.56, 2.7% under.
    await loadAppWithState(page, priced([1000, 8.3], [50, 9]));
    await openPulse(page);
    await expect(page.locator('#statsOverview')).toHaveClass(/inv-hero-warning/);
    const money = page.locator('[data-tdy-q="money"]');
    await expect(money).toHaveClass(/inv-hero-warning/);
    await expect(money.locator('[data-story-say] .inv-dot-warning')).toHaveCount(1);
    // Its tiles are the question's own story, opened from the widget's head (UI pass 3, U2).
    await money.locator('.inv-widget-door').click();
    await expect(page.locator('[data-tdy-q-open="money"] .inv-tile-warning')).toHaveCount(2);
    await page.locator('[data-tdy-q-open="money"] [data-action="invCloseOverlay"]').first().click();
    await openStatsTab(page, 'cost');
    const contrib = page.locator('#statsVerdict .inv-tile', { has: page.locator('.inv-tile-label', { hasText: 'Contribution' }) });
    await expect(contrib).toHaveClass(/inv-tile-warning/);
    await openStatsTab(page, 'trends');
    const margin = page.locator('#statsHeadline [data-tile="margin"]');
    await expect(margin).toHaveClass(/inv-tile-warning/);
    await expect(margin.locator('.inv-badge')).toHaveClass(/inv-badge-warning/);
    await expect(page.locator('#statsHeadline')).toHaveClass(/inv-hero-warning/);
    // The month's report says what a kilo left in the same tone.
    await g(page, `rptSet('monthly', localDateStr())`);
    await switchTab(page, 'pageReports');
    const cost = page.locator('.inv-rpt-doc [data-rpt-sec="cost"] .inv-rpt-p').first();
    await expect(cost.locator('.inv-fig-warning')).toHaveCount(2);
    await expect(cost.locator('.inv-fig-danger')).toHaveCount(0);
  });

  test('A2-5: the Cost card’s figure is judged as realisation is, never on its own base', async ({ page }) => {
    // ₹8.14/kg against ₹8.56: 4.9% under the cost (a warning), 5.2% when realisation is the base (it read danger).
    const s = base();
    s.clients = [client(1, 'NOVA GEARS', 8.14)];
    s.invoices = [inv('00001', 1, 'NOVA GEARS', [{ partNumber: 'NG-1', qty: 1000, rate: 8.14 }])];
    s.invNextNum = 2;
    await loadAppWithState(page, s);
    await openStatsTab(page, 'cost');
    const v = page.locator('#statsVerdict');
    await expect(v.locator('.inv-hero-fig .inv-fig-warning')).toHaveCount(1);
    await expect(v.locator('.inv-hero-fig .inv-fig-danger')).toHaveCount(0);
    await expect(v.locator('.inv-tile', { has: page.locator('.inv-tile-label', { hasText: 'Realisation' }) })).toHaveClass(/inv-tile-warning/);
  });

  test('A2-6: the By client card’s figure never contradicts its tone', async ({ page }) => {
    // No large account under the cost; a small one (5% of the tonnage) well under it. The card judges large accounts: its figure,
    // the worst-priced client, is plain, not red on a green card.
    await loadAppWithState(page, priced([1000, 9], [50, 4]));
    await openStatsTab(page, 'clients');
    let v = page.locator('#statsVerdict');
    await expect(v).toHaveClass(/inv-hero-ok/);
    await expect(v.locator('.inv-hero-fig')).toContainText('₹4.00');
    await expect(v.locator('.inv-hero-fig [class*="inv-fig-"]')).toHaveCount(0);
    // A large account 12% under the full cost: red in its row, and the card is the worst of what it holds.
    await loadAppWithState(page, priced([1000, 7.5], [50, 9]));
    await openStatsTab(page, 'clients');
    v = page.locator('#statsVerdict');
    await expect(page.locator('#statsMargin [data-margin-net] .inv-fig-danger')).toHaveText('7.50');
    await expect(v.locator('.inv-hero-fig .inv-fig-danger')).toHaveCount(1);
    await expect(v).toHaveClass(/inv-hero-danger/);
  });

  test('A2-10: Trends’ line on the weighed lines names the live cost per kg', async ({ page }) => {
    const s = base();
    s.clients = [client(1, 'NOVA GEARS', 9)];
    // ₹1,000 of ₹10,000 is a NOS line with no weight: the tonnage under the cost carries 90% of the revenue.
    s.invoices = [inv('00001', 1, 'NOVA GEARS', [{ partNumber: 'NG-1', qty: 1000, rate: 9 }]), inv('00002', 1, 'NOVA GEARS', [{ partNumber: 'PIN', unit: 'NOS', qty: 100, rate: 10 }])];
    s.invNextNum = 3;
    await loadAppWithState(page, s);
    await openStatsTab(page, 'trends');
    await expect(page.locator('#statsHeadline [data-callout="weighed"]'))
      .toHaveText('The live cost per kg divides by the weighed lines alone, 90% of revenue: it reads high by about 11%.');
  });

  test('A2-3: a figure over its mark is drawn in the info tone, on screen and on the report’s paper', async ({ page }) => {
    const day = workdayIso(), s: any = base();
    s.staff = [1, 2, 3, 4, 5].map(i => ({ id: i, name: 'Ravi Test ' + i, comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }));
    s.attendance = { [day]: { marks: Object.fromEntries([1, 2, 3, 4, 5].map(i => [i, { st: 'P', area: 'vat-a1', hours: 8, ot: 0 }])), extra: [], note: '' } };
    // Five on VAT A1 against the four the day needs: one over.
    s.shiftNeeds = { [day]: { 'vat-a1': 4 } };
    await loadAppWithState(page, s);
    const info = await infoColour(page);
    await openWidget(page, 'attendance');
    const fig = page.locator('[data-w="atttoday"] [data-alloc="vat-a1"] .inv-fig-info');
    await expect(fig).toHaveText('5/4');
    expect(await fig.evaluate(el => getComputedStyle(el).color)).toBe(info);
    // The day's report: the heads a day in the paper's own blue.
    await g(page, `rptSet('daily', '${day}')`);
    await switchTab(page, 'pageReports');
    const paper = page.locator('.inv-rpt-doc [data-rpt-table="areas"] .inv-fig-info');
    await expect(paper).toHaveText('5.0');
    expect(await paper.evaluate(el => getComputedStyle(el).color)).toBe('rgb(29, 79, 138)');
  });
});

test.describe('P211: what nothing uses goes', () => {
  test('A2-11: the helpers nothing calls are gone, and the planner’s two actions nothing draws', async ({ page }) => {
    await loadAppWithState(page, base());
    for (const f of ['statsDeltaText', 'tdyCap', 'chgEntries', 'chgKindWord', 'mrgBaseClear', 'plnStationOpts', 'rptDash']) {
      expect(await g(page, `typeof ${f}`), f).toBe('undefined');
    }
    // The plan is picked through its <select> (change): no button carries these two.
    expect(await g(page, `plannerAction('invPlnScenario', { dataset: { id: 'PS-none' } })`)).toBe(false);
    expect(await g(page, `plannerAction('invPlnFirst', { dataset: {} })`)).toBe(false);
  });

  test('A2-11: no rule is kept for a class nothing draws, and the comments name what is there now', async ({ page }) => {
    await loadAppWithState(page, base());
    const sels = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (rules: CSSRuleList) => { for (const r of Array.from(rules)) { const s = (r as CSSStyleRule).selectorText; if (s) out.push(s); if ((r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules); } };
      for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules); } catch { /* cross-origin */ } }
      return out.join('\n');
    });
    expect(sels).not.toContain('.inv-token-on');
    expect(sels).not.toContain('.inv-token-add');
    const src = await page.evaluate(() => fetch('/sep-invoicing.html', { cache: 'no-store' }).then(r => r.text()));
    expect(src).not.toContain('Stats → Overview lists them all');
    expect(src).not.toContain('View tabs Open / Done (design principles §7)');
  });
});
