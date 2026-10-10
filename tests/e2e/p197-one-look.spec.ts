import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { longBook, oneLookProblems, walkOneLook } from './load-fixture';

// P197: one look (docs/TAB_MAP.md §3e, I11; owner, 9 Oct 2026: "UI still feels inconsistent to me, maybe spec will address it").
// The census found the components alike everywhere and the screens put together five ways. Every screen now declares its kind
// (an overview, a work screen, a document or a form), wears only the box looks on LOOKS, and, once a step has assembled it
// (ONE_LOOK), keeps its kind's anatomy: a work screen leads with its one verdict card, then one toolbar row, never a page-head
// line, a tile strip or a callout leading, one action at a row's end on the phone. TM1 assembles no screen; the census of every
// screen is attached as the baseline each step's report starts from. The long book is made up; the face and clock are pinned.

test('every screen declares its kind and wears only the system’s looks; the screens assembled keep their anatomy (phone)', async ({ page }) => {
  test.setTimeout(300_000);
  const { errs, bad, report } = await walkOneLook(page);
  // The map's screens, Bills & notes gone (TM3a), and the Overviews of People, Production, Stock and Power (TM4).
  expect(Object.keys(report).length, 'the whole map walked').toBeGreaterThanOrEqual(46);
  expect(errs, 'no page error on any screen').toEqual([]);
  expect(bad).toEqual([]);
});

/* ---------- The anatomy's checks have teeth: screens the test draws, right and wrong ---------- */

/* Hides the page's own blocks and draws `html` in their place, declared as `kind`. */
async function drawScreen(page: Page, kind: string, html: string) {
  await page.evaluate(([k, h]) => {
    const act = document.querySelector('.inv-page.inv-page-active') as HTMLElement;
    Array.from(act.children).forEach(c => { (c as HTMLElement).style.display = 'none'; });
    document.getElementById('p197')?.remove();
    const d = document.createElement('div');
    d.id = 'p197';
    d.innerHTML = h;
    act.appendChild(d);
    act.dataset.screen = k;
  }, [kind, html]);
}
const verdict = `uiVerdictHtml({ screen: 'Test · 4 rows', verdict: '1 row needs you', tone: 'warning', factors: [{ label: 'Late', fig: '1', tone: 'warning' }] })`;
const toolbar = `'<div class="inv-toolbar"><div class="inv-search"><input type="search" aria-label="Search"></div>' + uiToolbarMoreHtml([{ label: 'Export', action: 'invSearchOpen' }]) + '</div>'`;
const list = `'<div class="inv-panel inv-panel-flush"><div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">Row</span></span>' + uiRowEndHtml('₹10.00', { tone: 'ok', word: 'Paid' }) + '</div></div>'`;

test('the anatomy checks pass a work screen assembled to one look and name each way one can go wrong', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageFloor');
  const g = (e: string) => page.evaluate(x => (0, eval)(x), e) as Promise<string>;
  await drawScreen(page, 'work', await g(`${verdict} + ${toolbar} + ${list}`));
  expect(await oneLookProblems(page)).toEqual([]);

  // Everything the census found leading screens, at once.
  await drawScreen(page, 'work', await g(`'<div class="inv-pagehead"><span class="inv-pagehead-meta">4 rows · 1 late</span></div>' +
    '<div class="inv-tiles"><div class="inv-tile"><div class="inv-tile-label">A</div><div class="inv-tile-value">1</div></div></div>' +
    '<div class="inv-callout inv-callout-info">Read this first</div>' + ${verdict} + ${verdict} +
    '<div class="inv-toolbar"><button class="inv-btn">A</button></div><div class="inv-toolbar"><button class="inv-btn">B</button></div>' +
    '<div class="inv-panel inv-panel-flush"><div class="inv-row"><span class="inv-row-main">Row</span><span class="inv-row-end">' +
    '<button class="inv-btn inv-btn-sm">Correct</button><button class="inv-btn inv-btn-sm">Void</button></span></div></div>'`));
  const p = await oneLookProblems(page);
  expect(p).toEqual(expect.arrayContaining([
    'leads with inv-pagehead, not the verdict card', '2 verdict cards', '2 toolbars', 'the toolbar is not under the verdict card',
    'a page-head line', 'a tile strip of its own', 'a callout leads', '1 row ends with more than one action']));

  // A toolbar wrapping to a second row.
  await drawScreen(page, 'work', await g(`${verdict} + '<div class="inv-toolbar">' + Array.from({ length: 9 }, function (x, i) { return '<button class="inv-btn">Action ' + i + '</button>'; }).join('') + '</div>'`));
  expect((await oneLookProblems(page)).some(x => /^the toolbar runs to \d+ rows$/.test(x))).toBe(true);

  // An overview leads with a hero carrying its verdict; a panel does not do.
  await drawScreen(page, 'overview', await g(`'<div class="inv-toolbar"><button class="inv-btn">Today</button></div><div class="inv-heroes">' + ${verdict} + '</div>'`));
  expect(await oneLookProblems(page)).toEqual([]);
  await drawScreen(page, 'overview', await g(`'<div class="inv-panel"><div class="inv-panel-head">Panel</div></div>'`));
  expect(await oneLookProblems(page)).toEqual(['leads with inv-panel, not a hero with its verdict']);

  // A document's paper fits the width; a form's action bar is last.
  await drawScreen(page, 'document', `<div class="inv-scroll-x"><div class="inv-rpt-doc"><div class="p197-wide"></div></div></div>`);
  await page.evaluate(() => { (document.querySelector('.p197-wide') as HTMLElement).style.width = '1600px'; (document.querySelector('.p197-wide') as HTMLElement).style.height = '20px'; });
  expect((await oneLookProblems(page)).some(x => x.startsWith('the paper scrolls sideways'))).toBe(true);
  await drawScreen(page, 'form', `<div class="inv-actionbar"><button class="inv-btn inv-btn-primary">Save</button></div><div class="inv-panel"><div class="inv-panel-head">Fields</div></div>`);
  expect(await oneLookProblems(page)).toEqual(['the action bar is not last']);
});
