import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM } from './fixtures';

// P165 on the desktop: WhatsApp Web in one named window, and the desktop app by its scheme, beside Today's inputs.

test('the desktop offers WhatsApp Web in its own window and the desktop app', async ({ page }) => {
  const s: any = emptyState(); s.incomingMaterial = noSeedIM();
  await loadAppWithState(page, s);
  const box = page.locator('#homeNeeds [data-tdy-wa] [data-wa="today"]');
  await expect(box.locator('[data-wa-go="web"]')).toHaveAttribute('href', 'https://web.whatsapp.com/');
  await expect(box.locator('[data-wa-go="web"]')).toHaveAttribute('target', 'sepWhatsApp');
  await expect(box.locator('[data-wa-go="app"]')).toHaveAttribute('href', 'whatsapp://');
  await expect(box.locator('[data-wa-go="app"]')).not.toHaveAttribute('target', /.*/);
  for (const go of ['web', 'app']) {
    const r = await box.locator(`[data-wa-go="${go}"]`).boundingBox();
    expect(r!.height).toBeGreaterThanOrEqual(24);
  }
});
