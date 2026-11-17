import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { walkPages, walkDialogs, setStopHook, type Stop } from './sweep-fixture';
import { fitState, fitScan, fitShown, CI_TEXT, type FitHit } from './fit-fixture';

// P274: text in a box fits the box, on the phone. Every page, view tab and dialog on a book with every name and figure that runs
// long (fitState: an 80-character client, a 42-character part, a 100-character description, a crore), at 360px (the narrowest
// phone in use) and at the Pixel 5's 393px in dark, with CI's text width laid over (tests.md: CI draws text ~0.5% wider). Nothing
// spills past its box, is cut by a box that draws no ellipsis, runs into a padded side, hugs a drawn edge, or is ellipsised to
// under three characters (fitScan). Then each fix the sweep found, measured on its own.

async function at360(page: Page) { await page.setViewportSize({ width: 360, height: 800 }); }

for (const [width, scheme] of [[360, 'light'], [393, 'dark']] as const) {
  test(`every screen and dialog at ${width}px (${scheme}): text fits its box`, async ({ page }) => {
    test.setTimeout(240_000);
    if (width === 360) await at360(page);
    await page.emulateMedia({ colorScheme: scheme });
    await loadAppWithState(page, fitState());
    await page.addStyleTag({ content: CI_TEXT });
    const hits: FitHit[] = [];
    setStopHook(async (p, where) => { hits.push(...await fitScan(p, where)); });
    const stops: Stop[] = [];
    try {
      await walkPages(page, `p274-${width}-${scheme}`, stops);
      await walkDialogs(page, `p274-${width}-${scheme}`, stops);
    } finally { setStopHook(null); }
    expect(stops.length).toBeGreaterThan(40);
    expect(fitShown(hits)).toEqual([]);
  });
}

test('the top bar names the place at 360px', async ({ page }) => {
  // Eight 8px gaps beside the back arrow and five tools left the title 24px: "O…" for Office, "M…" for Mine. A short name is whole
  // now, and a long one keeps 4rem (Knowledge, behind the arrow, reads "Knowle…" with its full name in its title).
  await at360(page);
  await loadAppWithState(page, fitState());
  for (const id of ['pageRegister', 'pageHistory', 'pageMessages', 'pageKnow']) {
    await switchTab(page, id);
    const t = await page.locator('#topbarTitle').evaluate(el => ({ text: el.textContent!, sw: el.scrollWidth, cw: el.clientWidth }));
    const cut = t.sw > t.cw + 1;
    if (t.text.length <= 7) expect(cut, `${id}: ${t.text} cut to ${t.cw}px`).toBe(false);
    else if (cut) expect(t.cw, `${id}: ${t.text}`).toBeGreaterThanOrEqual(64);
  }
});

test('a check-in note says its sentence inside its panel, the dot on its first line', async ({ page }) => {
  // A dot is one line (a status word); a note's dot says a sentence, and ran 55px past the panel at 360px.
  await at360(page);
  await loadAppWithState(page, fitState());
  const d = todayIso().split('-').reverse().join('/');
  await page.evaluate(t => (0, eval)(`S.staff[0].card = 'SEP-0001'; ckReviewOpen(${JSON.stringify(t)})`),
    `SEP check-in\nCard SEP-0001\nTime ${d} 08:20\nPlace 22.800100,86.150100 ±12 m\nCode ABCD`);
  const notes = page.locator('[data-ck-review] [data-ck-note] .inv-dot');
  expect(await notes.count()).toBeGreaterThan(1);
  const r = await page.locator('[data-ck-review] .inv-panel').evaluate(panel => {
    const pb = panel.getBoundingClientRect();
    return Array.from(panel.querySelectorAll('[data-ck-note] .inv-dot')).map(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const lines = Array.from(range.getClientRects()).filter(q => q.width > 1);
      const dot = getComputedStyle(el, '::before');
      const b = el.getBoundingClientRect();
      return { text: el.textContent, right: Math.max(...lines.map(q => q.right)), edge: pb.right - 1, lines: new Set(lines.map(q => Math.round(q.top))).size,
        dotMid: getComputedStyle(el).alignItems === 'center' ? b.top + b.height / 2 : b.top + parseFloat(dot.marginTop) + parseFloat(dot.height) / 2, firstMid: Math.min(...lines.map(q => q.top)) + Math.min(...lines.map(q => q.height)) / 2 };
    });
  });
  expect(r.some(x => x.lines > 1)).toBe(true);
  for (const x of r) {
    expect(x.right, x.text!).toBeLessThanOrEqual(x.edge);
    expect(Math.abs(x.dotMid - x.firstMid), x.text!).toBeLessThan(3);
  }
});

test('the planner board heads each month and year whole', async ({ page }) => {
  // A month is a 24th of the board, and its head kept a cell's 12px a side: 12px of text, "’26" broken after its first figure and
  // each month's name touching the next.
  await at360(page);
  await loadAppWithState(page, fitState());
  await switchTab(page, 'pagePlanner');
  const heads = await page.locator('#plnBoard thead th:not(:first-child)').evaluateAll(ths => ths.map(th => {
    const btn = th.querySelector('button')!, yr = th.querySelector('.inv-row-meta') as HTMLElement | null;
    const r = document.createRange(); if (yr) r.selectNodeContents(yr);
    return { m: btn.textContent, btnFits: btn.scrollWidth <= btn.clientWidth + 1, yr: yr ? yr.textContent : null,
      yrLines: yr ? new Set(Array.from(r.getClientRects()).filter(q => q.width > 1).map(q => Math.round(q.top))).size : 0 };
  }));
  expect(heads.length).toBe(24);
  for (const h of heads) {
    expect(h.btnFits, h.m!).toBe(true);
    if (h.yr) expect(h.yrLines, h.yr).toBe(1);
  }
});

test('a scale of five reads every label at 360px', async ({ page }) => {
  // A worker's check-in, 1 · Low to 5 · Driven: each segment ellipsised to "1 · Lo…" … "5 · D…". A label takes a second line at
  // a space before it is cut, and five segments keep a 4px inset.
  await at360(page);
  await loadAppWithState(page, fitState());
  await page.evaluate(() => (0, eval)('pplCheckinOpen(1)'));
  const segs = await page.locator('.inv-dialog .inv-seg[aria-label="How they seem"] .inv-seg-btn').evaluateAll(bs => bs.map(b => ({
    t: b.textContent, cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1, h: b.getBoundingClientRect().height })));
  expect(segs.length).toBe(5);
  for (const s of segs) { expect(s.cut, s.t!).toBe(false); expect(s.h).toBeGreaterThanOrEqual(43.5); }
});

test('a chart drawn in rows lets go of whole rows in its card', async ({ page }) => {
  // Stats' "Who fills the plant": three clients' rows, the scale and the keys in a 120px picture, the third row cut through the
  // middle and the keys under the card's foot. Past the room its keys go, then its last rows, whole.
  await at360(page);
  await loadAppWithState(page, fitState());
  await switchTab(page, 'pageStats');
  const viz = page.locator('.inv-widget[data-w="share"] [data-wdg-viz]');
  await expect(viz.locator('.inv-chart-row').first()).toBeVisible();
  const r = await viz.evaluate(v => {
    const vb = v.getBoundingClientRect();
    const shown = Array.from(v.querySelectorAll('.inv-chart-row, .inv-chart-scale, .inv-chart-keys')).filter(e => (e as HTMLElement).checkVisibility());
    return { over: v.scrollHeight - v.clientHeight, rows: shown.filter(e => e.matches('.inv-chart-row')).length,
      cut: shown.filter(e => e.getBoundingClientRect().bottom > vb.bottom + 1).map(e => e.className) };
  });
  expect(r.rows).toBeGreaterThan(0);
  expect(r.cut).toEqual([]);
  expect(r.over).toBeLessThanOrEqual(1);
});
