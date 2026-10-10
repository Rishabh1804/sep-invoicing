import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, waitForBoot, answerAsk, openSettingsAt, switchTab, emptyState, noSeedIM, todayIso, workdayIso, type SepState } from './fixtures';
import { PINS, g, guardBook, withUsers, unlock, windowGone, lockNow } from './p140-guard.fixture';

// P152: the guard's QA (the audit of 2 Oct 2026, QA4 and QA2). What it pins, each a finding the auditor reproduced:
// - QA4-5: the owner's own PIN is changed only with the PIN it has, and a new recovery code asks the PIN, inside the window.
// - QA4-2 / QA2-1: the first unlock after a fresh open draws the screen for whoever unlocks; nothing a role decides is drawn
//   for nobody under the lock.
// - QA4-7: Switch user shuts the print preview and draws a view the next role may not see again, typed or not.
// - QA4-8: wrong PINs are counted per ID; one ID's right PIN never clears another's count.
// - QA4-9: replacing the book (a backup, a pull) is the owner's, and keeps this book's IDs unless the owner says.
// - QA4-6: an invoice's state is a billing change.
// - QA4-1, QA4-4, QA4-3, QA2-5, QA2-9: the To-do, Needs you, the bar's counts, the link picker, Stock, Production and a
//   client's Money panel show a role only what its screens and permissions show.
// - QA4-10, QA4-11: the change log names who did what the guard saves, and a push's time is not a change.
// - QA2-6, QA2-7, QA2-11, QA2-13: the workspace's remembered view, Today's counts, the zinc task, the dead code.
// Every name is made up.

const ev = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const PIN_FLOOR = '86420975';

function daysAgo(n: number) {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* The guard's book with two tasks the data raises: a challan waiting ten days (Office's, on Challans) and no backup on this
   device (Settings'). */
function taskBook() {
  const s: any = guardBook();
  s.incomingMaterial = [...noSeedIM(), { id: 'IM-OLD', challanNo: '4411', challanDate: daysAgo(10), clientId: 1, clientName: 'TEST CLIENT KG',
    receivedDate: daysAgo(10), notes: '', createdAt: 1, items: [{ id: 'IMI-1', partNumber: 'BRKT-1', desc: 'Bracket', unit: 'KG', qty: 50, rate: 13, amount: 650, invoiced: false }] }];
  return s;
}
/* A statement of three rows, one a receipt placed on the client: Finance has something to say about it. */
function withBank(s: any) {
  const row = (id: number, date: string, narration: string, dr: number, cr: number, set?: any) =>
    ({ id: 'BK-' + id, date, valueDate: date, narration, chq: '', dr, cr, balance: 250000, dayIdx: id, importId: 'BI', ...(set ? { set } : {}) });
  const rows = [row(1, daysAgo(120), 'SMS CHARGES', 10, 0), row(2, daysAgo(20), 'NEFT-ALPHA FORGINGS', 0, 11800, { cat: 'receipt', clientId: 1 }),
    row(3, daysAgo(5), 'NEFT-GAMMA CHEMICALS', 5000, 0, { cat: 'supplier' }), row(4, daysAgo(1), 'SMS CHARGES', 10, 0)];
  s.bank = { rows, imports: [{ id: 'BI', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[3].date, rows: 4, added: 4, closing: 250000 }],
    parties: {}, opening: {}, gstNotes: {} };
  return s;
}
/* The three users of P140 and a floor hand, whose role opens Today, Floor → Day, Production and Stock (no Staff). */
async function withFour(page: Page, cfg?: Record<string, unknown>) {
  await withUsers(page, cfg);
  await page.evaluate(async (pin) => {
    const w = window as any, S = (0, eval)('S');
    S.users.push({ id: 'U-flr', name: 'Dilip Oraon', role: 'floor', secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: 'U-own' });
    await w.saveState();
  }, PIN_FLOOR);
  await page.reload();
  await waitForBoot(page);
}
async function switchUser(page: Page, id: string, pin: string) {
  await g(page, "grdLockAll('switch')");
  await unlock(page, id, pin);
}
async function pickFile(page: Page, name: string, obj: unknown) {
  if (!(await page.locator('[data-add-sheet]').count())) await page.locator('.inv-navbar-add').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="file"]').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(JSON.stringify(obj)) });
}
const invState = async (page: Page, id: string) => ev(page, `S.invoices.find(function(i){ return i.id === '${id}'; }).invoiceState || 'created'`);

test.describe('P152: the guard, after its QA', () => {
  test.describe.configure({ timeout: 90_000 });

  test('QA4-5: the owner’s own PIN is changed with the PIN it has; a new recovery code asks the PIN inside the window too', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);   // the PIN given a moment ago: inside the re-ask window
    await openSettingsAt(page, 'users');
    // The owner's own row offers a change of PIN, never a reset.
    const own = page.locator('[data-grd-user="U-own"]');
    await own.locator('[data-action="invGuardResetPin"]').click();
    const form = page.locator('[data-grd-form="mine"]');
    await expect(form).toBeVisible();
    await expect(page.locator('[data-grd-form="pin"]')).toHaveCount(0);
    await form.locator('#grdCur').fill('11112222');
    await form.locator('#grdP1').fill('55556666');
    await form.locator('#grdP2').fill('55556666');
    await form.locator('[data-action="invGuardFormSave"]').click();
    await expect(form.locator('[data-grd-err]')).toHaveText('Wrong PIN. 4 tries left.');
    await form.locator('.inv-dialog-foot [data-action="invCloseConfirm"]').click();
    await expect(form).toHaveCount(0);
    // Asked for by name, the reset of one's own PIN is that change too.
    await g(page, "grdFormOpen('pin', 'U-own')");
    await expect(page.locator('[data-grd-form="mine"]')).toBeVisible();
    await page.locator('[data-grd-form="mine"] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
    // Nothing changed: the old PIN still opens.
    expect(await ev(page, "grdVerify(grdUserById('U-own').secret, '" + PINS.owner + "')")).toBe(true);
    // Another user's PIN is a reset, as before.
    await page.locator('[data-grd-user="U-sup"] [data-action="invGuardResetPin"]').click();
    await expect(page.locator('[data-grd-form="pin"]')).toBeVisible();
    await page.locator('[data-grd-form="pin"] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
    // A new recovery code: the PIN, whatever the window; Cancel leaves the code there was.
    const before = await ev(page, 'JSON.stringify(S.guardCfg.recovery)');
    await page.locator('[data-action="invGuardNewCode"]').click();
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Make a new recovery code');
    await ask.locator('[data-action="invGuardAskCancel"]').last().click();
    await expect(ask).toHaveCount(0);
    await expect(page.locator('[data-grd-recovery]')).toHaveCount(0);
    expect(await ev(page, 'JSON.stringify(S.guardCfg.recovery)')).toBe(before);
    await page.locator('[data-action="invGuardNewCode"]').click();
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect(page.locator('[data-grd-recovery]')).toHaveText(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  test('QA4-2 / QA2-1: the first unlock after a fresh open draws Today for whoever unlocks', async ({ page }) => {
    await loadAppWithState(page, taskBook());
    await withUsers(page);   // reloads onto the lock: the start drew the screen with nobody signed in
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('#homeNeeds [data-card="tasks"]')).toBeVisible();
    // The challan waiting is Office's (Challans), the backup Settings': neither is the supervisor's.
    await expect(page.locator('#homeNeeds [data-tdy-task^="challan:"]')).toHaveCount(0);
    await expect(page.locator('#homeNeeds [data-tdy-task="backup"]')).toHaveCount(0);
    // The owner, switched to, sees both: the data does raise them.
    await switchUser(page, 'U-own', PINS.owner);
    await expect(page.locator('#homeNeeds [data-tdy-task^="challan:"]')).toHaveCount(1);
    await expect(page.locator('#homeNeeds [data-tdy-task="backup"]')).toHaveCount(1);

    // Pulse at a fresh open (another tab: a session of its own): the questions are money, not the supervisor's.
    const tab = await page.context().newPage();
    await tab.goto('/?tab=pageHome&v=pulse');
    await waitForBoot(tab);
    await unlock(tab, 'U-sup', PINS.super);
    await expect(tab.locator('#homePulse')).toBeVisible();
    // No question and no period: the head holds Edit Home alone (in its More since the tab map, TM2b).
    await expect(tab.locator('#homeQuestions [data-tdy-q], #homeQuestions [data-action="invStatsPeriod"], #statsWhy, #statsOverview, #statsPace')).toHaveCount(0);
    await expect(tab.locator('#homeQuestions [data-tdy-pulse-head] button')).toHaveText(['Edit Home']);
    await expect(tab.locator('[data-home-w="mtd"]')).toBeHidden();
    await expect(tab.locator('[data-home-w="money"]')).toBeHidden();
    await expect(tab.locator('#homeFinCard')).toBeEmpty();
    await tab.close();
  });

  test('QA4-2: nothing a role decides is drawn under the lock; what changed meanwhile is drawn at the unlock', async ({ page }) => {
    await loadAppWithState(page, taskBook());
    await withUsers(page);
    // At the start nobody is signed in: Today waits for the unlock, and the bar counts nothing.
    expect(await ev(page, "document.getElementById('homeNeeds').innerHTML")).toBe('');
    expect(await ev(page, 'JSON.stringify(wsRedCounts())')).toBe(JSON.stringify({ today: 0, office: 0, floor: 0, money: 0, mine: 0 }));
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('#homeNeeds [data-card="tasks"]')).toBeVisible();
    await expect(page.locator('#homeNeeds [data-tdy-task^="challan:"]')).toHaveCount(0);
    // Locked again, a redraw (another window's save) draws nothing for nobody under the lock.
    await g(page, "grdLock('away')");
    await g(page, `TODO_RULE_FNS.stock = function () { return [{ key: 'stock:N', rule: 'stock', tone: 'amber', itemId: 'N', title: 'Order Nitric acid', sub: 'Low',
      why: 'Stock', facts: [], clears: '', go: { kind: 'stock', id: 'N' }, goLabel: 'Open the line', sig: 'amber|low' }]; }; tabRedrawActive()`);
    expect(await ev(page, "document.getElementById('homeNeeds').innerHTML")).not.toContain('challan:');
    // The same person back: Today drawn for them, with what changed while the lock was down.
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('#homeNeeds [data-tdy-task="stock:N"]')).toHaveCount(1);
    await expect(page.locator('#homeNeeds [data-tdy-task^="challan:"]')).toHaveCount(0);
  });

  test('QA4-2: the Windows widget’s launch at a fresh open waits for the unlock, and opens only a task the role sees', async ({ page }) => {
    await loadAppWithState(page, taskBook());
    await withUsers(page);
    // A row tapped on the widget opens the app on its task: the lock first, the task for whoever unlocks.
    const tab = await page.context().newPage();
    await tab.goto('/?tab=pageTodo&todo=' + encodeURIComponent('open:a:challan:1'));
    await waitForBoot(tab);
    await expect(tab.locator('#guardRoot')).toBeVisible();
    await expect(tab.locator('[data-todo-facts]')).toHaveCount(0);
    await unlock(tab, 'U-own', PINS.owner);
    // The tasks are Needs you's (the tab map, TM2a); the old address lands there.
    await expect(tab.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(tab.locator('#homeNeeds')).toBeVisible();
    await expect(tab.locator('[data-todo-facts]')).toContainText('Bill TEST CLIENT KG');
    await tab.close();
    // The supervisor tapping the same row is told the task is not theirs, and sees none of it.
    const tab2 = await page.context().newPage();
    await tab2.goto('/?tab=pageTodo&todo=' + encodeURIComponent('open:a:challan:1'));
    await waitForBoot(tab2);
    await unlock(tab2, 'U-sup', PINS.super);
    await expect(tab2.locator('.inv-toast')).toContainText('not one your ID opens');
    await expect(tab2.locator('[data-todo-facts]')).toHaveCount(0);
    await tab2.close();
  });

  test('QA4-7: Switch user shuts the print preview, and Staff is drawn again without Pay though a figure was typed on it', async ({ page }) => {
    const s: any = guardBook();
    s.staff = [{ id: 1, name: 'Alfa Tirkey', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true }];
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, "showPrintPreview('INV-1')");
    await expect(page.locator('#invPrintView')).toHaveClass(/inv-print-view-active/);
    await switchUser(page, 'U-sup', PINS.super);
    await expect(page.locator('#invPrintView')).not.toHaveClass(/inv-print-view-active/);
    // The owner on Staff → Pay, a payment half typed.
    await switchUser(page, 'U-own', PINS.owner);
    await switchTab(page, 'pageStaff');
    await g(page, "_attView = 'pay'; renderAttendance()");
    await page.locator('#payFormFold > summary').click();   // folded on the phone until it is wanted (TM4b)
    await page.locator('#payAmount').fill('500');
    expect(await ev(page, '_pageTyped')).toBe(true);
    await switchUser(page, 'U-sup', PINS.super);
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    expect(await ev(page, '_attView')).not.toBe('pay');
    await expect(page.locator('#payForm')).toHaveCount(0);
    await expect(page.locator('#payAmount')).toHaveCount(0);
  });

  test('QA4-8: wrong PINs are counted per ID: another ID’s right PIN never clears the owner’s count', async ({ page }) => {
    await page.clock.install();
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    const lock = page.locator('#guardRoot'), err = lock.locator('[data-grd-err]'), go = lock.locator('[data-action="invGuardUnlock"]');
    await lock.locator('[data-id="U-own"]').click();
    for (let i = 1; i <= 4; i++) {
      await lock.locator('#grdPin').fill('000000');
      await go.click();
      const left = 5 - i;
      await expect(err).toHaveText(`Wrong PIN. ${left} tr${left === 1 ? 'y' : 'ies'} left.`);
    }
    // The supervisor's right PIN: their own count, never the owner's.
    await unlock(page, 'U-sup', PINS.super);
    await lockNow(page);
    await lock.locator('[data-id="U-own"]').click();
    await lock.locator('#grdPin').fill('000000');
    await go.click();
    await expect(err).toHaveText('Locked for 30 seconds.');
    await expect(go).toBeDisabled();
    // The owner locked out does not lock out the others.
    await lock.locator('[data-id="U-sup"]').click();
    await expect(err).toHaveText('');
    await expect(go).toBeEnabled();
    await lock.locator('#grdPin').fill(PINS.super);
    await go.click();
    await expect(lock).toHaveCount(0);
    // Kept by ID on the device, and the supervisor's success left the owner's lockout standing.
    const fails = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_guard_fail') || 'null'));
    expect(fails.ids['u:U-own'].n).toBe(5);
    expect(fails.ids['u:U-sup']).toBeUndefined();
    // The owner's lockout runs on, and ends; then the owner's right PIN clears it.
    await lockNow(page);
    await lock.locator('[data-id="U-own"]').click();
    await expect(err).toHaveText(/^Locked for (2[0-9]|30) seconds\.$/);
    await page.clock.fastForward(31_000);
    await expect(go).toBeEnabled();
    await lock.locator('#grdPin').fill(PINS.owner);
    await go.click();
    await expect(lock).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_guard_fail'))).toBeNull();
  });

  test('QA4-9: replacing the book is the owner’s, and the owner keeps this book’s IDs unless they say', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    // The supervisor is given imports, to bring in floor records.
    await withUsers(page, { roles: { supervisor: { may: ['floor', 'imports'] } } });
    await unlock(page, 'U-sup', PINS.super);
    const backup = { ...emptyState(), company: { ...emptyState().company, name: 'TAKEN OVER CO' } };
    // Add → File with a backup that has no IDs: refused with a word, no PIN asked, the book and its IDs as they were.
    await pickFile(page, 'backup.json', backup);
    expect(await answerAsk(page, 'ok')).toContain('can’t import a backup');
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    expect(await ev(page, 'S.company.name')).not.toBe('TAKEN OVER CO');
    expect(await ev(page, 'grdOn()')).toBe(true);
    // A pull and Settings' Import are refused the same way, and adoptState itself refuses.
    const pulled = page.evaluate(() => (window as any).ghPull());
    expect(await answerAsk(page, 'ok')).toContain('can’t pull from GitHub');
    expect(await pulled).toBe(false);
    expect(await ev(page, `(function () { try { adoptState(${JSON.stringify(backup)}); return 'adopted'; } catch (e) { return 'refused'; } })()`)).toBe('refused');
    expect(await ev(page, 'S.company.name')).not.toBe('TAKEN OVER CO');
    expect(await ev(page, 'S.users.length')).toBe(3);
    // Floor records still come in: a stock file merges.
    await pickFile(page, 'stock.json', { format: 'sep-stock', version: 1, items: [{ id: 'C', name: 'Caustic soda', key: 'CAUSTIC', unit: 'kg', active: true }],
      entries: [{ id: 'c9', itemId: 'C', kind: 'count', qty: 5, date: todayIso(), at: 2 }], pastes: [] });
    await expect.poll(() => ev(page, 'S.stock.items.map(function(i){ return i.id; }).join(",")')).toBe('N,C');

    // The owner: a backup with no guard is taken in, and this book's IDs kept unless the owner says to take its own.
    await switchUser(page, 'U-own', PINS.owner);
    await pickFile(page, 'backup.json', backup);
    expect(await answerAsk(page, 'ok')).toContain('Replace all data?');
    expect(await answerAsk(page, 'cancel')).toContain('no ID');
    await expect.poll(() => ev(page, 'S.company.name')).toBe('TAKEN OVER CO');
    expect(await ev(page, 'grdOn()')).toBe(true);
    expect(await ev(page, 'S.users.map(function(u){ return u.id; }).join(",")')).toBe('U-own,U-sup,U-off');
    expect(await ev(page, 'grdUserId()')).toBe('U-own');
    expect((await readStoredState(page)).users.length).toBe(3);
    // Said yes to, the backup's own (none) is taken: the guard is off.
    const backup2 = { ...backup, company: { ...backup.company, name: 'SECOND CO' } };
    await pickFile(page, 'backup.json', backup2);
    await answerAsk(page, 'ok');
    expect(await answerAsk(page, 'ok')).toContain('no ID');
    await expect.poll(() => ev(page, 'S.company.name')).toBe('SECOND CO');
    expect(await ev(page, 'grdOn()')).toBe(false);
  });

  test('QA4-6: an invoice’s state is a billing change: told no without billing, asked outside the window, printing marks without asking', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    // The supervisor may not change invoices: each mark is refused with a word, nothing asked, nothing marked.
    await g(page, "advanceInvoiceState('INV-1', 'dispatched')");
    expect(await answerAsk(page, 'ok')).toContain('can’t mark an invoice dispatched');
    await g(page, "_regSelected = { 'INV-1': true, 'INV-2': true }; regBulkSetState('dispatched')");
    expect(await answerAsk(page, 'ok')).toContain('can’t mark invoices dispatched');
    await g(page, "_printInvId = 'INV-1'; printMarkPrinted()");
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
    expect(await invState(page, 'INV-1')).toBe('created');
    expect(await invState(page, 'INV-2')).toBe('created');
    // A printed invoice put back, and filing, the same.
    await g(page, "S.invoices[1].invoiceState = 'printed'; S.invoices[1].printedAt = Date.now()");
    await g(page, "invNotPrinted('INV-2')");
    expect(await answerAsk(page, 'ok')).toContain('can’t mark an invoice not printed');
    expect(await invState(page, 'INV-2')).toBe('printed');
    await g(page, "S.invoices[0].invoiceState = 'delivered'; regFilter.month = ''; bulkMarkFiled()");
    expect(await answerAsk(page, 'ok')).toContain('can’t mark invoices filed');
    expect(await invState(page, 'INV-1')).toBe('delivered');
    await g(page, "S.invoices[0].invoiceState = 'created'; S.invoices[1].invoiceState = 'created'; delete S.invoices[1].printedAt");

    // The office: outside the window the PIN is asked; Cancel changes nothing; the PIN marks it.
    await switchUser(page, 'U-off', PINS.office);
    await windowGone(page);
    await g(page, "advanceInvoiceState('INV-1', 'dispatched')");
    const ask = page.locator('[data-grd-ask]');
    await expect(ask.locator('.inv-dialog-title')).toHaveText('Mark an invoice dispatched');
    await ask.locator('[data-action="invGuardAskCancel"]').last().click();
    await expect(ask).toHaveCount(0);
    expect(await invState(page, 'INV-1')).toBe('created');
    await g(page, "advanceInvoiceState('INV-1', 'dispatched')");
    await ask.locator('#grdAskPin').fill(PINS.office);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect.poll(() => invState(page, 'INV-1')).toBe('dispatched');
    // Printing an invoice the office opens marks it Printed with nothing asked, outside the window too.
    await windowGone(page);
    await g(page, "_printInvId = 'INV-2'; printMarkPrinted()");
    await expect(ask).toHaveCount(0);
    expect(await invState(page, 'INV-2')).toBe('printed');
  });

  test('QA4-1, QA4-4, QA2-9: the To-do, its counts and its link picker show a role only what its screens and its money show', async ({ page }) => {
    await loadAppWithState(page, taskBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    // A red finance task landing on Stock, which the supervisor opens, and a red pay task on Staff (Pay).
    await g(page, `TODO_RULE_FNS.supplierNoBill = function () { return [{ key: 'supplierNoBill:x', rule: 'supplierNoBill', tone: 'red', title: 'Enter the stock bill for TEST TRADERS',
      sub: 'paid with no bill', why: 'Payments', facts: [], clears: '', go: { kind: 'stockList' }, goLabel: 'Open Stock', sig: '1' }]; };
      TODO_RULE_FNS.payCarry = function () { return [{ key: 'payCarry', rule: 'payCarry', tone: 'red', title: 'A worker carries a balance',
      sub: '', why: 'Pay', facts: [], clears: '', go: { kind: 'payDue' }, goLabel: 'Open Pay', sig: '1' }]; };`);
    await switchTab(page, 'pageHome');
    const appKeys = (p: Page) => ev(p, `Array.prototype.map.call(document.querySelectorAll('#homeNeeds [data-todo="app"]'), function (b) { return b.dataset.tdyTask; })`) as Promise<string[]>;
    let keys = await appKeys(page);
    for (const k of ['supplierNoBill:x', 'payCarry', 'challan:1', 'backup']) expect(keys).not.toContain(k);
    // Opened by its key (the widget's launch), a task not the role's is not shown.
    await g(page, "todoOpenApp('supplierNoBill:x')");
    await expect(page.locator('[data-todo-facts]')).toHaveCount(0);
    // The bar counts only what the role sees: nothing red here.
    expect(await ev(page, 'JSON.stringify(wsRedCounts())')).toBe(JSON.stringify({ today: 0, office: 0, floor: 0, money: 0, mine: 0 }));
    // The link picker: a stock line, nothing else; no invoice, challan or client is listed.
    await page.locator('[data-action="invTodoNew"]').click();
    expect(await ev(page, `Array.prototype.map.call(document.querySelectorAll('#todoLinkKind option'), function (o) { return o.value; })`)).toEqual(['', 'stock']);
    for (const k of ['invoice', 'challan', 'client']) expect(await ev(page, `todoLinkOptions('${k}', '')`)).not.toMatch(/SEP\/TEST|4411|TEST CLIENT/);
    expect(await ev(page, "todoLinkOptions('stock', '')")).toContain('Nitric acid');

    // The owner sees every one, and the counts are theirs.
    await switchUser(page, 'U-own', PINS.owner);
    await switchTab(page, 'pageHome');
    keys = await appKeys(page);
    for (const k of ['supplierNoBill:x', 'payCarry', 'challan:1', 'backup']) expect(keys).toContain(k);
    const n = JSON.parse(await ev(page, 'JSON.stringify(wsRedCounts())') as string);
    expect(n.floor).toBe(2);
    expect(n.today).toBe(2);
    await page.locator('[data-action="invTodoNew"]').click();
    expect(await ev(page, `Array.prototype.map.call(document.querySelectorAll('#todoLinkKind option'), function (o) { return o.value; })`)).toEqual(['', 'client', 'invoice', 'challan', 'stock']);
  });

  test('QA4-4, QA4-3: Stock carries no bank or forecast, Production no labour ₹/kg, and a client no Money panel, for a role without them', async ({ page }) => {
    const s: any = withBank(guardBook());
    s.production = { entries: [{ id: 'E1', at: 1, time: '10:00', unit: 'NOS', basis: 'register', src: 'photo', kind: 'plated', line: 'vat-a1', lineSrc: 'written',
      slot: 'general', clientId: 1, part: 'BRKT-1', qty: 100, date: workdayIso() }], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
    // A line in use, with a price: an order to place.
    s.stock.entries.push({ id: 'r1', itemId: 'N', kind: 'received', qty: 50, price: 40, supplier: 'GAMMA CHEMICALS', billNo: 'G/1', date: daysAgo(20), at: 1 },
      { id: 'u1', itemId: 'N', kind: 'used', qty: 30, days: 6, from: daysAgo(7), date: daysAgo(1), at: 2 });
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    // Stock's card: the order's cost, never the forecast's low (the bank's). Floor's stock card says the same (TM4).
    await switchTab(page, 'pageStock');
    await expect(page.locator('#stockVerdict')).toContainText('with GST');
    await expect(page.locator('#stockVerdict')).not.toContainText('after the order');
    await switchTab(page, 'pageFloor');
    await expect(page.locator('#flrHeroes [data-flr-reorder]')).toHaveCount(1);
    // What the bank paid a supplier is the bank's: nothing, on Stock's overview and on a line's page alike.
    expect(await ev(page, "finSupplierPaid('GAMMA CHEMICALS')")).toBeNull();
    // Production → Lines: no labour per kg without the wages.
    await switchTab(page, 'pageProduction');
    await g(page, "prodSetTab('lines'); renderProduction()");
    await expect(page.locator('#prodRuns')).toBeVisible();
    await expect(page.locator('#prodLabour')).toHaveCount(0);

    // The office opens clients and invoices, not money: no Money panel, no payment from the statement.
    await switchUser(page, 'U-off', PINS.office);
    await g(page, 'openClientEdit(1)');
    await expect(page.locator('.inv-scrim-dialog')).toBeVisible();
    await expect(page.locator('[data-client-money]')).toHaveCount(0);
    await g(page, 'closeOverlay()');
    await g(page, "openInvoiceDetail('INV-1')");
    await expect(page.locator('[data-inv-detail="INV-1"]').first()).toBeVisible();
    await expect(page.locator('[data-inv-payment]')).toHaveCount(0);
    await g(page, 'closeOverlay()');

    // The owner has every one of them.
    await switchUser(page, 'U-own', PINS.owner);
    await g(page, 'openClientEdit(1)');
    await expect(page.locator('[data-client-money]')).toHaveCount(1);
    await g(page, 'closeOverlay()');
    await switchTab(page, 'pageStock');
    // Stock's card: the forecast's low after the order (TM4d).
    await expect(page.locator('#stockVerdict')).toContainText('after the order');
    expect(await ev(page, "finSupplierPaid('GAMMA CHEMICALS').paid")).toBe(5000);
    await switchTab(page, 'pageProduction');
    await g(page, "prodSetTab('lines'); renderProduction()");
    await expect(page.locator('#prodLabour')).toBeVisible();
  });

  test('QA2-5: Needs you lists the day’s inputs a role’s screens take, and no task on Pay or Settings it may not open', async ({ page }) => {
    await loadAppWithState(page, taskBook());
    await withFour(page);
    const inputs = (p: Page) => ev(p, `Array.prototype.map.call(document.querySelectorAll('#homeNeeds [data-tdy-input]'), function (r) { return r.dataset.tdyInput; })`);
    // The office: no floor screen, so no input of the floor's.
    await unlock(page, 'U-off', PINS.office);
    await expect(page.locator('#homeNeeds [data-card="tasks"]')).toBeVisible();
    expect(await inputs(page)).toEqual([]);
    await expect(page.locator('#homeNeeds [data-card="inputs"]')).toHaveCount(0);
    // The floor hand has no Staff: the rolls go, pickling, stock and production stay.
    await switchUser(page, 'U-flr', PIN_FLOOR);
    expect(await inputs(page)).toEqual(['pickling', 'stock', 'production']);
    // The supervisor takes all five; a task on Pay (no wages) or Settings is not theirs.
    await switchUser(page, 'U-sup', PINS.super);
    expect(await inputs(page)).toEqual(['roll-in', 'pickling', 'stock', 'production', 'roll-out']);
    await g(page, `TODO_RULE_FNS.payCarry = function () { return [{ key: 'payCarry', rule: 'payCarry', tone: 'amber', title: 'A worker carries a balance',
      sub: '', why: 'Pay', facts: [], clears: '', go: { kind: 'payDue' }, goLabel: 'Open Pay', sig: '1' }]; }; renderHome()`);
    await expect(page.locator('#homeNeeds [data-tdy-task="payCarry"]')).toHaveCount(0);
    await expect(page.locator('#homeNeeds [data-tdy-task="backup"]')).toHaveCount(0);
  });

  test('QA2-6: a workspace reopens the view it remembers only for a role that opens it', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page);
    await unlock(page, 'U-own', PINS.owner);
    await switchTab(page, 'pageStaff');   // Floor → People, remembered for Floor this session
    await switchTab(page, 'pageHome');
    await switchUser(page, 'U-flr', PIN_FLOOR);   // the floor hand's role has no Staff
    await page.locator('.inv-navbar [data-ws="floor"]').click();
    await expect(page.locator('#pageFloor')).toHaveClass(/inv-page-active/);
    await expect(page.locator('.inv-toast', { hasText: 'doesn’t open' })).toHaveCount(0);
  });

  test('QA2-7: Today’s red counts are drawn on Needs you as on Pulse', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await g(page, `TODO_RULE_FNS.stock = function () { return [{ key: 'stock:N', rule: 'stock', tone: 'red', itemId: 'N', title: 'Order Nitric acid', sub: 'Out',
      why: 'Stock', facts: [], clears: '', go: { kind: 'stock', id: 'N' }, goLabel: 'Open the line', sig: 'red|out' }]; }; renderHome()`);
    await expect(page.locator('.inv-navbar [data-ws-count="today"]')).toHaveText('1');
    await expect(page.locator('.inv-navbar [data-ws-count="floor"]')).toHaveText('1');
  });

  test('QA2-11: the stale zinc rate’s task opens the zinc rate in Settings', async ({ page }) => {
    const s: any = guardBook();
    s.todoCheck = { zinc: true };
    s.zinc = { ratePerKg: 300, premiumPerKg: 15, upliftPct: 10.5, basis: 'manual', updatedAt: Date.now() - 40 * 86400000, source: '' };
    await loadAppWithState(page, s);
    expect(await ev(page, "JSON.stringify(todoAppAll(['zinc'])[0].go)")).toBe(JSON.stringify({ kind: 'settings', sec: 'zinc' }));
    await g(page, "todoOpenApp('zinc')");
    const go = page.locator('.inv-scrim-dialog [data-action="invTodoGoApp"]');
    await expect(go).toHaveText('Open the zinc rate');
    await go.click();
    await expect(page.locator('#settingsScrim details[data-sec="zinc"]')).toHaveAttribute('open', '');
  });

  test('QA2-13: Add’s Payment door is off without the wages, and the count no screen read is gone', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await page.locator('.inv-navbar-add').click();
    await expect(page.locator('[data-add-sheet] [data-action="invAddHand"][data-go="payment"]')).toBeHidden();
    await expect(page.locator('[data-add-sheet] [data-action="invAddHand"][data-go="stock"]')).toBeVisible();
    expect(await ev(page, 'typeof todoRedCount')).toBe('undefined');
  });

  test('QA4-10: what the guard saves with nobody signed in is logged under who did it', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    // A recovery code on record, so the owner's PIN can be reset from the lock.
    await page.evaluate(async () => {
      const w = window as any, S = (0, eval)('S');
      const rec = await w.grdMakeSecret(w.grdCodeNorm('ABCD-EFGH-JKMN'));
      S.guardCfg.recovery = { alg: rec.alg, iter: rec.iter, salt: rec.salt, hash: rec.hash };
      await w.saveState();
    });
    // The users were made with the guard off (by nobody): only what is saved from here on is looked at.
    const t0 = await page.evaluate(() => Date.now());
    const lock = page.locator('#guardRoot');
    await lock.locator('[data-id="U-own"]').click();
    await lock.locator('[data-action="invGuardForgot"]').click();
    await lock.locator('#grdCode').fill('ABCD-EFGH-JKMN');
    await lock.locator('#grdNew1').fill('97531864');
    await lock.locator('#grdNew2').fill('97531864');
    await lock.locator('[data-action="invGuardRecover"]').click();
    await expect(lock).toHaveCount(0);
    await page.locator('[data-grd-code] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
    const usersBy = () => ev(page, `S.changeLog.filter(function (e) { return e.coll === 'users' && e.at >= ${t0}; }).map(function (e) { return e.by; })`) as Promise<unknown[]>;
    let by = await usersBy();
    expect(by.length).toBeGreaterThan(0);
    expect(by.every(b => b === 'U-own')).toBe(true);

    // Turn off the guard: every user deactivated, by the owner who did it.
    await openSettingsAt(page, 'users');
    await page.locator('[data-action="invGuardOff"]').click();
    const ask = page.locator('[data-grd-ask]');
    await ask.locator('#grdAskPin').fill('97531864');
    await ask.locator('[data-action="invGuardAskOk"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Turn off the guard?');
    await expect.poll(async () => (await usersBy()).length).toBeGreaterThan(by.length);
    by = await usersBy();
    expect(by.every(b => b === 'U-own')).toBe(true);
  });

  test('QA4-10: a book imported without the person who imported it still names them on the import’s line', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    const other = await page.evaluate(async () => {
      const w = window as any;
      return [{ id: 'U-x', name: 'Ira Bose', role: 'owner', secret: await w.grdMakeSecret('31415926'), active: true, createdAt: 1, createdBy: null }];
    });
    const incoming = { ...emptyState(), incomingMaterial: noSeedIM(), users: other, company: { ...emptyState().company, name: 'ELSEWHERE CO' } };
    await pickFile(page, 'backup.json', incoming);
    await answerAsk(page, 'ok');                                   // Replace all data?
    expect(await answerAsk(page, 'ok')).toContain('other IDs');     // take the backup's IDs
    await expect(page.locator('#guardRoot')).toBeVisible();         // the owner here is not an ID there: locked
    const line = await ev(page, `JSON.stringify(S.changeLog.filter(function (e) { return e.coll === 'book'; }).pop())`);
    expect(JSON.parse(line as string).by).toBe('U-own');
  });

  test('QA4-11: a push’s time on the device’s row is not a change anybody made', async ({ page }) => {
    await loadAppWithState(page, { ...guardBook(), devices: [{ id: 'dev-x', name: 'Desk PC', user: null, registeredAt: 1, registeredBy: null, build: 'x' }] } as SepState);
    // A push records its time on the row and persists it quietly (devices.js devPushPrep's done).
    await g(page, 'S.devices[0].lastPushAt = Date.now(); persistState()');
    await g(page, "S.company.phone = '0657 2000000'; saveState()");
    const colls = await ev(page, 'S.changeLog.map(function (e) { return e.coll; })') as string[];
    expect(colls).toContain('company');
    expect(colls).not.toContain('devices');
  });
});
