import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, waitForBoot, type SepState } from './fixtures';
import { PINS, unlock, withUsers } from './p140-guard.fixture';

// P184: the tab map, step TM1 (docs/TAB_MAP.md §2, §5, §1a-2, §3e; owner, 9 Oct 2026: "Merge and go with all 14"). Today holds
// its Insights (Stats, Reports, the Planner), Office ends in Clients and Sales, Floor's first view is its Overview, and History
// and Knowledge are tools in the top bar on every screen, in no section's row. Places that move later are followed through one
// redirect table, proven here with a row the test puts in. One look's pieces (the verdict card, the row end, the toolbar's
// Filter and More) are proven on a screen the test draws, since no screen takes them until TM2. Every name is made up.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const on = (p: Page) => g(p, `document.querySelector('.inv-page-active').id`) as Promise<string>;
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
const row = (p: Page) => p.locator('#wsTabs .inv-viewtab');
const own = (p: Page) => p.locator('.inv-page-active .inv-viewtabs:not(#wsTabs) .inv-viewtab:visible');
const bar = (p: Page, ws: string) => p.locator(`.inv-navbar-item[data-ws="${ws}"]`);
const swipe = (p: Page, from: number, to: number) => p.evaluate(([a, b]) => {
  const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
  document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], changedTouches: [t(a)] }));
  document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(b)] }));
}, [from, to]);

function book(): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM() } as SepState;
}

/* The rows of §2 as TM1 leaves them: Stats keeps its five tabs and the Planner its eight until TM2; Money's row is its page's. */
export const ROWS: Record<string, string[]> = {
  today: ['Needs you', 'Pulse', 'Stats', 'Reports', 'Planner'],
  office: ['Pipeline', 'Challans', 'Invoices', 'Clients', 'Sales'],
  floor: ['Overview', 'People', 'Production', 'Stock', 'Power'],
};

test.describe('P184: the tab map on the phone', () => {
  test('each section’s row is the map’s, Insights named in Today’s; Money’s row is its page’s', async ({ page }) => {
    await loadAppWithState(page, book());
    for (const [ws, labels] of Object.entries(ROWS)) {
      await bar(page, ws).click();
      await expect(row(page)).toHaveText(labels);
      await expect(bar(page, ws)).toHaveClass(/inv-navbar-item-on/);
    }
    // The group's name stands before Stats in Today's row, and Office's row has none.
    await bar(page, 'today').click();
    await expect(page.locator('#wsTabs .inv-viewtab-group')).toHaveText(['Insights']);
    expect(await g(page, `document.querySelector('#wsTabs .inv-viewtab-group').nextElementSibling.textContent`)).toBe('Stats');
    await bar(page, 'office').click();
    await expect(page.locator('#wsTabs .inv-viewtab-group')).toHaveCount(0);
    // Money has one view: no section row, its page's own row.
    await bar(page, 'money').click();
    await expect(page.locator('#wsTabs')).toHaveClass(/inv-hidden/);
    await expect(own(page)).toHaveText(['Overview', 'Receivables', 'Payments', 'Bank', 'Bills & notes', 'GST']);
    // No row is wider than six, and the sections' rows than five.
    for (const labels of Object.values(ROWS)) expect(labels.length).toBeLessThanOrEqual(5);
    expect(await g(page, `WORKSPACES.map(function(w){ return w.id + ':' + w.views.length; }).join(' ')`)).toBe('today:5 office:5 floor:5 money:1');
  });

  test('Clients and Sales are one page with two rows: each draws only its own group, and a view lights its own door', async ({ page }) => {
    await loadAppWithState(page, book());
    await bar(page, 'office').click();
    await row(page).filter({ hasText: /^Clients$/ }).click();
    await expect(own(page)).toHaveText(['Clients', 'Parts', 'Performance']);
    await own(page).filter({ hasText: 'Parts' }).click();
    expect(where(page)).toEqual(['pageClients', 'items']);
    await expect(row(page).filter({ hasText: /^Clients$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');

    await row(page).filter({ hasText: /^Sales$/ }).click();
    expect(where(page)).toEqual(['pageClients', 'prospects']);
    await expect(own(page)).toHaveText(['Prospects', 'Quotations']);
    await own(page).filter({ hasText: 'Quotations' }).click();
    expect(where(page)).toEqual(['pageClients', 'quotes']);
    await expect(row(page).filter({ hasText: /^Sales$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(row(page).filter({ hasText: /^Clients$/ })).toHaveAttribute('aria-selected', 'false');

    // Office's door comes back to the view left (Quotations), not to Sales' first.
    await bar(page, 'floor').click();
    await bar(page, 'office').click();
    expect(where(page)).toEqual(['pageClients', 'quotes']);
    // Clients' door comes back to Parts, where Clients' group was left.
    await row(page).filter({ hasText: /^Clients$/ }).click();
    expect(where(page)).toEqual(['pageClients', 'items']);

    // An address lights its own door.
    await page.goto('/?tab=pageClients&v=quotes');
    await waitForBoot(page);
    await expect(row(page).filter({ hasText: /^Sales$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(own(page)).toHaveText(['Prospects', 'Quotations']);
    await expect(own(page).filter({ hasText: 'Quotations' })).toHaveAttribute('aria-selected', 'true');
  });

  test('swiping Office goes Pipeline → Challans → Invoices → Clients → Sales, and back', async ({ page }) => {
    await loadAppWithState(page, book());
    await bar(page, 'office').click();
    await row(page).first().click();
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push((await row(page).filter({ has: page.locator('xpath=self::*[@aria-selected="true"]') }).innerText()).trim());
      await swipe(page, 300, 60);
      await page.waitForTimeout(150);
    }
    expect(seen).toEqual(['Pipeline', 'Challans', 'Invoices', 'Clients', 'Sales']);
    // The last swipe went nowhere: Sales is the row's end, and the swipe stays inside Office.
    expect(await on(page)).toBe('pageClients');
    expect(where(page)).toEqual(['pageClients', 'prospects']);
    await swipe(page, 60, 300);
    await expect(row(page).filter({ hasText: /^Clients$/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('History and Knowledge are tools in the top bar: no door lit, no section row, their own title', async ({ page }) => {
    await loadAppWithState(page, book());
    // The phone's top bar, in order: Search, History, Knowledge, Settings.
    const tools = await page.locator('.inv-topbar button:visible').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.action));
    expect(tools.filter(a => a !== 'invNavBack')).toEqual(['invSearchOpen', 'invGoHistory', 'invKbHelp', 'invOpenSettings']);
    expect(await g(page, `[wsOf('pageHistory'), wsOf('pageKnow')]`)).toEqual([null, null]);

    await bar(page, 'floor').click();
    await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').click();
    await expect(page.locator('#pageHistory')).toHaveClass(/inv-page-active/);
    expect(where(page)).toEqual(['pageHistory', '']);
    await expect(page.locator('.inv-navbar-item-on')).toHaveCount(0);
    await expect(page.locator('#wsTabs')).toHaveClass(/inv-hidden/);
    await expect(page.locator('#topbarTitle')).toHaveText('History');
    // A swipe on a tool's page goes nowhere.
    await swipe(page, 300, 60);
    await page.waitForTimeout(200);
    expect(await on(page)).toBe('pageHistory');
    // Back returns to the section it was opened from.
    await page.goBack();
    await expect(page.locator('#pageFloor')).toHaveClass(/inv-page-active/);
    await expect(bar(page, 'floor')).toHaveClass(/inv-navbar-item-on/);

    await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click();
    await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
    await expect(page.locator('.inv-navbar-item-on')).toHaveCount(0);
    await expect(page.locator('#wsTabs')).toHaveClass(/inv-hidden/);
    await expect(page.locator('#topbarTitle')).toHaveText('Knowledge');
    // Its own row is its own: Start, Library, Troubleshoot, Records, Training.
    await expect(own(page)).toHaveText(['Start', 'Library', 'Troubleshoot', 'Records', 'Training']);
  });

  test('the History tool is the owner’s and hidden from the Office role, which is told the map’s names', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('.inv-topbar [data-action="invGoHistory"]:visible')).toHaveCount(1);
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardLockNow"]').click();
    await unlock(page, 'U-off', PINS.office);
    await expect(page.locator('.inv-topbar [data-action="invGoHistory"]:visible')).toHaveCount(0);
    // Today's row holds only what the role opens: its Insights, and their name, go with them.
    await bar(page, 'today').click();
    await expect(row(page)).toHaveText(['Needs you', 'Pulse']);
    await expect(page.locator('#wsTabs .inv-viewtab-group')).toHaveCount(0);
    // A page refused is named as the map names it.
    await g(page, `switchTab('pageStaff')`);
    await expect(page.locator('.inv-toast').last()).toContainText('Your ID doesn’t open People');
    await g(page, `switchTab('pageFinance')`);
    await expect(page.locator('.inv-toast').last()).toContainText('Your ID doesn’t open Money');
    await g(page, `switchTab('pageHistory')`);
    await expect(page.locator('.inv-toast').last()).toContainText('Your ID doesn’t open History');
    expect(await on(page)).not.toBe('pageHistory');
  });

  test('a place that moved opens where it went, from an address and from a step saved in the history', async ({ page }) => {
    // The table is empty until a step removes a place (TM2 on); the test puts in two rows before the app reads its address:
    // a page that is gone, and a view that moved to another page.
    await page.addInitScript(() => {
      let arr: any[] = [];
      Object.defineProperty(window, 'NAV_REDIRECTS', {
        configurable: true, get: () => arr,
        set: v => {
          arr = v;
          arr.push({ tab: 'pageGone', v: null, to: () => ({ tab: 'pageStock', v: '' }) });
          arr.push({ tab: 'pageStats', v: ['billing', 'old'], to: (l: any) => ({ tab: 'pagePipeline', v: '', id: l.id }) });
        },
      });
    });
    await loadAppWithState(page, book());
    expect(await g(page, `NAV_REDIRECTS.length`)).toBe(2);
    // A pure helper: an address it does not know comes back unchanged.
    expect(await g(page, `navRedirect({ tab: 'pageStats', v: 'cost', id: '', d: '' })`)).toEqual({ tab: 'pageStats', v: 'cost', id: '', d: '' });
    expect(await g(page, `navRedirect({ tab: 'pageStats', v: 'billing/x', id: 'A', d: '' })`)).toEqual({ tab: 'pagePipeline', v: '', id: 'A', d: '' });

    // From an address: a page that no longer exists still lands, and the bar shows where.
    await page.goto('/?tab=pageGone&v=anything');
    await waitForBoot(page);
    expect(await on(page)).toBe('pageStock');
    expect(where(page)[0]).toBe('pageStock');
    // A view that moved.
    await page.goto('/?tab=pageStats&v=billing');
    await waitForBoot(page);
    expect(await on(page)).toBe('pagePipeline');
    expect(where(page)[0]).toBe('pagePipeline');

    // From a step of the trail an older build saved: Back arrives at the place it went.
    await switchTab(page, 'pageStock');
    await page.evaluate(() => {
      const h: any = history.state;
      history.replaceState(Object.assign({}, h, { loc: { tab: 'pageStats', v: 'old', id: '', d: '' } }), '', '?tab=pageStats&v=old');
    });
    await switchTab(page, 'pageRegister');
    await page.goBack();
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
  });
});

/* ---------- One look's pieces, on a screen the test draws (TM1 applies them to no screen) ---------- */

async function drawTest(page: Page, html: string) {
  await page.evaluate(h => {
    const act = document.querySelector('.inv-page.inv-page-active')!;
    document.getElementById('p184')?.remove();
    const d = document.createElement('div');
    d.id = 'p184';
    d.innerHTML = h;
    act.prepend(d);
  }, html);
}

test.describe('P184: the toolbar’s More and Filter on the phone', () => {
  test('More holds the rest of a row: a pick shuts it first and then acts, its badges are carried, Back shuts it', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const html = await g(page, `'<div class="inv-toolbar">' + uiToolbarMoreHtml([
      { label: 'Open Stock', action: 'invSwitchTab', attrs: ' data-tab="pageStock"', badge: { n: 2, tone: 'warning' } },
      { label: 'Search', action: 'invSearchOpen', badge: { n: 1, tone: 'danger' } },
      { label: 'Quiet', action: 'invSearchOpen' }]) + '</div>'`) as string;
    await drawTest(page, html);
    const more = page.locator('#p184 [data-action="invTbMore"]');
    await expect(more).toHaveText(/More\s*3/);
    // The worst tone of what it holds, so nothing waiting hides behind it.
    await expect(more.locator('.inv-badge')).toHaveClass(/inv-badge-danger/);
    await expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    // Nothing behind it is drawn until it opens: no id or button is held twice.
    await expect(page.locator('#p184 [data-tb-pick]')).toHaveCount(0);

    await more.click();
    const dlg = page.locator('[data-tb-more-dialog]');
    await expect(dlg.locator('.inv-dialog-title')).toHaveText('More');
    await expect(dlg.locator('[data-tb-pick]')).toHaveText([/Open Stock\s*2/, /Search\s*1/, /Quiet/]);
    // Back shuts it, and the screen stays.
    await page.goBack();
    await expect(dlg).toHaveCount(0);
    expect(await on(page)).toBe('pageFloor');

    // A pick carries the action and data it had on the row: the dialog shuts, then the act.
    await more.click();
    await dlg.locator('[data-tb-pick]', { hasText: 'Open Stock' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);

    // A pick that opens a layer of its own: More is shut under it, and Back passes over More's step.
    await switchTab(page, 'pageFloor');
    await drawTest(page, html);
    await page.locator('#p184 [data-action="invTbMore"]').click();
    await dlg.locator('[data-tb-pick]', { hasText: 'Search' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('.inv-dialog-palette')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.inv-dialog-palette')).toHaveCount(0);
    await expect(dlg).toHaveCount(0);
    expect(await on(page)).toBe('pageFloor');
  });

  test('Filter holds the screen’s own controls: they apply as they change, Done shows them as tokens, a token’s × clears it', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    // A screen's filters, as a screen would draw them: a select with its own id and change handler, its value in the screen's
    // state, its applied value a token under the row.
    await page.evaluate(() => {
      const w: any = window;
      w._p184 = { client: '', changes: 0, done: 0 };
      w.p184Draw = () => {
        const st = w._p184;
        const sel = '<select class="inv-select" id="p184Client" aria-label="Client"><option value="">All clients</option>' +
          ['ALPHA', 'BETA'].map((c: string) => '<option' + (st.client === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>';
        const html = '<div class="inv-toolbar">' + w.uiFilterHtml({ key: 'p184', controls: sel, count: st.client ? 1 : 0 }) + '</div>' +
          w.uiTokensHtml([{ key: 'Client', value: st.client, action: 'invP184Clear' }]);
        const act = document.querySelector('.inv-page.inv-page-active')!;
        let d = document.getElementById('p184');
        if (!d) { d = document.createElement('div'); d.id = 'p184'; act.prepend(d); }
        d.innerHTML = html;
      };
      w.UI_FILTER_DONE.p184 = () => { w._p184.done++; w.p184Draw(); };
      document.addEventListener('change', e => {
        const t = e.target as HTMLSelectElement;
        if (t && t.id === 'p184Client') { w._p184.client = t.value; w._p184.changes++; }
      });
      // The token's action, as a screen's would be: clear and redraw.
      document.addEventListener('click', e => {
        const b = (e.target as HTMLElement).closest('[data-action="invP184Clear"]');
        if (b) { w._p184.client = ''; w.p184Draw(); }
      });
      w.p184Draw();
    });
    const filter = page.locator('#p184 [data-action="invTbFilter"]');
    await expect(filter).toHaveText('Filter');
    await expect(page.locator('#p184 .inv-tokens')).toHaveCount(0);
    // The controls are not on the row: they wait for the dialog.
    await expect(page.locator('#p184Client')).toHaveCount(0);

    await filter.click();
    const dlg = page.locator('[data-tb-filter-dialog="p184"]');
    await expect(dlg).toBeVisible();
    await dlg.locator('#p184Client').selectOption('BETA');
    expect(await g(page, `_p184.changes`)).toBe(1);
    await expect(dlg).toBeVisible();
    await dlg.locator('.inv-dialog-foot [data-action="invTbFilterDone"]').click();
    await expect(dlg).toHaveCount(0);
    expect(await g(page, `_p184.done`)).toBe(1);
    await expect(page.locator('#p184 [data-action="invTbFilter"]')).toHaveText(/Filter\s*1/);
    const token = page.locator('#p184 .inv-tokens .inv-token');
    await expect(token).toHaveText(/Client\s*BETA/);
    await expect(token).toHaveAttribute('aria-label', 'Clear Client: BETA');

    // The token's × clears that one.
    await token.click();
    await expect(page.locator('#p184 .inv-tokens')).toHaveCount(0);
    await expect(page.locator('#p184 [data-action="invTbFilter"]')).toHaveText('Filter');

    // Back shuts the dialog the way Done does, and the row is drawn again.
    await page.locator('#p184 [data-action="invTbFilter"]').click();
    await dlg.locator('#p184Client').selectOption('ALPHA');
    await page.goBack();
    await expect(dlg).toHaveCount(0);
    expect(await g(page, `_p184.done`)).toBe(2);
    await expect(page.locator('#p184 .inv-tokens .inv-token')).toHaveText(/Client\s*ALPHA/);
    expect(await on(page)).toBe('pageFloor');
  });
});

test.describe('P184: the verdict card and the row end on the phone', () => {
  test('the verdict card is shut on the phone, its line still says the state; its tiles filter; the device remembers it', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const card = () => g(page, `uiVerdictHtml({ screen: 'Test · 12 rows', verdict: '3 rows need you', tone: 'warning', fig: '₹1,200',
      facts: ['2 late', '1 new'], key: 'p184',
      factors: [{ label: 'Late', fig: '2', tone: 'danger', action: 'invP184Factor', attrs: ' data-k="late"', pressed: false },
        { label: 'New', fig: '1', tone: 'info' }, { label: 'Done', fig: '9', tone: 'ok' }],
      links: ['<button type="button" class="inv-btn inv-btn-link inv-btn-sm">Open</button>'] })`) as Promise<string>;
    await drawTest(page, await card());
    const v = page.locator('#p184 [data-verdict]');
    await expect(v).toHaveAttribute('data-card', 'verdict');
    await expect(v).toHaveClass(/inv-hero-warning/);
    expect(await v.evaluate(el => el.tagName)).toBe('DETAILS');
    expect(await v.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(v.locator('.inv-hero-title')).toHaveText('3 rows need you');
    await expect(v.locator('.inv-hero-eyebrow')).toHaveText('Test · 12 rows');
    await expect(v.locator('.inv-hero-fig')).toHaveText('₹1,200');
    await expect(v.locator('.inv-hero-fact')).toHaveText(['2 late', '1 new']);
    await expect(v).not.toHaveAttribute('data-verdict-long', /.*/);
    // Opened: its factors are tiles; the one that filters keeps aria-pressed.
    await v.locator(':scope > summary').click();
    await expect(v.locator('.inv-tile')).toHaveCount(3);
    await expect(v.locator('button.inv-tile[data-action="invP184Factor"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(v.locator('.inv-tile-danger')).toHaveCount(1);
    await expect(v.locator('.inv-hero-foot .inv-btn')).toHaveText('Open');
    // Remembered per device: drawn again, it is open.
    expect(await g(page, `JSON.parse(localStorage.getItem('sep_inv_folds'))['v-p184']`)).toBe(true);
    await drawTest(page, await card());
    expect(await page.locator('#p184 [data-verdict]').evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  });

  test('a verdict past its limits is flagged; one naming rupees falls back to its count for a role without money', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await drawTest(page, await g(page, `uiVerdictHtml({ screen: 'Test', verdict: '${'x'.repeat(61)}', tone: 'ok' })`) as string);
    await expect(page.locator('#p184 [data-verdict]')).toHaveAttribute('data-verdict-long', '');
    expect(errs.some(e => /over its limits/.test(e))).toBe(true);
    await drawTest(page, await g(page, `uiVerdictHtml({ screen: 'Test', verdict: '${'x'.repeat(60)}', tone: 'ok',
      factors: [1, 2, 3, 4, 5].map(function (n) { return { label: 'F' + n, fig: String(n) }; }) })`) as string);
    await expect(page.locator('#p184 [data-verdict]')).toHaveAttribute('data-verdict-long', '');

    const money = `uiVerdictHtml({ screen: 'Challans', verdict: '₹5,945 to bill', plain: '4 challans to bill', money: true, tone: 'warning',
      facts: [{ text: '₹1,200 over 10 days', money: true }, 'the oldest 12 days'],
      factors: [{ label: 'Open', fig: '₹5,945', money: true }, { label: 'Challans', fig: '4' }] })`;
    await drawTest(page, await g(page, money) as string);
    await expect(page.locator('#p184 .inv-hero-title')).toHaveText('₹5,945 to bill');

    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await switchTab(page, 'pageRegister');
    expect(await g(page, `grdSeesMoney()`)).toBe(false);
    await drawTest(page, await g(page, money) as string);
    const v = page.locator('#p184 [data-verdict]');
    await expect(v.locator('.inv-hero-title')).toHaveText('4 challans to bill');
    await expect(v.locator('.inv-hero-fact')).toHaveText(['the oldest 12 days']);
    await v.locator(':scope > summary').click();
    await expect(v.locator('.inv-tile')).toHaveCount(1);
    await expect(v).not.toContainText('₹');
  });

  test('a row ends in its figure and its status or one action; its second action is in its fold on the phone', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const html = await g(page, `'<div class="inv-panel inv-panel-flush"><div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">Run 1</span></span>' +
      uiRowEndHtml('120 kg', { tone: 'warning', word: 'Not weighed' }) + '</div>' +
      '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">Run 2</span></span>' +
      uiRowEndHtml('', null, '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm">Correct</button>') + '</div>' +
      uiRowMoreHtml(['<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm">Void</button>', '']) + '</div>'`) as string;
    await drawTest(page, html);
    const ends = page.locator('#p184 .inv-row-end');
    await expect(ends.nth(0).locator('.inv-num')).toHaveText('120 kg');
    await expect(ends.nth(0).locator('.inv-dot')).toHaveText('Not weighed');
    await expect(ends.nth(0).locator('.inv-dot')).toHaveClass(/inv-dot-warning/);
    await expect(ends.nth(0)).toHaveClass(/inv-row-end-stack/);
    for (let i = 0; i < 2; i++) expect(await ends.nth(i).locator('.inv-btn').count()).toBeLessThanOrEqual(1);
    await expect(page.locator('#p184 [data-row-more] .inv-btn')).toHaveText(['Void']);
    expect(await g(page, `uiRowMoreHtml([])`)).toBe('');
  });

  test('every page declares its kind, and a form sub-view says so while it shows', async ({ page }) => {
    await loadAppWithState(page, book());
    const pages: string[] = await g(page, `Array.from(document.querySelectorAll('.inv-page')).map(function (p) { return p.id; })`) as string[];
    for (const id of pages) {
      await g(page, `switchTab(${JSON.stringify(id)})`);
      await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
      const kind = await page.locator(`#${id}`).getAttribute('data-screen');
      expect(['overview', 'work', 'document', 'form'], id).toContain(kind);
      expect(kind, id).toBe(await g(page, `screenKindOf(navLoc())`));
    }
    // A sub-view that is a form: the challan form.
    await switchTab(page, 'pageIM');
    await page.locator('#pageIM [data-action="invShowAddChallan"]').first().click();
    await expect(page.locator('#pageIM')).toHaveAttribute('data-screen', 'form');
    expect(where(page)).toEqual(['pageIM', 'form']);
    // Stock's and Production's by-hand and paste sub-views; back on the list, a work screen again.
    await switchTab(page, 'pageStock');
    await page.locator('#pageStock [data-action="invStockManual"]').first().click();
    await expect(page.locator('#pageStock')).toHaveAttribute('data-screen', 'form');
    await switchTab(page, 'pageProduction');
    await page.locator('#pageProduction [data-action="invProdPaste"]').first().click();
    await expect(page.locator('#pageProduction')).toHaveAttribute('data-screen', 'form');
    await page.goBack();
    await expect(page.locator('#pageProduction')).not.toHaveAttribute('data-screen', 'form');
  });
});
