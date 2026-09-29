import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P92: a dialog holding what somebody typed is never shut unasked (owner, 29 Sep 2026: a tap outside the box closed
// it and everything entered was gone). A tap on the scrim or the head's × asks first, Keep editing leaves every
// field as typed, Discard closes. With nothing typed both close at once, as before; Cancel is a chosen discard.

function state(): SepState {
  const s = emptyState();
  s.clients = [{ id: 1, name: 'EXISTING CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  return s;
}
async function openAdd(page: Page, view: 'clients' | 'items') {
  await switchTab(page, 'pageClients');
  await page.locator(`[data-action="invSwitchSubView"][data-view="${view}"]`).first().click();
  await page.locator(`.inv-toolbar [data-action="${view === 'clients' ? 'invAddClient' : 'invAddItem'}"]`).click();
  await expect(page.locator('.inv-dialog-title')).toHaveText(view === 'clients' ? 'Add client' : 'Add item');
}
const tapOutside = (page: Page) => page.locator('.inv-scrim-dialog').first().click({ position: { x: 4, y: 4 } });
const clientCount = (page: Page) => page.evaluate(() => (0, eval)('S.clients.length'));

test.describe('P92: a dialog with typed work asks before closing', () => {
  test('a tap outside asks; Keep editing keeps every field; Discard closes and saves nothing', async ({ page }) => {
    await loadAppWithState(page, state());
    await openAdd(page, 'clients');
    await page.locator('#ceditName').fill('NEW PLATING CO');
    await page.locator('#ceditGstin').fill('20AAECS1234F1Z5');

    await tapOutside(page);
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('Discard what you typed?');
    expect(said).toContain('Keep editing');
    await expect(page.locator('#ceditName')).toHaveValue('NEW PLATING CO');
    await expect(page.locator('#ceditGstin')).toHaveValue('20AAECS1234F1Z5');

    await tapOutside(page);
    await answerAsk(page, 'ok');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect(await clientCount(page)).toBe(1);
  });

  test('the × asks too, and a typed form still saves as before', async ({ page }) => {
    await loadAppWithState(page, state());
    await openAdd(page, 'clients');
    await page.locator('#ceditName').fill('SECOND CO');
    await page.locator('.inv-dialog-close').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#ceditName')).toHaveValue('SECOND CO');
    await page.locator('[data-action="invSaveClient"][data-mode="add"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect(await clientCount(page)).toBe(2);
  });

  test('with nothing typed, a tap outside and the × close at once; Cancel never asks', async ({ page }) => {
    await loadAppWithState(page, state());
    await openAdd(page, 'clients');
    await tapOutside(page);
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);

    await page.locator('.inv-toolbar [data-action="invAddClient"]').click();
    await page.locator('.inv-dialog-close').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);

    await page.locator('.inv-toolbar [data-action="invAddClient"]').click();
    await page.locator('#ceditName').fill('THROWN AWAY');
    await page.locator('.inv-dialog-foot [data-action="invCloseOverlay"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
  });

  test('every form dialog gets it from the shell: Add item', async ({ page }) => {
    await loadAppWithState(page, state());
    await openAdd(page, 'items');
    await page.locator('#itemEditPN').fill('BRKT 77');
    await tapOutside(page);
    await answerAsk(page, 'cancel');
    await expect(page.locator('#itemEditPN')).toHaveValue('BRKT 77');
  });
});
