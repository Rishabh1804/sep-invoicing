import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { emptyState, loadAppWithState, noSeedIM, answerAsk, todayIso, type SepState } from './fixtures';
import { fakeGitHubRepo, seedPrtSync, statusText, jobName, type GitFake, type File as GhFile } from './prt-github-fixture';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P247, a print job opens only where its document could (owner, 28 Oct 2026, of an Office ID opening a pay slip's wages from the
// office's queue with Print it here: "That's definitely not acceptable"; Castor's finding on the codex record, M-1).
// - Every preview says what its document needs (print.js printNeed): the pages its own screen is on, and wages, money, a
//   permission or the owner, the same gate as that screen. Send to office keeps it on the job.
// - The station's dialog opens a job, by Cancel or Print it here, only for an ID whose screens open the same document
//   (prtlight.js prtJobOpens). Another's job is listed without its title, with nothing to do, and stays on the queue for the station.
//   A job sent before jobs said what they need is the owner's.
// GitHub is a fake at the route layer (prt-github-fixture.ts); every name and figure is made up.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
// Today, or on a Sunday the Monday after: the plant works and the general shift runs.
const W = new Date(todayIso() + 'T00:00:00').getDay() === 0 ? addDays(todayIso(), 1) : todayIso();
const at = (hm: string) => new Date(W + 'T' + hm + ':00').getTime();
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

/* ---------- Every preview says what its document needs ---------- */
// Each function that opens the print view, and what it says another ID needs: the same gate as the screen it is opened from.
const NEEDS: Record<string, string> = {
  showPrintPreview: "printNeed({ pages: ['pageRegister'] })",
  showCreditNotePreview: "printNeed({ pages: ['pageRegister'] })",
  showSalesRegisterPreview: "printNeed({ pages: ['pageRegister'] })",
  showQualityCertificates: "printNeed({ pages: ['pageRegister'] })",
  qtPrint: "printNeed({ pages: ['pageClients'] })",
  soaPrint: "printNeed({ pages: ['pageFinance'], money: true })",
  psShow: "printNeed({ pages: ['pageStaff'], wages: true, money: paySeesBank() })",
  attSheetPreview: "printNeed({ pages: ['pageStaff'] })",
  idcPreview: 'printNeed({ owner: true })',
  ckPrint: 'printNeed({ owner: true })',
  stockSheetPreview: "printNeed({ pages: ['pageStock'] })",
  rptPrint: "printNeed({ pages: ['pageReports'], owner: current && grdIsOwner(), wages: current && grdSeesWages() })",
  powerPrint: "printNeed({ pages: ['pagePower'] })",
  plnReportOpen: "printNeed({ pages: ['pagePlanner'] })",
  fshShow: 'printNeed(need)',
  prtHereShow: 'printNeed(held.data.need)',
  prtPrintHere: 'printNeed(data.need)',
};
/* The functions in split/ that open the print view, each with its body. */
function printOpeners(): Record<string, string> {
  const dir = path.join(__dirname, '..', '..', 'split'), out: Record<string, string> = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    lines.forEach((ln, i) => {
      if (!/classList\.add\('inv-print-view-active'\)/.test(ln)) return;
      let s = i;
      while (s > 0 && !/^(async )?function \w+\(/.test(lines[s])) s--;
      const name = (/^(?:async )?function (\w+)\(/.exec(lines[s]) || [])[1];
      let e = i;
      while (e < lines.length - 1 && !/^}/.test(lines[e])) e++;
      if (name) out[name] = lines.slice(s, e + 1).join('\n');
    });
  }
  return out;
}

test('every preview says what its document needs, the gate of the screen it comes from', async () => {
  const fns = printOpeners();
  // A new way into the print view names its need here first.
  expect(Object.keys(fns).sort()).toEqual(Object.keys(NEEDS).sort());
  for (const [name, call] of Object.entries(NEEDS)) expect(fns[name], name).toContain(call);
  // The face sheets name each sheet's page, and money where the stock as entered carries its bills and prices.
  const face = fs.readFileSync(path.join(__dirname, '..', '..', 'split', 'facesheet.js'), 'utf8');
  for (const [id, page] of [['roll', 'pageStaff'], ['attsheet', 'pageStaff'], ['pickling', 'pageProduction'], ['stock', 'pageStock'], ['barrel', 'pageProduction'], ['vat', 'pageProduction']])
    expect(face).toMatch(new RegExp("\\{ id: '" + id + "',[^\\n]*page: '" + page + "'"));
  expect(face).toContain("{ pages: pages, money: money }");
  expect(face).toContain("{ pages: ['pageProduction'] }");
});

/* ---------- The queue ---------- */
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
const job = (title: string, html: string, need?: unknown) =>
  JSON.stringify({ kind: 'sep-print', v: 1, title, html, sentAt: Date.now(), sentBy: 'Asha Rao · Phone', ...(need === undefined ? {} : { need }) });
const SLIPS = jobName(at('12:10'), 'pay01'), OLD = jobName(at('12:12'), 'old01'), INVOICE = jobName(at('12:14'), 'inv01');
/* Three jobs waiting, oldest first: pay slips (Pay's to open, with wages), one sent before jobs said what they need, and an invoice
   (Invoices'), the newest, so Print it here has to pass the other two to reach it. The station checked in two minutes ago; GitHub sync on this device; the guard on, its three IDs. */
async function setUp(page: Page, jobs = true): Promise<GitFake> {
  await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
  await page.clock.install({ time: new Date(at('12:30')) });
  const status = new Map<string, GhFile>([['print-status.json', { sha: 'st0', text: statusText(at('12:28')) }]]), main = new Map<string, GhFile>();
  if (jobs) {
    main.set(INVOICE, { sha: 'j1', text: job('Invoice SEP/TEST-00001', '<div class="inv-print-invoice">THE INVOICE</div>', { pages: ['pageRegister'] }) });
    main.set(SLIPS, { sha: 'j2', text: job('Pay slips 2026-10', '<div class="inv-ps-sheet">THE WAGES</div>', { pages: ['pageStaff'], wages: true }) });
    main.set(OLD, { sha: 'j3', text: job('ID cards', '<div class="inv-idc-sheet">THE CARDS</div>') });
  }
  await seedPrtSync(page);
  const fake = await fakeGitHubRepo(page, { main, status });
  await loadAppWithState(page, book());
  await withUsers(page);
  return fake;
}
/* Signed in on this device, which is registered for sync (devices.js, P142). */
async function signIn(page: Page, id: string, pin: string) {
  await unlock(page, id, pin);
  await page.evaluate(() => { (window as any).devSyncBlocked = () => ''; });
}
const dialog = (page: Page) => page.locator('[data-prt-dialog]');
const queued = (f: GitFake) => [...f.main.keys()].filter(k => k.startsWith('print-queue/')).sort();
/* The station's dialog, its jobs read (each one's title, sender and need). */
async function openStation(page: Page) {
  await g(page, 'prtLightOpen()');
  await expect(dialog(page).locator('[data-prt-job]')).toHaveCount(3);
  await expect(dialog(page).locator('[data-prt-job]').first()).not.toContainText('A job');
}

test('an Office ID opens only the jobs its screens open; the others stay on the queue, listed without their titles', async ({ page }) => {
  const f = await setUp(page);
  await signIn(page, 'U-off', PINS.office);
  await openStation(page);
  const rows = dialog(page).locator('[data-prt-job]');
  // The invoice is the office's own: its title, and Cancel.
  await expect(rows.nth(2)).toContainText('Invoice SEP/TEST-00001');
  await expect(rows.nth(2).locator('[data-action="invPrtLightCancel"]')).toHaveCount(1);
  // Pay slips need Pay and the wages; a job that does not say is the owner's. Listed, so the count adds up, and nothing more.
  for (const i of [0, 1]) {
    await expect(rows.nth(i)).toContainText('A document your ID doesn’t open');
    await expect(rows.nth(i)).toHaveAttribute('data-prt-closed', '');
    await expect(rows.nth(i).locator('button')).toHaveCount(0);
  }
  await expect(dialog(page)).not.toContainText('Pay slips');
  await expect(dialog(page)).not.toContainText('ID cards');
  await expect(dialog(page).locator('[data-action="invPrtHere"]')).toHaveText('Print it here');
  // Print it here passes the two older jobs and takes the invoice alone: the pay slips and the cards are never taken off the queue
  // or drawn here.
  await dialog(page).locator('[data-action="invPrtHere"]').click();
  await expect(page.locator('#invPrintView')).toHaveClass(/inv-print-view-active/);
  await expect(page.locator('#invPrintBody')).toContainText('THE INVOICE');
  expect(queued(f)).toEqual([SLIPS, OLD]);
  expect(f.log.filter(l => l.method === 'DELETE').map(l => l.message)).toEqual(['Taken to print on Chitra Sen · Office desk: Invoice SEP/TEST-00001']);
  // Sent to the office again, it keeps what it needs.
  expect(JSON.parse(await page.evaluate(() => JSON.stringify((0, eval)('_printNeed'))))).toEqual({ pages: ['pageRegister'] });
  // Printed: the one it opens is done, and the two left wait for the station.
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  expect(await answerAsk(page, 'ok')).toContain('Did it print?');
  await expect(page.locator('#invPrintView')).not.toHaveClass(/inv-print-view-active/);
  expect(queued(f)).toEqual([SLIPS, OLD]);
  await expect(page.locator('body')).not.toContainText('THE WAGES');
  await expect(page.locator('body')).not.toContainText('THE CARDS');
  // With only those left, Print it here is not offered, and a tap from a dialog drawn before says why.
  await g(page, 'prtLightOpen()');
  await expect(dialog(page).locator('[data-prt-job]')).toHaveCount(2);
  await expect(dialog(page).locator('[data-prt-closed]')).toHaveCount(2);
  await expect(dialog(page).locator('[data-action="invPrtHere"]')).toHaveCount(0);
  await g(page, 'prtHereStart()');
  await expect(page.locator('.inv-toast').last()).toContainText('Your ID doesn’t open the jobs waiting');
  expect(queued(f)).toEqual([SLIPS, OLD]);
});

test('the owner opens every job, the one sent before jobs said what they need included', async ({ page }) => {
  const f = await setUp(page);
  await signIn(page, 'U-own', PINS.owner);
  await openStation(page);
  const rows = dialog(page).locator('[data-prt-job]');
  await expect(rows.nth(0)).toContainText('Pay slips 2026-10');
  await expect(rows.nth(1)).toContainText('ID cards');
  await expect(rows.nth(2)).toContainText('Invoice SEP/TEST-00001');
  await expect(dialog(page).locator('[data-prt-closed]')).toHaveCount(0);
  await expect(dialog(page).locator('[data-action="invPrtLightCancel"]')).toHaveCount(3);
  await expect(dialog(page).locator('[data-action="invPrtHere"]')).toHaveText('Print the 3 here');
  // Cancelled there by the owner: off the queue.
  await rows.nth(0).locator('[data-action="invPrtLightCancel"]').click();
  await expect.poll(() => queued(f)).toEqual([OLD, INVOICE]);
});

test('a job sent keeps what its document needs', async ({ page }) => {
  const f = await setUp(page, false);
  await signIn(page, 'U-off', PINS.office);
  await g(page, "showPrintPreview('INV-1')");
  await expect(page.locator('#invPrintView')).toHaveClass(/inv-print-view-active/);
  await page.locator('#invPrintRemote').click();
  await expect(page.locator('.inv-toast').last()).toContainText('Sent to');
  const sent = queued(f);
  expect(sent).toHaveLength(1);
  const j = JSON.parse(f.main.get(sent[0])!.text);
  expect(j.need).toEqual({ pages: ['pageRegister'] });
  // Closed, the preview says nothing: the next document sets its own.
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  expect(await page.evaluate(() => (0, eval)('_printNeed'))).toBeNull();
});

test('a report of the current period carries the sender’s own open tasks: the owner’s is the owner’s; a past one is the page’s', async ({ page }) => {
  await setUp(page, false);
  await signIn(page, 'U-own', PINS.owner);
  const need = (from: string) => page.evaluate(f => {
    (0, eval)('_rptState = { kind: "monthly", from: ' + JSON.stringify(f) + ' }; rptPrint()');
    return JSON.parse(JSON.stringify((0, eval)('_printNeed')));
  }, from);
  // This month: its open items are the owner's To-do, so the owner's alone.
  expect(await need(W.slice(0, 8) + '01')).toEqual({ pages: ['pageReports'], owner: true, wages: true });
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  // A month gone lists no open items: the Reports page's own gate.
  const last = new Date(W + 'T00:00:00'); last.setDate(1); last.setMonth(last.getMonth() - 1);
  expect(await need(isoOf(last))).toEqual({ pages: ['pageReports'], owner: false, wages: false });
});

test('a run of Print it here is the ID’s that started it: another signing in is asked nothing, and the job goes back unshown', async ({ page }) => {
  const f = await setUp(page);
  await signIn(page, 'U-own', PINS.owner);
  await openStation(page);
  // The owner takes the oldest, the pay slips, off the queue and into the preview.
  await dialog(page).locator('[data-action="invPrtHere"]').click();
  await expect(page.locator('#invPrintBody')).toContainText('THE WAGES');
  expect(queued(f)).toEqual([OLD, INVOICE]);
  // The office's ID signs in over it, and the first write back fails (the office Wi-Fi drops).
  let fail = true;
  await page.route('https://api.github.com/repos/testowner/testrepo/contents/' + SLIPS, r =>
    r.request().method() === 'PUT' && fail ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }) : r.fallback());
  await g(page, "grdLockAll('switch')");
  await signIn(page, 'U-off', PINS.office);
  // Nothing is asked of the office, nothing of the job is on its screen, and the run does not go on for it.
  await expect(page.locator('#invPrintView')).not.toHaveClass(/inv-print-view-active/);
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('THE WAGES');
  await expect(page.locator('body')).not.toContainText('Did it print?');
  expect(await page.evaluate(() => (0, eval)('_prtHere'))).toBeNull();
  // Held in memory and never drawn, it goes back on the queue under its own name once a write lands, a minute on.
  expect(queued(f)).toEqual([OLD, INVOICE]);
  fail = false;
  await page.clock.runFor(61000);
  await expect.poll(() => queued(f)).toEqual([SLIPS, OLD, INVOICE]);
  expect(JSON.parse(f.main.get(SLIPS)!.text).need).toEqual({ pages: ['pageStaff'], wages: true });
  await expect(page.locator('body')).not.toContainText('THE WAGES');
  expect(await page.evaluate(() => (window as any).__printed)).toBe(0);
});

test('another ID signing in while Did it print? asks puts the job back, and takes nothing more for that ID', async ({ page }) => {
  const f = await setUp(page);
  await signIn(page, 'U-own', PINS.owner);
  await openStation(page);
  // The owner takes all three: the pay slips first, then closes the preview, and the question is asked.
  await dialog(page).locator('[data-action="invPrtHere"]').click();
  await expect(page.locator('#invPrintBody')).toContainText('THE WAGES');
  await page.locator('#invPrintView [data-action="invClosePrint"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toContainText('Did it print?');
  // The office's ID signs in over the question: it is shut, the pay slips go back, and the run does not go on for the office,
  // which would otherwise take the invoice, its own to open, off the queue without being asked.
  await g(page, "grdLockAll('switch')");
  await signIn(page, 'U-off', PINS.office);
  await expect.poll(() => queued(f)).toEqual([SLIPS, OLD, INVOICE]);
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
  await expect(page.locator('#invPrintView')).not.toHaveClass(/inv-print-view-active/);
  expect(await page.evaluate(() => (0, eval)('_prtHere'))).toBeNull();
  await page.waitForTimeout(500);
  expect(f.log.filter(l => l.method === 'DELETE').map(l => l.path)).toEqual([SLIPS]);
  await expect(page.locator('body')).not.toContainText('THE WAGES');
  await expect(page.locator('body')).not.toContainText('THE INVOICE');
});

test('a need this build cannot read is refused, and a stale Cancel does nothing', async ({ page }) => {
  const f = await setUp(page);
  await signIn(page, 'U-off', PINS.office);
  const opens = (need: unknown) => page.evaluate(n => (0, eval)('prtJobOpens')(n), need);
  expect(await opens({ pages: ['pageRegister'] })).toBe(true);
  // A key a later build added, or pages that are not a list: an older device never opens what it cannot judge.
  expect(await opens({ pages: ['pageRegister'], sealed: true })).toBe(false);
  expect(await opens({ pages: 'pageRegister' })).toBe(false);
  // The pay slips' Cancel, called though no button was drawn for it, takes nothing off the queue.
  await openStation(page);
  await g(page, "prtLightCancel('" + SLIPS.replace('print-queue/', '').replace('.json', '') + "')");
  await page.waitForTimeout(300);
  expect(queued(f)).toEqual([SLIPS, OLD, INVOICE]);
});

test('a report taken off the queue stays as it came while this device’s own report redraws', async ({ page }) => {
  const f = await setUp(page, false);
  f.main.set(jobName(at('12:16'), 'rpt01'), { sha: 'r1', text: job('SEP monthly report', '<div class="inv-rpt-doc" data-rpt-doc>THE QUEUED REPORT</div>', { pages: ['pageReports'] }) });
  await signIn(page, 'U-own', PINS.owner);
  await g(page, 'prtLightOpen()');
  await expect(dialog(page).locator('[data-prt-job]').first()).toContainText('SEP monthly report');
  await dialog(page).locator('[data-action="invPrtHere"]').click();
  await expect(page.locator('#invPrintBody')).toContainText('THE QUEUED REPORT');
  // A save redraws Reports, which keeps a report of this device's own in the preview current: not one from the queue.
  await g(page, 'renderReports()');
  await expect(page.locator('#invPrintBody')).toContainText('THE QUEUED REPORT');
});
