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
    expect(e[0].rounds).toEqual([{ time: '9:20', qty: 108 }, { time: '10:15', qty: 108 }]);
    expect(e[0].date).toBe(todayIso());
    expect(s.production.photos).toHaveLength(1);
    const ph = s.production.photos[0];
    expect(ph).toMatchObject({ model: 'gemini-2.5-flash', promptVer: 'reg-v1', readLine: 'vat-a1', rows: 4, name: 'register.png' });
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

  test('no key: the app says where to set it, and hand entry needs none', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => localStorage.removeItem('sep_inv_gemini_key'));
    await page.locator('#pageProduction [data-action="invProdPhoto"]').click();
    await expect(page.locator('[data-ui-ask]')).toContainText('Settings → Connections');
  });
});
