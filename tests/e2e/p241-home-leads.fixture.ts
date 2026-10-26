import { expect, type Page, type Route } from '@playwright/test';
import { loadAppWithState, emptyState, noSeedIM, todayIso, openHome, openNeeds, toolbarMore, readStoredState, withWidgets, openSettingsAt, type SepState } from './fixtures';
import { longBook } from './load-fixture';
import { geistReady } from './p235-family.fixture';
import { drawBoard } from './p224-widget-sweep.fixture';
import { guardBook } from './p140-guard.fixture';
import { FEED_BASE, fakeWorker, okWorker, newsAnswer, weatherAnswer, feedCopy, feedsOn, testTime, FAKE_LAT, FAKE_LON } from './feeds-fixture';

// P241 (owner, 21 Oct 2026, after U2R's stop: "Home screen should not feel heavy, and should lead and prioritise the user, control
// attention, makes information effortless, has a clear objective"), shared by the phone and the desktop. Home reads this month, with
// no period to pick; Needs you carries its red count as a badge; the masthead leads with what asks for something today, red before
// amber whatever a move to know is worth; a day the plant is shut is marked from Home and said wherever the day is; about seven
// cards on the phone, the pace in Month to date, the day's production and attendance in The floor now; an edge only for what asks
// for something today; What's coming names a client as written; the weather's place from the address, and MET Norway and GDELT
// asked straight where the feeds service cannot be reached. Made-up names and places; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const sunday = (day: string) => new Date(day + 'T00:00:00').getDay() === 0;
/* The day the specs stand on: today, or the Monday after where today is a Sunday (a Sunday not worked is a day off of its own). */
export const W = sunday(todayIso()) ? addDays(todayIso(), 1) : todayIso();
/* The working day before it. */
export const D = (() => { let d = addDays(W, -1); while (sunday(d)) d = addDays(d, -1); return d; })();
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
/* A book with no paid holiday, so the day it stands on is a working day whatever the calendar says. */
const emptyBook = (): any => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.labour = { ...(s.labour || {}), holidays: [] };
  return s;
};
const client = (id: number, name: string, perKg = 12) => ({ id, name, billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: perKg, effectiveFrom: '2020-04-01' }], itemRates: [] });

/* The floor: a client, a challan, one run plated on the day before, two hands marked that day; the plant register as found a year
   ago, VAT A1's tank running and three of the barrel's six down. Nothing recorded on the day the spec stands on. */
export function floorBook(): SepState {
  const s = emptyBook();
  s.clients = [client(21, 'KESTREL FORGE')];
  s.incomingMaterial.push({ id: 'C1', clientId: 21, clientName: 'KESTREL FORGE', challanNo: '501', challanDate: addDays(D, -3),
    items: [{ id: 'C1a', partNumber: 'BRACKET Z 4411', desc: 'BRACKET Z 4411', unit: 'KG', qty: 300, invoiced: false }] });
  s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
    { id: 'A', kind: 'plated', date: D, line: 'vat-a1', lineSrc: 'written', slot: 'general', time: '09:00', to: '11:00', clientId: 21, part: 'BRACKET Z 4411', qty: 120, unit: 'KG', basis: 'register', src: 'photo', at: 1 }] };
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }];
  s.attendance = { [D]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 }, 2: { st: 'P', area: 'barrel', hours: 8, ot: 0 } }, extra: [], note: '' } };
  const yearAgo = addDays(W, -365), at = new Date(yearAgo + 'T10:00:00').getTime();
  const u = (id: string, name: string, station: string, kind: string, status: string) => ({ id, name, station, kind, kgRound: 50, status, since: yearAgo, addedOn: yearAgo, line: station, at, condition: 'fair' });
  const units = [u('T1', 'A1 tank 1', 'vat-a1', 'tank', 'run')].concat([1, 2, 3, 4, 5, 6].map(n => u('B' + n, 'Barrel ' + n, 'barrel', 'barrel', n > 3 ? 'down' : 'run')));
  s.plant = { units, log: units.map(x => ({ id: 'L' + x.id, unitId: x.id, date: yearAgo, from: null, to: x.status, at })) };
  return s as SepState;
}

/* ---------- Home reads this month ---------- */
export async function homeReadsMonth(page: Page) {
  await loadAppWithState(page, longBook());
  await openHome(page);
  // No period to pick on Home (owner: "Let's remove the MTD, QTD, YTD, all filters - they are not needed on the home screen"): its
  // widgets read this month, whatever Stats is set to; Stats keeps its own.
  await expect(page.locator('#homeDash .inv-seg')).toHaveCount(0);
  expect(await g(page, `wdgPeriod('home')`)).toBe('mtd');
  const fig = () => page.locator('#homeBoard [data-w="mtd"] .inv-widget-fig').innerText();
  const before = await fig();
  await g(page, `_statsPeriod = 'ytd'; renderHome()`);
  await expect(page.locator('#homeBoard [data-w="mtd"] .inv-widget-fig')).toHaveText(before);
  expect(await g(page, '_statsPeriod')).toBe('ytd');
}

/* ---------- Needs you's count, a badge ---------- */
export async function needsBadge(page: Page) {
  const s = emptyBook();
  s.todo = { tasks: [
    { id: 'm1', text: 'Ring the drum supplier', due: addDays(W, -2), note: '', link: null, createdAt: 1, doneAt: null },
    { id: 'm2', text: 'Send the rate card', due: addDays(W, -1), note: '', link: null, createdAt: 2, doneAt: null },
    { id: 'm3', text: 'Book the transporter', due: addDays(W, 2), note: '', link: null, createdAt: 3, doneAt: null }], snoozes: {} };
  await page.clock.install({ time: new Date(W + 'T10:00:00') });
  await loadAppWithState(page, s);
  // The count of red rows, on the tab's label (owner: "that should be shown as notification dots"), and the door's alike.
  const badges = page.locator('[data-ws-count="today"]');
  const tab = page.locator('#wsTabs [data-v="needs"] [data-ws-count="today"]');
  await expect(tab).toHaveText('2');
  await expect(tab).toBeVisible();
  expect(await badges.evaluateAll(els => els.map(e => e.textContent))).toEqual(Array(await badges.count()).fill('2'));
  // The masthead leads with them where no move does, its one button Needs you.
  const m = page.locator('#homeDash [data-home-day]');
  await expect(m.locator('.inv-mast-say')).toHaveText('2 things need you now');
  await expect(m).toHaveAttribute('data-tone', 'danger');
  await m.locator('.inv-mast-act [data-home-needs]').click();
  await expect(page.locator('#homeNeeds')).toBeVisible();
  // Done one at a time: the count goes down, then the badge goes.
  await page.locator('#homeNeeds [data-action="invTodoToggle"][data-id="m1"]').first().check();
  await expect(tab).toHaveText('1');
  await page.locator('#homeNeeds [data-action="invTodoToggle"][data-id="m2"]').first().check();
  await expect(tab).toHaveText('');
  await expect(tab).toHaveClass(/inv-hidden/);
  await openHome(page);
  await expect(m.locator('.inv-mast-say')).toHaveText('Nothing needs you now');
  await expect(m).toHaveAttribute('data-tone', 'ok');
}

/* ---------- The masthead leads with what asks for something today ---------- */
export async function leadOrder(page: Page) {
  await page.clock.install({ time: new Date(W + 'T15:05:00') });
  await loadAppWithState(page, guardBook());
  // The stock line out: red. The move worth most across the questions is a move to know.
  await g(page, `S.stock.entries.push({ id: 'u1', itemId: 'N', kind: 'used', qty: 12, date: localDateStr(), at: Date.now() }); saveState(); renderHome()`);
  const r = await page.evaluate(() => {
    const w = window as any, all = w.tdyFirstMoves(w.tdyQuestions(), 99).map((x: any) => x.mv), l = w.homeMastLead();
    return { first: all[0] ? all[0].tone : null, reds: all.filter((mv: any) => mv.tone === 'red').map((mv: any) => mv.key), move: l.move || null, tone: l.tone, text: l.text };
  });
  expect(r.first).not.toBe('red');
  // A red move leads before it; else the count of what is red does.
  expect(r.tone).toBe('danger');
  if (r.reds.length) expect(r.move).toBe(r.reds[0]);
  else expect(r.text).toMatch(/things? needs? you now/);
  const m = page.locator('#homeDash [data-home-day]');
  await expect(m).toHaveAttribute('data-tone', 'danger');
  if (r.move) {
    // The sentence opens the move's dialog; its button is the move's own.
    await expect(m.locator('.inv-mast-act [data-home-lead="move"]')).toHaveCount(1);
    await m.locator('.inv-mast-lead').click();
    await expect(page.locator('[data-adv-dialog]')).toBeVisible();
    await page.keyboard.press('Escape');
  }
}

/* ---------- A day the plant is shut ---------- */
export async function plantShut(page: Page, desktop: boolean) {
  await page.clock.install({ time: new Date(W + 'T11:30:00') });
  await loadAppWithState(page, floorBook());
  await openHome(page);
  const m = page.locator('#homeDash [data-home-day]'), floor = page.locator('#homeBoard .inv-widget[data-w="floornow"]');
  await expect(m.locator('[data-home-shift]')).toContainText(desktop ? 'General shift ends 5:00 PM' : 'Shift ends 5:00 PM');
  await expect(m).toContainText('Barrel: 3 of 6 down');
  // The floor card: the day before's plating until today's first run (Production, the last day, folded in), and the barrel half
  // down said in danger though it has not run.
  await expect(floor.locator('[data-wc-lastday]')).toContainText('Last plated ');
  await expect(floor.locator('[data-wc-line="barrel"]')).toContainText('3 of 6 barrels down');
  await expect(floor.locator('[data-wc-line="barrel"] .inv-plant-lamp')).toHaveClass(/inv-dot-danger/);
  // Nothing recorded by eleven: the card offers to mark the day shut.
  await floor.locator('[data-action="invPlantShut"]').click();
  const dlg = page.locator('[data-plant-shut]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('#plantShutFrom')).toHaveValue(W);
  await dlg.locator('#plantShutWhy').fill('Durga Puja');
  await dlg.locator('[data-action="invPlantShutSave"]').click();
  await expect(dlg).toHaveCount(0);
  // Said in the shift's place, the masthead's line facts gone with the shift; the floor card one quiet line.
  await expect(m.locator('[data-home-shift]')).toHaveText('Plant shut · Durga Puja');
  await expect(m).toHaveAttribute('data-day-off', 'shut');
  await expect(m.locator('[data-home-track]')).toHaveCount(0);
  await expect(m.locator('.inv-mast-facts li', { hasText: '3 of 6 down' })).toHaveCount(0);
  await expect(floor.locator('[data-wc-off]')).toHaveText('Plant shut today: Durga Puja');
  await expect(floor.locator('.inv-plant-row')).toHaveCount(0);
  await expect(floor.locator('[data-action="invPlantShut"]')).toHaveCount(0);
  await expect(floor).toHaveAttribute('data-tone', 'neutral');
  // Not a working day for the pace and the turnaround; kept in the book with why, in the change log.
  expect(await g(page, `statsWorkingDayList('${W}', '${W}').length`)).toBe(0);
  const st = await readStoredState(page);
  expect(st.flowCfg.holidays).toContain(W);
  expect(st.flowCfg.shutWhy[W]).toBe('Durga Puja');
  expect(JSON.stringify((st.changeLog || []).slice(-5))).toContain('Durga Puja');
  // Needs you does not wait on the rolls.
  await openNeeds(page);
  await expect(page.locator('#homeNeeds [data-tdy-input="roll-in"]')).toContainText('Not expected: plant shut, Durga Puja');
  // Removed from Home's More: the shift again.
  await openHome(page);
  await toolbarMore(page, 'Plant shut…');
  await expect(dlg.locator('[data-plant-shut-list]')).toContainText('Durga Puja');
  await dlg.locator('[data-action="invPlantShutDel"][data-day="' + W + '"]').click();
  await expect(dlg.locator('[data-plant-shut-list]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(m.locator('[data-home-shift]')).toContainText(/[Ss]hift ends 5:00 PM/);
  // A day marked shut and worked anyway is a working day.
  await g(page, `S.flowCfg.holidays = ['${W}']; S.attendance['${W}'] = { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 } }, extra: [], note: '' }; saveState(); renderHome()`);
  await expect(m.locator('[data-home-shift]')).toContainText(/[Ss]hift ends 5:00 PM/);
  // A paid holiday (Settings → Labour) is a day off too, said as one.
  await g(page, `S.flowCfg.holidays = []; delete S.attendance['${W}']; S.labour.holidays = ['${W.slice(5)}']; saveState(); renderHome()`);
  await expect(m.locator('[data-home-shift]')).toHaveText('Paid holiday: plant shut');
  await expect(floor.locator('[data-wc-off]')).toHaveText('A paid holiday: the plant is shut');
}

/* ---------- About seven cards on the phone ---------- */
export async function presetsSeven(page: Page, desktop: boolean) {
  await loadAppWithState(page, longBook());
  const p = await page.evaluate(() => {
    const w = window as any, out: Record<string, { phone: string[]; desk: string[] }> = {};
    for (const k of Object.keys(w.WDG_PRESETS)) out[k] = { phone: w.wdgPresetList('home', 'phone', k).map((x: string[]) => x[0]), desk: w.wdgPresetList('home', 'desk', k).map((x: string[]) => x[0]) };
    return out;
  });
  expect(p.owner.phone).toEqual(['mtd', 'q-money', 'cash', 'owed', 'floornow', 'coming', 'q-smooth']);
  expect(p.owner.desk).toEqual(['mtd', 'q-money', 'cash', 'owed', 'floornow', 'coming', 'q-smooth', 'tata']);
  // What the masthead now says (the move worth most, the count, the weather), the pace Month to date holds and the day The floor now
  // holds are on no preset; each widget is still under Add a widget.
  for (const k of Object.keys(p)) {
    expect(p[k].phone.length, k).toBeLessThanOrEqual(8);
    for (const id of ['dofirst', 'pace', 'prodday', 'atttoday', 'weather', 'needs']) {
      expect(p[k].phone, k + ' phone').not.toContain(id);
      expect(p[k].desk, k + ' desktop').not.toContain(id);
    }
  }
  await openHome(page);
  expect(await page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w))).toEqual(desktop ? p.owner.desk : p.owner.phone);
  const n = await g(page, `wdgAddable('home')`);
  await expect(page.locator('[data-home-foot]')).toContainText(n + ' to choose from');
}

/* ---------- Month to date, where the month lands ---------- */
export async function mtdPace(page: Page) {
  const s = emptyBook();
  s.clients = [client(41, 'ORION CLAMPS', 10)];
  const inv = (id: string, n: number, date: string, taxable: number) => ({ id, invoiceNumber: pad(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + pad(n).padStart(5, '0'), date, status: 'active',
    invoiceState: 'created', clientId: 41, clientName: 'ORION CLAMPS', gstType: 'intra', items: [{ partNumber: 'P1', desc: 'Part', unit: 'KG', qty: taxable / 10, rate: 10, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstAmt: 0, grandTotal: taxable, challanNo: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime() });
  const last = addDays(W.slice(0, 8) + '01', -1);
  s.invoices = [inv('I1', 1, W, 24000), inv('I2', 2, last.slice(0, 8) + '05', 30000), inv('I3', 3, last, 30000)];
  await page.clock.install({ time: new Date(W + 'T11:30:00') });
  await withWidgets(page, [['mtd', 's'], ['q-money', 's']]);
  await loadAppWithState(page, s);
  await openHome(page);
  const p = await page.evaluate(() => { const w = window as any, x = w.predMonthPace(); return { proj: x.projRev, low: x.low, high: x.high, card: w.inrCard(x.projRev).text, exact: w.formatCurrency(x.projRev) }; });
  const pace = page.locator('#homeBoard [data-w="mtd"] [data-mtd-pace]');
  // A Small keeps where the month lands (its bars go first where it is short of room), the exact figure its title.
  await expect(pace).toHaveText('On pace for ' + p.card);
  expect(await pace.getAttribute('title')).toContain(p.exact);
  // A Medium adds its likely range.
  await drawBoard(page, [['mtd', 'm']]);
  await expect(page.locator('#homeBoard [data-w="mtd"] [data-mtd-pace]')).toContainText('On pace for ' + p.card + ' · likely ');
  // The bars show it too: this month to date hatched, where it lands outlined over it.
  const bars = await page.evaluate(() => {
    const html = (window as any).chartMiniBars([{ v: 40 }, { v: 20, todate: true, hatch: true, proj: 60 }]), t = document.createElement('template');
    t.innerHTML = html;
    const bar = t.content.querySelectorAll('.inv-minibar')[1], proj = t.content.querySelector('.inv-minibar-proj');
    return { proj: !!proj, barH: Number(bar.getAttribute('height')), projH: proj ? Number(proj.getAttribute('height')) : 0 };
  });
  expect(bars.proj).toBe(true);
  expect(bars.projH).toBeGreaterThan(bars.barH * 2.5);
}

/* ---------- An edge only for today ---------- */
export async function edgesToday(page: Page) {
  await loadAppWithState(page, longBook());
  await openHome(page);
  // The rule: two red cards alike but for data-trend; the trend keeps no edge and no red tint.
  const r = await page.evaluate(() => {
    const grid = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement;
    const mk = (trend: boolean) => {
      const s = document.createElement('section');
      s.className = 'inv-widget'; s.dataset.tone = 'danger'; s.dataset.type = 'brief';
      if (trend) s.setAttribute('data-trend', '');
      grid.appendChild(s);
      const cs = getComputedStyle(s), o = { bg: cs.backgroundColor, sh: cs.boxShadow };
      s.remove();
      return o;
    };
    return { today: mk(false), trend: mk(true) };
  });
  expect(r.today.sh).toMatch(/inset/);
  expect(r.trend.sh).not.toMatch(/inset/);
  expect(r.trend.bg).not.toBe(r.today.bg);
  // Which are trends: the month against the last, a period's answer, a record of days; never what asks for something today.
  const flags = await page.evaluate(() => {
    const w = window as any, f = (id: string) => { const t = w.wdgDef(id).trend; return typeof t === 'function' ? 'by its day' : !!t; };
    return Object.fromEntries(['mtd', 'pace', 'q-money', 'q-clients', 'q-plant', 'q-changed', 'why', 'figures', 'dtp', 'heat', 'eff', 'attweek', 'ot', 'clientprice', 'kilo', 'corr',
      'zincpaid', 'powercuts', 'prodday', 'owed', 'cash', 'q-smooth', 'q-cash', 'floornow', 'coming', 'stockdays', 'unbilled', 'needs', 'turn', 'risk', 'atttoday'].map(id => [id, f(id)]));
  });
  for (const id of ['mtd', 'pace', 'q-money', 'q-clients', 'q-plant', 'q-changed', 'why', 'figures', 'dtp', 'heat', 'eff', 'attweek', 'ot', 'clientprice', 'kilo', 'corr', 'zincpaid', 'powercuts'])
    expect(flags[id], id).toBe(true);
  expect(flags.prodday).toBe('by its day');
  for (const id of ['owed', 'cash', 'q-smooth', 'q-cash', 'floornow', 'coming', 'stockdays', 'unbilled', 'needs', 'turn', 'risk', 'atttoday']) expect(flags[id], id).toBe(false);
  // Drawn: every trend on the board is marked and unedged, its figure and lamp keeping their tone.
  const drawn = await page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => ({ id: (e as HTMLElement).dataset.w, trend: e.hasAttribute('data-trend'), sh: getComputedStyle(e).boxShadow })));
  for (const c of drawn) if (c.trend) expect(c.sh, c.id).not.toMatch(/inset/);
  expect(drawn.some(c => c.trend)).toBe(true);
}

/* ---------- What's coming, the names as written ---------- */
export async function comingWords(page: Page) {
  const s = emptyBook();
  s.clients = [client(31, 'OX SHEET WORKS'), client(32, 'TERRA AUTO P LTD')];
  const ch = (id: string, c: number, name: string, date: string) => ({ id, clientId: c, clientName: name, challanNo: id, challanDate: date,
    items: [{ id: id + 'a', partNumber: 'P1', desc: 'Part', unit: 'KG', qty: 10, invoiced: true }] });
  // The latest three days back: two days back, a Saturday's challan on a Monday is due back today and leads the headline.
  for (let i = 0; i < 6; i++) s.incomingMaterial.push(ch('O' + i, 31, 'OX SHEET WORKS', addDays(W, -3 - 3 * i)));
  for (let i = 0; i < 5; i++) s.incomingMaterial.push(ch('P' + i, 32, 'TERRA AUTO P LTD', addDays(W, -7 - 12 * i)));
  await page.clock.install({ time: new Date(W + 'T10:00:00') });
  await withWidgets(page, [['coming', 'm']]);
  await loadAppWithState(page, s);
  await openHome(page);
  const card = page.locator('#homeBoard .inv-widget[data-w="coming"]');
  const rows = await card.locator('[data-coming-k] .inv-row-title, [data-coming-k] .inv-brief-when-title').allInnerTexts();
  const all = (await card.innerText()).replace(/\s+/g, ' ');
  // A name in capitals keeps its first letter (the owner's Home had lowered one, "oM …"), and a company's P LTD is dropped.
  expect(all).toContain('Next challan from OX SHEET WORKS');
  expect(all).toContain('Next challan from TERRA AUTO');
  expect(all).not.toContain('P LTD');
  expect(all).not.toMatch(/\boX\b/);
  // The headline counts what the rows are and never says one of them again.
  const head = (await card.locator('.inv-brief-ans').innerText()).trim();
  expect(head).toMatch(/^2 challans expected by /);
  for (const t of rows) expect(head).not.toBe(t.trim());
  const u = await page.evaluate(() => {
    const w = window as any;
    return { a: w.lcLead('OX SHEET WORKS'), b: w.lcLead('Today'), c: w.lcLead('Mon 19 Oct'), d: w.lcLead('Tata Motors'), e: w.clientShortName('TERRA AUTO P LTD'),
      f: w.clientShortName('KAPPA INDUSTRIES LTD'), g: w.clientShortName('ZETA FORGINGS PVT. LTD.'), h: w.clientShortName('KAPPA TOOLS LLP'), i: w.clientShortName('Tata Motors Limited'), j: w.clientShortName('LTD') };
  });
  expect(u).toEqual({ a: 'OX SHEET WORKS', b: 'today', c: 'Mon 19 Oct', d: 'Tata Motors', e: 'TERRA AUTO', f: 'KAPPA INDUSTRIES', g: 'ZETA FORGINGS', h: 'KAPPA TOOLS', i: 'Tata Motors', j: 'LTD' });
}

/* ---------- The weather's place from the address ---------- */
const GEO = 'https://nominatim.openstreetmap.org';
async function fakeGeo(page: Page, answer: unknown): Promise<string[]> {
  const asked: string[] = [];
  await page.route(GEO + '/**', async (route: Route) => {
    asked.push(new URL(route.request().url()).searchParams.get('q') || '');
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(answer) });
  });
  return asked;
}
const placeBook = () => {
  const s = emptyBook();
  s.company = { ...(s.company || {}), add1: 'Plot 7, Phase 2', add2: 'Industrial Area', add3: 'Testtown' };
  s.feedsCfg = { on: true, url: FEED_BASE };
  return s;
};
export async function weatherPlace(page: Page) {
  await feedsOn(page);
  await page.addInitScript(() => { (window as any).__sepGeoOn = true; });
  await page.clock.setFixedTime(testTime());
  const asked = await fakeGeo(page, [{ lat: '10.123456', lon: '20.456789', display_name: 'Industrial Area, Testtown, India' }]);
  const calls = await fakeWorker(page, okWorker(() => newsAnswer(), () => weatherAnswer()));
  await loadAppWithState(page, placeBook());
  await page.evaluate(() => (window as any).feedEnsure());
  // The address's parts with no figure in them, the locality and its town first; asked once.
  expect(asked[0]).toBe('Industrial Area, Testtown');
  const geo = (await feedCopy(page)).geo;
  expect(geo).toMatchObject({ key: 'industrial area, testtown', lat: 10.1235, lon: 20.4568, name: 'Industrial Area' });
  expect(await g(page, `feedCfg().placeFrom`)).toBe('address');
  // The weather asked at the place to two decimals, and drawn in the masthead.
  expect(calls.some(c => c.path === '/weather' && c.params.lat === '10.12' && c.params.lon === '20.46')).toBe(true);
  await expect(page.locator('#homeDash [data-home-day] [data-home-wx]')).toContainText('°');
  // The place is the device's: the book holds no coordinate, and the address is not asked again.
  const st = await readStoredState(page);
  expect(st.feedsCfg.lat == null && st.feedsCfg.lon == null).toBe(true);
  await page.evaluate(() => (window as any).feedGeoEnsure());
  expect(asked).toHaveLength(1);
  // Settings says where the place came from.
  await openSettingsAt(page, 'feeds');
  await expect(page.locator('#settingsScrim [data-feed-place="address"]')).toBeVisible();
}

/* ---------- MET Norway and GDELT, straight ---------- */
function metAnswer(t0: Date) {
  const hour = 3600000, start = Math.floor(t0.getTime() / hour) * hour;
  return { type: 'Feature', properties: { meta: { updated_at: t0.toISOString() }, timeseries: Array.from({ length: 60 }, (_, i) => ({ time: new Date(start + i * hour).toISOString(),
    data: { instant: { details: { air_temperature: 27.5 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } } } })) } };
}
async function fakeSources(page: Page): Promise<{ met: string[]; gdelt: string[] }> {
  const seen = { met: [] as string[], gdelt: [] as string[] };
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await page.route('https://api.met.no/**', async route => { seen.met.push(route.request().url()); await json(route, metAnswer(testTime())); });
  await page.route('https://api.gdeltproject.org/**', async route => {
    seen.gdelt.push(route.request().url());
    await json(route, { articles: [{ url: 'https://news.example.test/a1', title: 'Truck makers report a busy month', seendate: '20261020T101500Z', language: 'English' }] });
  });
  return seen;
}
export async function directSources(page: Page) {
  await feedsOn(page);
  await page.addInitScript(() => { (window as any).__sepFeedsDirect = true; });
  await page.clock.setFixedTime(testTime());
  const seen = await fakeSources(page);
  // No feeds service at the address: every ask answered 404.
  const calls = await fakeWorker(page, () => ({ status: 404, json: { error: 'not found' } }));
  const s = emptyBook();
  s.feedsCfg = { on: true, url: FEED_BASE, lat: FAKE_LAT, lon: FAKE_LON, place: 'Test place' };
  await loadAppWithState(page, s);
  // Home asked when it was drawn: its asks awaited (GDELT's topics 6 s apart, as the service asks them), then its minute's ask stopped.
  await page.evaluate(() => (window as any).feedEnsure());
  await g(page, 'homeClockStop()');
  expect(calls.some(c => c.path === '/weather')).toBe(true);
  expect(seen.met.some(u => u.includes('lat=10.12&lon=20.46'))).toBe(true);
  expect(seen.gdelt.length).toBeGreaterThanOrEqual(3);
  const copy = await feedCopy(page);
  expect(copy.weather.via).toBe('direct');
  expect(copy.news.via).toBe('direct');
  expect(copy.news.data.topics['tata-cv'].items[0].title).toBe('Truck makers report a busy month');
  expect(copy.direct.at).toBeGreaterThan(0);
  // Settings says each came straight from its source.
  await openSettingsAt(page, 'feeds');
  await expect(page.locator('#settingsScrim [data-feed-status-row="weather"]')).toContainText('straight from MET Norway');
  await expect(page.locator('#settingsScrim [data-feed-status-row="news"]')).toContainText('straight from GDELT');
  await page.keyboard.press('Escape');
  // The service is not asked again for six hours: the next weather goes straight to MET Norway.
  const asked = calls.length, met = seen.met.length;
  await page.clock.setFixedTime(new Date(testTime().getTime() + 2 * 60000));
  expect(await page.evaluate(() => (window as any).feedRefresh('weather'))).toEqual({ ok: true, via: 'direct' });
  expect(calls.length).toBe(asked);
  expect(seen.met.length).toBe(met + 1);
}

/* The Worker set up after the app held it off: Check reaching it ends the six hours, so the next ask is the Worker's. Only its
   weather fails at first, so the hold is set with no topic of GDELT's asked six seconds apart. */
export async function checkEndsHold(page: Page) {
  await feedsOn(page);
  await page.addInitScript(() => { (window as any).__sepFeedsDirect = true; });
  await page.clock.setFixedTime(testTime());
  const seen = await fakeSources(page);
  let up = false;
  const ok = okWorker(() => newsAnswer(), () => weatherAnswer());
  const calls = await fakeWorker(page, c => !up && c.path === '/weather' ? { status: 404, json: { error: 'not found' } } : ok(c));
  const s = emptyBook();
  s.feedsCfg = { on: true, url: FEED_BASE, lat: FAKE_LAT, lon: FAKE_LON, place: 'Test place' };
  await loadAppWithState(page, s);
  await page.evaluate(() => (window as any).feedEnsure());
  await g(page, 'homeClockStop()');
  // No weather from a Worker at the address: MET Norway asked straight, and the Worker held off.
  let copy = await feedCopy(page);
  expect(copy.weather.via).toBe('direct');
  expect(copy.direct.at).toBeGreaterThan(0);
  // The Worker is set up, and Check reaches it: the hold is over.
  up = true;
  await openSettingsAt(page, 'feeds');
  await page.locator('[data-sec="feeds"] [data-action="invFeedCheck"]').click();
  await expect(page.locator('[data-feed-check="ok"]')).toContainText('Reached');
  copy = await feedCopy(page);
  expect(copy.direct.at).toBeFalsy();
  await page.keyboard.press('Escape');
  // The next weather, well inside the six hours, is the Worker's, and MET Norway is not asked again.
  const asked = calls.filter(c => c.path === '/weather').length, met = seen.met.length;
  await page.clock.setFixedTime(new Date(testTime().getTime() + 2 * 60000));
  expect(await page.evaluate(() => (window as any).feedRefresh('weather'))).toEqual({ ok: true, via: 'service' });
  expect(calls.filter(c => c.path === '/weather')).toHaveLength(asked + 1);
  expect(seen.met.length).toBe(met);
}

/* Under test the sources and the address's place are never asked unless a spec says so. */
export async function quietUnderTest(page: Page) {
  await feedsOn(page);
  await page.clock.setFixedTime(testTime());
  const seen = await fakeSources(page), asked = await fakeGeo(page, []);
  await fakeWorker(page, () => ({ status: 404, json: { error: 'not found' } }));
  await loadAppWithState(page, placeBook());
  await page.evaluate(() => (window as any).feedEnsure());
  expect(asked).toHaveLength(0);
  expect(await g(page, `feedCfg().placeFrom`)).toBe('');
  await g(page, `S.feedsCfg.lat = ${FAKE_LAT}; S.feedsCfg.lon = ${FAKE_LON}`);
  expect(await page.evaluate(() => (window as any).feedFetch('weather'))).toEqual({ ok: false, why: 'refused', status: 404, via: 'service' });
  expect(seen.met).toHaveLength(0);
  expect(seen.gdelt).toHaveLength(0);
}

/* ---------- The phone: a quiet card is short ---------- */
export async function phoneQuiet(page: Page) {
  const s: any = floorBook();
  s.flowCfg = { ...(s.flowCfg || {}), holidays: [W], shutWhy: { [W]: 'Durga Puja' } };
  await page.clock.install({ time: new Date(W + 'T11:30:00') });
  await loadAppWithState(page, s);
  await geistReady(page);
  await openHome(page);
  const floor = page.locator('#homeBoard .inv-widget[data-w="floornow"]');
  await expect(floor.locator('[data-wc-off]')).toBeVisible();
  // A Medium on the phone is two rows (348 px) at most; a shut day's floor card holds a line and the last day plated.
  const h = await floor.evaluate(e => e.getBoundingClientRect().height);
  expect(h).toBeLessThan(220);
  // The board's tools stand at the end of the masthead's act row, and no row of their own follows it.
  await expect(page.locator('#homeDash [data-home-day] .inv-mast-act [data-home-toolbar] [data-action="invWdgArrange"]')).toBeVisible();
  await expect(page.locator('#homeDash > [data-home-toolbar]')).toHaveCount(0);
  // Arranging, each card is its size's whole box again, and the toolbar its own row.
  await page.locator('#homeDash [data-action="invWdgArrange"]').click();
  await expect(page.locator('#homeDash > [data-home-toolbar][data-arranging]')).toHaveCount(1);
  expect(Math.round(await floor.evaluate(e => e.getBoundingClientRect().height))).toBe(348);
  await page.locator('[data-action="invWdgDone"]').first().click();
}
