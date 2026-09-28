import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P85, the register half: a photo of the VAT register read by Gemini (mocked here), every row checked before it is
// saved, a struck row asked about each time, only the photo's facts kept (never the image), and the same page never
// counted twice.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PNG2 = Buffer.concat([PNG, Buffer.from([0, 1, 2])]);
const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] });
function dmy(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
const PAGE = () => ({
  date: dmy(0), line: 'VAT A1', dayTotal: 624,
  rows: [
    { time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', rackSize: 4, rounds: 25, qty: 108 },
    { time: '10:15', customer: null, part: null, ditto: true, qty: 108 },
    { time: '2:30', customer: 'Durga auto', part: '0141', qty: 300, struck: true },
    { time: '3:45', customer: 'Durga auto', part: '0140', qty: 108 },
  ],
});

async function boot(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState);
  await page.evaluate(() => { try { localStorage.setItem('sep_inv_gemini_key', 'TEST-KEY'); localStorage.removeItem('sep_inv_prod_photo_draft'); } catch (e) {} });
  await switchTab(page, 'pageProduction');
}
async function mock(page: Page, body: () => unknown, status = 200) {
  const calls: any[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body()) });
  });
  return calls;
}
const pick = (page: Page, buffer: Buffer, name = 'register.png') => page.setInputFiles('#prodPhotoInput', { name, mimeType: 'image/png', buffer });

test.describe('P85: the register photo', () => {
  test('read with a schema, checked row by row, a struck row asked, only the facts kept', async ({ page }) => {
    await boot(page);
    const calls = await mock(page, () => reply(PAGE()));
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    // The request: the schema, no thinking, a smaller JPEG, and no client list.
    expect(calls).toHaveLength(1);
    const cfg = calls[0].generationConfig;
    expect(cfg).toMatchObject({ responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } });
    expect(cfg.responseSchema.required).toEqual(['rows']);
    expect(calls[0].contents[0].parts[0].inline_data.mime_type).toBe('image/jpeg');
    expect(calls[0].contents[0].parts[1].text).not.toContain('NOVA CLAMPS');

    // Runs by customer and part; the struck row is red and Save waits on it.
    await expect(page.locator('[data-prod-run]')).toHaveCount(3);
    await expect(page.locator('[data-prod-run="0"] .inv-num')).toHaveText('216 NOS');
    await expect(page.locator('[data-prod-run="0"]')).toContainText('4 × 25 = 100, but 108 is written');   // said; the written figure is used
    const save = page.locator('[data-action="invProdSavePhoto"]');
    await expect(save).toBeDisabled();
    await expect(page.locator('[data-prod-run="1"]')).toContainText('Counted or cancelled?');
    await page.locator('[data-action="invProdStruck"][data-v="cancelled"]').click();
    await expect(save).toBeEnabled();
    // Cancelled, the page's total of 624 does not agree with the rows counted (324): said.
    await expect(page.locator('#productionContent')).toContainText('the rows counted add to 324');
    await save.click();

    const s = await readStoredState(page);
    const e = s.production.entries;
    // The cancelled run was never plated; the other two are the register's, on the line it names.
    expect(e.map((x: any) => [x.clientId, x.qty, x.time, x.to, x.line, x.lineSrc, x.basis, x.src])).toEqual([
      [11, 216, '09:20', '10:15', 'vat-a1', 'written', 'register', 'photo'],
      [12, 108, '15:45', '15:45', 'vat-a1', 'written', 'register', 'photo'],
    ]);
    expect(e[0].rounds).toEqual([{ time: '9:20', qty: 108, rack: 4, n: 25 }, { time: '10:15', qty: 108 }]);
    expect(e[0].date).toBe(todayIso());
    expect(s.production.photos).toHaveLength(1);
    const ph = s.production.photos[0];
    expect(ph).toMatchObject({ model: 'gemini-3.8-flash', promptVer: 'reg-v2', readLine: 'vat-a1', rows: 4, name: 'register.png' });
    expect(ph.sha).toMatch(/^[0-9a-f]{64}$/);
    // The image is never kept: no data URL anywhere in the stored state.
    expect(JSON.stringify(s.production)).not.toContain('data:image');
  });

  test('the same photo, or the same page photographed again, is never counted twice', async ({ page }) => {
    await boot(page);
    await mock(page, () => reply({ ...PAGE(), rows: PAGE().rows.filter(r => !r.struck) }));
    await pick(page, PNG);
    await page.locator('[data-action="invProdSavePhoto"]').click();
    // The same file: refused outright.
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoDup')).toContainText('saved before');
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeDisabled();
    await page.locator('[data-action="invProdBack"]').click();
    // A retake (a different file, the same rows): warned, the owner's call.
    await pick(page, PNG2, 'retake.png');
    await expect(page.locator('#prodPhotoDup')).toContainText('same rows');
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeEnabled();
  });

  test('a read is kept on the device until saved, so reopening the photo costs no second request', async ({ page }) => {
    await boot(page);
    const calls = await mock(page, () => reply(PAGE()));
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await page.locator('[data-action="invProdBack"]').click();
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await expect(page.locator('#productionContent')).toContainText('kept from the last read');
    expect(calls).toHaveLength(1);
  });

  test('Gemini refusing says so in the app, and the next photo is still read', async ({ page }) => {
    await boot(page);
    let n = 0;
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
      n++;
      if (n === 1) await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Resource exhausted' } }) });
      else await route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply(PAGE())) });
    });
    await page.setInputFiles('#prodPhotoInput', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG2 }]);
    await expect(page.locator('.inv-notice-bar')).toContainText('too many requests');
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    expect(n).toBe(2);
  });

  test('a key whose prepaid credits ran out is named as billing, not as a busy minute', async ({ page }) => {
    await boot(page);
    await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.' } }) }));
    await page.setInputFiles('#prodPhotoInput', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('.inv-notice-bar')).toContainText('prepaid billing and its credits have run out');
    await expect(page.locator('.inv-notice-bar')).not.toContainText('Wait a minute');
  });

  test('no key: the app says where to set it, and hand entry needs none', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => localStorage.removeItem('sep_inv_gemini_key'));
    await page.locator('#pageProduction [data-action="invProdPhoto"]').click();
    await expect(page.locator('[data-ui-ask]')).toContainText('Settings → Connections');
  });

  // The real register (photos of 24–26 Sep 2026) has two page shapes and a power log. Made-up clients, the same shapes.
  const read = (page: Page, json: unknown, photoDate: string | null = null) => page.evaluate(({ json, photoDate }) => {
    const ev = (0, eval);
    const rd = ev('prodFromRegisterRead')(json, ev('prodCtx()'), photoDate, {});
    return { page: rd.page, style: rd.style, date: rd.date, runs: rd.runs.map((e: any) => [e.clientId, e.part, e.qty, e.time, e.to]), down: rd.downtime.map((d: any) => [d.date, d.time, d.to, d.open]),
      issues: rd.issues.map((x: any) => x.tone + ':' + x.code), rowIssues: rd.rows.map((r: any) => r.issues.map((x: any) => x.code)), rows: rd.rows.length,
      rounds: rd.runs.map((e: any) => e.rounds) };
  }, { json, photoDate });

  test('a rounds page: figures added up as written, START a round, a blank ditto row not a row', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '9:30 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '9:45 AM', ditto: true, qtyText: '72' },
      { time: '10:00 AM', ditto: true, qtyText: '72+10' },
      { time: '3:00 PM', ditto: true, qtyText: '7+93' },
      { time: '3:15 PM', ditto: true, part: 'LINER', qtyText: '87' },
      { ditto: true }] });
    expect(r.style).toBe('rounds');
    expect(r.rows).toBe(5);                             // the trailing ditto-only row is not read as a round
    expect(r.runs).toEqual([[11, 'CLAMP', 72 + 72 + 82 + 100, '09:30', '15:00'], [11, 'LINER', 87, '15:15', '15:15']]);
    expect(r.rowIssues[0]).toEqual(['start']);
    expect(r.rowIssues.flat()).not.toContain('illegible');
  });

  test('a START / END page: the END carries the batch, a START is never a round of its own', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), weekday: null, line: 'VAT-A2', rows: [
      { time: '9:20 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '3:00 PM', mark: 'END', ditto: true, qtyText: '98×8+1' },
      { time: '4:00 PM', mark: 'END', ditto: true, qtyText: '120x3' },
      { time: '4:00 PM', mark: 'START', customer: 'DURGA AUTO', part: 'TINA(0160)' },
      { time: '4:45 PM', mark: 'END', ditto: true, qtyText: '50+52+30' },
      { time: '4:50 PM', mark: 'END', ditto: true, qtyText: '7 boxes' }] });
    expect(r.style).toBe('startend');
    // 98 × 8 + 1 = 785 and 120 × 3 = 360: not doubled by the START (the first build read 1,930 here).
    expect(r.runs.map((x: any) => [x[0], x[2], x[3], x[4]])).toEqual([[11, 1145, '09:20', '16:00'], [12, 132, '16:00', '16:50']]);
    expect(r.rounds[0]).toEqual([{ time: '3:00 PM', qty: 785, batch: true, written: '98×8+1', rack: 98, n: 8 }, { time: '4:00 PM', qty: 360, batch: true, written: '120x3', rack: 120, n: 3 }]);
    expect(r.rowIssues[5]).toContain('figure');         // "7 boxes" is not a figure it can add up: said, never guessed
  });

  test('the power log is read as cuts; a sheet that is not the register is refused; a day name checks the date', async ({ page }) => {
    await boot(page);
    const d = dmy(0);
    const power = await read(page, { page: 'power', rows: [
      { date: d, event: 'Power cut', time: '11:16 AM' }, { date: d, event: 'Power in', time: '11:21 AM' },
      { date: d, event: 'Power cut', time: '11:26 AM' }, { date: d, event: 'Power in', time: '12:00 PM' },
      { date: d, event: 'Power cut', time: '3:45 PM' }] });
    expect(power.page).toBe('power');
    expect(power.date).toBe(todayIso());
    expect(power.down).toEqual([[todayIso(), '11:16', '11:21', false], [todayIso(), '11:26', '12:00', false], [todayIso(), '15:45', null, true]]);
    const other = await read(page, { page: 'other', rows: [{ customer: 'Worker one', qtyText: '40' }] });
    expect(other.issues).toEqual(['red:page']);
    expect(other.runs).toEqual([]);
    const wrongDay = new Date(todayIso() + 'T00:00:00'); wrongDay.setDate(wrongDay.getDate() + 1);
    const named = await read(page, { page: 'production', date: d, weekday: wrongDay.toLocaleDateString('en-GB', { weekday: 'long' }), line: 'VAT-A1', rows: [{ time: '9:45 AM', customer: 'NOVA CLAMPS', part: 'CLAMP', qtyText: '72' }] });
    expect(named.issues).toContain('amber:weekday');
  });

  test('a power log photo saves its cuts, and a cut the pickling messages also sent is counted once', async ({ page }) => {
    await boot(page);
    await page.evaluate((iso) => { const ev = (0, eval);
      ev('S.production.entries.push({ id: "PM1", kind: "downtime", date: "' + iso + '", time: "11:18", to: "11:22", downtime: { cause: "power" }, basis: "pickling", src: "paste", pasteId: "PP1", at: 1 }); prodTouch()'); }, todayIso());
    const d = dmy(0);
    await mock(page, () => reply({ page: 'power', rows: [
      { date: d, event: 'Power cut', time: '11:16 AM' }, { date: d, event: 'Power in', time: '11:21 AM' },
      { date: d, event: 'Power cut', time: '11:26 AM' }, { date: d, event: 'Power in', time: '12:00 PM' }] }));
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoPower [data-prod-cut]')).toHaveCount(2);
    await expect(page.locator('#prodPhotoLine')).toHaveCount(0);
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const s = await readStoredState(page);
    const cuts = s.production.entries.filter((e: any) => e.kind === 'downtime');
    expect(cuts.map((e: any) => [e.time, e.to, e.basis, e.src])).toEqual([['11:18', '11:22', 'pickling', 'paste'], ['11:16', '11:21', 'register', 'photo'], ['11:26', '12:00', 'register', 'photo']]);
    expect(s.production.photos[0]).toMatchObject({ page: 'power', rows: 2 });
    // The day: 11:16–11:22 once (two reports), 11:26–12:00 its own cut though it began ten minutes after the first.
    const day = await page.evaluate((iso) => (0, eval)('prodDowntimeDay("' + iso + '")').map((x: any) => [x.time, x.to, x.min, x.reports]), todayIso());
    expect(day).toEqual([['11:16', '11:22', 6, 2], ['11:26', '12:00', 34, 1]]);
  });

  test('more of the register as it is kept: VAT-2, racks counted in two goes, 12:45 AM at noon, a figure where the part goes', async ({ page }) => {
    await boot(page);
    const r = await read(page, { page: 'production', date: dmy(0), line: 'VAT-2', rows: [
      { time: '11:45 AM', mark: 'START', customer: 'NOVA CLAMPS', part: 'CLAMP' },
      { time: '4:00 PM', mark: 'END', ditto: true, qtyText: '3+4×156' },
      { time: '4:10 PM', mark: 'END', customer: 'DURGA AUTO', part: 'TINA', qtyText: '25 NOS' },
      { time: '4:20 PM', mark: 'START', ditto: true, part: 'ROD' },
      { time: '4:45 PM', mark: 'END', ditto: true, qtyText: '+16×3' }] });
    expect(r.runs.map((x: any) => [x[0], x[2]])).toEqual([[11, 1092], [12, 25], [12, 48]]);
    expect(r.rowIssues[1]).toContain('grouped');       // said: 7 racks of 156, where plain arithmetic reads 627
    const rounds = await read(page, { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '11:30 AM', customer: 'NOVA CLAMPS', part: 'CLAMP', qtyText: '100' }, { time: '12:45 AM', ditto: true, qtyText: '100' }, { time: '1:05 PM', ditto: true, qtyText: '100' }] });
    expect(rounds.runs[0]).toEqual([11, 'CLAMP', 300, '11:30', '13:05']);
    expect(rounds.rowIssues[1]).toContain('meridiem');
    const power = await read(page, { page: 'power', rows: [{ date: dmy(0), event: 'Power cut', time: '12:05 AM' }, { date: dmy(0), event: 'Power in', time: '1:00 PM' }] });
    expect(power.down).toEqual([[todayIso(), '12:05', '13:00', false]]);
    expect(power.issues).toContain('amber:meridiem');
  });

  test('a customer\'s challan photographed into the register reader is handed to the challan scanner', async ({ page }) => {
    await boot(page);
    const calls = await mock(page, () => calls.length <= 1 ? reply({ page: 'challan', date: '18-9-26', rows: [] })
      : reply({ challanNo: '133', challanDate: todayIso(), clientName: 'Nova clamps', vehicleNo: '', items: [{ partNumber: 'DRAIN PLUG', desc: 'DRAIN PLUG', unit: 'NOS', qty: 500, nosQty: 500, rate: 0, amount: 0 }] }));
    await pick(page, PNG, 'challan.png');
    await expect(page.locator('#productionContent')).toContainText('a customer’s challan');
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeDisabled();
    await page.locator('[data-action="invProdToScanner"]').click();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect.poll(() => page.evaluate(() => (0, eval)('_challanForm && _challanForm.challanNo'))).toBe('133');
    expect(calls).toHaveLength(2);
    expect((await readStoredState(page)).production.photos).toHaveLength(0);
  });
});
