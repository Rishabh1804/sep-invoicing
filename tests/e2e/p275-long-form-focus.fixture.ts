import { expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, SepState } from './fixtures';

/* P275's book and keyboard paths, shared by the phone spec and its .desktop twin. Made-up data only (HR-10). */

export function longFormBook(): SepState {
  const s: any = emptyState();
  s.clients = [{ id: 1, name: 'DELTA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] }];
  s.items = [{ id: 101, partNumber: 'QX1', desc: 'TEST BRACKET', hsn: '998873', unit: 'KG', rate: 13, stdWeightKg: 0.5 }];
  return s as SepState;
}

/** The focused control, seen from outside: on screen, and what the page draws at its corners is the control itself, not a bar. */
export async function focusInSight(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'nothing focused';
    const name = el.dataset.k || el.id || el.tagName;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) return name + ' off the screen (' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' of ' + window.innerHeight + ')';
    const inset = 2;
    // Its top and bottom edges, a little in (a corner falls outside a rounded field), and its two sides at mid-height.
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    for (const [x, y] of [[cx, r.top + inset], [cx, r.bottom - inset], [r.left + r.width / 4, cy], [r.right - r.width / 4, cy]]) {
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!hit || !(hit === el || el.contains(hit))) {
        const bar = hit && hit.closest('.inv-actionbar, .inv-navbar, .inv-topbar, .inv-ws-tabs');
        return name + ' covered by ' + (bar ? bar.className : hit ? hit.tagName + '.' + String(hit.className) : 'nothing');
      }
    }
    return 'ok';
  });
}

export const focusedKey = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement).dataset.k || '');

/** Types a line from its part field by keyboard alone: the part (a lone match commits on Enter), its quantity, then Enter down the
 * chain to Add line and Enter on it. Every field the keyboard lands on is checked. */
async function typeLine(page: Page, area: string, n: number, seen: string[]) {
  await page.keyboard.type('QX1');
  await expect(page.locator(area + ' .inv-combo > .inv-menu:not(.inv-hidden) .inv-menu-item').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedKey(page)).toBe('qty-' + n);
  seen.push('line ' + (n + 1) + ' qty: ' + await focusInSight(page));
  await page.keyboard.type('12');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Enter');
    const k = await focusedKey(page);
    seen.push('line ' + (n + 1) + ' ' + k + ': ' + await focusInSight(page));
    if (k === 'addline') break;
  }
  await expect.poll(() => focusedKey(page)).toBe('addline');
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedKey(page)).toBe('part-' + (n + 1));
  seen.push('line ' + (n + 2) + ' part: ' + await focusInSight(page));
}

export async function challanByKeyboard(page: Page, lines: number): Promise<string[]> {
  await loadAppWithState(page, longFormBook());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').waitFor();
  await page.locator('#imChallanClientSearch').focus();
  await page.keyboard.type('DELTA');
  await page.keyboard.press('Enter');
  await expect(page.locator('#imChallanNo')).toBeFocused();
  await page.keyboard.type('9001');
  const seen: string[] = [];
  // Number, date, vehicle, wanted by, then the first line's part.
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); seen.push('head ' + (await focusedKey(page)) + ': ' + await focusInSight(page)); }
  await expect.poll(() => focusedKey(page)).toBe('part-0');
  for (let n = 0; n < lines; n++) await typeLine(page, '#imAddForm', n, seen);
  await expect(page.locator('#imAddForm .inv-line')).toHaveCount(lines + 1);
  return seen;
}

export async function createByKeyboard(page: Page, lines: number): Promise<string[]> {
  await loadAppWithState(page, longFormBook());
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').waitFor();
  await page.locator('#invClientSearch').fill('DELTA');
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedKey(page)).toBe('addline');
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedKey(page)).toBe('part-0');
  const seen: string[] = [];
  for (let n = 0; n < lines; n++) await typeLine(page, '#createFormArea', n, seen);
  await expect(page.locator('#createFormArea .inv-line')).toHaveCount(lines + 1);
  return seen;
}

export const slipped = (seen: string[]) => seen.filter((s) => !s.endsWith(': ok'));

