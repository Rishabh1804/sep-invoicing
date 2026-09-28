import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

// P85: one way to ask Gemini to read a photo (vision.js). The challan scanner moved onto it and its request must be
// byte for byte what it always sent: the original image and the prompt, no schema, no generationConfig.

// A real 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(obj) + '\n```' }] }, finishReason: 'STOP' }] });

async function boot(page: Page) {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  await loadAppWithState(page, s);
  await page.evaluate(() => { try { localStorage.setItem('sep_inv_gemini_key', 'TEST-KEY'); } catch (e) {} });
}

test('the challan scanner sends exactly what it always sent, and the reply fills the challan form', async ({ page }) => {
  await boot(page);
  let seen: any = null, url = '';
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    url = route.request().url();
    seen = route.request().postData();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply({ challanNo: '41', challanDate: '2026-09-20', clientName: 'Kestrel Auto', vehicleNo: 'JH05 X 1',
      items: [{ partNumber: 'BRKT-9', desc: 'BRKT-9', unit: 'KG', qty: 12.5, nosQty: 40, rate: 0, amount: 0 }] })) });
  });
  await switchTab(page, 'pageIM');
  await ev(page, `showAddChallanForm()`);
  await ev(page, `scanChallan()`);
  await page.setInputFiles('#scanFileInput', { name: 'challan.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => seen).not.toBeNull();
  expect(url).toContain('models/gemini-2.5-flash:generateContent?key=TEST-KEY');
  const prompt = await ev(page, `_scanExtractionPrompt`);
  // The golden body: what scanner.js built by hand before vision.js existed.
  expect(seen).toBe(JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data: PNG.toString('base64') } }, { text: prompt }] }] }));
  await expect.poll(() => ev(page, `_challanForm && _challanForm.items.length && _challanForm.items[0].partNumber`)).toBe('BRKT-9');
  expect(await ev(page, `_challanForm.challanNo`)).toBe('41');
  expect(await ev(page, `_challanForm.items[0].nosQty`)).toBe(40);
});

test('the scanner keeps its own messages when Gemini fails, and clears its overlay', async ({ page }) => {
  await boot(page);
  await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid' } }) }));
  await switchTab(page, 'pageIM');
  await ev(page, `showAddChallanForm()`);
  await ev(page, `scanChallan()`);
  await page.setInputFiles('#scanFileInput', { name: 'c.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('.inv-toast, #toast').filter({ hasText: 'API error: API key not valid' }).first()).toBeVisible();
  await expect(page.locator('#scanProcessing')).toBeEmpty();
});

test('a read that never answers times out and says so, rather than spinning for ever', async ({ page }) => {
  await boot(page);
  await page.route('https://generativelanguage.googleapis.com/**', () => { /* never answered */ });
  await page.evaluate(() => { (window as any).GEMINI_TIMEOUT_MS = 300; });
  await switchTab(page, 'pageIM');
  await ev(page, `showAddChallanForm()`);
  await ev(page, `scanChallan()`);
  await page.setInputFiles('#scanFileInput', { name: 'c.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#scanProcessing')).toBeEmpty({ timeout: 5000 });
  await expect(page.getByText(/Scan failed: Gemini did not answer/).first()).toBeVisible();
});

test('geminiReadReply names each way a reply can fail', async ({ page }) => {
  await boot(page);
  const r = await ev(page, `JSON.stringify([
    geminiReadReply({}, true).code,
    geminiReadReply({ promptFeedback: { blockReason: 'SAFETY' } }, true).code,
    geminiReadReply({ candidates: [{ content: { parts: [{ text: '{"a":' }] }, finishReason: 'MAX_TOKENS' }] }, true).code,
    geminiReadReply({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }, true).code,
    geminiReadReply({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }, true).json.a
  ])`);
  expect(JSON.parse(r as string)).toEqual(['empty', 'blocked', 'truncated', 'json', 1]);
});
