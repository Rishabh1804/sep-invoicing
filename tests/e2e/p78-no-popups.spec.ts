import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab, answerAsk, openSettingsAt } from './fixtures';
import { partState } from './p77-part-invoice.fixture';

// P78: no browser pop-ups (owner, 27 Sep 2026: "make sure in case of browser pop-up failure there is another
// way that the message or error gets relayed - in all places in our app"). Every confirm(), alert() and prompt()
// is now uiConfirm / uiAlert / uiPrompt (state.js): a dialog in the app's one shell. Here the browser's own
// three are made to THROW, the flows that used them are walked, and each must ask in the app and never call
// them. Then the shell itself is made to fail, and the message must still reach the screen as a banner — with a
// question that could not be asked answered "cancel", so nothing destructive happens unseen.

async function armNativeTraps(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__native = [];
    for (const k of ['confirm', 'alert', 'prompt']) {
      w[k] = (...a: unknown[]) => { w.__native.push(k + ': ' + String(a[0])); throw new Error('native ' + k + ' called'); };
    }
  });
}
const nativeCalls = (page: Page) => page.evaluate(() => (window as any).__native as string[]);
// Runs a handler the way its button does, without waiting on the question it asks.
const g = (page: Page, expr: string) => page.evaluate(e => { (0, eval)(e); }, expr);

function state() {
  const s: any = partState();
  s.items = [{ id: 11, partNumber: 'TEST ITEM 11', desc: 'Test item', unit: 'KG', hsn: '998873' }];
  s.costBills = [{ id: 'CB1', kind: 'power', month: '2026-08', amount: 1000, units: null, note: '', at: 1 }];
  s.partWeights = { 'TEST PART 9': 0.25 };
  return s;
}

test('every flow that used a browser pop-up asks in the app instead, and the browser is never called', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await armNativeTraps(page);
  await loadAppWithState(page, state());

  // Delete a challan: asked, danger-toned; Cancel keeps it, Delete removes it.
  await switchTab(page, 'pageIM');
  await g(page, "deleteChallan('IM-401')");
  const ask = page.locator('[data-ui-ask]');
  await expect(ask).toContainText('Delete this challan?');
  await expect(ask).toContainText('Challan 401 from KG TEST WORKS, 1 line. This cannot be undone.');
  await expect(ask.locator('[data-ans="ok"]')).toHaveClass(/inv-btn-danger/);
  // Focus starts on Cancel before a destructive act.
  await expect(ask.locator('[data-ans="cancel"]')).toBeFocused();
  await answerAsk(page, 'cancel');
  expect((await readStoredState(page)).incomingMaterial.map((m: any) => m.id)).toContain('IM-401');
  await g(page, "deleteChallan('IM-401')");
  await answerAsk(page, 'ok');
  await expect.poll(async () => (await readStoredState(page)).incomingMaterial.map((m: any) => m.id)).not.toContain('IM-401');

  // Esc answers cancel too.
  await g(page, 'deleteItem(11)');
  await expect(ask).toContainText('Delete TEST ITEM 11?');
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  expect((await readStoredState(page)).items).toHaveLength(1);
  await g(page, 'deleteItem(11)');
  await answerAsk(page, 'ok');
  await expect.poll(async () => (await readStoredState(page)).items.length).toBe(0);

  // A part weight.
  await g(page, "deletePartWeight('TEST PART 9')");
  expect(await answerAsk(page, 'ok')).toContain('Delete weight for TEST PART 9?');
  await expect.poll(async () => Object.keys((await readStoredState(page)).partWeights)).toEqual([]);

  // A void asks for its reason in the app: blank is refused in place, a reason voids.
  await g(page, "costBillVoid('CB1', 'stats')");
  const input = ask.locator('[data-ui-ask-input]');
  await expect(input).toBeFocused();
  await ask.locator('[data-ans="ok"]').click();
  await expect(ask.locator('[data-ui-ask-err]')).toBeVisible();
  await expect(ask).toHaveCount(1);
  await input.fill('Entered for the wrong month');
  await input.press('Enter');
  await expect(ask).toHaveCount(0);
  await expect.poll(async () => (await readStoredState(page)).costBills[0].voidReason).toBe('Entered for the wrong month');

  // Settings closed with a section edited: asked, and Keep editing keeps it open.
  await openSettingsAt(page, 'company');
  await page.locator('#setCompName').fill('SOMEONE ELSE');
  await page.locator('[data-action="invCloseSettings"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Close without saving?');
  await expect(page.locator('#settingsScrim')).toHaveCount(1);
  await page.locator('[data-action="invCloseSettings"]').click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#settingsScrim')).toHaveCount(0);

  // An over-bill asks under its line, not in a box (P78 limit reasons).
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('samarth');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-301"]').check();
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('650');
  await expect(page.locator('#invImShare0 [data-ack="over"]')).toBeVisible();

  expect(await nativeCalls(page)).toEqual([]);
  expect(dialogs).toEqual([]);
});

test('the stock reorder list, when the clipboard refuses, shows the order to copy by hand', async ({ page }) => {
  await armNativeTraps(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await loadAppWithState(page, state());
  await g(page, 'stockReorderCopy()');
  const ask = page.locator('[data-ui-ask][data-ui-kind="alert"]');
  await expect(ask).toContainText('Copy the order');
  await expect(ask).toContainText('could not be copied by itself');
  await answerAsk(page, 'ok');
  expect(await nativeCalls(page)).toEqual([]);
});

test('a dialog that cannot be drawn still says its message, and a question it could not ask is answered no', async ({ page }) => {
  await armNativeTraps(page);
  await loadAppWithState(page, state());
  await page.evaluate(() => { (window as any).dialogOpen = () => { throw new Error('the shell is broken'); }; });

  await g(page, "deleteChallan('IM-401')");
  const bar = page.locator('.inv-notice-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Could not show this question, so nothing was done');
  await expect(bar).toContainText('Delete this challan? Challan 401 from KG TEST WORKS');
  // Nothing destructive happened unseen.
  expect((await readStoredState(page)).incomingMaterial.map((m: any) => m.id)).toContain('IM-401');

  // A message (an alert) is kept in full, joining the banner rather than covering it.
  await page.evaluate(() => (window as any).uiAlert({ title: 'Copy the order', body: 'Line one\nLine two' }));
  await expect(bar.locator('.inv-notice-text')).toHaveCount(2);
  await expect(bar.locator('.inv-notice-text').nth(1)).toHaveText('Copy the order: Line one Line two');
  // A prompt that could not be shown answers null: no void without a reason seen.
  expect(await page.evaluate(() => (window as any).uiPrompt({ title: 'Void this payment', label: 'Why?' }))).toBeNull();
  await expect(bar.locator('.inv-notice-text')).toHaveCount(3);

  // It stays until dismissed (a toast would have gone in seconds).
  await page.waitForTimeout(4500);
  await expect(bar).toBeVisible();
  await bar.locator('[data-action="invNoticeDismiss"]').click();
  await expect(bar).toHaveCount(0);
  expect(await nativeCalls(page)).toEqual([]);
});

test('an error nothing caught reaches the screen, not only the console', async ({ page }) => {
  await loadAppWithState(page, state());
  await page.evaluate(() => { setTimeout(() => { throw new Error('a test fault'); }, 0); });
  await expect(page.locator('.inv-notice-bar')).toContainText('Something went wrong: ');
  await expect(page.locator('.inv-notice-bar')).toContainText('a test fault');
  await page.evaluate(() => { Promise.reject(new Error('a rejected test promise')); });
  await expect(page.locator('.inv-notice-bar .inv-notice-text')).toHaveCount(2);
});
