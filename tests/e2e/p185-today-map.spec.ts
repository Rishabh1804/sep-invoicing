import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, readStoredState, switchTab, toolbarMore, todayIso, waitForBoot, workingDaysBack,
  type SepState } from './fixtures';
import { longBook } from './load-fixture';

// P185: the tab map, step TM2 (docs/TAB_MAP.md TM2a–TM2f, §5). Today: the To-do joins Needs you (its Add, its Done, its Snoozed,
// what was learnt, the launch addresses); Pulse takes what was Stats → Overview (the period, Why it moved, In one line, the
// pace), each folded to its verdict on the phone; Stats keeps By client · Cost · Trends, each led by its verdict card; the
// dispatch cycle is Pipeline's; the Planner is Play · Ledger · A day · Moves, one verdict card on every view and rows on the
// phone; every preset hides the To-do, the recent invoices and Money; the report on the page fits the screen; and the old
// places redirect. Every name and figure is made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
async function openFold(d: Locator) {
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click();
}

function base(extra: Partial<SepState> = {}): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState;
}
async function load(page: Page, state: SepState) {
  // A backup today keeps the backup task quiet: these tests count the To-do's own mechanics.
  await page.addInitScript(() => { try { localStorage.setItem('sep_inv_last_export', String(Date.now())); } catch { /* */ } });
  await loadAppWithState(page, state);
}
/* A stock line running out (counted 20, then 6 a day): one red task from the data, `stock:SI-1`. */
function stockRunningOut() {
  const [d1, d2, d3] = workingDaysBack(4).slice(1).reverse();
  return {
    items: [{ id: 'SI-1', name: 'Q558', key: 'Q558', aliases: [], unit: 'KG', basis: 'draw', active: true, createdAt: 1 }],
    entries: [
      { id: 'SE-1', itemId: 'SI-1', kind: 'count', qty: 20, date: d1, at: 1, seq: 0 },
      { id: 'SE-2', itemId: 'SI-1', kind: 'used', qty: 6, date: d2, at: 2, seq: 1, days: 1 },
      { id: 'SE-3', itemId: 'SI-1', kind: 'used', qty: 6, date: d3, at: 3, seq: 1, days: 1 },
    ],
    pastes: [],
  };
}

test.describe('P185: Today on the phone', () => {
  test('Needs you takes the To-do: Add heads the tasks, a tick goes to Done and back, a snooze waits under Snoozed; nothing is deleted', async ({ page }) => {
    await load(page, base({ stock: stockRunningOut() } as any));
    await expect(page.locator('#homeNeeds')).toBeVisible();
    const tasks = page.locator('#homeNeeds [data-card="tasks"]');
    // The Add row is the first thing in the tasks, above Now, and Add is the view's one primary.
    await expect(tasks.locator(':scope > *').first()).toHaveAttribute('data-tdy-add', '');
    await expect(page.locator('#homeNeeds .inv-btn-primary:visible')).toHaveText(['Add']);
    await page.locator('#todoNew').fill('Ask about CN/001');
    await page.locator('#todoNew').press('Enter');
    const mine = () => tasks.locator('[data-todo="mine"]').filter({ hasText: 'Ask about CN/001' });
    await expect(mine()).toHaveCount(1);
    await expect(page.locator('#todoNew')).toBeFocused();
    await expect(page.locator('#todoNew')).toHaveValue('');

    // Undated, it is this week's: the group is opened to tick it.
    await openFold(tasks.locator('[data-tdy-group="week"]'));
    await mine().locator('[data-action="invTodoToggle"]').click();
    const done = tasks.locator('[data-card="done"]');
    await expect(done.locator('.inv-panel-count')).toHaveText('1');
    expect(await done.evaluate(el => (el as HTMLDetailsElement).open), 'Done is folded, shut').toBe(false);
    let st = (await readStoredState(page)).todo;
    expect(st.tasks).toHaveLength(1);
    expect(st.tasks[0].doneAt).toBeGreaterThan(0);
    await openFold(done);
    await done.locator('[data-done] [data-action="invTodoToggle"]').click();
    await expect(tasks.locator('[data-card="done"]')).toHaveCount(0);
    await expect(mine()).toHaveCount(1);
    st = (await readStoredState(page)).todo;
    expect(st.tasks[0].doneAt).toBeNull();

    // The stock task, snoozed for a week from its dialog, waits under Snoozed; Wake brings it back.
    const stock = tasks.locator('[data-tdy-task="stock:SI-1"]');
    await expect(stock).toHaveCount(1);
    await stock.locator('[data-action="invTodoOpenApp"]').click();
    await page.locator('[data-action="invTodoSnooze"][data-v="7"]').click();
    await expect(tasks.locator('[data-tdy-task="stock:SI-1"]')).toHaveCount(0);
    const snoozed = tasks.locator('[data-card="snoozed"]');
    await expect(snoozed.locator('.inv-panel-count')).toHaveText('1');
    await openFold(snoozed);
    await snoozed.locator('[data-action="invTodoWake"]').click();
    await expect(tasks.locator('[data-card="snoozed"]')).toHaveCount(0);
    await expect(tasks.locator('[data-tdy-task="stock:SI-1"]')).toHaveCount(1);
    expect((await readStoredState(page)).todo.snoozes).toEqual({});
  });

  test('the To-do’s addresses land on Needs you: add focuses the field, a task opens its dialog; the old page is gone', async ({ page }) => {
    await load(page, base({ stock: stockRunningOut() } as any));
    expect(await page.locator('#pageTodo').count()).toBe(0);
    await page.goto('/?tab=pageTodo&todo=add');
    await waitForBoot(page);
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await expect(page.locator('#todoNew')).toBeFocused();
    await expect.poll(() => where(page)).toEqual(['pageHome', 'needs']);

    await page.goto('/?tab=pageTodo&todo=' + encodeURIComponent('open:a:stock:SI-1'));
    await waitForBoot(page);
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await expect(page.locator('[data-todo-facts]')).toBeVisible();
    // The widget, the manifest's shortcut and the old address all open Needs you.
    await page.goto('/?tab=pageTodo');
    await waitForBoot(page);
    await expect.poll(() => where(page)).toEqual(['pageHome', 'needs']);
    expect(await g(page, `GRD_PAGE_IDS.indexOf('pageTodo')`)).toBe(-1);
  });

  test('what the app learnt from your answers is on Needs you, and its task opens it there', async ({ page }) => {
    const resp = Array.from({ length: 3 }, (_, i) => ({ at: Date.now() - (i + 1) * 3600e3, key: 'challan:' + (i + 1), rule: 'challan', act: 'snooze', age: 0 }));
    await load(page, base({ todo: { tasks: [], snoozes: {}, resp } } as any));
    await expect(page.locator('#homeNeeds #todoLearn [data-learn="raise:challan"]')).toHaveCount(1);
    await switchTab(page, 'pageFinance');
    const t: any = await g(page, `todoAppAll(['learn'])[0]`);
    await g(page, `todoGo(${JSON.stringify(t.go)})`);
    await expect(page.locator('#homeNeeds')).toBeVisible();
    await expect(page.locator('#todoLearn [data-learn="raise:challan"]')).toBeVisible();
  });

  test('Pulse leads with the period and More; Why it moved, In one line and the pace fold to their verdicts; one period with Stats', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openPulse(page);
    const head = page.locator('[data-tdy-pulse-head]');
    await expect(head.locator('.inv-seg-btn[aria-pressed="true"]')).toHaveText('MTD');
    // One row: the period and More, nothing else (their middles level, whatever box an inline span draws).
    const mids = await head.evaluate(el => Array.from(el.children).map(c => { const r = (c as HTMLElement).getBoundingClientRect(); return r.top + r.height / 2; }));
    expect(mids.length).toBe(2);
    expect(Math.max(...mids) - Math.min(...mids), 'the head is one row').toBeLessThan(8);
    for (const id of ['statsWhy', 'statsOverview', 'statsPace']) {
      const card = page.locator('#' + id);
      await expect(card).toHaveCount(1);
      expect(await card.evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open), id + ' is shut to its verdict').toBe(true);
      await expect(card.locator(':scope > summary .inv-hero-title')).not.toHaveText('');
    }
    // The questions lead, then Do first, then the three.
    const order = await page.locator('#homeQuestions > *').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.tdyPulseHead != null ? 'head'
      : e.matches('[data-tdy-questions]') ? 'questions' : e.matches('[data-card="first"]') ? 'first' : e.matches('[data-tdy-pulse-cards]') ? 'cards' : e.className));
    expect(order).toEqual(['head', 'questions', 'first', 'cards']);

    // The period is Stats' too: changed here, Stats shows it; changed there, Pulse is drawn again on it.
    await head.locator('.inv-seg-btn', { hasText: 'QTD' }).click();
    await expect(head.locator('.inv-seg-btn[aria-pressed="true"]')).toHaveText('QTD');
    await switchTab(page, 'pageStats');
    await expect(page.locator('#statsToolbar .inv-seg-btn[aria-pressed="true"]')).toHaveText('QTD');
    await page.locator('#statsToolbar .inv-seg-btn', { hasText: 'YTD' }).click();
    await openPulse(page);
    await expect(page.locator('[data-tdy-pulse-head] .inv-seg-btn[aria-pressed="true"]')).toHaveText('YTD');

    // More: Make a report opens Reports on the period; Edit Home opens the arrangement.
    await toolbarMore(page, 'Make a report');
    await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
    await openPulse(page);
    await toolbarMore(page, 'Edit Home');
    await expect(page.locator('#homeEdit')).toBeVisible();
    await expect(page.locator('#homeEditBar')).toHaveCount(0);
  });

  test('Stats is By client · Cost · Trends, each led by its verdict card, shut on the phone', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStats');
    await expect(page.locator('#statsToolbar .inv-viewtab')).toHaveText(['By client', 'Cost', 'Trends']);
    await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveText('By client');
    for (const [tab, id] of [['clients', 'statsVerdict'], ['cost', 'statsVerdict'], ['trends', 'statsHeadline']]) {
      await page.locator(`#statsToolbar [data-action="invStatsTab"][data-tab="${tab}"]`).click();
      const v = page.locator('#statsToolbar > .inv-hero[data-verdict]');
      await expect(v).toHaveCount(1);
      await expect(v).toHaveAttribute('id', id);
      expect(await v.evaluate(el => (el as HTMLDetailsElement).open), tab + ': shut on the phone').toBe(false);
      // The verdict, then the period: one toolbar row.
      await expect(page.locator('#statsToolbar > *').nth(2)).toHaveClass(/inv-toolbar/);
    }
    // Trends: the headline's four figures are its factors, six months follows, top items folded.
    const head = page.locator('#statsHeadline');
    expect(await head.locator('[data-tile]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.tile))).toEqual(['revenue', 'tonnage', 'realisation', 'margin']);
    await expect(page.locator('#statsContent > *').first()).toHaveAttribute('data-card', 'months');
    expect(await page.locator('[data-card="top"]').evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open)).toBe(true);
    // Cost: the live cost and how much of it is measured; each component's source a badge.
    await page.locator('#statsToolbar [data-action="invStatsTab"][data-tab="cost"]').click();
    await expect(page.locator('#statsVerdict .inv-hero-title')).toContainText('% measured');
    await expect(page.locator('[data-card="livecost"] .inv-badge').first()).toBeVisible();
    // By client: realisation, concentration and the challan forecast fold, shut on the phone.
    await page.locator('#statsToolbar [data-action="invStatsTab"][data-tab="clients"]').click();
    for (const c of ['realisation', 'concentration', 'next']) {
      expect(await page.locator(`[data-card="${c}"]`).evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open), c).toBe(true);
    }
  });

  test('Cost keeps no list of bills: one line says where they are entered and opens the form there; their notes are on Money', async ({ page }) => {
    // A bill two months back with a note, and a later one voided: the voided bill is listed inside, never the head.
    const ym = (back: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - back); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const book = longBook() as any;
    book.costBills = [
      { id: 'CB-T1', kind: 'power', month: ym(2), amount: 41234.5, units: 3100, note: 'Paid at the counter with an older month', at: 1 },
      { id: 'CB-T2', kind: 'power', month: ym(1), amount: 99999, voided: true, voidReason: 'entered twice', at: 2 },
    ];
    await loadAppWithState(page, book);
    await switchTab(page, 'pageStats');
    await page.locator('#statsToolbar [data-action="invStatsTab"][data-tab="cost"]').click();
    // The tab map, TM3a: the bills are entered and kept on Money → Payments; the card's list repeated them.
    await expect(page.locator('[data-fold="cost-bills"]')).toHaveCount(0);
    await expect(page.locator('#liveCost [data-bill]')).toHaveCount(0);
    const line = page.locator('[data-cost-bills]');
    await expect(line).toContainText('Bills are entered in Money → Payments');
    await expect(line).not.toContainText('Paid at the counter');
    await line.locator('[data-action="invCostBillGo"]').click();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#pageFinance [data-bill-form]')).toBeVisible();
    // On Payments the bills fold to one row led by the latest that stands, the voided one muted inside, each with its note.
    const fold = page.locator('[data-fold="bills-entered"]');
    const head = fold.locator(':scope > summary');
    await expect(head).toContainText('1 bill entered, the latest ' + await g(page, `billsMonthLabel('${ym(2)}')`));
    await expect(head).toContainText('₹41,234.50');
    await expect(head).not.toContainText('99,999');
    await openFold(fold);
    await expect(fold.locator('.inv-row-muted')).toContainText('void: entered twice');
    await expect(fold).toContainText('Paid at the counter');
  });

  test('the dispatch cycle is Pipeline’s, over the last 90 days', async ({ page }) => {
    // Two invoices dispatched in the last 90 days (2 and 4 days after they were made) and one long before (30 days after).
    const day = 86400000, now = Date.now();
    const iso = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const inv = (id: string, age: number, after: number) => ({ id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date: iso(age), status: 'active',
      invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA PRESS', gstType: 'intra',
      items: [{ partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100 }], taxableValue: 100, grandTotal: 118,
      createdAt: now - age * day, dispatchedAt: now - age * day + after * day });
    await load(page, base({ clients: [{ id: 1, name: 'ALPHA PRESS', billingMode: 'weight', gstType: 'intra', isActive: true }],
      invoices: [inv('00001', 10, 2), inv('00002', 20, 4), inv('00003', 200, 30)], invNextNum: 4 } as any));
    await switchTab(page, 'pagePipeline');
    const card = page.locator('#pipeDispatch');
    await expect(card).toBeVisible();
    await expect(card).toContainText('last 90 days');
    // The two inside the window, averaged: (2 + 4) / 2.
    await expect(card.locator('.inv-row', { hasText: 'Created to dispatched' })).toContainText('3.0');
    await expect(card.locator('.inv-row', { hasText: 'Created to dispatched' })).toContainText('average of 2 invoices');
    // Stats keeps no Billing tab to hold it.
    await switchTab(page, 'pageStats');
    await expect(page.locator('#pageStats [data-action="invStatsTab"]')).toHaveText(['By client', 'Cost', 'Trends']);
  });

  test('the Planner is Play · Ledger · A day · Moves, one verdict card on every view, one toolbar row, rows on the phone', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pagePlanner');
    const views = page.locator('#pagePlanner .inv-viewtab');
    await expect(views).toHaveText(['Play', 'Ledger', 'A day', 'Moves']);
    for (const v of ['Play', 'Ledger', 'A day', 'Moves']) {
      await views.filter({ hasText: v }).click();
      await expect(page.locator('#pagePlanner [data-verdict]')).toHaveCount(1);
      await expect(page.locator('#plnVerdict [data-pl-goal]')).toHaveCount(1);
      expect(await page.locator('#plnVerdict [data-pl-hud]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.plHud))).toEqual(['margin', 'cash', 'cqi', 'score']);
      const tops = await page.locator('[data-pl-toolbar]').evaluate(el => Array.from(el.children).map(c => Math.round((c as HTMLElement).getBoundingClientRect().top / 8)));
      expect(new Set(tops).size, v + ': one toolbar row').toBe(1);
    }
    // Moves: the switch picks the kind, and the address says it.
    const kinds = page.locator('[data-pl-moves] .inv-seg-btn');
    await expect(kinds).toHaveText(['Plant', 'Tech tree', 'Staff', 'Clients', 'Finance']);
    await kinds.filter({ hasText: 'Tech tree' }).click();
    await expect(kinds.filter({ hasText: 'Tech tree' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => where(page)).toEqual(['pagePlanner', 'moves/tech']);
    // On the phone the lines are rows, not a table.
    await kinds.filter({ hasText: 'Plant' }).click();
    await expect(page.locator('#plnLines table')).toHaveCount(0);
    expect(await page.locator('#plnLines .inv-row').count()).toBeGreaterThan(0);
    // The goal's difficulty and the rest are behind More.
    await toolbarMore(page);
    await expect(page.locator('[data-tb-more-dialog] [data-tb-pick]').filter({ hasText: 'Make the report' })).toHaveCount(1);
    await expect(page.locator('[data-tb-more-dialog] [data-tb-pick]').filter({ hasText: /^Goal: / })).toHaveCount(3);
  });

  test('every preset hides the To-do, the recent invoices and Money; a layout of your own keeps them', async ({ page }) => {
    // A device on the Owner preset as an older build saved it: the three shown.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('p185-set')) return;
      sessionStorage.setItem('p185-set', '1');
      localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'owner', order: ['mtd', 'quick', 'money', 'todo', 'attendance', 'unbilled', 'production', 'power', 'stock', 'sync', 'zinc', 'recent'],
        hidden: { production: true, power: true, stock: true }, wide: { mtd: true, quick: true, recent: true } }));
    });
    await loadAppWithState(page, longBook());
    await openPulse(page);
    for (const w of ['money', 'todo', 'recent']) await expect(page.locator(`#homeWidgets [data-home-w="${w}"]`)).toHaveClass(/inv-hidden/);
    await expect(page.locator('#homeWidgets [data-home-w="mtd"]')).not.toHaveClass(/inv-hidden/);
    // A layout of the owner's own is kept as it is.
    await page.evaluate(() => localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom', order: ['mtd', 'money', 'todo', 'recent'], hidden: {}, wide: {} })));
    await page.reload();
    await waitForBoot(page);
    await openPulse(page);
    for (const w of ['money', 'todo', 'recent']) await expect(page.locator(`#homeWidgets [data-home-w="${w}"]`)).not.toHaveClass(/inv-hidden/);
  });

  test('the report on the page fits the phone’s width; the paper itself is unchanged', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    const fit = await page.evaluate(() => {
      const sheet = document.getElementById('rptSheet')!, doc = sheet.querySelector('.inv-rpt-doc') as HTMLElement;
      return { zoom: parseFloat(getComputedStyle(doc).zoom || '1'), docRight: doc.getBoundingClientRect().right, vw: document.documentElement.clientWidth,
        scrollW: document.documentElement.scrollWidth, sheetScroll: sheet.scrollWidth - sheet.clientWidth };
    });
    expect(fit.zoom).toBeLessThan(1);
    expect(fit.docRight).toBeLessThanOrEqual(fit.vw);
    expect(fit.scrollW).toBeLessThanOrEqual(fit.vw);
    expect(fit.sheetScroll).toBeLessThanOrEqual(1);
    // The paper is the paper: Print sends the same document to the print view, which prints it at life size, and the page
    // itself is never printed.
    await page.locator('#pageReports [data-action="invRptPrint"]').click();
    await expect(page.locator('#invPrintBody [data-rpt-doc]')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const paper = await page.evaluate(() => ({ zoom: parseFloat(getComputedStyle(document.querySelector('#invPrintBody .inv-rpt-doc')!).zoom || '1'),
      page: getComputedStyle(document.getElementById('pageReports')!).display }));
    expect(paper).toEqual({ zoom: 1, page: 'none' });
    await page.emulateMedia({ media: 'screen' });
  });

  test('TM2’s old places redirect: Stats’ Overview to Pulse, its Billing to Pipeline, a Planner kind to Moves, the To-do to Needs you', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const cases: Array<[string, string[]]> = [
      ['/?tab=pageStats&v=overview', ['pageHome', 'pulse']],
      ['/?tab=pageStats&v=billing', ['pagePipeline', 'awaiting']],
      ['/?tab=pagePlanner&v=plant', ['pagePlanner', 'moves/plant']],
      ['/?tab=pagePlanner&v=finance', ['pagePlanner', 'moves/finance']],
      ['/?tab=pageTodo', ['pageHome', 'needs']],
    ];
    for (const [url, to] of cases) {
      await page.goto(url);
      await waitForBoot(page);
      await expect.poll(() => where(page), url).toEqual(to);
      await expect(page.locator('#' + to[0])).toHaveClass(/inv-page-active/);
    }
    // A Planner kind's old address opens Moves on that kind.
    await page.goto('/?tab=pagePlanner&v=tech');
    await waitForBoot(page);
    await expect(page.locator('[data-pl-moves] .inv-seg-btn[aria-pressed="true"]')).toHaveText('Tech tree');
    // A task saved naming the old Stats tabs lands on their new homes.
    await g(page, `todoGo({ kind: 'stats', tab: 'overview' })`);
    await expect(page.locator('#homePulse')).toBeVisible();
    await g(page, `todoGo({ kind: 'stats', tab: 'billing' })`);
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    expect(todayIso()).toBeTruthy();
  });
});
