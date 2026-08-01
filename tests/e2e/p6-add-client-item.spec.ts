import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P6 assertion: Client Master and Items Master both expose an explicit, labelled
// "Add" entry point (previously only Items had one, and only as a bare "+" FAB
// that was hidden on desktop). Covers the create path end-to-end plus the two
// guards that protect master-data integrity: required name and duplicate keys.

function stateWithOneClient(): SepState {
  const state = emptyState();
  state.clients = [
    { id: 1, name: 'EXISTING CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
  ];
  return state;
}

async function openClientsTab(page: Page): Promise<void> {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();
}

async function openItemsTab(page: Page): Promise<void> {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
}

test.describe('P6: explicit add entry points for clients and items', () => {

  test('positive: Add Client button creates a client with an opening rate', async ({ page }) => {
    await loadAppWithState(page, stateWithOneClient());
    await openClientsTab(page);

    await page.locator('.inv-toolbar-add[data-action="invAddClient"]').click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add Client');

    await page.locator('#ceditName').fill('NEW PLATING CO');
    await page.locator('#ceditGstin').fill('20AAECS1234F1Z5');
    await page.locator('#ceditMobile').fill('9800000000');
    await page.locator('#ceditMode').selectOption('weight');
    await page.locator('#ceditNewRate').fill('14.25');
    await page.locator('[data-action="invSaveClient"][data-mode="add"]').click();

    // Overlay closes and the new client appears in the list.
    await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
    await expect(page.locator('#clientList')).toContainText('NEW PLATING CO');

    // Persisted with the opening rate attached to the rate history.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state') || '{}';
      const s = JSON.parse(raw) as { clients: Array<{ name: string; mobile?: string; rates?: Array<{ ratePerKg: number }> }> };
      return s.clients.find((c) => c.name === 'NEW PLATING CO');
    });
    expect(saved).toBeTruthy();
    expect(saved!.mobile).toBe('9800000000');
    expect(saved!.rates?.[0]?.ratePerKg).toBe(14.25);
  });

  test('guard: duplicate client name is rejected', async ({ page }) => {
    await loadAppWithState(page, stateWithOneClient());
    await openClientsTab(page);

    await page.locator('.inv-toolbar-add[data-action="invAddClient"]').click();
    await page.locator('#ceditName').fill('existing client');
    await page.locator('[data-action="invSaveClient"][data-mode="add"]').click();

    // Overlay stays open, nothing added.
    await expect(page.locator('.inv-overlay-card')).toBeVisible();
    const count = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state') || '{}';
      return (JSON.parse(raw) as { clients: unknown[] }).clients.length;
    });
    expect(count).toBe(1);
  });

  test('guard: blank client name is rejected', async ({ page }) => {
    await loadAppWithState(page, stateWithOneClient());
    await openClientsTab(page);

    await page.locator('.inv-toolbar-add[data-action="invAddClient"]').click();
    await page.locator('[data-action="invSaveClient"][data-mode="add"]').click();

    await expect(page.locator('.inv-overlay-card')).toBeVisible();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add Client');
  });

  test('positive: Add Item button creates an item in Items Master', async ({ page }) => {
    await loadAppWithState(page, stateWithOneClient());
    await openItemsTab(page);

    await page.locator('.inv-toolbar-add[data-action="invAddItem"]').click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add Item');

    await page.locator('#itemEditPN').fill('15020030');
    await page.locator('#itemEditDesc').fill('188 CD');
    await page.locator('#itemEditRate').fill('9');
    await page.locator('[data-action="invSaveItem"][data-mode="add"]').click();

    await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
    await expect(page.locator('#itemsList')).toContainText('15020030');
  });

  test('guard: duplicate part number is rejected', async ({ page }) => {
    const state = stateWithOneClient();
    state.items = [{ id: 1, partNumber: '15020030', desc: '188 CD', hsn: '998873', unit: 'KG', rate: 9, stdWeightKg: null }];
    await loadAppWithState(page, state);
    await openItemsTab(page);

    await page.locator('.inv-toolbar-add[data-action="invAddItem"]').click();
    await page.locator('#itemEditPN').fill('15020030');
    await page.locator('[data-action="invSaveItem"][data-mode="add"]').click();

    await expect(page.locator('.inv-overlay-card')).toBeVisible();
    const count = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state') || '{}';
      return (JSON.parse(raw) as { items: unknown[] }).items.length;
    });
    expect(count).toBe(1);
  });

});
