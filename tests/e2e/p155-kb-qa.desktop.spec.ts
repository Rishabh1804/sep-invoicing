import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P155 on the desktop: the knowledge base's QA chain (5 Oct 2026). Each test failed on the build before its fix. Made-up
// content throughout.

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: 'About ' + title, body: 'Text of ' + title + '.', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
function book(articles: any[] = []): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 7, name: 'ACME FORGINGS', billingMode: 'weight', rates: [], isActive: true }];
  s.kb = { articles, trained: [], paths: [] };
  return s as SepState;
}
const many = () => Array.from({ length: 40 }, (_, i) => art('A' + i, 'guide', 'Article ' + String(i).padStart(2, '0')));
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

test.describe('P155 desktop: Knowledge', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

  test('the list and the open article are one view: one primary button between them', async ({ page }) => {
    await loadAppWithState(page, book([art('D1', 'guide', 'A draft', { status: 'draft' }), art('G1', 'guide', 'Rinsing')]));
    for (const id of ['D1', 'G1']) {
      await page.evaluate(x => (window as any).kbOpenArticle(x), id);
      await expect(page.locator('#kbPane [data-kb-article]')).toBeVisible();
      await expect(page.locator('#pageKnow .inv-btn-primary:visible')).toHaveCount(1);
    }
  });

  test('an article written from Start is open beside its list once saved', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `kbSetTab('start'); switchTab('pageKnow')`);
    await page.locator('#knowContent .inv-toolbar [data-action="invKbNew"]').first().click();
    await page.locator('#knowContent [data-kb-f="title"]').fill('Written from Start');
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    await expect(page.locator('#kbPane')).toContainText('Written from Start');
    await expect(page).toHaveURL(/v=library/);
  });

  test('the book is in the desktop’s top bar, and opens the guides for the screen on show', async ({ page }) => {
    await loadAppWithState(page, book());
    const book1 = page.locator('.inv-topbar [data-action="invKbHelp"]:visible');
    await expect(book1).toHaveCount(1);
    await book1.click();
    await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#kbLibrary')).toContainText('Using the app: Today');
  });

  test('an article’s row opens in a new window on a Ctrl+click, at its own address', async ({ page }) => {
    await loadAppWithState(page, book(many()));
    await g(page, `window.__opened = []; window.open = function(url) { window.__opened.push(url); return {}; }; kbSetTab('library'); switchTab('pageKnow')`);
    await page.locator('[data-kb-row="A3"] [data-action="invKbOpen"]').click({ modifiers: ['Control'] });
    expect(await g(page, 'window.__opened')).toEqual([expect.stringMatching(/tab=pageKnow&v=library&id=A3$/)]);
    await expect(page.locator('#kbHost')).not.toHaveClass(/inv-pane-open/);
  });

  test('the search and the chips stay above the list as it scrolls; the open row is the current one, in Knowledge only', async ({ page }) => {
    await loadAppWithState(page, book(many().concat([art('Q1', 'requirement', 'ACME needs a certificate', { links: [{ type: 'client', id: '7', label: 'ACME FORGINGS' }] })])));
    await g(page, `kbSetTab('library'); switchTab('pageKnow')`);
    // The list shows its first thirty; the app's own guides are among them, so the rest are one tap away (uiMoreHtml).
    const more = page.locator('#kbLibrary [data-action="invShowMore"]');
    if (await more.count()) await more.first().click();
    await page.locator('[data-kb-row="Q1"] [data-action="invKbOpen"]').click();
    await expect(page.locator('#kbLibrary [data-kb-row="Q1"]')).toHaveAttribute('aria-current', 'true');
    await page.locator('#kbHost > .inv-pane-list').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const box = await page.locator('#kbSearch').boundingBox();
    expect(box && box.y).toBeGreaterThan(0);
    expect(await g(page, `!!document.querySelector('#kbSearch').closest('.inv-pane-list')`)).toBe(false);
    // A client's own panel is not Knowledge's list: nothing there is marked.
    await switchTab(page, 'pageClients');
    await g(page, `_renderClientDetail(7)`);
    await expect(page.locator('[data-kb-linked="client"] [data-kb-row="Q1"]')).toBeVisible();
    await expect(page.locator('[data-kb-linked="client"] [aria-current], [data-kb-linked="client"] .inv-row-selected')).toHaveCount(0);
  });

  test('an article named on Start (what the phone wrote) opens beside its list', async ({ page }) => {
    await loadAppWithState(page, book(many()));
    await page.goto('/?tab=pageKnow&v=start&id=A3');
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('#kbPane')).toContainText('Text of Article 03.');
    await expect(page).toHaveURL(/v=library&id=A3/);
  });

  test('the trail names an article only for a role that reads it: the next person at the window is not shown the last one’s', async ({ page }) => {
    await loadAppWithState(page, book([art('OWN1', 'requirement', 'Margins by client', { roles: ['owner'] }), art('G1', 'guide', 'Rinsing')]));
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await g(page, `kbOpenArticle('OWN1')`);
    await expect(page.locator('#kbPane')).toContainText('Margins by client');
    await g(page, `kbOpenArticle('G1')`);
    await expect(page.locator('#navTrail')).toContainText('Margins by client');
    await g(page, `grdLockAll('test')`);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `switchTab('pageKnow')`);
    await expect(page.locator('#navTrail')).not.toContainText('Margins by client');
    const st: any = await readStoredState(page);
    expect(st.kb.articles.length).toBe(2);
  });
});
