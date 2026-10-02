import { test, expect, type Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { CLIENTS, challan, dayOff, inv, openSearch, search, searchBook, titles } from './p139-search.fixture';
import { PINS, guardBook, withUsers, unlock, windowGone } from './p140-guard.fixture';
import { pipeState } from './p137-pipeline.fixture';
import { floorBook, openFloor, tile } from './p138-floor-day.fixture';

// P151: the QA chain of 2 Oct 2026 on search, Add, Office → Pipeline and Floor → Day (QA3-1 … QA3-12, QA4-1). Search showed
// a role the screens and actions its pages hide, and a To-do jump drew its dialog over Home after the page was refused; a
// number matched every number it began; a challan answered to its year; SEP 1234 found nothing; Pipeline showed the bank's
// receivables to a role without money; a roll headed "in time6:00 am" was no roll; the stock beside a roll was dropped;
// Floor's On site counted a different roster from Staff's; Add a bill opened last month whatever. Every name, number and
// figure is made up; every date is built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (offset = -1) => {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};
const ym = (back: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - back); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

/* The search book with a series the shop writes (SEP/2026-27/NNNNN), P.O.s made from challans, and challans of the year. */
function seriesBook() {
  const s = searchBook() as any;
  const ser = (id: string, n: number, c: typeof CLIENTS[number], date: string, extra: Record<string, unknown> = {}) =>
    ({ ...inv(id, n, c, date, 1000 + n), displayNumber: 'SEP/2026-27/' + String(n).padStart(5, '0'), ...extra });
  s.invoices = [
    ser('S-83', 83, CLIENTS[0], dayOff(-9)), ser('S-834', 834, CLIENTS[0], dayOff(-8)), ser('S-835', 835, CLIENTS[1], dayOff(-7)),
    ser('S-836', 836, CLIENTS[2], dayOff(-6)), ser('S-1234', 1234, CLIENTS[0], dayOff(-5)), ser('S-21', 21, CLIENTS[1], dayOff(-4)),
    ser('S-950', 950, CLIENTS[2], dayOff(-3), { poNumber: 'DA1/00877', challanNo: '0901/26-27' }),
    ser('S-87', 87, CLIENTS[2], dayOff(-2), { poNumber: 'DA1/00087' }),
  ];
  s.invNextNum = 1235;
  s.incomingMaterial = ['0901/26-27', '0902/26-27', '0903/26-27', '0904/26-27', '0905/26-27', '0906/26-27', '27']
    .map((no, i) => challan('IM-Y' + i, no, CLIENTS[i % 3], dayOff(-10 - i)));
  s.creditNotes = [];
  return s;
}

test.describe('P151: search finds what is asked, whole', () => {
  test('QA3-3: an identifier ending in a digit matches whole, never as the start of a longer one', async ({ page }) => {
    await loadAppWithState(page, seriesBook());
    await openSearch(page);
    await search(page, 'SEP/2026-27/00083');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/00083']);
    await search(page, 'SEP/2026-27/00834');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/00834']);
    // A P.O.: DA1/00087 is not the start of DA1/00877, and the other way round.
    await search(page, 'DA1/00087');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/00087']);
    await search(page, 'DA1/00877');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/00950']);
    // One typed ending in a separator still finds what it begins: all eight invoices of the series (five shown, then Show all).
    await search(page, 'sep/2026-27/');
    await expect(page.locator('#srchG-invoice .inv-num')).toHaveText('8');
  });

  test('QA3-4: a challan is its first number, never its year; DA1 is a word, not the number 1', async ({ page }) => {
    await loadAppWithState(page, seriesBook());
    await openSearch(page);
    // 27 is challan 27, and only it: the six of 26-27 do not answer to their year.
    await search(page, '27');
    expect(await titles(page, 'challan')).toEqual(['Ch. 27']);
    await search(page, '26');
    expect(await titles(page, 'challan')).toEqual([]);
    // Each still answers to its own number, and written whole.
    await search(page, '901');
    expect(await titles(page, 'challan')).toEqual(['Ch. 0901/26-27']);
    await search(page, '0901/26-27');
    expect(await titles(page, 'challan')).toEqual(['Ch. 0901/26-27']);
    // Invoice 00950 cites challan 0901/26-27 under P.O. DA1/00877: its numbers are its own, 901 and 877, never 26, 27 or 1.
    const n = await g(page, `(function(){ var d = srchData(); return d.keys[d.byKey['invoice|S-950']].n; })()`) as string;
    expect(n.trim().split(' ').sort()).toEqual(['877', '901', '950']);
    for (const q of ['26', '27', '1']) {
      await search(page, q);
      expect(await titles(page, 'invoice')).not.toContain('SEP/2026-27/00950');
    }
    await search(page, '901');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/00950']);
  });

  test('QA3-12: SEP 1234, sep/1234, 27/01234 and 2026-27/01234 find SEP/2026-27/01234; SEP alone finds no invoice', async ({ page }) => {
    await loadAppWithState(page, seriesBook());
    await openSearch(page);
    for (const q of ['SEP 1234', 'sep/1234', '27/01234', '2026-27/01234', 'sep 01234', 'SEP/2026-27/01234']) {
      await search(page, q);
      expect((await titles(page, 'invoice'))[0], q).toBe('SEP/2026-27/01234');
    }
    // The series word is never enough on its own (it would list every invoice), nor beside a word nothing else matches.
    await search(page, 'SEP');
    expect(await titles(page, 'invoice')).toEqual([]);
    await search(page, 'sep zzz');
    await expect(page.locator('#srchList .inv-empty')).toContainText('Nothing matches');
    // Beside a name it narrows to that client's invoices.
    await search(page, 'sep alpha');
    expect(await titles(page, 'invoice')).toEqual(['SEP/2026-27/01234', 'SEP/2026-27/00834', 'SEP/2026-27/00083']);
    // SEP 21 is invoice 00021, first, and still the 21st of September: both readings are tried.
    await search(page, 'SEP 21');
    expect((await titles(page, 'invoice'))[0]).toBe('SEP/2026-27/00021');
    const both = await g(page, `(function(){ var t = srchParse('SEP 21'); return t.length === 1 && t[0].t === 'alt' && t[0].alts[0][0].t === 'date' && t[0].alts[0][0].m === '09' && t[0].alts[0][0].d === '21'; })()`);
    expect(both).toBe(true);
    // A month written first with a day still finds that day (here yesterday), whatever the month.
    const y = new Date(dayOff(-1) + 'T00:00:00');
    await search(page, `${MON[y.getMonth()]} ${y.getDate()}`);
    expect(await titles(page, 'bank')).toEqual(['SMS CHARGES']);
  });
});

test.describe('P151: a role finds and opens only what its screens show', () => {
  test('QA3-1: a supervisor\'s search lists no screen or action on a page it may not open, nor Pay', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    const screens = await g(page, `srchIndex().filter(function(e){ return e.kind === 'screen'; }).map(function(e){ return e.id; })`) as string[];
    for (const id of ['cn-list', 'audit', 'add-bill', 'new-invoice', 'new-challan', 'new-quote', 'add-client', 'add-item', 'pay', 'settings']) expect(screens, id).not.toContain(id);
    // What a supervisor's pages hold is still there: its stock entry, its task, its paste box, its roster.
    for (const id of ['stock-entry', 'add-task', 'paste', 'add-worker', 'roster', 'att-day']) expect(screens, id).toContain(id);
    await openSearch(page);
    await search(page, 'credit notes');
    expect(await titles(page, 'screen')).not.toContain('Credit notes');
    await search(page, 'number audit');
    expect(await titles(page, 'screen')).not.toContain('Number audit');
    await search(page, 'bill');
    expect(await titles(page, 'screen')).not.toContain('Add a bill');
    await page.keyboard.press('Escape');
    // The owner finds each of them.
    await g(page, `grdSessClear()`);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await unlock(page, 'U-own', PINS.owner);
    const own = await g(page, `srchIndex().filter(function(e){ return e.kind === 'screen'; }).map(function(e){ return e.id; })`) as string[];
    for (const id of ['cn-list', 'audit', 'add-bill', 'new-invoice', 'pay', 'settings']) expect(own, id).toContain(id);
  });

  test('QA3-1, QA4-1: a To-do jump to a page the role may not open opens nothing, over Home or anywhere', async ({ page }) => {
    const s: any = guardBook();
    s.todo = { tasks: [
      { id: 'T-INV', text: 'Check the invoice', due: '', note: '', link: { kind: 'invoice', id: 'INV-1' }, createdAt: 1, doneAt: null },
      { id: 'T-CL', text: 'Call the client', due: '', note: '', link: { kind: 'client', id: 1 }, createdAt: 1, doneAt: null },
    ], snoozes: {} };
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageStock');
    const nothing = async (expr: string, word: string) => {
      // Each refusal says so itself: a toast left from the call before is no answer (it hid a silent refusal).
      await g(page, `document.querySelectorAll('.inv-toast').forEach(function(t) { t.remove(); })`);
      await g(page, expr);
      await expect(page.locator('.inv-toast').last()).toHaveText('Your ID doesn’t open ' + word);
      await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
      await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    };
    // The credit notes and the number audit (with its Record, which writes a void) drew their dialogs over Home.
    await nothing(`todoGo({ kind: 'cnList' })`, 'Register');
    await nothing(`todoGo({ kind: 'audit' })`, 'Register');
    // A task linked to an invoice showed the invoice, its Mark buttons included; one linked to a client its rate ladder.
    await nothing(`todoGoLink('T-INV')`, 'Register');
    await expect(page.locator('[data-inv-detail]')).toHaveCount(0);
    await nothing(`todoGoLink('T-CL')`, 'Clients');
    await expect(page.locator('[data-action="invSaveClient"]')).toHaveCount(0);
    await nothing(`todoGo({ kind: 'bills', month: '${ym(1)}' })`, 'Finance');
    await nothing(`todoGo({ kind: 'payWages' })`, 'Pay');
    // A page it does open still opens.
    await g(page, `todoGo({ kind: 'staffRoster' })`);
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
  });

  test('QA3-1: accounting for a missing number is a void, asked as every void is', async ({ page }) => {
    const s: any = guardBook();
    s.invoices = [s.invoices[0], { ...s.invoices[1], id: 'INV-3', invoiceNumber: '00003', displayNumber: 'SEP/TEST-00003' }];
    s.invNextNum = 4;
    await loadAppWithState(page, s);
    await withUsers(page);
    // The office opens the Register and its audit, and may not void: told so, never asked a PIN, nothing written.
    await unlock(page, 'U-off', PINS.office);
    await switchTab(page, 'pageRegister');
    await page.locator('#regNumberAudit').click();
    await page.locator('[data-action="invAccountForNumber"][data-num="2"]').click();
    await page.locator('#invGapReason').fill('spoiled, never issued');
    await page.locator('[data-action="invSaveGapReason"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t account for a missing number. Ask the owner.');
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    expect((await readStoredState(page)).voidedNumbers || []).toHaveLength(0);
    // The owner, past the re-ask window, is asked the PIN, and the number is accounted for.
    await g(page, `grdSessClear()`);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await unlock(page, 'U-own', PINS.owner);
    await windowGone(page);
    await switchTab(page, 'pageRegister');
    await page.locator('#regNumberAudit').click();
    await page.locator('[data-action="invAccountForNumber"][data-num="2"]').click();
    await page.locator('#invGapReason').fill('spoiled, never issued');
    await page.locator('[data-action="invSaveGapReason"]').click();
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Account for a missing number');
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('#grdAskPin').press('Enter');
    await expect.poll(async () => ((await readStoredState(page)).voidedNumbers || []).map((v: any) => v.invoiceNumber)).toEqual(['00002']);
  });

  test('QA3-2: Pipeline shows no Owed to us to a role that does not see money; the owner sees it', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('#pagePipeline [data-pipe-stage="created"]')).toBeVisible();
    await expect(page.locator('#pagePipeline [data-pipe-stage="owed"]')).toHaveCount(0);
    await expect(page.locator('#pagePipeline')).not.toContainText('Owed to us');
    await expect(page.locator('#pagePipeline [data-action="invHomeImportBank"]')).toHaveCount(0);
    // An address naming the stage opens the first stage instead.
    await g(page, `navOpen({ tab: 'pagePipeline', v: 'owed', id: '' })`);
    await expect(page.locator('#pipeList [data-pipe-list="owed"]')).toHaveCount(0);
    await expect(page.locator('#pipeList [data-pipe-list]')).toHaveCount(1);
    await g(page, `grdSessClear()`);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await unlock(page, 'U-own', PINS.owner);
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('#pagePipeline [data-pipe-stage="owed"]')).toBeVisible();
  });
});

test.describe('P151: Add, the rolls and the floor', () => {
  const STAFF = [
    { id: 'W1', name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 'W2', name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  ];
  const CLIENTS_KG = [{ id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }];
  const load = (page: Page, extra: Record<string, unknown> = {}) =>
    loadAppWithState(page, { ...emptyState(), clients: CLIENTS_KG, staff: STAFF, attendance: {}, incomingMaterial: noSeedIM(), ...extra } as SepState);
  // A roll whose head runs the time on without a space, as the supervisor sometimes sends it.
  const ROLL6 = (block: boolean) => `${dmy(-1)}/ in time6:00 am
----VAT A 1----
1) ARUN
2) BALA` + (block ? `
----production----
Durga auto 0101--400 nos` : '');
  // An ordinary roll, for the stock beside it (QA3-10 is not about the head).
  const ROLL = () => `${dmy(-1)}/ in time
----VAT A 1----
1) ARUN
2) BALA`;
  const STOCK_WA = () => `[${dmy(0)}, 2:05 pm] Supervisor One: Chemical use chemical stock\n${dmy(-6)}/-${dmy(0)}/\n\n1) Q558 NIL\n\n2) MONICOL 6-1=5 KG`;
  async function addPaste(page: Page, text: string) {
    await page.locator('.inv-navbar-add').click();
    await page.locator('#addPasteText').fill(text);
    await page.locator('[data-action="invAddRead"]').click();
  }

  test('QA3-5: a roll headed "in time6:00 am" is a roll, to both readers, and its production is offered beside it', async ({ page }) => {
    await load(page);
    const kinds = await g(page, `[relayKind(${JSON.stringify(ROLL6(false))}), prodKind(${JSON.stringify(ROLL6(true))}), relayKind(${JSON.stringify(ROLL6(true))})]`);
    expect(kinds).toEqual(['in', 'roll', 'in']);
    await addPaste(page, ROLL6(false));
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    await expect(page.locator('[data-relay-row]')).toHaveCount(2);
    // With a production block: the attendance is read here, the production offered (it all went to Production).
    await load(page);
    await addPaste(page, ROLL6(true));
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-relay-row]')).toHaveCount(2);
    await expect(page.locator('#relayProdNote [data-action="invRelayToProd"]')).toBeVisible();
  });

  test('QA3-10: the stock beside a roll is read in Stock from the roll\'s check, as it was sent; nothing points at More', async ({ page }) => {
    await load(page);
    await page.locator('.inv-navbar-add').click();
    // The clipboard says where each part is read.
    await page.evaluate(t => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.resolve(t) } }), ROLL() + '\n' + STOCK_WA());
    await page.locator('[data-add-sec="clipboard"]').click();
    const out = page.locator('#addClipOut [data-add-clip="ok"]');
    await expect(out.locator('[data-add-clip-item="in"]')).toBeVisible();
    await expect(out.locator('[data-add-clip-item="stock"]')).toContainText('2 lines');
    await expect(out.locator('.inv-toolbar .inv-note')).toHaveText('Read in Staff and checked there before anything is saved; the stock message is read in Stock from there.');
    await out.locator('[data-action="invAddClipRead"]').click();
    // The roll's check: the stock is offered, and only the stock goes to Stock, with who sent it.
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    await expect(page.locator('#attContent')).not.toContainText('More →');
    const note = page.locator('#relayStockNote');
    await expect(note).toContainText('Attendance is read here; the stock is read in Stock.');
    await note.locator('[data-action="invRelayToStock"]').click();
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeVisible();
    await expect(page.locator('#stockContent')).toContainText('MONICOL');
    await expect(page.locator('#stockContent')).not.toContainText('ARUN');
    await expect(page.locator('#stockSentBy')).toHaveValue('Supervisor One');
    expect((await readStoredState(page)).stock?.entries || []).toHaveLength(0);
    // Back: the roll's check is where it was, nothing saved.
    await page.goBack();
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    expect((await readStoredState(page)).attendance).toEqual({});

    // The stock written under a roll, no date of its own: the roll's issue says where it is read, and Read in Stock takes it.
    await load(page);
    await addPaste(page, `${dmy(0)}, 6:02 pm - Supervisor One: ${ROLL()}\n\ncamical use camical stock\n1) ZINK 20-5=15 KG\n2) HCL NIL`);
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    await expect(page.locator('#attContent')).not.toContainText('More →');
    await expect(page.locator('[data-issue="info"]').filter({ hasText: 'chemical stock' })).toContainText('It is read in Stock');
    await page.locator('#relayStockNote [data-action="invRelayToStock"]').click();
    await expect(page.locator('#stockContent')).toContainText('ZINK');
    await expect(page.locator('#stockContent')).not.toContainText('BALA');
    await expect(page.locator('#stockSentBy')).toHaveValue('Supervisor One');
    // No string the app draws points at the retired More sheet.
    const src = await page.evaluate(() => Array.from(document.scripts).map(s => s.textContent || '').join('\n'));
    expect(src.match(/['"][^'"\n]*More →[^'"\n]*['"]/g) || []).toEqual([]);
  });

  test('QA3-9: Floor → Day counts the day\'s roster as Staff → Day does: a hand marked that day who has since left', async ({ page }) => {
    const s: any = floorBook();
    s.staff[0].active = false;   // Alfa left after today's marks
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="day"]').click();
    const staffOn = await page.locator('#attOnSite').innerText();
    const staffOf = await page.locator('#attDayTiles .inv-tile-of').first().innerText();
    expect(staffOn + staffOf).toBe('16/17');
    await openFloor(page);
    await expect(tile(page, 'onsite').locator('.inv-tile-value')).toHaveText('16/17');
  });

  test('QA3-11: search\'s Add a bill opens the latest month with no electricity bill, as Add → Bill does', async ({ page }) => {
    await load(page, { costBills: [{ id: 'B1', kind: 'power', month: ym(1), amount: 40000, units: 5000, note: '', at: 1 }] });
    await openSearch(page);
    await search(page, 'add a bill');
    expect((await titles(page, 'screen'))[0]).toBe('Add a bill');
    await page.keyboard.press('Enter');
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#pageFinance #costBillMonth')).toHaveValue(ym(2));
    await expect(page.locator('#pageFinance #costBillAmount')).toBeVisible();
  });
});
