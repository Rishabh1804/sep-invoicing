import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { longBook } from './load-fixture';

// P270: the navigation sweep (17 Nov 2026). Screens added since the navigation step had no line in navLoc / navApply, so Back,
// a reload and a link did not know them. Every name and figure is made up.

const T = todayIso();
const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
const RUN = { id: 'R1', kind: 'plated', date: T, time: '10:00', to: '11:00', slot: 'general', line: 'vat-a1', lineSrc: 'written', clientId: 11, client: 'NOVA',
  part: 'BRACKET 7101', qty: 300, unit: 'NOS', basis: 'register', src: 'hand', by: 'T', at: 1 };
const LOAD = { id: 'L1', kind: 'pickled', date: T, time: '09:00', clientId: 11, client: 'NOVA', part: 'BRACKET 7101', qty: 300, unit: 'NOS',
  basis: 'pickling', src: 'hand', by: 'T', at: 1 };
const PHOTOS = [
  { id: 'FP1', img: 'nopicture1', date: T, time: '10:30', area: 'A1', sentBy: '', tags: {}, by: 'T', at: 1 },
  { id: 'FP2', img: 'nopicture2', date: T, time: '11:30', area: '', sentBy: '', tags: {}, by: 'T', at: 2 },
];
// A register page as Claude answers it (P257's shape); Anthropic's API is faked at the route layer.
const dmy = (iso: string) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y.slice(2); };
const REG_PAGE = { page: 'production', date: dmy(T), weekday: '', line: 'VAT-A1', dayTotal: null,
  rows: [{ time: '9:20 AM', mark: '', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qtyText: '108', struck: false, over: '', bracket: false, ditto: false, legible: true, event: '', date: '' }] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '', u.searchParams.get('id') || '']; };

async function open(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), staff: [{ id: 1, name: 'RAVI', active: true }],
    production: { entries: [RUN, LOAD], pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {}, lines: {} } },
    floorPhotos: { areas: [{ id: 'A1', name: 'VAT A1', line: 'vat-a1', questions: [] }], photos: PHOTOS } } as unknown as SepState);
  await switchTab(page, 'pageProduction');
}

test.describe('P270: navigation sweep', () => {
  test('Production → Photos: a photo being tagged and Areas are places; Back comes back to the log, a reload stays', async ({ page }) => {
    await open(page);
    await page.locator('[data-action="invProdTab"][data-tab="photos"]').click();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'photos', '']);
    // A photo opened to be tagged: its own step. Back is the log, not the screen before Photos.
    await page.locator('[data-action="invFphOpen"][data-id="FP2"]').click();
    await expect(page.locator('#fphTime')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'photos', 'FP2']);
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#fphTime')).toHaveValue('11:30');
    await page.goBack();
    await expect(page.locator('#fphVerdict')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'photos', '']);
    expect(await g(page, '_fphOpen')).toBeNull();
    // Areas is a place too.
    await page.locator('[data-action="invFphAreas"]').click();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'photos/areas', '']);
    await page.goBack();
    await expect(page.locator('#fphVerdict')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#fphAreasAdd')).toBeVisible();
    // Typed in Areas, its own way back asks before the words go (a sub-view's back button, P103's rule); Stay keeps them.
    await page.locator('#fphAreasAdd').fill('IN GATE');
    await page.locator('[data-action="invFphList"]').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#fphAreasAdd')).toHaveValue('IN GATE');
    await page.locator('[data-action="invFphList"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#fphVerdict')).toBeVisible();
    // A link to a photo opens it; one not in the log opens the log.
    await page.goto('/?tab=pageProduction&v=photos&id=FP1');
    await waitForBoot(page);
    await expect(page.locator('#fphArea')).toHaveValue('A1');
    await page.goto('/?tab=pageProduction&v=photos&id=FP9');
    await waitForBoot(page);
    await expect(page.locator('#fphVerdict')).toBeVisible();
    expect(where(page)).toEqual(['pageProduction', 'photos', '']);
  });

  test('Production → Lines: the line on screen is in the address; a reload stays on Pickling, Back walks the lines', async ({ page }) => {
    await open(page);
    await page.locator('[data-action="invProdTab"][data-tab="lines"]').click();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'lines', '']);
    await page.locator('[data-action="invProdLine"][data-line="pickling"]').click();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'lines/pickling', '']);
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('[data-action="invProdLine"][data-line="pickling"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-action="invProdLine"][data-line="barrel"]').click();
    await expect.poll(() => where(page)[1]).toBe('lines/barrel');
    await page.goBack();
    await expect(page.locator('[data-action="invProdLine"][data-line="pickling"]')).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page.locator('[data-action="invProdLine"][data-line="vat-a1"]')).toHaveAttribute('aria-pressed', 'true');
    // A link names the line; the top bar's trail names it too (desktop) and the address of the first line is the plain one.
    await page.goto('/?tab=pageProduction&v=lines/vat-a2');
    await waitForBoot(page);
    await expect(page.locator('[data-action="invProdLine"][data-line="vat-a2"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await g(page, `navLabel({ tab: 'pageProduction', v: 'lines/pickling' }).sub`)).toBe('Lines · Pickling');
  });

  test('Production → the register photo’s check is a place: Back from it is Lines, and the next photo picked is read', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { localStorage.setItem('sep_inv_claude_key', 'sk-ant-test'); localStorage.removeItem('sep_inv_prod_photo_read'); });
    await page.route('https://api.anthropic.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(REG_PAGE) }],
      stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 1500 } }) }));
    await page.locator('[data-action="invProdTab"][data-tab="lines"]').click();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'lines', '']);
    await page.setInputFiles('#prodPhotoInput', { name: 'register.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'lines/photo', '']);
    // Back is Lines, where the photo was picked, and the photo checked goes with the check.
    await page.goBack();
    await expect(page.locator('[data-action="invProdLine"]').first()).toBeVisible();
    expect(where(page)).toEqual(['pageProduction', 'lines', '']);
    expect(await g(page, '_prodPhoto')).toBeNull();
    // The next photo picked opens its check (a photo left behind had made the pick do nothing).
    await page.setInputFiles('#prodPhotoInput', { name: 'register2.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.from([0, 1, 2])]) });
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeVisible();
    // A reload cannot bring a photo back (it was never saved): the address opens Lines.
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('[data-action="invProdLine"]').first()).toBeVisible();
    expect(where(page)).toEqual(['pageProduction', 'lines', '']);
  });

  test('Back comes back to the rows the screen was left at, not its top; a tap moving on the next screen still opens at its top', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageRegister');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(700);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
    // Floor from the phone's bar (it stays on screen): a move, at the top.
    await page.locator('.inv-navbar-item[data-ws="floor"]').click();
    await expect(page.locator('#pageRegister')).not.toHaveClass(/inv-page-active/);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Back: Invoices, where it was left.
    await page.goBack();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
    // The top bar's arrow is the same Back.
    await page.locator('.inv-navbar-item[data-ws="floor"]').click();
    await expect(page.locator('#pageRegister')).not.toHaveClass(/inv-page-active/);
    await page.locator('#navBack').click();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
  });

  test('focus goes back to what opened a dialog, even where a save drew it again', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageClients');
    const row = page.locator('#pageClients [data-action="invEditClient"]').nth(1);
    const id = await row.getAttribute('data-id');
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
    await page.locator('.inv-scrim-dialog input').first().fill('OMEGA RENAMED WORKS');
    await page.locator('.inv-scrim-dialog [data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    // The list was drawn again under the dialog: the client's row, drawn again, has the focus (it fell to the page's body).
    await expect.poll(() => page.evaluate(() => { const a = document.activeElement as HTMLElement; return a && a.dataset ? [a.dataset.action, a.dataset.id] : null; }))
      .toEqual(['invEditClient', id]);
    // Escape on a dialog with nothing redrawn: the same row, as before.
    await page.locator(`#pageClients [data-action="invEditClient"][data-id="${id}"]`).press('Enter');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement).dataset.id)).toBe(id);
  });
});
