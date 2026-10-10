import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, type SepState, toolbarMore } from './fixtures';

// P172 (owner, 7 Oct 2026): "Previewing assigns ID number which holds and doesn't change + the design for the ID is too simple.
// It doesn't carry the address of the plant and the back side should be safety and hazard guidelines for a Zinc plating plant.
// Also, once I set the skill there is no way to change the skill level. Reports to lacks the field when they report to me."
// Made-up names only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company || {}, { name: 'TEST WORKS', add1: '12 Test Road, Industrial Area', add2: 'Testpur - 800 001', add3: '', phone: '90000 00000' });
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true, skills: { 'vat-a1': 2 },
    profile: { designation: 'Line technician', bloodGroup: 'B+', emergency: { relation: 'Brother', phone: '90000 11111' } } },
    { id: 2, name: 'Bina Devi', comp: 'monthly', dayRate: 500, area: 'barrel', active: true }];
  return s;
}
async function preview(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
  await toolbarMore(page, 'ID cards');   // the Roster toolbar's More (TM4b)
  await page.locator('[data-action="invIdcPreview"]').click();
}

test.describe('P172 ID cards and the worker record', () => {
  test('a preview gives no number: closed unprinted, the next preview shows the same numbers, and nothing is kept', async ({ page }) => {
    await loadAppWithState(page, book());
    await preview(page);
    await expect(page.locator('#invPrintBody [data-idc-card="SEP-0001"]')).toHaveCount(1);
    await g(page, `closePrintPreview()`);
    expect(await g(page, `[staffById(1).card || null, staffById(2).card || null, S.cardSeq || 0]`)).toEqual([null, null, 0]);
    await preview(page);
    await expect(page.locator('#invPrintBody [data-idc-card]')).toHaveCount(2);
    await expect(page.locator('#invPrintBody [data-idc-card="SEP-0001"]')).toHaveCount(1);
    // Printed by the browser's own Ctrl+P: the numbers shown are the ones given.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    expect(await g(page, `[staffById(1).card, staffById(2).card]`)).toEqual(['SEP-0001', 'SEP-0002']);
  });

  test('the front carries the plant’s address and the worker’s details; the back the safety rules, behind its own front', async ({ page }) => {
    await loadAppWithState(page, book());
    await preview(page);
    const front = page.locator('#invPrintBody [data-idc-sheet="front"] [data-idc-card]').first();
    await expect(front).toContainText('12 Test Road, Industrial Area, Testpur - 800 001');
    await expect(front).toContainText('90000 00000');
    await expect(front).toContainText('Line technician');
    await expect(front).toContainText('Brother 90000 11111');
    await expect(front).toContainText('Line technician · VAT A1');
    const back = page.locator('#invPrintBody [data-idc-sheet="back"]');
    await expect(back.locator('.inv-idc-back')).toHaveCount(2);
    await expect(back.first()).toContainText('Never let acid meet cyanide');
    await expect(back.first()).toContainText('If found, return to TEST WORKS');
    // A sheet of three: the third card's back sits on the right of its row, opposite its front on the left.
    await g(page, `closePrintPreview(); S.staff.push({ id: 3, name: 'Chandan Oraon', comp: 'daily', dayRate: 400, area: 'flex', active: true })`);
    await preview(page);
    const cells = await page.locator('#invPrintBody [data-idc-sheet="back"] > *').evaluateAll(els => els.map(e => e.className));
    expect(cells).toEqual(['inv-idc inv-idc-back', 'inv-idc inv-idc-back', 'inv-idc-blank', 'inv-idc inv-idc-back']);
  });

  test('the owner rewrites the back’s rules on the print dialog; they are kept for the next print', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await toolbarMore(page, 'ID cards');   // the Roster toolbar's More (TM4b)
    await page.fill('#idcRules', 'Rule one\nRule two');
    await page.locator('[data-action="invIdcPreview"]').click();
    await expect(page.locator('#invPrintBody .inv-idc-rules li')).toHaveText(['Rule one', 'Rule two', 'Rule one', 'Rule two']);
    expect(await g(page, `S.idcCfg.rules`)).toEqual(['Rule one', 'Rule two']);
  });

  test('a skill is changed from its own panel, and only the skills are written', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    await page.locator('[data-ppl-skills] [data-action="invPplEdit"][data-part="skills"]').click();
    await expect(page.locator('#pplDesig')).toHaveCount(0);
    await page.selectOption('#pplSkill-vat-a1', '4');
    await page.locator('[data-action="invPplSave"]').click();
    await expect(page.locator('[data-ppl-skill="vat-a1"] .inv-skill')).toHaveAttribute('aria-label', '4 of 5');
    expect(await g(page, `[staffById(1).skills['vat-a1'], staffById(1).profile.designation]`)).toEqual([4, 'Line technician']);
  });

  test('“Reports to” can name the owner', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="2"]').first().click();
    await page.locator('[data-ppl-ties] [data-action="invPplEdit"][data-part="ties"]').click();
    await page.selectOption('#pplTieKind0', 'reportsTo');
    await page.selectOption('#pplTieWho0', 'owner');
    await page.locator('[data-action="invPplSave"]').click();
    await expect(page.locator('[data-ppl-ties] [data-ppl-tie="reportsTo"]')).toContainText('Reports to you (the owner)');
    expect(await g(page, `staffById(2).ties`)).toEqual([{ kind: 'reportsTo', owner: true }]);
  });
});
