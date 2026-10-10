import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, openSales, switchTab, todayIso, toolbarMoreLabels } from './fixtures';
import { longBook } from './load-fixture';
import { pipeState } from './p137-pipeline.fixture';
import { clientsState } from './clients-fixture';

// P193 (desktop): Office in one look (docs/TAB_MAP.md TM5). The desktop takes the same rows as the phone with its filters inline
// (§1a-10): Invoices is one toolbar row with its range in a dialog of its own and its select-all in the table's head; Parts' filters
// sit in its row; Performance's card is open with its flags as coded tiles; Pipeline's verdict leads its stages and list.

const oneRow = (page: Page, sel: string) => page.locator(sel).evaluate(el => {
  const kids = Array.from(el.children).filter(k => (k as HTMLElement).offsetParent !== null && !(k as HTMLElement).hidden);
  const boxes = kids.map(k => k.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  return boxes.every(b => boxes.every(o => b.top < o.bottom && o.top < b.bottom));
});

test.describe('P193: Office in one look (desktop)', () => {
  for (const [w, h] of [[1280, 800], [1024, 768]]) {
    test(`TM5c at ${w}: Invoices is one row (search, client, month, state, Range, More); the range a dialog; select-all in the head`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await loadAppWithState(page, pipeState());
      await switchTab(page, 'pageRegister');
      const bar = '#pageRegister [data-reg-toolbar]';
      expect(await oneRow(page, bar)).toBe(true);
      for (const sel of ['#regSearch', '#regClientFilter', '#regMonthFilter', '#regStateFilter', '[data-reg-range]', '[data-action="invTbMore"]'])
        await expect(page.locator(bar + ' ' + sel), sel).toBeVisible();
      // No Filter button, no Select (the rows carry their boxes), no tokens: the filters are on the row.
      await expect(page.locator(bar + ' [data-action="invTbFilter"], ' + bar + ' [data-action="invRegToggleSelect"]')).toHaveCount(0);
      await expect(page.locator('#pageRegister .inv-tokens')).toHaveCount(0);
      expect(await toolbarMoreLabels(page)).toEqual(['Credit notes', 'Number audit', 'Sales register CSV', 'Sales register PDF', 'GSTR-1 CSV', 'Bulk mark filed']);
      // The range: its own dialog; the button says the range in use, and the verdict's screen names it.
      await page.locator(bar + ' [data-reg-range]').click();
      const dlg = page.locator('[data-reg-range-dialog]');
      await dlg.locator('#regDateFrom').fill('2020-04-01');
      await dlg.locator('[data-action="invTbFilterDone"].inv-btn-primary').click();
      await expect(dlg).toHaveCount(0);
      await expect(page.locator(bar + ' [data-reg-range]')).toContainText('Range:');
      await expect(page.locator('#regVerdict .inv-hero-eyebrow, #regVerdict [data-verdict]').first()).toContainText('Invoices ·');
      expect(await oneRow(page, bar)).toBe(true);
      // The table's head ticks every row on show, and again clears them.
      const all = page.locator('#pageRegister thead [data-action="invRegSelectAll"]');
      await all.click();
      // A cancelled invoice has no box to tick.
      const boxes = await page.locator('#pageRegister tbody input[type="checkbox"]').count();
      expect(boxes).toBeGreaterThan(0);
      await expect(page.locator('#pageRegister tbody input[type="checkbox"]:checked')).toHaveCount(boxes);
      await all.click();
      await expect(page.locator('#pageRegister tbody input[type="checkbox"]:checked')).toHaveCount(0);
    });
  }

  test('TM5a: Pipeline’s verdict leads, its stages coded tiles beside the open list', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('#pipelineContent > :first-child')).toHaveAttribute('data-verdict', '');
    // Nothing in it folds (its stages are beside it), so it is a card, not a fold.
    await expect(page.locator('#pipelineContent [data-verdict] .inv-hero-title')).toBeVisible();
    await expect(page.locator('#pipeHost .inv-pipe-rail .inv-coded [data-pipe-stage]')).toHaveCount(6);
    await expect(page.locator('#pipeList [data-pipe-list]')).toBeVisible();
  });

  test('TM5e: Parts’ filters and sort are on its one row; the card holds the move', async ({ page }) => {
    await loadAppWithState(page, clientsState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').click();
    const bar = '#pageClients [data-items-toolbar]';
    expect(await oneRow(page, bar)).toBe(true);
    for (const sel of ['#itemsSearch', '[data-action="invFilterNoWeight"]', '[data-action="invFilterUnused"]', '#itemsSort', '[data-action="invAddItem"]', '[data-action="invTbMore"]'])
      await expect(page.locator(bar + ' ' + sel), sel).toBeVisible();
    await expect(page.locator(bar + ' [data-action="invTbFilter"]')).toHaveCount(0);
    await expect(page.locator('#itemsVerdict [data-action="invOpenWeightEntry"]')).toBeVisible();
    await page.locator(bar + ' [data-action="invFilterNoWeight"]').click();
    await expect(page.locator(bar + ' [data-action="invFilterNoWeight"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('TM5f: Performance’s card is open on the desktop, its flags coded tiles that open their tasks', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
    const v = page.locator('#cpVerdict');
    await expect(v).toHaveJSProperty('open', true);
    const n = Number(await v.getAttribute('data-cp-flags'));
    const tiles = v.locator('[data-action="invTodoOpenApp"]');
    await expect(tiles).toHaveCount(Math.min(n, 4));
    await tiles.first().click();
    await expect(page.locator('.inv-scrim-dialog')).toBeVisible();
  });

  test('TM5g: Quotations’ reprice moves fill the pane beside the list until a quotation is opened, and the page never scrolls', async ({ page }) => {
    const s: any = longBook();
    s.quotations = [{ id: 'QD', num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: todayIso(), clientId: null,
      to: { name: 'A PROSPECTIVE FIRM', address: 'Plot 1', gstin: '', state: '', attn: '' }, intro: '', lines: [{ item: 'BRACKET', partNumber: 'B1',
        desc: '', basis: 'kg', rate: 22, refWeightKg: null, note: '' }], gstPct: 18, sac: '998873', transport: 'excluded', minConsignmentKg: null,
      lotPcs: null, validDays: 30, paymentDays: 15, terms: ['Job work.'], status: 'draft', createdAt: 1, at: 1 }];
    await loadAppWithState(page, s);
    await openSales(page, 'quotes');
    // The card says how many clients are to reprice and holds none of the moves here: under it, open, they pushed the list below
    // the screen's foot (P80).
    const card = page.locator('#qtVerdict');
    await expect(card.locator('.inv-hero-fact').filter({ hasText: 'to reprice' })).toHaveCount(1);
    await expect(card.locator('[data-qt-reprice]')).toHaveCount(0);
    await expect(page.locator('#qtHost.inv-pane-open #qtPane [data-qt-reprice] [data-adv-move]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    // A quotation opened takes the pane; shut, the moves come back.
    await page.locator('#qtMaster [data-action="invQtOpen"]').first().click();
    await expect(page.locator('#qtPane')).toContainText('Draft');
    await expect(page.locator('#qtPane [data-qt-reprice]')).toHaveCount(0);
    await page.locator('#qtPane [data-action="invQtClosePane"]').click();
    await expect(page.locator('#qtPane [data-qt-reprice] [data-adv-move]').first()).toBeVisible();
  });
});
