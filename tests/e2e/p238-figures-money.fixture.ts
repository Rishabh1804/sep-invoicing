import { expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';
import { walkFamily, geistReady } from './p235-family.fixture';

// P238 (UI pass 3, U2R; docs/UI_PASS_3.md §24k–§24l), shared by the phone and the desktop: money on a board is short (inrCard), its
// exact amount the element's title, a rate keeping its paise; a Ledger's lines are whole rupees adding up to the total ruled under them;
// a figure is Geist with tabular figures on every screen, an identifier Geist Mono with its slashed zero. Paper is P228's.

/* inrCard's table (§24k) and its edges: every step through gstRound (HR-8). */
export async function inrCardCases(page: Page) {
  await loadAppWithState(page, sweepState());
  const got = await page.evaluate(() => {
    const w = window as any;
    return [0, 66476, 99999.4, 99999.6, 349800, 119656.8, 9999999, 12384210, 123456789, -66476.4, 0.4, -0.4, 1e11, 100000, 99999.5]
      .map(v => [v, w.inrCard(v).text]);
  });
  expect(got).toEqual([
    [0, '₹0'], [66476, '₹66,476'], [99999.4, '₹99,999'], [99999.6, '₹1.00 L'], [349800, '₹3.50 L'], [119656.8, '₹1.20 L'], [9999999, '₹1.00 Cr'],
    [12384210, '₹1.24 Cr'], [123456789, '₹12.35 Cr'], [-66476.4, '−₹66,476'], [0.4, '₹0'], [-0.4, '₹0'], [1e11, '₹10,000.00 Cr'], [100000, '₹1.00 L'],
    // Half a rupee rounds away from zero (gstRound), so 99,999.50 is a lakh.
    [99999.5, '₹1.00 L']]);
  const parts = await page.evaluate(() => { const c = (window as any).inrCard(-123456.78); return [c.num, c.unit, c.neg, c.exact]; });
  expect(parts).toEqual(['1.23', 'L', true, '-₹1,23,456.78']);
  // Drawn as a figure: the rupee raised and small, the unit after it, the exact amount the title.
  const html = await page.evaluate(() => (window as any).inrFigHtml(349800));
  expect(html).toContain('title="₹3,49,800.00"');
  expect(html).toContain('<span class="inv-cur">₹</span>3.50<span class="inv-unit">L</span>');
}

/* On the board: no amount of a thousand or more with its paise, each figure's exact amount its title, a rate with its paise, and a
   Ledger's lines whole and adding up to the total ruled under them. */
export async function boardMoneyProblems(page: Page, where: string): Promise<string[]> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const money = /([−-]?)₹([\d,]+\.\d\d)\b/g;
    document.querySelectorAll('#homeBoard .inv-widget').forEach(el => {
      const card = el as HTMLElement, at = card.dataset.w + '@' + card.dataset.size;
      // Text as drawn, a chart's own <title>s and its axis aside (a chart keeps formatInrShort, its titles stay exact).
      const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const n = walk.currentNode as Text, p = n.parentElement as HTMLElement;
        if (!p || p.closest('svg, title, [hidden]') || !p.checkVisibility()) continue;
        let m;
        money.lastIndex = 0;
        while ((m = money.exec(n.nodeValue || ''))) {
          const v = Number(m[2].replace(/,/g, ''));
          if (v >= 1000) out.push(at + ': an amount with its paise on a board: ' + m[0] + ' in "' + (n.nodeValue || '').trim().slice(0, 40) + '"');
        }
      }
      // A figure that is money says its exact amount in its title.
      card.querySelectorAll('.inv-widget-fig').forEach(f => {
        if (/₹/.test(f.textContent || '') && /\s[LC]r?$|L$|Cr$/.test((f.textContent || '').trim()) && !f.querySelector('[title*="₹"]') && !(f as HTMLElement).title)
          out.push(at + ': a short figure with no exact title: ' + (f.textContent || '').trim());
      });
      // A Ledger of amounts: every line whole, the total ruled only where the lines (and the rest's sum) add up to it.
      card.querySelectorAll('.inv-ledger:not([data-rate])').forEach(lg => {
        const lines = Array.from(lg.querySelectorAll(':scope > .inv-ledger-line')) as HTMLElement[];
        lines.forEach(l => { if (l.dataset.amt != null && Math.round(Number(l.dataset.amt)) !== Number(l.dataset.amt)) out.push(at + ': a Ledger line not whole: ' + l.dataset.amt); });
        const total = lg.querySelector(':scope > .inv-ledger-total') as HTMLElement | null;
        if (!total) return;
        const parts = lines.filter(l => l !== total && !l.classList.contains('inv-ledger-rest'));
        const sum = parts.reduce((s, l) => s + Number(l.dataset.amt || 0), 0);
        if (Math.abs(sum - Number(total.dataset.amt)) > 0.5 * Math.max(1, parts.length)) out.push(at + ': a total ruled under lines that do not add up: ' + sum + ' against ' + total.dataset.amt);
      });
      // A rate keeps its paise.
      card.querySelectorAll('.inv-ledger[data-rate] .inv-ledger-amt').forEach(a => {
        const t = (a.textContent || '').trim();
        if (/₹/.test(t) && !/\.\d\d/.test(t)) out.push(at + ': a rate without its paise: ' + t);
      });
    });
    return out;
  });
  return bad.map(b => where + ' · ' + b);
}

export async function boardMoney(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  const { bad, drawn } = await walkFamily(page, ['long', 'crore'], boardMoneyProblems);
  expect(drawn).toBeGreaterThan(60);
  expect(errs).toEqual([]);
  expect(bad).toEqual([]);
}

/* Figures in Geist with tabular figures, identifiers in Geist Mono with a slashed zero: on the board and on the screens behind it. */
export async function faces(page: Page) {
  await loadAppWithState(page, sweepState());
  await geistReady(page);
  const read = (sel: string) => page.locator(sel).first().evaluate(e => { const c = getComputedStyle(e); return { f: c.fontFamily, n: c.fontVariantNumeric }; });
  for (const sel of ['#homeBoard .inv-widget-fig', '.inv-mast-clock']) {
    const r = await read(sel);
    expect(r.f, sel).toMatch(/^"?Geist"?,/);
    expect(r.n, sel).toContain('tabular-nums');
    expect(r.n, sel).not.toContain('slashed-zero');
  }
  await switchTab(page, 'pageRegister');
  for (const sel of ['#pageRegister .inv-num', '#pageRegister .inv-id']) {
    if (!(await page.locator(sel).count())) continue;
    const r = await read(sel);
    if (sel.endsWith('inv-id')) { expect(r.f, sel).toMatch(/^"?Geist Mono"?,/); expect(r.n, sel).toContain('slashed-zero'); }
    else { expect(r.f, sel).toMatch(/^"?Geist"?,/); expect(r.n, sel).toContain('tabular-nums'); }
  }
}
