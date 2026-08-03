import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P8 assertion: the bulk weight-entry screen closes the gap Calc Weights
// structurally cannot — parts billed per piece have no KG line to derive a
// weight from, and without a weight there is no rupees-per-kg for them.
//
// The break-even figure is the point of the screen, so it gets the most
// attention here: at cost C, a piece rate R breaks even at R/C kg. Heavier
// than that and the piece is processed at a loss.

type Item = {
  id: number; partNumber: string; desc: string; gauge?: string;
  hsn: string; unit: string; rate: number; stdWeightKg: number | null;
};

const item = (
  id: number, partNumber: string, unit: string, rate: number,
  stdWeightKg: number | null = null, gauge = '',
): Item => ({ id, partNumber, desc: '', gauge, hsn: '998873', unit, rate, stdWeightKg });

function stateWith(items: Item[], cost = 7.5): SepState {
  const state = emptyState();
  state.items = items;
  state.defaultCostPerKg = cost;
  return state;
}

async function openEntry(page: import('@playwright/test').Page): Promise<void> {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
  await page.locator('[data-action="invOpenWeightEntry"]').click();
}

test.describe('P8: bulk weight entry', () => {

  test('lists only items missing a weight, and shows break-even against cost', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      item(1, 'CLAMP 165X83 (NT)', 'NOS', 4.88, null, '40X6'),
      item(2, 'ALREADY WEIGHED', 'NOS', 2.0, 0.25),
    ]));
    await openEntry(page);

    await expect(page.locator('.inv-overlay-title')).toHaveText('Enter Weights');
    await expect(page.locator('.inv-weight-row')).toHaveCount(1);
    await expect(page.locator('.inv-weight-row')).toContainText('CLAMP 165X83 (NT)');
    await expect(page.locator('.inv-weight-row')).not.toContainText('ALREADY WEIGHED');

    // 4.88 / 7.5 = 0.6507 -> 0.651 kg
    await expect(page.locator('.inv-weight-breakeven')).toContainText('0.651 kg');
    // The gauge rides along, since it is what distinguishes clamp variants.
    // Scoped to the row — the items list behind the overlay shows one too.
    await expect(page.locator('.inv-weight-row .inv-gauge-badge')).toHaveText('40X6');
  });

  test('typing a weight prices the part live, above and below break-even', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      item(1, 'CLAMP TEST', 'NOS', 4.88, null, '40X6'),
    ]));
    await openEntry(page);

    const input = page.locator('.inv-weight-input');
    const verdict = page.locator('.inv-weight-verdict');

    // Lighter than break-even -> earns more per kg than it costs.
    await input.fill('0.400');
    await expect(verdict).toContainText('12.20');       // 4.88 / 0.4
    await expect(verdict).toHaveClass(/inv-weight-ok/);

    // Heavier than break-even -> below the 7.50 cost.
    await input.fill('0.900');
    await expect(verdict).toContainText('5.42');        // 4.88 / 0.9
    await expect(verdict).toHaveClass(/inv-weight-bad/);

    // Clearing the field clears the verdict rather than leaving a stale one.
    await input.fill('');
    await expect(verdict).toHaveText('');
  });

  test('saves entered weights and skips blank rows', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      item(1, 'PART A', 'NOS', 4.88),
      item(2, 'PART B', 'NOS', 1.50),
    ]));
    await openEntry(page);

    await page.locator('.inv-weight-input[data-id="1"]').fill('0.651');
    // PART B deliberately left blank.
    await page.locator('[data-action="invSaveWeights"]').click();

    await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);

    const items = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state') || '{}';
      return (JSON.parse(raw) as { items: Item[] }).items;
    });
    expect(items.find((i) => i.partNumber === 'PART A')?.stdWeightKg).toBe(0.651);
    expect(items.find((i) => i.partNumber === 'PART B')?.stdWeightKg).toBeNull();
  });

  test('NEGATIVE: KG-billed rows get no break-even — the rate is already per kg', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      item(1, 'KG PART', 'KG', 13.0),
    ]));
    await openEntry(page);

    await expect(page.locator('.inv-weight-row')).toHaveCount(1);
    await expect(page.locator('.inv-weight-breakeven')).toHaveCount(0);

    // And typing a weight must not invent a verdict for it either.
    await page.locator('.inv-weight-input').fill('0.5');
    await expect(page.locator('.inv-weight-verdict')).toHaveText('');
  });

  test('NEGATIVE: rejects a zero or negative weight rather than storing it', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      item(1, 'PART A', 'NOS', 4.88),
    ]));
    await openEntry(page);

    await page.locator('.inv-weight-input').fill('0');
    await page.locator('[data-action="invSaveWeights"]').click();

    // Overlay stays open, nothing stored.
    await expect(page.locator('.inv-overlay-card')).toBeVisible();
    const items = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state') || '{}';
      return (JSON.parse(raw) as { items: Item[] }).items;
    });
    expect(items[0].stdWeightKg).toBeNull();
  });

  test('orders the gaps by revenue at risk, not by part number', async ({ page }) => {
    const state = stateWith([
      item(1, 'LOW VALUE', 'NOS', 1.0),
      item(2, 'HIGH VALUE', 'NOS', 5.0),
    ]);
    state.invoices = [{
      id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001',
      date: '2026-04-10', status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'TEST CLIENT KG', items: [
        { partNumber: 'LOW VALUE', desc: '', hsn: '998873', unit: 'NOS', qty: 10, rate: 1, amount: 10 },
        { partNumber: 'HIGH VALUE', desc: '', hsn: '998873', unit: 'NOS', qty: 100, rate: 5, amount: 500 },
      ],
      taxableValue: 510, grandTotal: 601.8, createdAt: 1,
    }];
    await loadAppWithState(page, state);
    await openEntry(page);

    const rows = page.locator('.inv-weight-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('HIGH VALUE');
    await expect(rows.nth(1)).toContainText('LOW VALUE');
  });

});
