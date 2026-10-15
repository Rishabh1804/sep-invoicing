import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, type SepState } from './fixtures';

// P219 (desktop): the desk (KB2-1, docs/KNOWLEDGE_BASE_2.md §3): the Library on the left, the article in Reader in the middle, its
// context on the right, each scrolling on its own inside the room; the page never scrolls. Made-up content.

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: '', body: '', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
const long = Array.from({ length: 60 }, (_, i) => (i + 1) + '. Step number ' + (i + 1) + ' of the long part, with words enough to wrap.').join('\n') + '\n\n# The end part\nThe last words.';
function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.kb = { articles: [art('G1', 'guide', 'A long how-to', { body: long, glance: 'Where: VAT A1', links: [{ type: 'line', id: 'vat-a1', label: '' }] })].concat(
    Array.from({ length: 30 }, (_, i) => art('A' + i, 'fault', 'Fault ' + String(i).padStart(2, '0'), { symptom: 'Something seen ' + i }))), trained: [], paths: [],
    notes: [{ id: 'n1', articleId: 'G1', text: 'Seen in September.', private: false, by: 'Owner', at: Date.now() }] };
  return s as SepState;
}
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const pageScrolls = (p: Page) => p.evaluate(() => document.scrollingElement!.scrollHeight > window.innerHeight + 1);

test.describe('P219 desktop: the desk', () => {
  test('three columns, each scrolling on its own; the middle reads; the page never scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await loadAppWithState(page, book());
    await g(page, `kbOpenArticle('G1')`);
    const host = page.locator('#kbHost.inv-kb-desk.inv-pane-open');
    await expect(host).toBeVisible();
    await expect(page.locator('#kbPane [data-kb-mode="read"]')).toBeVisible();
    // No Quick on the desk: At a glance is the context column's first section.
    await expect(page.locator('#kbPane [data-action="invKbMode"][data-mode="quick"]')).toHaveCount(0);
    const ctx = page.locator('#kbCtx .inv-kb-ctx-body');
    await expect(ctx.locator('[data-kb-ctx]').first()).toHaveAttribute('data-kb-ctx', 'glance');
    await expect(ctx.locator('[data-kb-ctx="notes"]')).toContainText('Seen in September.');
    const cols = await host.evaluate(el => Array.from(el.children).map(c => Math.round(c.getBoundingClientRect().width)));
    expect(cols.length).toBe(3);
    expect(cols[0]).toBeGreaterThan(250); expect(cols[2]).toBeGreaterThan(290);
    expect(await pageScrolls(page)).toBe(false);
    // The middle scrolls itself; the page stays.
    const mid = page.locator('#kbPane');
    expect(await mid.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await mid.evaluate(el => { el.scrollTop = 600; });
    expect(await g(page, 'window.scrollY')).toBe(0);
  });

  test('Reader at a section scrolls the middle column to it; the Library shuts to its rail and the choice is kept', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await loadAppWithState(page, book());
    await page.goto('/?tab=pageKnow&v=library/read/2&id=G1');
    await page.locator('body.inv-booted').waitFor();
    // The section is in view inside the middle column (near the end of a long page, the column scrolls as far as it goes).
    const off = await page.locator('#kbPane [data-kb-sec="2"]').evaluate(el => { const m = el.closest('.inv-kb-mid')!; return [el.getBoundingClientRect().top - m.getBoundingClientRect().top, m.clientHeight]; });
    expect(off[0]).toBeGreaterThanOrEqual(0);
    expect(off[0]).toBeLessThan(off[1] - 40);
    expect(await page.locator('#kbPane').evaluate(el => el.scrollTop)).toBeGreaterThan(200);
    await page.locator('#kbHost [data-action="invKbDeskShut"]').click();
    await expect(page.locator('#kbHost')).toHaveClass(/inv-kb-desk-shut/);
    await expect(page.locator('#kbHost .inv-kb-rail [data-action="invKbRailKind"]')).toHaveCount(8);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('#kbHost')).toHaveClass(/inv-kb-desk-shut/);
  });

  test('under 80rem the context is a rail, opening over the article on a tap', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await loadAppWithState(page, book());
    await g(page, `kbOpenArticle('G1')`);
    await expect(page.locator('#kbCtx .inv-kb-ctx-body')).toBeHidden();
    await page.locator('#kbCtx .inv-kb-ctx-rail [data-key="notes"]').click();
    await expect(page.locator('#kbHost')).toHaveClass(/inv-kb-ctx-over/);
    await expect(page.locator('#kbCtx [data-kb-ctx="notes"]')).toBeVisible();
    expect(await pageScrolls(page)).toBe(false);
  });
});
