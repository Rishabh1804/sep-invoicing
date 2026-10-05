import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P154 on the desktop: Knowledge is Insights' fourth view; the Library is a list beside the open article, which has an
// address a reload and Back follow; the page never scrolls behind its list and pane (P80's rule). Made-up content.

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: 'About ' + title, body: 'Text of ' + title + '.', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 7, name: 'ACME FORGINGS', billingMode: 'weight', rates: [] }];
  s.kb = { articles: Array.from({ length: 40 }, (_, i) => art('A' + i, i % 2 ? 'process' : 'guide', 'Article ' + String(i).padStart(2, '0'))).concat([
    art('Q1', 'requirement', 'ACME needs a certificate', { links: [{ type: 'client', id: '7', label: 'ACME FORGINGS' }] })]), trained: [], paths: [] };
  return s as SepState;
}

test('the Library is a list beside the open article; the article has an address a reload keeps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, book());
  await switchTab(page, 'pageKnow');
  await expect(page.locator('#invSidebar [data-tab="pageKnow"]')).toHaveText(/Knowledge/);
  await page.locator('#knowContent [data-action="invKbTab"][data-tab="library"]').click();
  await page.locator('[data-kb-row="A3"] [data-action="invKbOpen"]').click();
  await expect(page.locator('#kbHost')).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#kbPane')).toContainText('Text of Article 03.');
  await expect(page).toHaveURL(/tab=pageKnow.*v=library.*id=A3/);
  // The page itself does not scroll: the list and the pane do.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight + 1)).toBe(true);
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await expect(page.locator('#kbPane')).toContainText('Text of Article 03.');
  await page.locator('#kbPane [data-action="invKbClose"]').click();
  await expect(page.locator('#kbHost')).not.toHaveClass(/inv-pane-open/);
});

test('a client’s detail lists the articles linked to it, each a door into Knowledge', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, book());
  await switchTab(page, 'pageClients');
  await page.evaluate(() => (window as any)._renderClientDetail(7));
  const panel = page.locator('[data-kb-linked="client"]');
  await expect(panel).toContainText('ACME needs a certificate');
  await panel.locator('[data-action="invKbOpen"]').click();
  await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#kbPane')).toContainText('Text of ACME needs a certificate.');
  const st: any = await readStoredState(page);
  expect(st.kb.articles.length).toBe(41);
});
