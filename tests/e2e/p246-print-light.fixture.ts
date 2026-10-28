import { expect, type Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openHome, openNeeds, readStoredState, answerAsk, todayIso, type SepState } from './fixtures';
import { fakeGitHubRepo, seedPrtSync, statusText, jobName, jobText, type GitFake, type File as GhFile } from './prt-github-fixture';
import { withUsers, unlock, lockNow, PINS } from './p140-guard.fixture';

// P246, the print station's light (owner, 28 Oct 2026: "need a blinking light (notification) on the home screen hero card, to show
// if the kiosk printer machine is connected and online. If it's not connected, it should show red light or amber, depends, and when
// it was last active"; then, on the design pass, "1 and 2 - your recommendation / 3 - needs a fail safe, just to be sure, if someone
// is updating on the kiosk then auto-reload should not happen without the work being saved"), shared by the phone and the desktop.
// - The station checks in every 10 minutes on a branch of its own, made from the sync branch and moved back onto it each month.
// - The light is one of the masthead's facts, its words and its dot; red with a job waiting it leads, after money in danger; red
//   blinks until it is opened and again when it gets worse, never for reduced motion; it is the owner's and the office's.
// - Its dialog: the station's state, when it was last seen and last printed, its build, the jobs waiting, each cancelled there, and
//   the jobs printed on this device (each taken off the queue first, put back where it did not print).
// - Send to office asks first where the station is not on; the station reloads to a new build only once nothing would be lost.
// GitHub is a fake at the route layer (prt-github-fixture.ts); every name and figure is made up; the day is today or, on a Sunday,
// the Monday after, in a book with no paid holiday, so the plant works and the general shift runs 8:30 AM to 5:00 PM.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
export const W = new Date(todayIso() + 'T00:00:00').getDay() === 0 ? addDays(todayIso(), 1) : todayIso();
const at = (hm: string, day = W) => new Date(day + 'T' + hm + ':00').getTime();
const MIN = 60000;
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const words = (s: string | null) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.labour = { ...(s.labour || {}), holidays: [] };
  const addr = { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' };
  s.clients = [{ id: 1, name: 'NOVA FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, address: addr }];
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: W, status: 'active', invoiceState: 'created', clientId: 1,
    clientName: 'NOVA FORGE', clientGSTIN: '', gstType: 'intra', clientAddress: addr,
    items: [{ partNumber: 'BRACKET A', desc: 'BRACKET A', hsn: '998873', unit: 'KG', qty: 100, rate: 12, amount: 1200, nosQty: null }],
    taxableValue: 1200, cgstPer: 9, cgstAmt: 108, sgstPer: 9, sgstAmt: 108, igstPer: 0, igstAmt: 0, grandTotal: 1416, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: W, transport: '', remarks: '', linkedIMIds: [], createdAt: at('09:00') }];
  s.printer = { on: true, name: 'Office laser', address: '10.0.0.9', cartridge: 'TONER-1' };
  return s as SepState;
}

type Job = { at: number; title?: string; tail?: string };
type Opts = { now?: string; seen?: number | null; jobs?: Job[]; station?: boolean; home?: boolean; build?: string };
/* The clock at `now` (12:30 PM by default) and running; the station's check-in at `seen` (none: never seen) and the jobs waiting;
   GitHub sync on this device; the book loaded and Home open. */
async function setUp(page: Page, o: Opts = {}): Promise<GitFake> {
  await page.clock.install({ time: new Date(at(o.now || '12:30')) });
  const status = new Map<string, GhFile>(), main = new Map<string, GhFile>();
  if (o.seen != null) status.set('print-status.json', { sha: 'st0', text: statusText(o.seen, o.build ? { build: o.build } : {}) });
  (o.jobs || []).forEach((j, i) => main.set(jobName(j.at, j.tail || 'job' + 'abcdefgh'[i]), { sha: 'j' + i, text: jobText(j.title || 'Invoice SEP/TEST-0000' + (i + 1)) }));
  await seedPrtSync(page, o.station ? { sep_inv_print_station: { on: true } } : {});
  const fake = await fakeGitHubRepo(page, { main, status });
  await loadAppWithState(page, book());
  if (o.home !== false) await openHome(page);
  return fake;
}
const mast = (page: Page) => page.locator('#homeDash [data-home-day]');
const light = (page: Page) => mast(page).locator('[data-prt-light]');
const dialog = (page: Page) => page.locator('[data-prt-dialog]');
const queued = (f: GitFake) => [...f.main.keys()].filter(k => k.startsWith('print-queue/')).sort();
/* The lamp's own animation: the dot's mark, never its words. */
const blinking = (page: Page, sel: string) => page.locator(sel).first().evaluate(e => getComputedStyle(e, '::before').animationName);
/* The station's own look at the queue every 15 seconds, stopped: the spec takes each look itself (a look the clock fired could still
   hold the station's lock when the spec's own is taken, and that one would do nothing). */
const ownLooks = (page: Page) => g(page, 'clearTimeout(_prtTimer); prtStationArm = function() {}; true');

/* ---------- The state, worked out ---------- */
export async function stateRules(page: Page) {
  await page.clock.install({ time: new Date(at('12:30')) });
  await loadAppWithState(page, book());
  const days = { W, Y: addDays(W, -1), D3: addDays(W, -3), D10: addDays(W, -10) };
  const r = await page.evaluate(d => {
    const w = window as any, sh = { start: 510, end: 1020 };
    const T = (hm: string, day = d.W) => new Date(day + 'T' + hm + ':00');
    const rec = (seen: Date | null, jobs: string[] = [], build = '') => ({ at: Date.now(), ok: true, never: !seen,
      jobs: jobs.map((h, i) => ({ id: 'j' + i, at: T(h).getTime() })),
      status: seen ? { at: seen.getTime(), build, lastPrinted: null, device: 'Office desk' } : null });
    const st = (rr: any, now: Date, o: any = {}) => {
      const x = w.prtLightState(rr, { now, online: o.online !== false, live: o.live || '', shift: 'shift' in o ? o.shift : sh });
      return x && { state: x.state, tone: x.tone, text: x.text.replace(/ /g, ' '), lead: x.lead, sig: x.sig };
    };
    const noon = T('12:30');
    return {
      on: st(rec(T('12:25')), noon),
      fresh: st(rec(T('12:25'), ['12:28']), noon),
      waiting: st(rec(T('12:25'), ['12:25']), noon),
      stuck: st(rec(T('12:25'), ['12:15']), noon),
      stuckTwo: st(rec(T('12:25'), ['12:15', '12:26']), noon),
      stuckLater: st(rec(T('12:25'), ['12:15']), T('12:30'), { shift: null }),
      old: st(rec(T('12:25'), [], 'b0'), noon, { live: 'b1' }),
      sameBuild: st(rec(T('12:25'), [], 'b1'), noon, { live: 'b1' }),
      unseen: st(rec(T('12:00')), noon),
      down: st(rec(T('11:00')), noon),
      downLater: st(rec(T('11:00')), T('13:31')),
      unseenJob: st(rec(T('12:00'), ['12:15']), noon),
      morning: st(rec(T('17:10', d.Y)), T('09:00')),
      morningLate: st(rec(T('17:10', d.Y)), T('09:45')),
      evening: st(rec(T('17:10')), T('19:00')),
      eveningJob: st(rec(T('17:10'), ['17:20']), T('19:00')),
      shut: st(rec(T('11:00'), ['11:30']), noon, { shift: null }),
      never: st(rec(null), noon),
      neverJob: st(rec(null, ['12:20']), noon),
      offline: st(rec(T('12:25')), noon, { online: false }),
      error: st({ at: Date.now(), ok: false, err: 'GitHub said 500' }, noon),
      none: st(null, noon),
      days3: w.prtWhenSaid(T('17:10', d.D3).getTime(), noon),
      days10: w.prtWhenSaid(T('17:10', d.D10).getTime(), noon), d10: w.stockShortDate(d.D10),
    };
  }, days);
  // Checked in within 15 minutes, nothing waiting past 3: on, green, and when it was seen.
  expect(r.on).toMatchObject({ state: 'on', tone: 'ok', text: 'Print station on · seen 12:25 PM', lead: false, sig: '' });
  expect(r.fresh!.state).toBe('on');
  // A job waiting past 3 minutes: amber; past 10 in the shift: red, and it leads (a dispatch can wait on that paper).
  expect(r.waiting).toMatchObject({ state: 'waiting', tone: 'warning', text: 'Print station on · 1 job waiting 5 min', lead: false });
  expect(r.stuck).toMatchObject({ state: 'stuck', tone: 'danger', text: 'Print station on · 1 job waiting 15 min', lead: true });
  expect(r.stuckTwo).toMatchObject({ state: 'stuck', tone: 'danger', text: 'Print station on · 2 jobs waiting, the oldest 15 min', lead: true });
  // Outside the shift (or on a day the plant is shut) a job waiting is amber, never red.
  expect(r.stuckLater).toMatchObject({ state: 'waiting', tone: 'warning', lead: false });
  // Its build behind the one published: amber (it reloads itself); on the published build: on.
  expect(r.old).toMatchObject({ state: 'old', tone: 'warning', text: 'Print station on an old build' });
  expect(r.sameBuild!.state).toBe('on');
  // In the shift and not seen: amber, then red past an hour, counted from the shift's start where it was last seen before it.
  expect(r.unseen).toMatchObject({ state: 'unseen', tone: 'warning', text: 'Print station not seen since 12:00 PM', lead: false });
  expect(r.down).toMatchObject({ state: 'down', tone: 'danger', text: 'Print station not seen since 11:00 AM', lead: false });
  expect(r.unseenJob).toMatchObject({ state: 'down', tone: 'danger', text: 'Print station not seen since 12:00 PM · 1 job waiting', lead: true });
  expect(r.morning).toMatchObject({ state: 'unseen', tone: 'warning', text: 'Print station not seen since yesterday 5:10 PM' });
  expect(r.morningLate).toMatchObject({ state: 'down', tone: 'danger' });
  // Outside the shift: off, grey; amber with a job waiting, never red.
  expect(r.evening).toMatchObject({ state: 'off', tone: 'neutral', text: 'Print station off since 5:10 PM' });
  expect(r.eveningJob).toMatchObject({ state: 'off', tone: 'warning', text: 'Print station off since 5:10 PM · 1 job waiting', lead: false });
  expect(r.shut).toMatchObject({ state: 'off', tone: 'warning', lead: false });
  // Never seen: grey, amber with a job waiting. Offline or GitHub not answering: grey, it cannot check, never the last colour.
  expect(r.never).toMatchObject({ state: 'never', tone: 'neutral', text: 'Print station not seen yet' });
  expect(r.neverJob).toMatchObject({ state: 'never', tone: 'warning', text: 'Print station not seen yet · 1 job waiting' });
  expect(r.offline).toMatchObject({ state: 'offline', tone: 'neutral', text: 'Print station: can’t check offline' });
  expect(r.error).toMatchObject({ state: 'error', tone: 'neutral', text: 'Print station: can’t check' });
  expect(r.none).toBeNull();
  // What a blink is acknowledged against: red, its jobs and the hours unseen. A job more, or another hour unseen, is worse.
  expect(r.stuck!.sig).not.toBe(r.stuckTwo!.sig);
  expect(r.down!.sig).not.toBe(r.downLater!.sig);
  expect(r.unseen!.sig).toBe('');
  // When it was, said short: a weekday within the week, else the day.
  expect(r.days3).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) 5:10 PM$/);
  expect(r.days10).toBe(r.d10);
}

/* ---------- The station's check-in ---------- */
export async function checkIn(page: Page) {
  const f = await setUp(page, { station: true, home: false });
  await ownLooks(page);
  const puts = () => f.log.filter(l => l.method === 'PUT' && l.path === 'print-status.json');
  // The first check-in makes the branch from the sync branch's head, then writes the file on it, never on the sync branch.
  await g(page, 'prtStationTick()');
  await expect.poll(() => puts().length).toBe(1);
  expect(f.log.find(l => l.method === 'POST')).toMatchObject({ path: 'git/refs', body: { ref: 'refs/heads/print-status', sha: 'main-head-1' } });
  expect(puts()[0]).toMatchObject({ branch: 'print-status', message: 'Print station checked in' });
  expect(puts()[0].body.sha).toBeUndefined();
  expect(f.main.has('print-status.json')).toBe(false);
  const month = W.slice(0, 7), build = await g(page, 'APP_BUILD');
  const first = JSON.parse(f.status.get('print-status.json')!.text);
  expect(first).toMatchObject({ kind: 'sep-print-status', v: 1, build, device: 'Office desk', lastPrinted: null, month });
  expect(first.at).toBeGreaterThanOrEqual(at('12:30'));
  // Within ten minutes it writes nothing more, however often it looks at the queue.
  await g(page, 'prtStationTick()');
  await g(page, 'prtStationTick()');
  expect(puts()).toHaveLength(1);
  // Ten minutes on: the next, over the file it wrote.
  const sha1 = f.status.get('print-status.json')!.sha;
  await page.clock.fastForward(11 * MIN);
  await g(page, 'prtStationTick()');
  await expect.poll(() => puts().length).toBe(2);
  expect(puts()[1].body.sha).toBe(sha1);
  // Another hand moved the file (a second station): read again and written once more over it.
  f.status.set('print-status.json', { sha: 'other', text: statusText(Date.now()) });
  await page.clock.fastForward(11 * MIN);
  await g(page, 'prtStationTick()');
  await expect.poll(() => puts().length).toBe(4);
  expect(puts()[3].body.sha).toBe('other');
  expect(f.log.filter(l => l.method === 'POST')).toHaveLength(1);
  // The first check-in of a new month moves the branch back onto the sync branch (forced): a month of check-ins at most.
  const next = (() => { const d = new Date(W + 'T00:00:00'); d.setMonth(d.getMonth() + 1, 1); return isoOf(d); })();
  await page.clock.setSystemTime(new Date(at('12:30', next)));
  await g(page, 'prtStationTick()');
  await expect.poll(() => puts().length).toBe(5);
  expect(f.log.find(l => l.method === 'PATCH')).toMatchObject({ path: 'git/refs/heads/print-status', body: { sha: 'main-head-1', force: true } });
  expect(puts()[4].body.sha).toBeUndefined();
  expect(JSON.parse(f.status.get('print-status.json')!.text).month).toBe(next.slice(0, 7));
  // Settings says when it last checked in.
  await page.evaluate(() => (window as any).openSettings('printer'));
  await expect(page.locator('[data-prt-station]')).toContainText('Checked in');
}

/* ---------- On the masthead, and its dialog ---------- */
export async function factAndDialog(page: Page, desktop: boolean) {
  await setUp(page, { seen: at('12:28') });
  // On: one of the masthead's facts, its dot and its words, green; it never leads.
  await expect(light(page)).toHaveAttribute('data-prt-light', 'ok');
  expect(words(await light(page).innerText())).toBe('Print station on · seen 12:28 PM');
  await expect(light(page)).not.toHaveClass(/inv-blink/);
  await expect(mast(page).locator('[data-home-lead="station"]')).toHaveCount(0);
  await expect(mast(page).locator('.inv-mast-facts [data-prt-light]')).toHaveCount(1);
  if (desktop) {
    // Beside the plant's facts, never under the clock; the masthead keeps its height.
    await expect(mast(page).locator('.inv-mast-time [data-prt-light]')).toHaveCount(0);
    expect(Math.abs((await mast(page).boundingBox())!.height - 148)).toBeLessThan(1);
  }
  // Its words open the station: now, last seen (and from where), last printed, the build; no jobs, so nothing to print here.
  await light(page).locator('button').click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d.locator('[data-prt-now="on"]')).toContainText('On');
  const seenRow = d.locator('.inv-row', { hasText: 'Last seen' });
  await expect(seenRow).toContainText('12:28 PM');
  await expect(seenRow).toContainText('2 min ago · Office desk');
  await expect(d.locator('.inv-row', { hasText: 'Last printed' })).toContainText('—');
  await expect(d.locator('.inv-row', { hasText: 'Build' })).toContainText('Not known');
  await expect(d).toContainText('The station checks in every 10 minutes. It cannot see the printer’s paper or toner.');
  await expect(d.locator('[data-action="invPrtHere"]')).toHaveCount(0);
  // The setup guide is one tap away.
  await d.locator('[data-action="invPrtGuide"]').click();
  await expect(page.locator('#pageKnow.inv-page-active')).toBeVisible();
  await expect(page.locator('#pageKnow')).toContainText('office printer');
}

/* ---------- Red with a job waiting leads, and blinks until it is opened ---------- */
export async function redLeads(page: Page, desktop: boolean) {
  const f = await setUp(page, { seen: at('12:28'), jobs: [{ at: at('12:15') }] });
  const say = mast(page).locator('.inv-mast-say');
  await expect(say.locator('[data-home-lead="station"]')).toBeVisible();
  expect(words(await say.innerText())).toBe('Print station on · 1 job waiting 15 min');
  await expect(mast(page)).toHaveAttribute('data-tone', 'danger');
  await expect(say).toHaveClass(/inv-blink/);
  expect(await blinking(page, '#homeDash .inv-mast-say')).toBe('inv-blink');
  // Not drawn twice: the lead is the light, and the facts do not carry it again.
  await expect(light(page)).toHaveCount(0);
  await expect(mast(page).locator('.inv-mast-act [data-home-lead="station"]')).toHaveText('See the job');
  // The count beside it leaves out its own task (the desktop's link; the phone's badge on Needs you says it).
  const others = await page.evaluate(() => (window as any).tdyTasks().filter((r: any) => r.tone === 'red' && !(r.app && r.app.rule === 'prtStation')).length);
  if (desktop) await expect(mast(page).locator('.inv-mast-act [data-home-needs]')).toHaveCount(others ? 1 : 0);
  // Never for anyone set to reduce motion: the class stays, the lamp holds still.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await blinking(page, '#homeDash .inv-mast-say')).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // A red task on Needs you, which opens the station.
  await openNeeds(page);
  const task = page.locator('#homeNeeds [data-tdy-task="prtStation"]');
  await expect(task).toBeVisible();
  await expect(task).toHaveAttribute('data-tone', 'red');
  await expect(task.locator('.inv-deck-title')).toHaveText('Check the print station');
  expect(words(await task.locator('.inv-deck-sub').innerText())).toBe('Print station on · 1 job waiting 15 min');
  // Opened: the blink holds steady.
  await openHome(page);
  await say.locator('[data-home-lead="station"]').click();
  await expect(dialog(page)).toBeVisible();
  // Seen two minutes ago but not printing: stuck, never "not seen".
  await expect(dialog(page).locator('[data-prt-now="stuck"]')).toContainText('Jobs stuck');
  await page.locator('[data-prt-dialog] .inv-dialog-close').click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(say).not.toHaveClass(/inv-blink/);
  await expect(mast(page)).toHaveAttribute('data-tone', 'danger');
  // Worse (a second job): it blinks again.
  f.main.set(jobName(at('12:29'), 'jobz'), { sha: 'jz', text: jobText('Invoice SEP/TEST-00009') });
  await g(page, 'prtLightRead(true)');
  await expect(say).toHaveClass(/inv-blink/);
  expect(words(await say.innerText())).toBe('Print station on · 2 jobs waiting, the oldest 15 min');
  await expect(mast(page).locator('.inv-mast-act [data-home-lead="station"]')).toHaveText('See the 2 jobs');
  // Its task opens the station too.
  await openNeeds(page);
  await page.locator('#homeNeeds [data-tdy-task="prtStation"]').getByRole('button', { name: 'See the jobs' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-prt-job]')).toHaveCount(2);
}

/* ---------- Money in danger leads first; the light still blinks among the facts ---------- */
export async function moneyFirst(page: Page) {
  await setUp(page, { seen: at('12:28'), jobs: [{ at: at('12:15') }] });
  await expect(mast(page).locator('[data-home-lead="station"]').first()).toBeVisible();
  await page.evaluate(() => { const w = window as any; w.finHasBank = () => true; w.finForecast = () => ({ overdrawn: true }); w.homeDayRefresh(); });
  await expect(mast(page).locator('[data-home-lead="money"]')).toBeVisible();
  expect(words(await mast(page).locator('.inv-mast-say').innerText())).toBe('The bank account is overdrawn');
  await expect(light(page)).toHaveAttribute('data-prt-light', 'danger');
  await expect(light(page)).toHaveClass(/inv-blink/);
  expect(words(await light(page).innerText())).toBe('Print station on · 1 job waiting 15 min');
}

/* ---------- The jobs: cancelled from the dialog, printed here ---------- */
export async function dialogJobs(page: Page) {
  await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
  const f = await setUp(page, { seen: at('12:28'), jobs: [{ at: at('12:15'), title: 'Invoice SEP/TEST-00001' }, { at: at('12:22'), title: 'Invoice SEP/TEST-00002' },
    { at: at('12:24'), title: 'Delivery challan 77' }] });
  await mast(page).locator('[data-home-lead="station"]').first().click();
  const d = dialog(page);
  await expect(d.locator('[data-prt-job]')).toHaveCount(3);
  // Each by its title (read once for the dialog), how long it has waited, in the tone of the wait.
  await expect(d.locator('[data-prt-job]').nth(0)).toContainText('Invoice SEP/TEST-00001');
  await expect(d.locator('[data-prt-job]').nth(0).locator('.inv-fig-danger')).toContainText('waiting 15 min');
  await expect(d.locator('[data-prt-job]').nth(1).locator('.inv-fig-warning')).toContainText('waiting 8 min');
  // Cancelled there: off the queue, and the dialog drawn again.
  await d.locator('[data-prt-job]').nth(2).locator('[data-action="invPrtLightCancel"]').click();
  await expect(page.locator('.inv-toast').last()).toContainText('Cancelled');
  await expect(d.locator('[data-prt-job]')).toHaveCount(2);
  expect(queued(f)).toHaveLength(2);
  expect(f.log.some(l => l.method === 'DELETE' && /^Print cancelled/.test(l.message || ''))).toBe(true);
  // Printed here, oldest first: each taken off the queue before its preview opens, so the station never prints it too.
  await expect(d.locator('[data-action="invPrtHere"]')).toHaveText('Print the 2 here');
  await d.locator('[data-action="invPrtHere"]').click();
  const view = page.locator('#invPrintView');
  await expect(view).toHaveClass(/inv-print-view-active/);
  await expect(page.locator('#invPrintBody')).toContainText('Invoice SEP/TEST-00001');
  expect(queued(f)).toHaveLength(1);
  expect(f.log.filter(l => l.method === 'DELETE' && /^Taken to print on Office desk: Invoice SEP\/TEST-00001/.test(l.message || ''))).toHaveLength(1);
  await page.locator('#invPrintView [data-action="invPrint"]').click();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
  // Its Print marks no invoice Printed: a job from the queue is no invoice of this preview's.
  expect((await readStoredState(page)).invoices[0].invoiceState).toBe('created');
  // Closed: did it print? Yes, and the next is taken.
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  expect(await answerAsk(page, 'ok')).toContain('Did it print?');
  await expect(view).toHaveClass(/inv-print-view-active/);
  await expect(page.locator('#invPrintBody')).toContainText('Invoice SEP/TEST-00002');
  await expect.poll(() => queued(f).length).toBe(0);
  // Not printed: put back on the queue under its own name, so it keeps its place.
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  await answerAsk(page, 'cancel');
  await expect(page.locator('.inv-toast').last()).toContainText('Put back on the queue');
  await expect.poll(() => queued(f)).toEqual([jobName(at('12:22'), 'jobb')]);
  expect(JSON.parse(f.main.get(jobName(at('12:22'), 'jobb'))!.text).title).toBe('Invoice SEP/TEST-00002');
  await expect(view).not.toHaveClass(/inv-print-view-active/);
}

/* ---------- Send to office asks where the station is not on ---------- */
export async function sendAsks(page: Page) {
  await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
  const f = await setUp(page, { seen: at('11:50') });
  // Not seen for 40 minutes in the shift: amber, and with nothing else to do it is the masthead's sentence.
  await expect(mast(page).locator('.inv-mast-say [data-home-lead="station"]')).toBeVisible();
  await expect(mast(page)).toHaveAttribute('data-tone', 'warning');
  expect(words(await mast(page).locator('.inv-mast-say').innerText())).toBe('Print station not seen since 11:50 AM');
  await expect(mast(page).locator('.inv-mast-say')).not.toHaveClass(/inv-blink/);
  await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
  // Asked over the preview, with Print here beside Send anyway.
  await page.locator('#invPrintRemote').click();
  const ask = page.locator('[data-ui-ask]').last();
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('Print station not seen since 11:50 AM');
  await expect(ask).toContainText('The job will wait until the station is back. Print here prints it on this device now.');
  await expect(ask.locator('[data-ans="alt"]')).toHaveText('Send anyway');
  await expect(ask.locator('[data-ans="ok"]')).toHaveText('Print here');
  expect(await ask.evaluate(t => { const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!e && t.contains(e); })).toBe(true);
  // Print here: printed on this device, the invoice marked Printed, nothing sent.
  await answerAsk(page, 'ok');
  expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
  expect((await readStoredState(page)).invoices[0].invoiceState).toBe('printed');
  expect(queued(f)).toHaveLength(0);
  // Closed with ×: nothing sent, nothing printed.
  await page.locator('#invPrintRemote').click();
  await page.locator('[data-ui-ask] .inv-dialog-close').last().click();
  await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
  expect(queued(f)).toHaveLength(0);
  // Send anyway: it goes to the queue as before.
  await page.locator('#invPrintRemote').click();
  await page.locator('[data-ui-ask] [data-ans="alt"]').last().click();
  await expect(page.locator('.inv-toast').last()).toContainText('Sent to Office laser');
  expect(queued(f)).toHaveLength(1);
}

/* ---------- The station reloads to a new build only when nothing would be lost ---------- */
export async function reloadSafe(page: Page) {
  await page.route('**/version.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: 'feedface' }) }));
  await setUp(page, { station: true, seen: at('12:25'), home: false });
  await ownLooks(page);
  await page.evaluate(() => { (window as any).prtReloadNow = () => { (window as any).__reloaded = ((window as any).__reloaded || 0) + 1; }; });
  await expect.poll(() => g(page, 'prtReloadDue()')).toBe(true);
  // The station's banner says it reloads itself, and when.
  await expect(page.locator('.inv-update-bar')).toContainText('This print station reloads itself once nothing is typed, saving or printing and it has been left alone for 5 minutes.');
  const blockers = () => g(page, 'prtReloadBlockers()') as Promise<string[]>;
  // Used in the last five minutes: it waits.
  expect(await blockers()).toContain('in use in the last 5 minutes');
  expect(await g(page, 'prtReloadMaybe()')).toBe(false);
  // Left alone, but a dialog open: it waits.
  await g(page, `_prtLastInput = Date.now() - 6 * 60000; uiAlert({ title: 'A question', body: 'Left open on the kiosk.' }); true`);
  await expect(page.locator('[data-ui-ask]')).toBeVisible();
  expect(await blockers()).toEqual(['a dialog is open']);
  expect(await g(page, 'prtReloadMaybe()')).toBe(false);
  // Answered: that was the kiosk in use.
  await answerAsk(page, 'ok');
  expect(await blockers()).toContain('in use in the last 5 minutes');
  // Something typed and not saved, a book still saving, a push waiting: each holds it.
  await g(page, '_prtLastInput = Date.now() - 6 * 60000; _pageTyped = true');
  expect(await blockers()).toEqual(['a form has typed work']);
  await g(page, '_pageTyped = false; _ghPushTimer = setTimeout(function() {}, 600000)');
  expect(await blockers()).toEqual(['a push to GitHub is waiting']);
  await g(page, 'ghCancelPending(); _challanForm = { items: [] }');
  expect(await blockers()).toEqual(['a challan is being entered']);
  await g(page, '_challanForm = null');
  expect(await blockers()).toEqual([]);
  expect(await page.evaluate(() => (window as any).__reloaded)).toBeUndefined();
  // Nothing holds it: its next look at the queue reloads it.
  await g(page, 'prtStationTick()');
  await expect.poll(() => page.evaluate(() => (window as any).__reloaded)).toBe(1);
  // A device that is not the station is never reloaded for a build.
  await g(page, 'prtSetStation(false)');
  expect(await g(page, 'prtReloadDue()')).toBe(false);
}

/* ---------- Offline: it cannot check, never the last colour it saw ---------- */
export async function offline(page: Page) {
  await setUp(page, { seen: at('11:00'), jobs: [{ at: at('12:00') }] });
  await expect(mast(page).locator('[data-home-lead="station"]').first()).toBeVisible();
  await page.context().setOffline(true);
  await g(page, 'prtLightRedraw()');
  await expect(light(page)).toHaveAttribute('data-prt-light', 'neutral');
  expect(words(await light(page).innerText())).toBe('Print station: can’t check offline');
  await expect(mast(page).locator('[data-home-lead="station"]')).toHaveCount(0);
  await light(page).locator('button').click();
  await expect(dialog(page).locator('[data-prt-now="offline"]')).toContainText('Can’t check');
  await expect(dialog(page)).toContainText('This device is offline');
  await page.context().setOffline(false);
}

/* ---------- The owner's and the office's ---------- */
export async function roles(page: Page) {
  await setUp(page, { seen: at('12:28'), jobs: [{ at: at('12:15') }] });
  await withUsers(page);
  // This device registered with the owner present (devices.js, P142): its sync is allowed.
  const allowSync = () => page.evaluate(() => { (window as any).devSyncBlocked = () => ''; });
  await unlock(page, 'U-off', PINS.office);
  await allowSync();
  await g(page, 'prtLightRead(true).then(function() { renderHome(); })');
  await openHome(page);
  await expect(mast(page).locator('[data-home-lead="station"]').first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).tdyTasks().some((r: any) => r.app && r.app.rule === 'prtStation'))).toBe(true);
  // The supervisor sees no light and no task: the same device, the same read.
  await lockNow(page);
  await unlock(page, 'U-sup', PINS.super);
  await openHome(page);
  await expect(mast(page).locator('[data-prt-light], [data-home-lead="station"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).tdyTasks().some((r: any) => r.app && r.app.rule === 'prtStation'))).toBe(false);
  // With the office printer off, nobody does.
  await lockNow(page);
  await unlock(page, 'U-own', PINS.owner);
  await openHome(page);
  await expect(mast(page).locator('[data-home-lead="station"]').first()).toBeVisible();
  await g(page, 'S.printer.on = false; homeDayRefresh()');
  await expect(mast(page).locator('[data-prt-light], [data-home-lead="station"]')).toHaveCount(0);
}
