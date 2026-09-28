import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P84: the paste check. Every message beside what was read; a name nobody holds is red until it is picked or kept
// as written; one pick answers for the whole paste and is remembered; the same message is never counted twice.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
function dmy(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
const PASTE = () => `${dmy(-1)}, 9:40 am - Pickler: NOVA CLAMPS
CLAMP133×83(35×6)-774 nos
Pickling Time 9:00AM
${dmy(-1)}, 11:05 am - Pickler: KUMAR
0140- 300 nos
Pickling time 10:30am
${dmy(-1)}, 2:05 pm - Pickler: KUMAR
0101--200 nos
Pickling time 1:50pm
${dmy(-1)}, 3:00 pm - Owner: ok`;

async function load(page: Page, extra: any = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), ...extra } as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction [data-action="invProdPaste"]').click();
  await page.locator('#prodPasteText').fill(text);
  await page.locator('[data-action="invProdRead"]').click();
}

test.describe('P84: the paste check', () => {
  test('read, asked, answered once for the paste, saved, remembered, never twice', async ({ page }) => {
    await load(page);
    await paste(page, PASTE());
    const save = page.locator('[data-action="invProdSaveReview"]');
    // "KUMAR" is a name the book does not hold: red on both its loads, and Save waits.
    await expect(page.locator('[data-prod-row][data-tone="red"]')).toHaveCount(2);
    await expect(save).toBeDisabled();
    await expect(page.locator('[data-prod-row="0:0"]')).toHaveAttribute('data-tone', 'clear');
    await expect(page.locator('[data-prod-row="0:0"] .inv-quote')).toHaveText('CLAMP133×83(35×6)-774 nos');
    // The chat's own line is shown and not read, never dropped.
    await expect(page.locator('[data-prod-msg="3"]')).toContainText('Not read');
    // One pick answers both rows of the name.
    await page.locator('[data-prod-client="1:0"]').selectOption('12');
    await expect(page.locator('[data-prod-row][data-tone="red"]')).toHaveCount(0);
    await expect(page.locator('[data-prod-row="2:0"] .inv-verdict-text')).toContainText('DURGA AUTO');
    await expect(save).toBeEnabled();
    await save.click();
    let s = await readStoredState(page);
    const e = s.production.entries;
    expect(e).toHaveLength(3);
    expect(e.map((x: any) => [x.kind, x.clientId, x.qty, x.time])).toEqual([['pickled', 11, 774, '09:00'], ['pickled', 12, 300, '10:30'], ['pickled', 12, 200, '13:50']]);
    expect(e[1]).toMatchObject({ basis: 'pickling', src: 'paste', raw: '0140- 300 nos', sentBy: 'Pickler' });
    expect(s.production.pastes).toHaveLength(3);
    expect(s.production.learn.clients).toEqual({ KUMAR: 12 });

    // Next time the spelling is known; the messages saved are refused, so nothing counts twice.
    await paste(page, PASTE() + `\n${dmy(0)}, 9:10 am - Pickler: KUMAR\n0140--50 nos\nPickling time 9:00am`);
    await expect(page.locator('#prodDupNote')).toContainText('3 messages');
    await expect(page.locator('[data-prod-row][data-tone="red"]')).toHaveCount(0);
    await expect(page.locator('[data-prod-row="4:0"] .inv-verdict-text')).toContainText('DURGA AUTO');
    await page.locator('[data-action="invProdSaveReview"]').click();
    s = await readStoredState(page);
    expect(s.production.entries).toHaveLength(4);
  });

  test('kept as written; a message whose entries were all voided can be read again', async ({ page }) => {
    await load(page);
    const one = `${dmy(-1)}, 10:45 am - Pickler: SIYA ENTERPRISES\nBuckle hook--200 nos\nPickling time 10:40am`;
    await paste(page, one);
    await expect(page.locator('[data-action="invProdSaveReview"]')).toBeDisabled();
    await page.locator('[data-prod-client="0:0"]').selectOption('asWritten');
    await page.locator('[data-action="invProdSaveReview"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries[0]).toMatchObject({ client: 'SIYA ENTERPRISES', qty: 200 });
    expect(s.production.entries[0].clientId).toBeUndefined();
    expect(s.production.learn.clients).toEqual({});
    const id = s.production.entries[0].id;
    await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
    await page.locator(`[data-prod-entry="${id}"] [data-action="invProdVoid"]`).click();
    await answerAsk(page, 'ok', 'read wrong');
    await paste(page, one);
    await expect(page.locator('#prodDupNote')).toHaveCount(0);
    await page.locator('[data-prod-client="0:0"]').selectOption('asWritten');
    await page.locator('[data-action="invProdSaveReview"]').click();
    s = await readStoredState(page);
    expect(s.production.entries).toHaveLength(2);
  });

  test('a roll\'s production block: the line from the header above is only a suggestion', async ({ page }) => {
    await load(page, { staff: [{ id: 1, name: 'Arun', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }] });
    await paste(page, `${dmy(-1)}, 8:40 pm - Supervisor: ${dmy(-1)}/ out time\n----8:00 PM---\n---berral---\n1) ARUN\n----production----\nDurga auto 0101--400 nos`);
    const row = page.locator('[data-prod-row="0:0"]');
    await expect(row).toHaveAttribute('data-tone', 'amber');
    await expect(row.locator('[data-action="invProdRevLine"][data-line="barrel"]')).toContainText('(header above)');
    // Saved without an answer, the line stays unknown; never the guess.
    await page.locator('[data-action="invProdSaveReview"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries[0]).toMatchObject({ kind: 'plated', slot: 'ot', to: '20:00', clientId: 12, qty: 400 });
    expect(s.production.entries[0].line).toBeUndefined();
    // Confirmed, it is the owner's: set.
    await page.evaluate(() => { const ev = (0, eval); ev('S.production.entries = []; S.production.pastes = []; prodTouch()'); });
    await paste(page, `${dmy(-2)}, 8:40 pm - Supervisor: ${dmy(-2)}/ out time\n----8:00 PM---\n---berral---\n1) ARUN\n----production----\nDurga auto 0101--300 nos`);
    await page.locator('[data-prod-row="0:0"] [data-action="invProdRevLine"][data-line="barrel"]').click();
    await expect(page.locator('[data-prod-row="0:0"]')).toHaveAttribute('data-tone', 'clear');
    await page.locator('[data-action="invProdSaveReview"]').click();
    s = await readStoredState(page);
    expect(s.production.entries[0]).toMatchObject({ line: 'barrel', lineSrc: 'set', qty: 300 });
  });
});
