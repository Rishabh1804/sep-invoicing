import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import { bankImportDoor, answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P179: the bank statement as the owner has it (8 Oct 2026: "When uploading the bank statement in xlsx format we get an
// error Row 50: page 2 cannot be read or not an excel file"). A statement of two pages ends in the bank's page foot, the
// time it was made under TRAN DATE and "Page 2 of" under BALANCE, which was read as a transaction; and the same statement
// saved from Excel as .xlsx was refused. The fixtures are FAKE (tests/fixtures/make-bank-sep.py): every name and figure
// invented; their dates are fixed because a file cannot carry todayIso().

const XLS = path.join(__dirname, '..', 'fixtures', 'bank-sep-2page.xls');
const XLSX = path.join(__dirname, '..', 'fixtures', 'bank-sep.xlsx');
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function state(): SepState { return { ...emptyState(), incomingMaterial: noSeedIM() } as unknown as SepState; }
async function openBank(page: Page) {
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
}
async function importFile(page: Page, file: string) {
  const before = await page.evaluate(() => ((window as any).bankData().imports || []).length);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), bankImportDoor(page)]);
  await chooser.setFiles(file);
  await page.waitForFunction(n => (window as any).bankData().imports.length > n, before);
}
/* The rows as the record keeps them, without what the import stamps. */
const kept = (rows: any[]) => rows.map(r => [r.id, r.date, r.narration, r.chq, r.dr, r.cr, r.balance, r.dayIdx]);

test('a statement of two pages is read past the bank’s page foot, every balance following from the one before', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importFile(page, XLS);
  await expect(page.locator('#bankVerdict')).toContainText('8 rows');
  await expect(page.locator('[data-bank-breaks="0"]')).toBeVisible();
  const b = (await readStoredState(page)).bank;
  expect(b.rows).toHaveLength(8);
  // The page foot's time (6 Sep, 11:21) is not a row; the last row is the statement's own.
  expect(b.rows.map((r: any) => r.date)).not.toContain('2026-09-06');
  expect(b.rows[b.rows.length - 1]).toMatchObject({ date: '2026-09-05', narration: 'NEFT-HDFCH00000000003-BETA AUTO', cr: 35400, balance: 146609.68 });
  expect(b.imports[0]).toMatchObject({ account: '001XXXXXXXX777', rows: 8, added: 8, closing: 146609.68 });
});

test('the same statement saved from Excel as .xlsx reads as the same rows, so either one after the other adds nothing', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importFile(page, XLSX);
  await expect(page.locator('.inv-toast').last()).toContainText('8 rows added');
  const fromXlsx = kept((await readStoredState(page)).bank.rows);
  // A date typed as a date, an amount typed as a number, and a narration in two runs of rich text all read as the bank wrote them.
  expect(fromXlsx.find(r => r[2] === 'TO SELF')).toEqual([expect.any(String), '2026-09-02', 'TO SELF', '000201', 40000, 0, 119000, 1]);
  await importFile(page, XLS);
  await expect(page.locator('.inv-toast').last()).toContainText('0 rows added · 8 already held');
  expect(kept((await readStoredState(page)).bank.rows)).toEqual(fromXlsx);
});

test('Add → File takes the .xlsx too, and lands it in Finance → Bank', async ({ page }) => {
  await loadAppWithState(page, state());
  await page.locator('[data-action="invAddOpen"]').first().click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invAddFile"]').click()]);
  await chooser.setFiles(XLSX);
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  await page.waitForFunction(() => (window as any).bankData().rows.length === 8);
});

test('the reader reads what an .xlsx holds: the app’s own export back, cell for cell', async ({ page }) => {
  await loadAppWithState(page, state());
  const rows = await page.evaluate(async () => {
    const E = (0, eval);
    const bytes: Uint8Array = E(`xlsxBuild([{ name: 'Mine', rows: [['Date', 'Narration', 'Amount'], [{ v: '2026-09-05', s: 'date' }, 'A & B <co>', { v: 1234.5, s: 'money' }], [null, '', 7]] }])`);
    return (await E('xlsxRead')(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).rows;
  });
  // A stored zip with inline strings (as the app writes it): the date is Excel's day number, the empty cells are not there.
  expect(rows).toEqual([['Date', 'Narration', 'Amount'], [46270, 'A & B <co>', 1234.5], [null, null, 7]].map(r => r.map(v => v === null ? undefined : v)));
});

test('what is not a statement is said: a zip with no workbook, a file that is no Excel file, a row whose balance cannot be read', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  for (const [name, bytes, said] of [
    ['notes.xlsx', Buffer.from([0x50, 0x4B, 0x03, 0x04, 0, 0]), 'Not an Excel workbook'],
    ['notes.xls', Buffer.from('not a spreadsheet'), 'Not an Excel file'],
  ] as Array<[string, Buffer, string]>) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), bankImportDoor(page)]);
    await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer: bytes });
    await expect(page.locator('.inv-toast').last()).toContainText(said);
  }
  expect((await readStoredState(page)).bank?.rows || []).toHaveLength(0);
  // A row carrying an amount with a balance nobody can read is still refused, by its row: only a row with no amount is a foot.
  const err = await g(page, `(function () { try { bankParseSheet([['TRAN DATE', 'NARRATION', 'WITHDRAWAL(DR)', 'DEPOSIT(CR)', 'BALANCE(INR)'],
    ['02/09/2026', 'TO SELF', '40,000.00', '', 'Page 2 of']]); return ''; } catch (e) { return e.message; } })()`);
  expect(err).toBe('Row 2: the balance "Page 2 of" cannot be read');
  // Add → File names a zip that holds no workbook.
  await page.locator('[data-action="invAddOpen"]').first().click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invAddFile"]').click()]);
  await chooser.setFiles({ name: 'photos.zip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04, 0, 0]) });
  expect(await answerAsk(page, 'ok')).toContain('a zip file with no Excel workbook in it');
});
