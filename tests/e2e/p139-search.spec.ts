import { test, expect } from '@playwright/test';
import { answerAsk, loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';
import { CLIENTS, challan, dayOff, inv, openSearch, search, searchBook, titles } from './p139-search.fixture';

// P139: search (Direction B, step 6; UX overhaul 2, step 4). One index over the book and the screens, the palette over the
// screen, and its jumps. A number matches whole (834 finds challan 834 and invoice 00834, never 8341), an amount to the
// paisa, a cheque number its deposit, a word the start of a word; results come grouped by kind, five a kind; Enter opens;
// Recent before anything is typed; Esc and back close it. Every name and figure here is made up; every date is built from
// today.

test.describe('P139: search on the phone', () => {
  test('a number matches whole: 834 finds challan 834 and invoice 00834, never 8341', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    await search(page, '834');
    expect(await titles(page, 'challan')).toEqual(['Ch. 834']);
    // The invoice whose own number it is leads; one citing challan 834 is in its group too.
    expect((await titles(page, 'invoice'))[0]).toBe('SEP/TEST-00834');
    const all = (await titles(page)).join(' | ');
    expect(all).not.toContain('8341');
    // Leading zeros are not part of a number, and the challan number written whole is one number.
    await search(page, '00834');
    expect(await titles(page, 'challan')).toEqual(['Ch. 834']);
    await search(page, '877/26-27');
    expect(await titles(page, 'challan')).toEqual(['Ch. 0877/26-27']);
    await search(page, '8341');
    expect(await titles(page, 'challan')).toEqual(['Ch. 8341']);
    expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-08341']);
    // A number written with its punctuation: the invoice's own, a P.O.
    await search(page, 'SEP/TEST-00900');
    expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-00900']);
    await search(page, 'da1/00877');
    expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-00900']);
  });

  test('an amount matches to the paisa, written either way, and a cheque number finds its deposit', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    for (const q of ['5902.12', '5,902.12', '₹5,902.12']) {
      await search(page, q);
      expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-00900']);
      expect(await titles(page, 'cn')).toEqual(['CN/007/26-27']);
    }
    // Not to the paisa is not the amount.
    await search(page, '5902.1');
    await expect(page.locator('#srchList .inv-empty')).toContainText('Nothing matches');
    await search(page, '525428');
    const bank = page.locator('#srchList [aria-labelledby="srchG-bank"] [role="option"]');
    await expect(bank).toHaveCount(1);
    await expect(bank).toContainText('cheque 525428');
    // The deposit is the only result, so it is under the cursor: Enter lands on Money → Bank filtered to it, its row open.
    await expect(bank).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invFinTab"][data-tab="bank"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#bankSearch')).toHaveValue('525428');
    await expect(page.locator('[data-bank-row="R1"]')).toBeVisible();
    await expect(page.locator('[data-bank-edit="R1"]')).toBeVisible();
    await expect(page.locator('[data-bank-row="R2"]')).toHaveCount(0);
  });

  test('a client\'s name, by the start of its words, finds the client and its invoices; a date finds its day', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    await search(page, 'alph');
    expect(await titles(page, 'client')).toEqual(['ALPHA FORGINGS PRIVATE LIMITED']);
    // Its invoices, the latest first, and nobody else's.
    expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-00900', 'SEP/TEST-00834']);
    // Case and punctuation fold, words in any order, a name written as one word.
    await search(page, 'FORGINGS alpha');
    expect(await titles(page, 'client')).toEqual(['ALPHA FORGINGS PRIVATE LIMITED']);
    await search(page, 'alphaforg');
    expect(await titles(page, 'client')).toEqual(['ALPHA FORGINGS PRIVATE LIMITED']);
    // Parts, a worker by a spelling the roster keeps, a stock line by its alias, a phone number.
    await search(page, 'clamp 66x42');
    expect(await titles(page, 'part')).toEqual(['CLAMP 66X42']);
    await search(page, 'ramoo');
    expect(await titles(page, 'worker')).toEqual(['Ramu Kumar']);
    await search(page, 'nitrik');
    expect(await titles(page, 'stock')).toEqual(['Nitric acid']);
    await search(page, '9876543210');
    expect(await titles(page, 'client')).toEqual(['ALPHA FORGINGS PRIVATE LIMITED']);
    // A date: the invoices and the bank rows of that day.
    const d = dayOff(-1).split('-');
    await search(page, `${d[2]}/${d[1]}/${d[0]}`);
    expect(await titles(page, 'invoice')).toEqual(['SEP/TEST-00900', 'SEP/TEST-00901']);
    expect(await titles(page, 'bank')).toEqual(['SMS CHARGES']);
  });

  test('a screen by its name or its old one; Enter lands on it as a step, and back returns', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    await search(page, 'live cost');
    // The screen leads, ahead of the Settings section of the same words.
    expect((await titles(page, 'screen')).slice(0, 2)).toEqual(['Live cost', 'Live cost fallbacks']);
    await page.keyboard.press('Enter');
    await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invStatsTab"][data-tab="cost"]')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('v')).toBe('cost');
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-search]')).toHaveCount(0);
    // The old name finds the new: IM is Challans, Register is Invoices.
    await openSearch(page);
    await search(page, 'im');
    expect(await titles(page, 'screen')).toContain('Challans');
    await search(page, 'register');
    expect((await titles(page, 'screen'))[0]).toBe('Invoices');
    await search(page, 'zinc rate');
    expect((await titles(page, 'screen'))[0]).toBe('Zinc rate');
    await page.keyboard.press('Enter');
    await expect(page.locator('#settingsScrim details[data-sec="zinc"]')).toHaveAttribute('open', '');
  });

  test('arrow keys move the cursor and Enter opens it; Recent leads before anything is typed', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    // Before typing: Go to, the workspaces' screens.
    await expect(page.locator('#srchG-goto')).toBeVisible();
    await expect(page.locator('#srchG-recent')).toHaveCount(0);
    await search(page, 'gamma');
    const opts = page.locator('#srchList [role="option"]');
    // Invoices, Challans, Clients, Bank rows, in that order of kinds: the first is under the cursor.
    expect(await titles(page)).toEqual(['SEP/TEST-00901', 'Ch. 0877/26-27', 'GAMMA PRESS WORKS', 'NEFT-GAMMA PRESS WORKS']);
    await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(opts.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#srchInput')).toHaveAttribute('aria-activedescendant', 'srchOpt1');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');     // wraps to the last
    await expect(opts.nth(3)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');   // and back round to the first
    await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(opts.nth(2)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    // A client on the phone: Clients, its sheet open.
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invSaveClient"][data-client="3"][data-mode="edit"]')).toBeVisible();
    await page.locator('.inv-scrim-dialog .inv-dialog-close').click();
    // Recent: what was opened from here, first.
    await openSearch(page);
    await expect(page.locator('#srchG-recent')).toBeVisible();
    expect((await titles(page, 'recent'))[0]).toBe('GAMMA PRESS WORKS');
    await expect(page.locator('#srchList [role="option"]').first()).toHaveAttribute('aria-selected', 'true');
  });

  test('a challan opens on its tab with its row in sight; an invoice opens its detail; Show all lists a kind', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await openSearch(page);
    await search(page, '834');
    await page.locator('#srchList [aria-labelledby="srchG-challan"] [role="option"]').click();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invIMTab"][data-tab="awaiting"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#pageIM [data-im="IM-834"]')).toBeInViewport();
    await openSearch(page);
    await search(page, '834');
    await page.locator('#srchList [aria-labelledby="srchG-invoice"] [role="option"]').first().click();
    await expect(page.locator('[data-inv-detail="INV-834"]')).toBeVisible();
    await page.locator('.inv-scrim-dialog .inv-dialog-close').click();
    // More than five of a kind: five, then Show all, which lists the rest in place.
    await openSearch(page);
    await search(page, 'sep/test');
    await expect(page.locator('#srchList [aria-labelledby="srchG-invoice"] [role="option"]')).toHaveCount(4);
    await search(page, 'settings');
    const screens = page.locator('#srchList [aria-labelledby="srchG-screen"] [role="option"]');
    await expect(screens).toHaveCount(6);
    await expect(screens.last()).toContainText(/Show all \d+ screens/);
    await screens.last().click();
    expect(await screens.count()).toBeGreaterThan(6);
    await expect(screens.nth(5)).toHaveAttribute('aria-selected', 'true');
  });

  test('a jump from search off a form with unsaved work asks first; the screen already open is no new step', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imVehicleNo').fill('JH 05 1234');
    await openSearch(page);
    await search(page, 'live cost');
    await page.keyboard.press('Enter');
    // Stay keeps the challan as typed.
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await openSearch(page);
    await search(page, 'live cost');
    await page.keyboard.press('Enter');
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
    await page.goBack();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    // Invoices picked on Invoices moves nothing: back goes where it went before.
    await switchTab(page, 'pageRegister');
    await openSearch(page);
    await search(page, 'invoices');
    expect((await titles(page, 'screen'))[0]).toBe('Invoices');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  });

  test('Esc and back close search, and leave the screen where it was', async ({ page }) => {
    await loadAppWithState(page, searchBook());
    await switchTab(page, 'pageClients');
    await openSearch(page);
    await search(page, 'alpha');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
    await openSearch(page);
    await page.goBack();
    await expect(page.locator('[data-search]')).toHaveCount(0);
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
    // Its steps are passed over: one more back reaches Home.
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  });

  test('the index: built under 150 ms on the sweep book, a query under 30 ms; a plain list a chatbot can read', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    const t = await page.evaluate(() => {
      const w: any = window;
      const runs: Array<{ build: number; query: number }> = [];
      for (let i = 0; i < 5; i++) {
        w._srchCache = null;
        const t0 = performance.now(); w.srchIndex(); const t1 = performance.now();
        w.srchQuery('alpha forg'); w.srchQuery('5902.12'); w.srchQuery('801');
        const t2 = performance.now();
        runs.push({ build: t1 - t0, query: (t2 - t1) / 3 });
      }
      const list = w.srchIndex();
      return { runs, n: list.length, kinds: [...new Set(list.map((e: any) => e.kind))], keys: Object.keys(list[0]).sort(),
        // Kept until the book changes: the same list twice, a new one after a save.
        same: w.srchIndex() === list, after: (w.saveState(), w.srchIndex() !== list) };
    });
    const build = Math.min(...t.runs.map(r => r.build)), query = Math.min(...t.runs.map(r => r.query));
    console.log(`P139 timings on the sweep book (${t.n} entries): index ${build.toFixed(1)} ms, a query ${query.toFixed(2)} ms`);
    expect(build).toBeLessThan(150);
    expect(query).toBeLessThan(30);
    expect(t.kinds).toEqual(expect.arrayContaining(['screen', 'invoice', 'challan', 'client', 'part', 'worker', 'stock', 'bank', 'quote', 'cn']));
    expect(t.keys).toEqual(['go', 'id', 'kind', 'sub', 'text', 'title']);
    expect(t.same).toBe(true);
    expect(t.after).toBe(true);
  });

  test('a book the size of the real one: the index and a query, timed', async ({ page }) => {
    // Measured, not judged: ~1,000 invoices, 1,200 challans, 300 parts and 1,500 bank rows, about the real book in Sep 2026.
    const s = searchBook();
    const c = CLIENTS;
    for (let i = 0; i < 1000; i++) s.invoices.push(inv('INV-B' + i, 1000 + i, c[i % 3], dayOff(-(i % 180)), 1000 + i, { challanNo: String(2000 + i) }));
    for (let i = 0; i < 1200; i++) s.incomingMaterial.push(challan('IM-B' + i, String(3000 + i), c[i % 3], dayOff(-(i % 180)), 'PART-' + (i % 300)));
    for (let i = 0; i < 300; i++) s.items.push({ id: 100 + i, partNumber: 'PART-' + i, desc: 'Bracket ' + i, unit: 'KG', rate: 13, hsn: '998873' });
    for (let i = 0; i < 1500; i++) s.bank.rows.push({ id: 'RB' + i, date: dayOff(-(i % 180)), valueDate: dayOff(-(i % 180)), narration: 'NEFT-PAYEE ' + i, chq: '', dr: i % 2 ? 100 + i : 0, cr: i % 2 ? 0 : 100 + i, balance: 100000, dayIdx: i });
    await loadAppWithState(page, s);
    // Five builds and their queries: the least is what the work costs, the most what a pause for garbage collection adds.
    const t = await page.evaluate(() => {
      const w: any = window;
      const builds: number[] = [], queries: number[] = [];
      let n = 0;
      for (let i = 0; i < 5; i++) {
        w._srchCache = null;
        const t0 = performance.now(); n = w.srchIndex().length; const t1 = performance.now();
        w.srchQuery('alpha'); w.srchQuery('2834'); w.srchQuery('5,902.12');
        builds.push(t1 - t0); queries.push((performance.now() - t1) / 3);
      }
      return { n, builds, queries };
    });
    const f = (a: number[]) => Math.min(...a).toFixed(1) + ' ms (the slowest ' + Math.max(...a).toFixed(1) + ')';
    console.log(`P139 timings on a real-sized book (${t.n} entries): index ${f(t.builds)}, a query ${f(t.queries)}`);
    expect(t.n).toBeGreaterThan(4000);
  });
});
