import { test, expect } from '@playwright/test';
import { loadAppWithState, openPulse } from './fixtures';
import { sweepState, bigSweepState, walkPages, walkDialogs, problems, sweep, type Stop } from './sweep-fixture';

// P76: design system step 4, the clean-up. Every screen, every view tab on it and every dialog, on the phone, in
// both themes: no class the design system retired (§6's "Replaces" lists) is drawn anywhere, every inv- class the
// app draws is one the stylesheet defines (or a named hook), no <select> carries a data-action (a select speaks
// through `change`), no id is drawn twice, and no page renders blank. Nothing throws on the way round.

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen and dialog is v2.0 only (${scheme})`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ colorScheme: scheme });
    await loadAppWithState(page, sweepState());
    const stops: Stop[] = [];
    await walkPages(page, `phone-${scheme}`, stops);
    await walkDialogs(page, `phone-${scheme}`, stops);
    expect(stops.length).toBeGreaterThan(40);
    expect(problems(stops)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('a crore-sized figure and a long client name fit every screen on the phone', async ({ page }) => {
  // The polish pass (27 Sep 2026): at ₹12,34,56,789.00 Home's revenue tile was cut off by its box, and a long total pushed the
  // action bar's figure out of its column. Every screen and dialog again, with nothing past the right edge and no figure cut.
  test.setTimeout(180_000);
  await loadAppWithState(page, bigSweepState());
  const stops: Stop[] = [];
  await walkPages(page, 'phone-big', stops);
  await walkDialogs(page, 'phone-big', stops);
  // The invoice form carrying that total in its action bar.
  await page.evaluate(`switchTab('pageCreate'); selectClient(2); addLineItem();
    invoiceForm.items[0].partNumber = 'BRKT-1'; invoiceForm.items[0].qty = 10991241.8; invoiceForm.items[0].rate = 9.5;
    recalcLineItem(invoiceForm.items[0], S.clients[1]); renderCreateForm();`);
  await expect(page.locator('#invGrandTotal')).toContainText('₹12,32,');
  stops.push(await sweep(page, 'create, a crore total'));
  expect(problems(stops, { cutMeta: false })).toEqual([]);
});

test('a crore in a tile breaks after a comma group, and a cut meta line keeps its date and its full text', async ({ page }) => {
  // The open items (27 Sep 2026): Home's revenue tile broke "₹10,46,48,655." / "51". A figure breaks only after a comma
  // (figWrapHtml), its last group and paise kept whole; the sweep's brokenFigures reads every tile the same way.
  await loadAppWithState(page, bigSweepState());
  await openPulse(page);
  const lines = await page.evaluate(() => {
    const el = document.getElementById('mtdRevenue')!;
    const out: string[] = [];
    let top = -1;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      for (let i = 0; i < n.textContent!.length; i++) {
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
        const t = Math.round(r.getClientRects()[0].top);
        if (t > top + 2) { out.push(''); top = t; }
        out[out.length - 1] += n.textContent![i];
      }
    }
    return out;
  });
  expect(lines.join('')).toMatch(/^₹\d{1,2},\d\d,\d\d,\d{3}\.\d\d$/);
  expect(lines.length).toBeGreaterThan(1);
  for (const l of lines.slice(0, -1)) expect(l).toMatch(/,$/);
  expect(lines[lines.length - 1]).toMatch(/^\d{3}\.\d\d$/);
  // Recent invoices: the date leads the meta line, so an 80-character name cannot push it out of sight, and the cut
  // line carries its full text.
  const meta = page.locator('#pageHome [data-home-w="recent"] .inv-row-meta', { hasText: 'ALPHA FORGINGS AND HEAVY' }).first();
  await expect(meta).toHaveText(/^\d\d \w{3} \d{4} · ALPHA/);
  await expect(meta).toHaveAttribute('title', /UNIT II, GAMHARIA\)$/);
});

test('no browser pop-up is called anywhere in the source: every message has an in-app path', async ({ page }) => {
  // Owner, 27 Sep 2026: a browser can block confirm(), alert() and prompt(), and a message that never appears was
  // never given. Every one goes through uiConfirm / uiAlert / uiPrompt (state.js), which fall back to a banner.
  // Comments are stripped first, so explaining the rule does not break it.
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(__dirname, '..', '..', 'split');
  const hits: string[] = [];
  for (const f of fs.readdirSync(dir).filter(f => /\.js$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
    src.split('\n').forEach((line, i) => {
      if (/(^|[^\w.$])(window\.)?(confirm|alert|prompt)\s*\(/.test(line)) hits.push(f + ':' + (i + 1) + ': ' + line.trim());
    });
  }
  expect(hits).toEqual([]);
  await page.goto('about:blank');
});

test('no <select> anywhere carries a data-action, in the source either', async ({ page }) => {
  // The rendered sweep reads what is on screen; this reads every template, so a select on a screen the sweep did
  // not reach is caught too.
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(__dirname, '..', '..', 'split');
  const hits: string[] = [];
  for (const f of fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.match(/<select\b[^>]*>/g) || []) if (/data-action=/.test(m)) hits.push(f + ': ' + m);
  }
  expect(hits).toEqual([]);
  await page.goto('about:blank');
});
