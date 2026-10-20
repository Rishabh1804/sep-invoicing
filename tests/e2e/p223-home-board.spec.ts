import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, waitForBoot, emptyState, noSeedIM, todayIso, answerAsk, openNeeds, withWidgets, switchTab, toolbarMore, toolbarMoreLabels } from './fixtures';
import { longBook } from './load-fixture';
import { sweepState } from './sweep-fixture';
import { withUsers, unlock, lockNow, PINS, guardBook } from './p140-guard.fixture';

// P223 (UI pass 3, U2; docs/UI_PASS_3.md §7, §8, §20): Home and its board, on the phone. The door is Home and its row Home ·
// Needs you; an old Pulse address opens the dashboard. The day card is Home's verdict: the greeting, the clock ticking on the
// minute, the general shift's end, the first thing that needs the owner. The board is two columns on a phone; arranging is a
// layer (keys, a finger's drag after a hold, a size, remove with Undo, Reset asking); the gallery adds and removes; each role
// starts on its own preset; a layout is the person's and the phone's, kept on the device, never in the book.

const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
const ids = (page: Page) => page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w));
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_layout') || 'null'));
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const emptyBook = () => ({ ...emptyState(), incomingMaterial: noSeedIM() });

test.describe('P223 Home and its board (phone)', () => {
  test('Home is the door and the first view of its row; an old Pulse address and a remembered Pulse view open the dashboard', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await expect(page.locator('.inv-navbar [data-action="invWsGo"][data-ws="today"]')).toContainText('Home');
    await expect(page.locator('#topbarTitle')).toHaveText('Home');
    const tabs = page.locator('#wsTabs .inv-viewtab');
    await expect(tabs.nth(0)).toHaveText('Home');
    await expect(tabs.nth(1)).toHaveText('Needs you');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
    await expect(page.locator('#homeNeeds')).toBeHidden();
    await expect.poll(() => where(page)).toEqual(['pageHome', 'home']);
    await openNeeds(page);
    await expect.poll(() => where(page)).toEqual(['pageHome', 'needs']);
    // Pulse's old address opens Home's dashboard, its address put right.
    await page.goto('/?tab=pageHome&v=pulse');
    await waitForBoot(page);
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageHome', 'home']);
    // A workspace's view remembered by an older build as Pulse: the door opens the dashboard.
    await switchTab(page, 'pageRegister');
    await page.evaluate(() => { (0, eval)("_wsLast.today = { tab: 'pageHome', v: 'pulse' }"); });
    await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="today"]').click();
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
    await expect.poll(() => where(page)).toEqual(['pageHome', 'home']);
    // invGoPulse is the brand's old name: it opens Home too (a saved trail, an older build's link).
    await switchTab(page, 'pageRegister');
    await g(page, `wsAction('invGoPulse', document.body)`);
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
  });

  test('the masthead: the greeting, the clock ticking on the minute, the shift’s end, and what leads in its tone; a report from the toolbar’s More', async ({ page }) => {
    await page.clock.install({ time: new Date(todayIso() + 'T09:42:10') });
    await loadAppWithState(page, emptyBook());
    // U2R (§24j): the day card is the masthead, flat and never folded; the phone says the shift short and draws no track (P239).
    const card = page.locator('#homeDash [data-home-day]');
    const day = await page.evaluate(() => { const n = new Date(); return n.toLocaleDateString('en-IN', { weekday: 'long' }) + ', ' + n.getDate() + ' ' + n.toLocaleDateString('en-IN', { month: 'long' }); });
    await expect(card).toContainText('Good morning · ' + day);
    await expect(card.locator('[data-home-clock]')).toHaveText('9:42 AM');
    await expect(card.locator('[data-home-shift]')).toHaveText('Shift ends 5:00 PM');
    // Nothing needs the owner on an empty book: the masthead says so, in ok.
    await expect(card).toContainText('Nothing needs you now');
    await expect(card).toHaveAttribute('data-tone', 'ok');
    await expect(card.locator('.inv-mast-say')).toHaveClass(/inv-dot-ok/);
    // On the minute: the clock changes and nothing else on the page is drawn again.
    const before = await page.evaluate(() => document.querySelectorAll('#homeDash *').length);
    await page.clock.runFor(60000);
    await expect(card.locator('[data-home-clock]')).toHaveText('9:43 AM');
    await expect(card.locator('[data-home-shift]')).toHaveText('Shift ends 5:00 PM');
    expect(await page.evaluate(() => document.querySelectorAll('#homeDash *').length)).toBe(before);
    // Left, the clock stops; back, it is set at once.
    await switchTab(page, 'pageRegister');
    expect(await g(page, '_homeClockT')).toBeNull();
    await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="today"]').click();
    await expect(card.locator('[data-home-clock]')).toHaveText('9:43 AM');
    // The Act: Needs you. On the phone the masthead carries no report; the toolbar’s More makes one of the period Home shows.
    await expect(card.locator('[data-home-needs]')).toContainText('Open Needs you');
    await expect(card.locator('[data-action="invHomeReport"]')).toHaveCount(0);
    await toolbarMore(page, 'Make a report');
    await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
    await expect.poll(() => where(page)).toEqual(['pageReports', 'monthly/' + todayIso().slice(0, 8) + '01']);
  });

  test('the masthead leads with what is red, in danger, with the ID’s name; a role without Reports has no report to make', async ({ page }) => {
    await page.clock.install({ time: new Date(todayIso() + 'T15:05:00') });
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    const card = page.locator('#homeDash [data-home-day]');
    await expect(card).toContainText('Good afternoon, Asha · ');
    await expect(card.locator('[data-home-shift]')).toHaveText('Shift ends 5:00 PM');
    // A red task leads: the stock line out on the guard's book.
    await g(page, `S.stock.entries.push({ id: 'u1', itemId: 'N', kind: 'used', qty: 12, date: localDateStr(), at: Date.now() }); saveState(); renderHome()`);
    await expect(card).toContainText(/things? needs? you now/);
    await expect(card).toHaveAttribute('data-tone', 'danger');
    await expect(card.locator('.inv-mast-say')).toHaveClass(/inv-dot-danger/);
    // The phone's masthead carries no report (§24j); the owner makes one from the toolbar's More, the office cannot.
    await expect(card.locator('[data-action="invHomeReport"]')).toHaveCount(0);
    expect(await toolbarMoreLabels(page)).toContain('Make a report');
    await lockNow(page);
    await unlock(page, 'U-off', PINS.office);
    await expect(card).toContainText('Good afternoon, Chitra · ');
    await expect(card.locator('[data-action="invHomeReport"]')).toHaveCount(0);
    expect(await toolbarMoreLabels(page)).not.toContain('Make a report');
  });

  test('the board is two columns on the phone: a Small spans one, a Medium and a Large the row', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'l']]);
    await loadAppWithState(page, sweepState());
    const m = await page.evaluate(() => {
      const grid = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement;
      const gw = grid.getBoundingClientRect().width;
      return { cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length, gw,
        w: Array.from(grid.querySelectorAll('.inv-widget')).map(el => [(el as HTMLElement).dataset.w, Math.round(el.getBoundingClientRect().width / gw * 100)]) };
    });
    expect(m.cols).toBe(2);
    const w = Object.fromEntries(m.w);
    expect(w.mtd).toBeLessThan(55);
    expect(w['q-money']).toBeLessThan(55);
    expect(w.pace).toBe(100);
    expect(w.recent).toBe(100);
    expect(await ids(page)).toEqual(['mtd', 'q-money', 'pace', 'recent']);
  });

  test('arranging is a layer: keys move a widget and say where, a size, remove with Undo, Escape and Back leave it, Reset asks', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'm']]);
    await loadAppWithState(page, sweepState());
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await expect(page.locator('.inv-wboard[data-arranging]')).toHaveCount(1);
    await expect(page.locator('[data-wdg-handle]')).toHaveCount(4);
    await expect(page.locator('[data-home-toolbar] .inv-btn')).toHaveText(['Add a widget', 'Reset', 'Done']);
    await expect(page.locator('#pageHome .inv-btn-primary:visible')).toHaveCount(1);
    // Keys: the first handle, →: one later, and the line says where.
    await page.locator('[data-wdg-handle="mtd"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => ids(page)).toEqual(['q-money', 'mtd', 'pace', 'recent']);
    await expect(page.locator('[data-wdg-live]')).toHaveText('Month to date, 2 of 4');
    await expect(page.locator('[data-wdg-handle="mtd"]')).toBeFocused();
    await page.keyboard.press('End');
    await expect.poll(() => ids(page)).toEqual(['q-money', 'pace', 'recent', 'mtd']);
    expect((await stored(page)).people['-'].home.phone.map((x: string[]) => x[0])).toEqual(['q-money', 'pace', 'recent', 'mtd']);
    // The phone's arrangement is the phone's: the desktop's is not written.
    expect((await stored(page)).people['-'].home.desk).toEqual([['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'm']]);
    // A size: that widget alone, drawn again at it.
    await page.locator('[data-w="recent"] [data-action="invWdgSize"][data-size="l"]').click();
    await expect(page.locator('#homeBoard [data-w="recent"]')).toHaveAttribute('data-size', 'l');
    // Remove, then Undo from the toast.
    await page.locator('[data-w="pace"] [data-action="invWdgRemove"]').click();
    await expect.poll(() => ids(page)).toEqual(['q-money', 'recent', 'mtd']);
    await page.locator('.inv-toast-act .inv-toast-btn').click();
    await expect.poll(() => ids(page)).toEqual(['q-money', 'pace', 'recent', 'mtd']);
    // Escape leaves it; so does Back, and Home stays on screen.
    await page.keyboard.press('Escape');
    await expect(page.locator('.inv-wboard[data-arranging]')).toHaveCount(0);
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await expect(page.locator('.inv-wboard[data-arranging]')).toHaveCount(1);
    await page.goBack();
    await expect(page.locator('.inv-wboard[data-arranging]')).toHaveCount(0);
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
    // Leaving Home while arranging ends it, and Home is drawn plain when it is next shown: no handle, and the board's own toolbar.
    // Home is first drawn clean by a visit elsewhere, so nothing but the leaving marks it to be drawn again (the handles and a Done
    // that did nothing had stayed on screen).
    await switchTab(page, 'pageRegister');
    await switchTab(page, 'pageHome');
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await expect(page.locator('[data-wdg-handle]')).toHaveCount(4);
    await switchTab(page, 'pageRegister');
    await switchTab(page, 'pageHome');
    await expect(page.locator('#homeDash [data-wdg-handle], .inv-wboard[data-arranging]')).toHaveCount(0);
    await expect(page.locator('[data-home-toolbar] [data-action="invWdgArrange"]')).toBeVisible();
    await expect(page.locator('[data-home-toolbar] [data-action="invWdgDone"]')).toHaveCount(0);
    // Reset asks, then puts the phone's back to the role's preset.
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await page.locator('[data-home-toolbar] [data-action="invWdgReset"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Put Home back as the Owner layout?');
    expect((await stored(page)).people['-'].home.phone).toBeUndefined();
    expect((await ids(page))[0]).toBe('mtd');
  });

  test('a finger drags a widget only after a hold: a quick move is a scroll, a held one lifts it and a drop writes the order', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'm']]);
    await loadAppWithState(page, sweepState());
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    const touch = (sel: string, type: string, dx = 0, dy = 0) => page.evaluate(([sel, type, dx, dy]) => {
      const el = document.querySelector(sel as string)!;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2 + (dx as number), y = r.top + r.height / 2 + (dy as number);
      (type === 'pointerdown' ? el : document).dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, button: 0 }));
    }, [sel, type, dx, dy] as [string, string, number, number]);
    // Quick: down and away at once is a scroll, never a drag.
    await touch('[data-wdg-handle="mtd"]', 'pointerdown');
    await touch('[data-wdg-handle="mtd"]', 'pointermove', 0, 40);
    await touch('[data-wdg-handle="mtd"]', 'pointerup', 0, 40);
    await page.waitForTimeout(350);
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(0);
    expect(await ids(page)).toEqual(['mtd', 'q-money', 'pace', 'recent']);
    // Held: it lifts, a placeholder keeps its room, and dropped on Recent invoices' far half it goes after it.
    await touch('[data-wdg-handle="mtd"]', 'pointerdown');
    await page.waitForTimeout(350);
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(1);
    await expect(page.locator('.inv-widget-ph')).toHaveCount(1);
    // One move that puts the lifted card's centre over Recent invoices' lower half (read once the card has lifted), then the drop.
    const at = await page.evaluate(() => {
      const r = document.querySelector('#homeBoard [data-w="recent"]')!.getBoundingClientRect();
      const c = document.querySelector('#homeBoard [data-w="mtd"]')!.getBoundingClientRect();
      const h = document.querySelector('[data-wdg-handle="mtd"]')!.getBoundingClientRect();
      return { dx: (r.left + r.width / 2) - (c.left + c.width / 2), dy: (r.top + r.height * 0.75) - (c.top + Math.min(c.height, 160) / 2), hx: h.left, hy: h.top };
    });
    await touch('[data-wdg-handle="mtd"]', 'pointermove', at.dx, at.dy);
    await touch('[data-wdg-handle="mtd"]', 'pointerup', at.dx, at.dy);
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(0);
    await expect.poll(() => ids(page)).toEqual(['q-money', 'pace', 'recent', 'mtd']);
  });

  test('the gallery: its sections as chips, previews drawn as they come into view, Add to Home and Remove', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['pace', 'm']]);
    await loadAppWithState(page, sweepState());
    const foot = page.locator('[data-home-foot] [data-action="invWdgGallery"]');
    await expect(foot).toContainText(/Add a widget · \d+ to choose from/);
    await foot.click();
    const gal = page.locator('[data-wdg-gallery]');
    await expect(gal).toBeVisible();
    await expect(gal.locator('.inv-gallery-chips .inv-chip').first()).toHaveText('All');
    await expect(gal.locator('.inv-gallery-chips .inv-chip')).toContainText(['All', 'Money', 'Office']);
    // The first card's preview is drawn; one far down waits until it is scrolled to.
    await expect(gal.locator('[data-wdg-preview]').first()).toHaveAttribute('data-drawn', '1');
    await expect(gal.locator('[data-wdg-preview] [data-w]').first()).toBeVisible();
    // Money: only money's widgets.
    await gal.locator('.inv-chip[data-sec="money"]').click();
    const secs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-gallery-w]')).map(c => (window as any).wdgDef((c as HTMLElement).dataset.galleryW).section));
    expect(secs.length).toBeGreaterThan(0);
    expect(new Set(secs)).toEqual(new Set(['money']));
    await page.locator('.inv-chip[data-sec="all"]').click();
    // On Home: said, with Remove; not on it: Add to Home, which puts it at the end.
    await expect(page.locator('[data-gallery-w="mtd"] [data-wdg-on]')).toHaveText('On Home');
    // Every preview is one height, drawn or not, so a preview drawn as it comes into view moves nothing under the finger, and the
    // list drawn again after an Add puts every card back where it stood (a preview grew from 48 px to 160 px when drawn: the cards
    // under it jumped while scrolling, and a tap on Add landed on the card that moved there).
    const recent = page.locator('[data-gallery-w="recent"]');
    await recent.scrollIntoViewIfNeeded();
    await expect(recent.locator('[data-wdg-preview]')).toHaveAttribute('data-drawn', '1');
    const heights = await page.locator('[data-wdg-preview]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    const add = page.locator('[data-gallery-w="recent"] [data-action="invWdgGalleryAdd"]');
    await add.hover();   // where a tap finds it (the click would scroll it there itself), measured after
    const topBefore = await recent.evaluate(e => e.getBoundingClientRect().top);
    await page.evaluate(() => { (window as any).__galDialog = document.querySelector('[data-wdg-gallery]'); });
    await add.click();
    await expect(page.locator('[data-gallery-w="recent"] [data-wdg-on]')).toHaveText('On Home');
    expect(Math.abs(await recent.evaluate(e => e.getBoundingClientRect().top) - topBefore)).toBeLessThan(1);
    // Drawn again in place: the same dialog (a dialog replaced replayed its slide-in at every tap), the preview drawn as it was (not
    // blank until drawn again), and the focus on the card's Remove (it had fallen to the page).
    expect(await page.evaluate(() => (window as any).__galDialog.isConnected)).toBe(true);
    await expect(recent.locator('[data-wdg-preview]')).toHaveAttribute('data-drawn', '1');
    expect(await recent.locator('[data-wdg-preview] [data-w]').count()).toBe(1);
    await expect(page.locator('[data-gallery-w="recent"] [data-action="invWdgGalleryRemove"]')).toBeFocused();
    await page.locator('[data-wdg-gallery] .inv-dialog-foot [data-action="invWdgGalleryDone"]').click();
    await expect.poll(() => ids(page)).toEqual(['mtd', 'pace', 'recent']);
    // The other layout gets it too, at its first size.
    expect((await stored(page)).people['-'].home.desk.map((x: string[]) => x[0])).toEqual(['mtd', 'pace', 'recent']);
    await foot.click();
    await page.locator('[data-gallery-w="pace"] [data-action="invWdgGalleryRemove"]').click();
    await page.locator('[data-wdg-gallery] .inv-dialog-foot [data-action="invWdgGalleryDone"]').click();
    await expect.poll(() => ids(page)).toEqual(['mtd', 'recent']);
  });

  test('each role starts on its own preset, and its gallery holds nothing it may not see', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    // The presets are U2R's (§24i), each packing with no hole; the phone's Owner leaves out Do first, Turnaround and Days to pay.
    expect(await ids(page)).toEqual(['mtd', 'q-money', 'prodday', 'cash', 'pace', 'coming', 'tata', 'floornow', 'risk', 'atttoday', 'q-smooth']);
    await lockNow(page);
    await unlock(page, 'U-off', PINS.office);
    expect(await ids(page)).toEqual(['needs', 'quick', 'unbilled', 'quote', 'weather', 'pipe', 'recent', 'tata', 'coming']);
    await page.locator('[data-home-foot] [data-action="invWdgGallery"]').click();
    const seen = await page.evaluate(() => Array.from(document.querySelectorAll('[data-gallery-w]')).map(c => (c as HTMLElement).dataset.galleryW));
    for (const id of ['money', 'cash', 'owed', 'dtp', 'gst', 'mtd', 'q-money', 'dofirst', 'why', 'figures', 'zinc', 'prodday', 'floornow', 'atttoday', 'sync'])
      expect(seen, id).not.toContain(id);
    await expect(page.locator('.inv-gallery-chips .inv-chip[data-sec="money"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await lockNow(page);
    await unlock(page, 'U-sup', PINS.super);
    expect(await ids(page)).toEqual(['floornow', 'eff', 'prodday', 'atttoday', 'risk', 'weather', 'stockdays', 'attweek', 'ot', 'tata']);
  });

  test('a layout is the person’s, kept on the device: two people keep two; it never reaches the book, a push or the change log', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    await page.locator('[data-wdg-handle="mtd"]').focus();
    await page.keyboard.press('End');
    await page.locator('[data-home-toolbar] [data-action="invWdgDone"]').click();
    const mine = await ids(page);
    expect(mine[mine.length - 1]).toBe('mtd');
    // A reload keeps the window's sign-in (sessionStorage, guard.js): the same person, the same layout, no lock.
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#guardRoot')).toBeHidden();
    await page.locator('#homeDash:not(.inv-hidden) #homeBoard .inv-widget').first().waitFor();
    expect(await ids(page)).toEqual(mine);
    await lockNow(page);
    await unlock(page, 'U-off', PINS.office);
    expect(await ids(page)).toEqual(['needs', 'quick', 'unbilled', 'quote', 'weather', 'pipe', 'recent', 'tata', 'coming']);
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    expect(await ids(page)).toEqual(mine);
    const st = await stored(page);
    expect(Object.keys(st.people)).toEqual(['U-own']);
    // The book holds none of it: a backup is the book, and so is a push; the change log has no line about it.
    const leak = await page.evaluate(() => { const S = (0, eval)('S'); return { book: JSON.stringify(S).includes('"phone":[['), log: JSON.stringify(S.changeLog || []).includes('layout') }; });
    expect(leak).toEqual({ book: false, log: false });
  });

  test('Pulse’s layout is moved once: a custom Pulse keeps every widget it showed, after the preset and in its order, by the new ids', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('sep_inv_home')) return;
      localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom',
        order: ['mtd', 'quick', 'money', 'todo', 'attendance', 'unbilled', 'production', 'power', 'stock', 'sync', 'zinc', 'recent'],
        hidden: { money: true, power: true, recent: true }, wide: { mtd: true, quick: true } }));
    });
    await loadAppWithState(page, sweepState());
    const list = await ids(page);
    const preset = ['mtd', 'q-money', 'prodday', 'cash', 'pace', 'coming', 'tata', 'floornow', 'risk', 'atttoday', 'q-smooth'];
    expect(list.slice(0, preset.length)).toEqual(preset);
    expect(list.slice(preset.length)).toEqual(['quick', 'needs', 'unbilled', 'stockdays', 'sync', 'zinc']);
    // Pulse's own record is left as it was: an older build in another window still reads it.
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('sep_inv_home')!)).order[3]).toBe('todo');
    expect((await stored(page)).people['-'].home.from).toBe('pulse');
  });

  test('Home draws within 1.5 s on the long book, every widget whole', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const ms = await page.evaluate(() => { (0, eval)('_bookWrites++'); const t = performance.now(); (window as any).renderHome(); return performance.now() - t; });
    expect(ms).toBeLessThan(1500);
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll('#homeBoard .inv-widget')).filter(el => el.getAttribute('data-state') === 'error' ||
      el.scrollHeight > el.clientHeight + 1).map(el => (el as HTMLElement).dataset.w));
    expect(bad).toEqual([]);
  });
});
