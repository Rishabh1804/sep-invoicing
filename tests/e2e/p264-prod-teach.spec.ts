import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P264 (owner, 17 Nov 2026): a paste refused with "No pickling or production lines found in that text" "should lead the app
// user to enter data manually, referencing the whatsapp text or pasted text - the parser should learn from it and read
// messages better next time". A message of no known shape (a bare date, a line header, the work under it) opens Enter it
// from the text, a row a line with a figure; what is saved there teaches each line's shape, and the next message written
// that way is read. Made-up clients, the shapes of the messages that were refused.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
];
function shift(offset: number) { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset); return d; }
const dmy = (o: number) => { const d = shift(o); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
const iso = (o: number) => { const d = shift(o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const REFUSED = () => `${dmy(-2)}
----VAT A 1----
NOVA CLAMP 2400 NOS
LINEAR 500 NOS
${dmy(-1)}
----VAT A 2----
DURGA
T BKT 800 NOS`;

async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState);
  await switchTab(page, 'pageProduction');
}
async function paste(page: Page, text: string) {
  await page.locator('#pageProduction [data-action="invProdPaste"]').first().click();
  await page.locator('#prodPasteText').fill(text);
  await page.locator('[data-action="invProdRead"]').click();
}
const live = (s: any) => s.production.entries.filter((x: any) => !x.voidedAt).map((e: any) => [e.date, e.kind, e.line, e.slot, e.clientId, e.part, e.qty, e.unit, e.src, e.basis]);

test.describe('P264: a message no reader knows is entered from its text, and taught', () => {
  test('the refused message opens Enter it from the text, filled from what could be read', async ({ page }) => {
    await load(page);
    await paste(page, REFUSED());
    await expect(page.locator('#prodTeachNote')).toBeVisible();
    await expect(page.locator('[data-prod-teach-text]')).toContainText('LINEAR 500 NOS');
    await expect(page.locator('[data-prod-teach-row]')).toHaveCount(3);
    // The client named at the front, the line header above, the client line over the part: filled, and editable.
    await expect(page.locator('#prodTeachClient0_0')).toHaveValue('11');
    await expect(page.locator('#prodTeachLine0_0')).toHaveValue('vat-a1');
    await expect(page.locator('#prodTeachQty0_0')).toHaveValue('2400');
    await expect(page.locator('#prodTeachClient0_1')).toHaveValue('');
    await expect(page.locator('#prodTeachClient0_2')).toHaveValue('12');
    await expect(page.locator('#prodTeachPart0_2')).toHaveValue('T BKT');
    await expect(page.locator('#prodTeachLine0_2')).toHaveValue('vat-a2');

    // A row with no client is refused at Save, never saved as a guess.
    await page.locator('[data-action="invProdTeachSave"]').click();
    expect((await readStoredState(page)).production.entries.length).toBe(0);
    await page.locator('#prodTeachClient0_1').selectOption('11');
    await page.locator('#prodTeachLine0_1').selectOption('vat-a1');
    await page.locator('[data-action="invProdTeachSave"]').click();

    const s = await readStoredState(page);
    expect(live(s).sort()).toEqual([
      [iso(-2), 'plated', 'vat-a1', 'general', 11, 'CLAMP', 2400, 'NOS', 'hand', 'relay'],
      [iso(-2), 'plated', 'vat-a1', 'general', 11, 'LINEAR', 500, 'NOS', 'hand', 'relay'],
      [iso(-1), 'plated', 'vat-a2', 'general', 12, 'T BKT', 800, 'NOS', 'hand', 'relay'],
    ].sort());
    // Each line's shape is learnt, the figure masked; the client line over a part is part of its shape.
    expect(Object.keys(s.production.learn.lines).sort()).toEqual(['DURGA | T BKT # NOS', 'LINEAR # NOS', 'NOVA CLAMP # NOS']);
    expect(s.production.pastes.map((x: any) => x.kind)).toEqual(['taught']);
  });

  test('the next message written the same way is read as taught; the same text again is refused', async ({ page }) => {
    await load(page);
    await paste(page, REFUSED());
    await page.locator('#prodTeachClient0_1').selectOption('11');
    await page.locator('#prodTeachLine0_1').selectOption('vat-a1');
    await page.locator('[data-action="invProdTeachSave"]').click();

    // New figures, today, the same shape: read, said to be read as taught, and saved through the usual check.
    const next = `${dmy(0)}\n----VAT A 2----\nDURGA\nT BKT 650 NOS\nT BKT 120 NOS`;
    const read = await page.evaluate(t => (window as any).parseProdPaste(t, (window as any).prodCtx()).map((m: any) => ({
      kind: m.kind, items: m.read.items.map((it: any) => [it.date, it.clientId, it.part, it.qty, it.unit, it.line, it.issues.map((x: any) => x.code)]) })), next);
    expect(read).toEqual([{ kind: 'taught', items: [
      [iso(0), 12, 'T BKT', 650, 'NOS', 'vat-a2', ['taught']],
      [iso(0), 12, 'T BKT', 120, 'NOS', 'vat-a2', ['taught']],
    ] }]);
    await paste(page, next);
    await expect(page.locator('[data-prod-msg="0"]')).toContainText('Read as entered by hand before');
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    expect(live(s).filter((e: any) => e[0] === iso(0))).toEqual([
      [iso(0), 'plated', 'vat-a2', 'general', 12, 'T BKT', 650, 'NOS', 'paste', 'relay'],
      [iso(0), 'plated', 'vat-a2', 'general', 12, 'T BKT', 120, 'NOS', 'paste', 'relay'],
    ]);

    // The text entered by hand, pasted again: read now, and refused as saved before, so nothing counts twice.
    await paste(page, REFUSED());
    await expect(page.locator('#prodDupNote')).toBeVisible();
  });

  test('a message none of whose lines was taught is still not read: no guess from chatter', async ({ page }) => {
    await load(page);
    await paste(page, REFUSED());
    await page.locator('#prodTeachClient0_1').selectOption('11');
    await page.locator('[data-action="invProdTeachSave"]').click();
    const read = await page.evaluate(t => (window as any).parseProdPaste(t, (window as any).prodCtx()).map((m: any) => [m.kind, m.read.items.length]),
      'Send 20 kg acid tomorrow\nBhaiya call me after 5');
    expect(read).toEqual([['other', 0]]);
  });
});
