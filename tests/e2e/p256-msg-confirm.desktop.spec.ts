import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P256 (desktop): the confirmation screen is a wide layer whose list scrolls under a foot that stays, and its messages are
// ticked from the keys: the arrows move between them, space ticks. Made-up names and figures.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const D1 = (() => { let d = shift(todayIso(), -6); while ([0, 6].includes(new Date(d + 'T00:00:00').getDay())) d = shift(d, -1); return d; })();
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const wa = (at: string, who: string, text: string) => `${dmy(D1)}, ${at} - ${who}: ${text}`;
const CHAT = [
  wa('9:40 am', 'Pickler', 'NOVA CLAMPS\nCLAMP133×83(35×6)-774 nos\nPickling Time 9:00AM'),
  wa('11:05 am', 'Pickler', 'NOVA CLAMPS\nCLAMP133×83(35×6)-300 nos\nPickling Time 10:30AM'),
  wa('2:05 pm', 'Pickler', 'NOVA CLAMPS\nCLAMP133×83(35×6)-120 nos\nPickling Time 1:50PM')].join('\n');

test('P256 desktop: a wide layer, the arrows move and space ticks', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), clients: [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }],
    incomingMaterial: noSeedIM() } as unknown as SepState);
  await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(CHAT)}), 'zip', 'IMP-K'); saveState(); mcOpen({ importId: 'IMP-K' }); })()`);
  const dlg = page.locator('[data-mc]');
  await expect(dlg).toBeVisible();
  expect((await dlg.boundingBox())!.width).toBeGreaterThan(700);
  await page.locator(`[data-mc-sum="g:${D1}:pickling"] button.inv-row-main`).click();
  const boxes = page.locator('[data-mc-row] input.inv-check');
  await expect(boxes).toHaveCount(3);
  await boxes.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(boxes.nth(1)).toBeFocused();
  await page.keyboard.press(' ');
  await expect(boxes.nth(1)).toBeChecked();
  await expect(boxes.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  await expect(boxes.nth(2)).toBeChecked();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(boxes.nth(0)).toBeFocused();
  await expect(boxes.nth(0)).not.toBeChecked();
  await expect(page.locator('[data-mc-count]')).toContainText('2 of 3 ticked');
  // The foot stays inside the layer while its list scrolls.
  const foot = await page.locator('[data-mc] .inv-dialog-foot').boundingBox(), d = await dlg.boundingBox();
  expect(foot!.y + foot!.height).toBeLessThanOrEqual(d!.y + d!.height + 1);
});
