import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P288 (owner, 23 Nov 2026: the sheets are photographed as they fill, every half hour, and "only the new rows" are to be taken):
// a sheet printed to photograph carries its code (P287), and the reader gives it back. A VAT sheet's day and line are the
// code's. A later photo of the same sheet is the page as it stands now: it replaces the earlier reading, whose runs are voided,
// so the page is never counted twice; the check says how many rows are new and which row reads differently. A sheet of
// another kind is said to have no reader yet, and nothing is saved. Anthropic's API is faked at the route layer; every name
// and figure is made up; the dates are fixed, since the code carries its own.

const ANTHROPIC = 'https://api.anthropic.com/**';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = (n: number) => Buffer.concat([PNG, Buffer.from([n])]);
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const DAY = '2026-11-24';
const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }] }];
const book = (): SepState => ({ ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as unknown as SepState);
const row = (time: string, qtyText: string, first = false) => ({ time, mark: '', customer: first ? 'Nova clamps' : '', part: first ? 'CLAMP 165x83' : '', dim: first ? '40x6' : '',
  qtyText, struck: false, over: '', bracket: false, ditto: !first, legible: true, event: '', date: '' });
// The handwriting names no date and another line: the code is what says the day and the line.
const sheet = (code: string, rows: unknown[]) => ({ page: 'production', date: '', weekday: '', line: 'VAT-A2', code, dayTotal: null, rows });
const reply = (obj: unknown) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 1500 } });

async function boot(page: Page, answers: unknown[]) {
  await loadAppWithState(page, book());
  await page.evaluate(() => { try { localStorage.setItem('sep_inv_claude_key', 'sk-ant-test'); localStorage.removeItem('sep_inv_prod_photo_read'); } catch (e) { /* none */ } });
  const reqs: any[] = [];
  await page.route(ANTHROPIC, async route => {
    reqs.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply(answers[Math.min(reqs.length, answers.length) - 1])) });
  });
  await switchTab(page, 'pageProduction');
  return reqs;
}
const pick = (page: Page, buffer: Buffer) => page.setInputFiles('#prodPhotoInput', { name: 'sheet.png', mimeType: 'image/png', buffer });
const live = async (page: Page) => ((await readStoredState(page)) as any).production.entries.filter((e: any) => e.kind === 'plated' && !e.voidedAt);

test.describe('P288: a sheet photographed again', () => {
  test('the code says the day and the line; a later photo replaces the earlier reading, and the check says what is new and what differs', async ({ page }) => {
    const CODE = `SEP SHEET VA1 ${DAY} PAGE 1`;
    const reqs = await boot(page, [
      sheet(CODE, [row('9:20 AM', '108', true), row('9:50 AM', '108')]),
      sheet('sep sheet va1 2026-11-24 page 1', [row('9:20 AM', '108', true), row('9:50 AM', '100'), row('10:20 AM', '108'), row('10:50 AM', '108')]),
    ]);
    await pick(page, png(1));
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    // The reader is asked for the code, and the schema carries it.
    expect(reqs[0].output_config.format.schema.properties.code.type).toBe('string');
    expect(JSON.stringify(reqs[0].messages)).toContain('SEP SHEET');
    // The page's day and line are the code's, not the handwriting's.
    await expect(page.locator('#prodPhotoDate')).toHaveValue(DAY);
    await expect(page.locator('#prodPhotoLine')).toHaveValue('vat-a1');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    let rows = await live(page);
    expect(rows.map((e: any) => [e.date, e.line, e.qty])).toEqual([[DAY, 'vat-a1', 216]]);
    expect(((await readStoredState(page)) as any).production.photos[0].code).toBe(CODE);

    // Half an hour on: the same sheet with two more rows, and one row read differently. The code is matched whatever its case.
    await pick(page, png(2));
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    const flow = page.locator('#pageProduction');
    await expect(flow).toContainText('This sheet was read before');
    await expect(flow).toContainText('2 rows new since');
    await expect(flow).toContainText('The row at 9:50 AM read 108 before and reads 100 now');
    await expect(flow).not.toContainText('counts the page twice');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('in place of the reading before');
    rows = await live(page);
    // The page as it stands now, once: 108 + 100 + 108 + 108.
    expect(rows.map((e: any) => e.qty)).toEqual([424]);
    const p = ((await readStoredState(page)) as any).production;
    const old = p.entries.filter((e: any) => e.photoId === p.photos[0].id);
    expect(old.length).toBe(1);
    expect(old[0].voidReason).toBe('Replaced by a later photo of the same sheet');
    expect(p.photos[1].replaces).toBe(p.photos[0].id);
    // The differing row was said: the unit under test names both readings.
    expect(await g(page, `JSON.stringify(prodPhotoSince({ fp: 'd|l|9:20 AM:108,9:50 AM:108' }, { fp: 'd|l|10:20 AM:108,9:20 AM:108,9:50 AM:100' }))`))
      .toBe(JSON.stringify({ fresh: [{ time: '10:20 AM', qty: '108' }], differ: [{ time: '9:50 AM', was: '108', now: '100' }], gone: [], same: false }));
  });

  test('a row that reads differently is shown with both readings; a sheet of another kind is said, and nothing is saved', async ({ page }) => {
    await boot(page, [
      sheet(`SEP SHEET VA1 ${DAY} PAGE 1`, [row('9:20 AM', '108', true), row('9:50 AM', '108')]),
      sheet(`SEP SHEET VA1 ${DAY} PAGE 1`, [row('9:20 AM', '108', true), row('9:50 AM', '100')]),
      sheet(`SEP SHEET STP ${DAY} PAGE 1`, [row('9:20 AM', '108', true)]),
    ]);
    await pick(page, png(1));
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await page.locator('[data-action="invProdSavePhoto"]').click();
    await pick(page, png(2));
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await expect(page.locator('#pageProduction')).toContainText('The row at 9:50 AM read 108 before and reads 100 now');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    expect((await live(page)).map((e: any) => e.qty)).toEqual([208]);
    // The stop sheet: its code is read, its reader is not built.
    await pick(page, png(3));
    await expect(page.locator('#pageProduction')).toContainText(`This is SEP SHEET STP ${DAY} PAGE 1: a sheet whose photo is not read into the book yet`);
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toHaveCount(0).catch(async () => { await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeDisabled(); });
    expect((await live(page)).map((e: any) => e.qty)).toEqual([208]);
    expect(await g(page, `[fshCodeRead('x'), fshCodeRead('SEP SHEET ZZZ 2026-11-24 PAGE 1'), fshCodeRead('SEP SHEET BRL 2026-11-24 PAGE 2').kind].join('|')`)).toBe('||barrel');
  });
});
