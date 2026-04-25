import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P5 assertion: piece-mode NOS line items show a clear affordance that the rate
// field is readonly because it's set from the client's piece-mode profile —
// `.inv-form-input-readonly` class (italic) + `title=` tooltip + `readonly` attr.
//
// Test shape per Aurelius's ratified triad idiom:
//   1. Positive — affordance renders on piece+NOS rows
//   2. Positive regression A — wrong unit (piece+KG): affordance absent, field editable
//   3. Positive regression B — wrong mode (kg+NOS): affordance absent, field editable
//
// Drives the form via UI clicks: `_preselectedClientId` (a `var`-scoped global)
// auto-selects our seeded client when the Create form initializes; we then click
// "Add Line Item" and toggle the unit select to NOS. `invoiceForm` itself is
// `let`-scoped and not reachable from a Playwright eval context.

const READONLY_TOOLTIP_FRAGMENT = /piece-mode profile/;

function makeStateWith(billingMode: 'piece' | 'kg'): SepState {
  const state = emptyState();
  state.clients = [
    { id: 99, name: 'P5 TEST CLIENT', billingMode, gstType: 'intra', gstin: '', address: '' },
  ];
  return state;
}

async function setupRow(page: Page, billingMode: 'piece' | 'kg', unit: 'NOS' | 'KG'): Promise<void> {
  await loadAppWithState(page, makeStateWith(billingMode));

  // Seed the preselect so initCreateForm() locks our client in. Stored as string
  // because the production code path reads from `btn.dataset.clientId` which is
  // always a string; `parseInt` happens inside initCreateForm.
  await page.evaluate(() => { (window as unknown as Record<string, unknown>)._preselectedClientId = '99'; });

  // Land on the Create form via the standard action.
  await page.locator('[data-action="invCreateNew"]').first().click();
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();

  // Add an empty line item (defaults to unit=KG, rate=0).
  await page.locator('[data-action="invAddLineItem"]').click();

  if (unit === 'NOS') {
    // Toggle the row's unit to NOS — fires data-action="invUpdateLine" which
    // re-renders the form so the rate field picks up the new affordance state.
    await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('NOS');
  }
}

test.describe('P5: piece-mode NOS readonly affordance on rate field', () => {

  test('positive: piece+NOS row shows readonly + class + tooltip on rate field', async ({ page }) => {
    await setupRow(page, 'piece', 'NOS');

    const rate = page.locator('input[data-field="rate"][data-idx="0"]');
    await expect(rate).toBeVisible();

    // All three signals of the affordance must be present.
    await expect(rate).toHaveClass(/inv-form-input-readonly/);
    await expect(rate).toHaveAttribute('title', READONLY_TOOLTIP_FRAGMENT);
    await expect(rate).toHaveAttribute('readonly', '');
  });

  test('positive regression A: piece+KG row has no readonly affordance on rate field', async ({ page }) => {
    await setupRow(page, 'piece', 'KG');

    const rate = page.locator('input[data-field="rate"][data-idx="0"]');
    await expect(rate).toBeVisible();

    // Affordance must NOT shadow an editable field.
    await expect(rate).not.toHaveClass(/inv-form-input-readonly/);
    await expect(rate).not.toHaveAttribute('title', READONLY_TOOLTIP_FRAGMENT);
    await expect(rate).not.toHaveAttribute('readonly', '');
  });

  test('positive regression B: kg+NOS row has no readonly affordance on rate field', async ({ page }) => {
    await setupRow(page, 'kg', 'NOS');

    const rate = page.locator('input[data-field="rate"][data-idx="0"]');
    await expect(rate).toBeVisible();

    await expect(rate).not.toHaveClass(/inv-form-input-readonly/);
    await expect(rate).not.toHaveAttribute('title', READONLY_TOOLTIP_FRAGMENT);
    await expect(rate).not.toHaveAttribute('readonly', '');
  });

});
