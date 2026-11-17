import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P267 (owner, 17 Nov 2026): "build an infrastructure to work with what we have got, as in photos from [the floor] or me, we will start
// tagging it and start data logging to the app and database." He adds the photos sent to him; the picture stays on his device, the log
// goes in the book; tagged at upload, later from a queue, or with Claude's suggestion confirmed by a person. Anthropic's API is faked
// at the route layer. Every name, area and figure is made up.

const T = todayIso();
const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
const RUN = { id: 'R1', kind: 'plated', date: T, time: '10:00', to: '11:00', slot: 'general', line: 'vat-a1', lineSrc: 'written', clientId: 11, client: 'NOVA',
  part: 'BRACKET 7101', qty: 300, unit: 'NOS', basis: 'register', src: 'hand', by: 'T', at: 1 };
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

async function open(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), staff: [{ id: 1, name: 'RAVI', active: true }],
    production: { entries: [RUN], pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {}, lines: {} } } } as unknown as SepState);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="photos"]').click();
}
/* Pictures of different colours (the log keys a picture by its bytes), with the minute the file says it was made. */
const addPhotos = (page: Page, colours: string[], hhmm: string) => page.evaluate(([cs, t, day]) => Promise.all((cs as string[]).map(c => new Promise<File>(ok => {
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30;
  const x = cv.getContext('2d')!; x.fillStyle = c; x.fillRect(0, 0, 40, 30);
  cv.toBlob(b => ok(new File([b!], c + '.png', { type: 'image/png', lastModified: new Date(day + 'T' + t + ':00').getTime() })), 'image/png');
}))).then(files => (window as any).fphAddFiles(files)), [colours, hhmm, T]);

test.describe('P267: floor photos, logged and tagged', () => {
  test('areas, photos added and tagged, the queue, the record within an hour, a photo twice', async ({ page }) => {
    await open(page);
    await expect(page.locator('#fphVerdict')).toContainText('No floor photos yet');
    // The areas are the book's, typed once, with their questions.
    await page.locator('[data-action="invFphAreas"]').click();
    await page.locator('#fphAreasAdd').fill('VAT A1\nIn Gate');
    await page.locator('[data-action="invFphAreasSave"]').click();
    let s = await readStoredState(page);
    const vat = s.floorPhotos.areas[0].id;
    await page.locator(`#fphAreaLine_${vat}`).selectOption('vat-a1');
    await page.locator(`#fphAreaQs_${vat}`).fill('Line loaded?\nRacks in the bath #\nWhat is waiting');
    await page.locator('[data-action="invFphAreasSave"]').click();
    s = await readStoredState(page);
    expect(s.floorPhotos.areas.map((a: any) => [a.name, a.line, a.questions.map((q: any) => [q.id, q.text, q.kind])])).toEqual([
      ['VAT A1', 'vat-a1', [['q1', 'Line loaded?', 'yesno'], ['q2', 'Racks in the bath', 'count'], ['q3', 'What is waiting', 'text']]],
      ['In Gate', '', []],
    ]);
    await page.locator('[data-action="invFphList"]').click();

    // Two photos: saved at once, untagged, dated from the file; the first opens to be tagged, its picture drawn from the device.
    await addPhotos(page, ['#a05030', '#3050a0'], '10:30');
    await expect(page.locator('img[data-kb-img]')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#fphTime')).toHaveValue('10:30');
    await page.locator('#fphArea').selectOption(vat);
    await page.locator('#fphSentBy').fill('RAVI');
    await page.locator('#fphQ_q1').selectOption('yes');
    await page.locator('#fphQ_q2').fill('4');
    await expect(page.locator('#fphNear')).toContainText('BRACKET 7101');
    await page.locator('[data-action="invFphSaveNext"]').click();
    // The next in the queue opens: left untagged, it stays in To tag.
    await expect(page.locator('#fphTime')).toBeVisible();
    await page.locator('[data-action="invFphClose"]').click();
    await expect(page.locator('#fphVerdict')).toContainText('2 photos in the log, 2 to tag');
    s = await readStoredState(page);
    const [p1, p2] = s.floorPhotos.photos;
    expect([p1.date, p1.time, p1.area, p1.sentBy, p1.tags]).toEqual([T, '10:30', vat, 'RAVI', { q1: 'yes', q2: 4 }]);
    // No image in the book: the picture stays on the device.
    expect(JSON.stringify(s.floorPhotos)).not.toMatch(/data:image|base64/);
    await page.locator('[data-action="invFphFilter"][data-todo="1"]').click();
    await expect(page.locator('[data-fph-row]')).toHaveCount(2);

    // The first finished: the third answer given, now tagged; one left.
    await page.locator(`[data-action="invFphOpen"][data-id="${p1.id}"]`).click();
    await page.locator('#fphQ_q3').fill('two racks');
    await page.locator('[data-action="invFphSave"]').click();
    await expect(page.locator('#fphVerdict')).toContainText('2 photos in the log, 1 to tag');
    // The same picture again is the same photo.
    await addPhotos(page, ['#a05030'], '10:30');
    await expect(page.locator('.inv-toast').last()).toContainText('already in the log');
    s = await readStoredState(page);
    expect(s.floorPhotos.photos.length).toBe(2);
    expect(p2.tags).toEqual({});
  });

  test("Claude suggests, a person keeps or changes it; a photo voided keeps its reason", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sep_inv_claude_key', 'sk-test'));
    let asked: any = null;
    await page.route('https://api.anthropic.com/**', async route => {
      asked = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify({ q1: true, q2: 6, q3: null, seen: 'A plating line with racks in the bath.' }) }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 300 } }) });
    });
    await open(page);
    await g(page, `fphData(true).areas.push({ id: 'FA1', name: 'VAT A1', line: 'vat-a1', questions: [fphQuestion('Line loaded?', 0), fphQuestion('Racks in the bath #', 1), fphQuestion('What is waiting', 2)] }); saveState()`);
    await addPhotos(page, ['#20a060'], '10:15');
    await page.locator('#fphArea').selectOption('FA1');
    await page.locator('[data-action="invFphClaude"]').click();
    await expect(page.locator('#fphQ_q2')).toHaveValue('6');
    await expect(page.locator('[data-fph-seen]')).toContainText('racks in the bath');
    // The question was asked with the area's own questions, and the picture.
    expect(Object.keys(asked.output_config.format.schema.properties)).toEqual(['q1', 'q2', 'q3', 'seen']);
    expect(asked.messages[0].content[0].type).toBe('image');
    // Nothing saved yet; the person changes the count and keeps the yes.
    let s = await readStoredState(page);
    expect(s.floorPhotos.photos[0].tags).toEqual({});
    await page.locator('#fphQ_q2').fill('5');
    await page.locator('#fphQ_q3').fill('nothing');
    await page.locator('[data-action="invFphSave"]').click();
    s = await readStoredState(page);
    const p = s.floorPhotos.photos[0];
    expect([p.tags, p.claudeKept, !!p.claudeRead]).toEqual([{ q1: 'yes', q2: 5, q3: 'nothing' }, ['q1'], true]);

    await page.locator(`[data-action="invFphOpen"][data-id="${p.id}"]`).click();
    await page.locator('[data-action="invFphVoid"]').click();
    await answerAsk(page, 'ok', 'blurred, taken again');
    s = await readStoredState(page);
    expect([s.floorPhotos.photos.length, s.floorPhotos.photos[0].voidReason]).toEqual([1, 'blurred, taken again']);
    await expect(page.locator('#fphVerdict')).toContainText('No floor photos yet');
  });
});
