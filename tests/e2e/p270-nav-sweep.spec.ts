import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';

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
});
