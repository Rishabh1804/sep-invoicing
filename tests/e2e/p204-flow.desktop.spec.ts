import { test, expect } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab } from './fixtures';
import { T, wd, short, book } from './p204-flow.fixture';

// P204 on the desktop (docs/ENTRY_FACES.md §5, the flow thread): a client's turnaround in the pane beside the list, and a challan
// wanted by a day set from its pane, badged in the table's status. Made-up names and figures.

test.describe('P204: the flow thread on the desktop', () => {
  test('a client’s pane carries its turnaround: the verdict, the steps, the open challans and invoices', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageClients');
    await page.locator('button[data-action="invSelectClientRow"][data-id="11"]').click();
    const p = page.locator('.inv-pane [data-client-flow="11"]');
    await expect(p).toBeVisible();
    await expect(p.locator('[data-flow-verdict] .inv-row-title')).toHaveText('Back in 3 working days');
    await expect(p.locator('[data-flow-step]')).toHaveCount(4);
    await expect(p.locator('[data-flow-challan="IM-104"] .inv-row-end')).toHaveText('Late · back ~' + short(T));
    await expect(p.locator('[data-flow-invoice="INV-91"] .inv-row-end')).toHaveText('Past terms');
  });

  test('a challan wanted by a day is set from its pane, and the table says it beside the status', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageIM');
    await page.locator('button[data-action="invSelectIMRow"][data-id="IM-104"]').click();
    await page.locator('.inv-pane [data-action="invFlowPrio"][data-id="IM-104"]').click();
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog').last();
    await dlg.locator('#flowPrioAll').fill(wd[1]);
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect.poll(async () => (await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-104').priority).toBe(wd[1]);
    await expect(page.locator('tr[data-im="IM-104"] [data-flow-wanted]')).toHaveClass(/inv-badge-danger/);
    await expect(page.locator('tr[data-im="IM-104"] [data-flow-wanted]')).toHaveText('Wanted ' + short(wd[1]));
  });
});
