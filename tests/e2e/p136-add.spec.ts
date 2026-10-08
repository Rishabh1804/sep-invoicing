import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, todayIso, type SepState } from './fixtures';

// P136: Add, the one door (Direction B, step B4; owner, 1 Oct 2026). One sheet for everything that comes in: a WhatsApp
// message pasted (the one paste box), the clipboard read only on a tap, a photo (the register reader, which offers a
// challan to the scanner), a file routed by what is in it, and every form by hand. The sheet saves nothing itself:
// each route ends in the review or the form that already exists. Names and messages are made up in the shop's shapes.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function day(offset: number): Date { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset); return d; }
const dmy = (offset = -1) => { const d = day(offset); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
const short = (offset: number) => { const d = day(offset); return `${d.getDate()} ${MON[d.getMonth()]}`; };

const STAFF = [
  { id: 'W1', name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 'W2', name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 'W3', name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 'W4', name: 'Esha', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 'W5', name: 'Gopal', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
  { id: 'W6', name: 'Hari', comp: 'hourly', area: 'office', hourRate: 50, active: true, onFloor: false },
  { id: 'W7', name: 'Jatin', comp: 'monthly', area: 'gate', dayRate: 500, active: true, onFloor: false },
];
// The relay spec's in-time roll (P41): seven on the roster, one name it does not hold, a 6 AM block and the 8:30 shift's EXTRA.
const IN = () => `${dmy(0)}, 10:15 am - Supervisor One: ${dmy()}/ in time
----6:00 AM---
----VAT A 1----
1) ARUN
2) BALA
EXTRA 3 HOURS
----8:30 AM---
---VAT A 1----
1) ARUN
2) CHAND
EXTRA 8 HOURS
---berral & pickling---
3) BALA
4) GOPALL
---office & gate keeper
5) HARI
6) JATIN
--monthly absent---
7) ESHA
---weekly absent---
8) ZORO`;
const STOCK_MSG = () => `[${dmy(0)}, 2:05 pm] Supervisor One: Chemical use chemical stock\n${dmy(-6)}/-${dmy(0)}/\n\n1) Q558 NIL\n\n2) MONICOL 6-1=5 KG`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JUL_XLS = path.join(__dirname, '..', 'fixtures', 'bank-jul.xls');

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...extra } as SepState);
}
/* The shell's Add (the phone bar, the sidebar) runs invAddOpen. Where it is not drawn yet, a button carrying the same
   action goes through the same door in events.js. */
async function openAdd(page: Page) {
  const door = page.locator('[data-action="invAddOpen"]:visible').first();
  if (await door.count()) await door.click();
  else await page.evaluate(() => {
    const b = document.createElement('button');
    b.setAttribute('data-action', 'invAddOpen');
    b.className = 'inv-hidden';
    document.body.appendChild(b);
    b.click();
    b.remove();
  });
  await expect(page.locator('[data-add-sheet]')).toBeVisible();
}
async function mockClipboard(page: Page, text: string | null) {
  await page.evaluate(t => {
    (window as any).__clipReads = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => {
      (window as any).__clipReads++;
      return t == null ? Promise.reject(new DOMException('Read permission denied.', 'NotAllowedError')) : Promise.resolve(t);
    } } });
  }, text);
}
async function pickFile(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="file"]').click()]);
  await chooser.setFiles(file as any);
}
const json = (name: string, obj: unknown) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(JSON.stringify(obj)) });
const tapOutside = (page: Page) => page.locator('.inv-scrim-dialog').last().click({ position: { x: 4, y: 4 } });
const lastToast = (page: Page) => page.locator('.inv-toast').last();

test.describe('P136: Add, the one door', () => {
  test('the sheet draws its five doors in order, one primary, and saves nothing itself; back closes it', async ({ page }) => {
    await load(page);
    await openAdd(page);
    const sheet = page.locator('[data-add-sheet]');
    await expect(sheet.locator('.inv-dialog-title')).toHaveText('Add');
    expect(await sheet.locator('[data-add-sec]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.addSec))).toEqual(['paste', 'clipboard', 'photo', 'file', 'hand']);
    await expect(sheet.locator('label[for="addPasteText"]')).toHaveText('Rolls, stock, pickling loads, production, power cuts');
    expect(await sheet.locator('[data-action="invAddHand"]').evaluateAll(els => els.map(e => (e as HTMLElement).innerText.trim())))
      .toEqual(['Challan', 'Invoice', 'Quotation', 'Stock entry', 'Production', 'Power cut', 'Attendance', 'Payment', 'Bill', 'Task']);
    await expect(sheet.locator('.inv-btn-primary')).toHaveCount(1);
    await expect(sheet.locator('.inv-btn-primary')).toHaveText('Read it');
    await expect(sheet).toContainText('Whatever comes in is read, shown to you beside what was read, and saved only when you say so.');
    // On a touch screen nothing raises the keyboard until the box is tapped.
    await expect(page.locator('#addPasteText')).not.toBeFocused();
    // A layer, not a place: the address stays the screen's, and back closes the sheet on it.
    expect(new URL(page.url()).searchParams.get('tab')).toBe('pageHome');
    await page.goBack();
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  });

  test('a pasted in-time roll reaches the paste box\'s check exactly as Home → Paste message sends it', async ({ page }) => {
    // Home → Paste message (homeQuick('paste')), the message pasted and read in the box.
    await load(page);
    await g(page, `homeQuick('paste')`);
    await page.locator('#relayPasteText').fill(IN());
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    const viaHome = await page.locator('#attContent').innerText();

    // The same message through Add.
    await load(page);
    await openAdd(page);
    await page.locator('#addPasteText').fill(IN());
    await page.locator('[data-action="invAddRead"]').click();
    // The typed text was what was being read: nothing was asked, and the sheet closed.
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
    expect(await page.locator('#attContent').innerText()).toBe(viaHome);
    // Nothing is saved until the check's own Save.
    expect((await readStoredState(page)).attendance).toEqual({});
  });

  test('the clipboard is read only on a tap: a stock message is named with its days and lines, and Read it opens the stock check', async ({ page }) => {
    await load(page);
    await mockClipboard(page, STOCK_MSG());
    await openAdd(page);
    expect(await page.evaluate(() => (window as any).__clipReads)).toBe(0);
    await page.locator('[data-add-sec="clipboard"]').click();
    const out = page.locator('#addClipOut [data-add-clip="ok"]');
    await expect(out).toContainText('On the clipboard');
    await expect(out.locator('[data-add-clip-item="stock"]')).toContainText('A stock message');
    await expect(out.locator('[data-add-clip-item="stock"]')).toContainText(`${short(-6)} – ${short(0)} · 2 lines`);
    await expect(out).toContainText('Read in Stock and checked there before anything is saved.');
    expect(await page.evaluate(() => (window as any).__clipReads)).toBe(1);
    await out.locator('[data-action="invAddClipRead"]').click();
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeVisible();
    await expect(page.locator('#stockContent')).toContainText('MONICOL');
    expect((await readStoredState(page)).stock?.entries || []).toHaveLength(0);
  });

  test('a roll on the clipboard is named by the paste box\'s own reader: its day, its names and its EXTRA', async ({ page }) => {
    await load(page);
    await mockClipboard(page, IN());
    await openAdd(page);
    await page.locator('[data-add-sec="clipboard"]').click();
    const item = page.locator('#addClipOut [data-add-clip-item="in"]');
    await expect(item).toContainText('An in-time roll');
    // Seven on the roster (one read from a spelling) and one it does not hold; a 6 AM block and the 8:30 shift's EXTRA.
    await expect(item).toContainText(`${short(-1)} · 8 names, 1 EXTRA block, 1 EXTRA on the general shift`);
    await expect(page.locator('#addClipOut')).toContainText('Read in Staff');
    await expect(page.locator('#addClipOut .inv-quote')).toContainText('in time');
    await page.locator('[data-action="invAddClipRead"]').click();
    await expect(page.locator('#relayReviewTiles')).toBeVisible();
  });

  test('a clipboard the browser will not read says so; an empty one and plain text are named, never read', async ({ page }) => {
    await load(page);
    await mockClipboard(page, null);
    await openAdd(page);
    await page.locator('[data-add-sec="clipboard"]').click();
    await expect(page.locator('#addClipOut [data-add-clip="refused"]')).toHaveText('The browser did not allow reading the clipboard: paste it in the box above.');
    // A browser with no clipboard API at all says the same.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await page.locator('[data-add-sec="clipboard"]').click();
    await expect(page.locator('#addClipOut [data-add-clip="refused"]')).toBeVisible();
    await mockClipboard(page, '   ');
    await page.locator('[data-add-sec="clipboard"]').click();
    await expect(page.locator('#addClipOut [data-add-clip="empty"]')).toContainText('The clipboard holds no text');
    await mockClipboard(page, 'Meeting at 4 <b>sharp</b>');
    await page.locator('[data-add-sec="clipboard"]').click();
    const other = page.locator('#addClipOut [data-add-clip="other"]');
    await expect(other).toContainText('1 line of text that is not a roll, a stock message or a production message');
    // What was copied is shown as text, never as markup, and there is nothing to read.
    await expect(other.locator('.inv-quote')).toHaveText('Meeting at 4 <b>sharp</b>');
    await expect(other.locator('b')).toHaveCount(0);
    await expect(page.locator('[data-action="invAddClipRead"]')).toHaveCount(0);
  });

  test('a file goes by what is in it: a stock export, the bank\'s statement, a backup asked about, anything else named', async ({ page }) => {
    await load(page);
    // A sep-stock export saved under a name that says nothing of it reaches Stock's import, which merges and says so.
    await openAdd(page);
    await pickFile(page, json('export.dat', { format: 'sep-stock', version: 1, pastes: [],
      items: [{ id: 'SI-X', name: 'Boric Acid', unit: 'kg' }], entries: [{ id: 'SE-X', itemId: 'SI-X', kind: 'count', date: todayIso(), qty: 25, at: 1 }] }));
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    await expect(lastToast(page)).toContainText('Imported 1 lines, 1 entries');
    expect((await readStoredState(page)).stock.items.map((i: any) => i.name)).toEqual(['Boric Acid']);

    // The bank's Excel 97–2003 statement reaches the bank import, on Finance → Bank.
    await openAdd(page);
    await pickFile(page, JUL_XLS);
    await page.waitForFunction(() => ((window as any).bankData().imports || []).length > 0);
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invFinTab"][data-tab="bank"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#bankHead')).toContainText('312 rows');

    // A backup, even one saved as .xls, is the whole book: Settings → Import's own question, and Cancel replaces nothing.
    const backup = { ...emptyState(), clients: [{ id: 7, name: 'ANOTHER BOOK CO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }] };
    await openAdd(page);
    await pickFile(page, json('statement.xls', backup));
    expect(await answerAsk(page, 'cancel')).toContain('Replace all data?');
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    const kept = await readStoredState(page);
    expect(kept.clients.map((c: any) => c.name)).toEqual(['TEST CLIENT KG']);
    expect(kept.bank.rows).toHaveLength(312);

    // Anything else is named, and the sheet stays open for another.
    await openAdd(page);
    await pickFile(page, json('notes.json', { hello: 1, world: [2] }));
    const said = await answerAsk(page, 'ok');
    expect(said).toContain('Not a file the app imports');
    expect(said).toContain('notes.json is a JSON file with keys hello, world, not one the app imports');
    await expect(page.locator('[data-add-sheet]')).toBeVisible();
    await pickFile(page, { name: 'register.xlsx', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04, 0, 0]) });
    expect(await answerAsk(page, 'ok')).toContain('a zip file with no Excel workbook in it');
  });

  test('every other import is reached by what its file holds: the roster, production, the power history, payroll as paid', async ({ page }) => {
    await load(page);
    await openAdd(page);
    await pickFile(page, json('people.json', { staff: [{ name: 'Zubin Testwala', comp: 'hourly', hourRate: 50, area: 'barrel' }] }));
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invAttView"][data-view="roster"]')).toHaveAttribute('aria-selected', 'true');
    await expect(lastToast(page)).toContainText('1 added, 0 updated');

    await openAdd(page);
    await pickFile(page, json('floor.json', { format: 'sep-production', version: 1,
      entries: [{ id: 'PE-X1', kind: 'plated', date: todayIso(), line: 'vat-a1', client: 'TEST CLIENT KG', part: 'BRKT-1', qty: 100, unit: 'NOS' }] }));
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    await expect(lastToast(page)).toContainText('1 entry added');

    // soma-internal's power history is a sep-production file carrying `power`: Power's import takes its cuts and bills.
    await openAdd(page);
    await pickFile(page, json('power.json', { format: 'sep-production', version: 1, power: { bills: {} },
      entries: [{ id: 'PE-X2', kind: 'downtime', date: todayIso(), time: '10:00', to: '10:30', downtime: { cause: 'power', open: false } }] }));
    await expect(page.locator('#pagePower')).toHaveClass(/inv-page-active/);
    await expect(lastToast(page)).toContainText('1 cut added');

    await openAdd(page);
    await pickFile(page, json('slips.json', { kind: 'sep-payroll-paid', months: [{ month: '2026-08', rows: [{ name: 'Arun', dayPay: 11000, ot: 0 }] }] }));
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(lastToast(page)).toContainText('1 month recorded');
    const s = await readStoredState(page);
    expect(s.staff.map((w: any) => w.name)).toContain('Zubin Testwala');
    expect(s.production.entries.map((e: any) => e.id).sort()).toEqual(['PE-X1', 'PE-X2']);
    expect(s.payrollPaid.map((r: any) => r.month)).toEqual(['2026-08']);
  });

  test('by hand, each button opens its form on the job', async ({ page }) => {
    await load(page);
    const d = day(0); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const lastMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lands: Array<[string, () => Promise<void>]> = [
      ['challan', async () => { await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/); await expect(page.locator('[data-form="challan"]').first()).toBeVisible(); }],
      ['invoice', async () => { await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/); await expect(page.locator('#invDate')).toBeVisible(); }],
      ['quote', async () => { await expect(page.locator('#clientsPageContent .inv-pagehead-title')).toHaveText('New quotation'); }],
      ['stock', async () => { await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/); await expect(page.locator('[data-action="invStockSaveManual"]')).toBeVisible(); }],
      ['production', async () => { await expect(page.locator('#productionContent .inv-pagehead-title')).toHaveText('Enter by hand'); }],
      ['power', async () => { await expect(page.locator('#productionContent .inv-pagehead-title')).toHaveText('Enter power cuts'); await expect(page.locator('#prodHandTo')).toBeVisible(); }],
      ['attendance', async () => { await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/); await expect(page.locator('#attDate')).toHaveValue(todayIso()); }],
      ['payment', async () => { await expect(page.locator('#payForm')).toBeVisible(); await expect(page.locator('#payWorker')).toBeFocused(); }],
      ['bill', async () => { await expect(page.locator('#pageFinance #costBillAmount')).toBeVisible(); await expect(page.locator('#pageFinance #costBillMonth')).toHaveValue(lastMonth); }],
      ['task', async () => { await expect(page.locator('#pageTodo')).toHaveClass(/inv-page-active/); await expect(page.locator('#todoNew')).toBeFocused(); }],
    ];
    for (const [go, landed] of lands) {
      await openAdd(page);
      await page.locator(`[data-action="invAddHand"][data-go="${go}"]`).click();
      await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
      await landed();
    }
  });

  test('text typed in the sheet asks before a tap outside closes it, and before another door drops it', async ({ page }) => {
    await load(page);
    await openAdd(page);
    await page.locator('#addPasteText').fill('half a roll');
    await tapOutside(page);
    expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
    await expect(page.locator('#addPasteText')).toHaveValue('half a roll');
    await page.locator('[data-action="invAddHand"][data-go="task"]').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#addPasteText')).toHaveValue('half a roll');
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await tapOutside(page);
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    // With nothing in the box, Read it says so in place, and the sheet closes at once.
    await openAdd(page);
    await page.locator('[data-action="invAddRead"]').click();
    await expect(page.locator('#addPasteErr')).toBeVisible();
    await expect(page.locator('[data-add-sheet]')).toBeVisible();
    await tapOutside(page);
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
  });

  test('a form with unsaved work under the sheet asks before a door leaves it', async ({ page }) => {
    await load(page);
    await g(page, `switchTab('pageStock'); stockOpenManual()`);
    await page.locator('#stockManDate').fill('2020-01-02');
    await openAdd(page);
    await page.locator('[data-action="invAddHand"][data-go="challan"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('[data-add-sheet]')).toBeVisible();
    await tapOutside(page);
    await expect(page.locator('#stockManDate')).toHaveValue('2020-01-02');
    await openAdd(page);
    await page.locator('[data-action="invAddHand"][data-go="challan"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-form="challan"]').first()).toBeVisible();
  });

  test('a photo goes to the register reader, which offers a challan to the scanner; with no Gemini key it says so and opens the key', async ({ page }) => {
    await load(page);
    await page.evaluate(() => { localStorage.removeItem('sep_inv_gemini_key'); localStorage.removeItem('sep_inv_prod_photo_draft'); });
    await openAdd(page);
    await page.locator('[data-add-sec="photo"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Gemini key needed');
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    await expect(page.locator('#settingsScrim details[data-sec="geminiKey"]')).toHaveAttribute('open', '');
    await page.locator('[data-action="invCloseSettings"]').first().click();
    await expect(page.locator('#settingsScrim')).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('sep_inv_gemini_key', 'TEST-KEY'));
    const reply = { candidates: [{ content: { parts: [{ text: JSON.stringify({ page: 'challan', date: dmy(0), rows: [] }) }] }, finishReason: 'STOP' }] };
    await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) }));
    await openAdd(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="photo"]').click()]);
    await chooser.setFiles({ name: 'paper.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invProdToScanner"]')).toBeVisible();
    await expect(page.locator('#productionContent')).toContainText('not a page of the register');
  });
});
