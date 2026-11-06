import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab, openHome, openNeeds, emptyState, noSeedIM, type SepState } from './fixtures';
import { longBook } from './load-fixture';

// P233 (docs/UI_PASS_3.md §14, §26e): across the app, U7. Every hero and verdict card takes the board's rule for its tone; dialogs and
// sheets in the look, a dialog drawn again in place not sliding in again; a toast led by its kind's icon; a status badge led by its
// tone's icon; search's results each led by its kind's icon; one set of blank states (no screen draws its own "No …" line); and the
// first-visit pointers: once a person a device, one a screen visit, never under a test browser unless a fixture asks. Made-up names.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

test('every hero on every screen takes the board’s rule: no wash; amber and red edged, red tinted', async ({ page }) => {
  await loadAppWithState(page, longBook());
  const seen = new Set<string>();
  for (const tab of ['pageHome', 'pageFloor', 'pageFinance', 'pageStock', 'pageRegister', 'pagePower']) {
    if (tab === 'pageHome') await openNeeds(page); else await switchTab(page, tab);
    const heroes = await ev(page, `Array.prototype.map.call(document.querySelectorAll('.inv-page-active .inv-hero'), function (h) {
      var cs = getComputedStyle(h); return { cls: h.className, img: cs.backgroundImage, shadow: cs.boxShadow }; })`) as any[];
    for (const h of heroes) {
      expect(h.img, tab + ' ' + h.cls).toBe('none');
      const tone = (h.cls.match(/inv-hero-(danger|warning|ok|info|neutral)/) || [, ''])[1];
      if (tone === 'danger' || tone === 'warning') expect(h.shadow, tab + ' ' + h.cls).toMatch(/inset/);
      else expect(h.shadow, tab + ' ' + h.cls).not.toMatch(/inset/);
      seen.add(tone || 'plain');
    }
  }
  // The long book shows a card of each kind the rule tells apart.
  expect(seen.has('danger')).toBe(true);
  expect([...seen].some(t => t === 'ok' || t === 'info' || t === 'plain')).toBe(true);
});

test('a dialog: its title larger, its close a ghost icon; on the phone a sheet with its grabber; drawn again in place, it does not slide in again', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await ev(page, `dialogOpen('<div class="inv-dialog" role="dialog" data-p233>' + dialogHeadHtml('A dialog') + '<p>One</p></div>', { dismiss: true })`);
  const d = page.locator('[data-p233]');
  await expect(d).toBeVisible();
  const look = await d.evaluate(el => {
    const t = getComputedStyle(el.querySelector('.inv-dialog-title')!), c = el.querySelector('.inv-dialog-close')!, g = getComputedStyle(el, '::before');
    return { fs: parseFloat(t.fontSize), w: t.fontWeight, ghost: c.classList.contains('inv-btn-ghost'), svg: !!c.querySelector('svg'), text: (c.textContent || '').trim(),
      grab: g.content, gw: parseFloat(g.width) };
  });
  expect(look.fs).toBe(17);
  expect(Number(look.w)).toBeGreaterThanOrEqual(600);
  expect(look.ghost && look.svg).toBe(true);
  expect(look.text).toBe('');
  expect(look.grab).not.toBe('none');
  expect(look.gw).toBeGreaterThan(0);
  // Drawn again in place (a credit note's form, the guard's, a quotation's): the new face does not replay its entrance.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ev(page, `dialogOpen('<div class="inv-dialog" role="dialog" data-p233b>' + dialogHeadHtml('A dialog') + '<p>Two</p></div>', { replace: true })`);
  const anims = await page.locator('[data-p233b]').evaluate(el => el.getAnimations().map(a => (a as CSSAnimation).animationName));
  expect(anims).toEqual([]);
  expect(await page.locator('.inv-scrim-dialog').count()).toBe(1);
});

test('a toast is led by its kind’s icon, its words its only text; a status badge by its tone’s icon', async ({ page }) => {
  await loadAppWithState(page, longBook());
  const kinds: Record<string, string> = { success: 'done', error: 'cancel', warning: 'alert', info: 'info' };
  const drawn: string[] = [];
  for (const k of Object.keys(kinds)) {
    await ev(page, `showToast('Saved the thing', '${k}')`);
    const t = page.locator('.inv-toast');
    await expect(t).toHaveText('Saved the thing');
    await expect(t.locator('svg.inv-toast-ico')).toHaveCount(1);
    drawn.push(await t.locator('svg.inv-toast-ico').innerHTML());
    const want = await ev(page, `(function () { var t = document.createElement('template'); t.innerHTML = iconSvg('${kinds[k]}'); return t.content.firstChild.innerHTML; })()`) as string;
    expect(drawn[drawn.length - 1]).toBe(want);
  }
  expect(new Set(drawn).size).toBe(4);
  // A badge of a tone draws its icon before its word (a mask of the tone's icon in its own colour); a neutral badge has none.
  const masks = await ev(page, `(function () { var box = document.createElement('div'); box.innerHTML = ['ok', 'warning', 'danger', 'info', 'neutral'].map(function (t) {
      return '<span class="inv-badge inv-badge-' + t + '">3</span>'; }).join(''); document.body.appendChild(box);
    var out = Array.prototype.map.call(box.children, function (b) { var cs = getComputedStyle(b, '::before'); return cs.maskImage || cs.webkitMaskImage; }); box.remove(); return out; })()`) as string[];
  for (const m of masks.slice(0, 4)) expect(m).toMatch(/^url\("data:image\/svg\+xml/);
  expect(new Set(masks.slice(0, 4)).size).toBe(4);
  expect(masks[4]).toBe('none');
});

test('search: each result led by its kind’s icon, grouped by kind, the keys at its foot', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await ev(page, `searchOpen('a')`);
  const list = page.locator('#srchList');
  const rows = list.locator('[role="option"].inv-row-2');
  await expect(rows.first()).toBeVisible();
  expect(await list.locator('[role="group"] .inv-row-group').count()).toBeGreaterThan(1);
  expect(await rows.count()).toBeGreaterThan(3);
  for (let i = 0; i < 4; i++) await expect(rows.nth(i).locator('.inv-row-lead svg')).toHaveCount(1);
  // The keys at its foot (shown where there is a keyboard: the desktop).
  await expect(page.locator('[data-search] .inv-keys')).toBeAttached();
  // Nothing found is the one blank state.
  await page.locator('#srchInput').fill('zzqqxx');
  await expect(list.locator('.inv-blank')).toContainText('Nothing matches');
});

test('one set of blank states: an empty book draws the blank state where each screen drew its own line, and no screen draws the old one', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as unknown as SepState);
  for (const tab of ['pageRegister', 'pageFinance']) {
    await switchTab(page, tab);
    await expect(page.locator('.inv-page-active .inv-blank').first(), tab).toBeVisible();
    expect(await page.locator('.inv-empty').count(), tab).toBe(0);
  }
  // The words stay the screen's own: an empty register says so.
  await switchTab(page, 'pageRegister');
  await expect(page.locator('#pageRegister .inv-blank').first()).toContainText('No invoices found');
  // A long empty text keeps its first sentence as the title and the rest under it.
  const h = await ev(page, `uiEmptyHtml('No bills recorded. Until there are, Live cost prices them at the fallbacks.')`) as string;
  expect(h).toContain('<p class="inv-blank-title">No bills recorded.</p>');
  expect(h).toContain('<p class="inv-blank-body">Until there are, Live cost prices them at the fallbacks.</p>');
  // The source holds no screen's own empty line any more.
  const fs = await import('fs'), path = await import('path');
  const dir = path.join(__dirname, '..', '..', 'split');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) expect(fs.readFileSync(path.join(dir, f), 'utf8'), f).not.toContain('class="inv-empty');
});

test('pointers: none under a test browser unless asked; once a person a device, one a screen visit; Got it, Escape and Read the guide', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await openHome(page);
  await page.waitForTimeout(1200);
  await expect(page.locator('.inv-pointer')).toHaveCount(0);
  // Turned on (the fixture's switch): Home's Customise is pointed at, said as new, with the guide at its section.
  await ev(page, `window.__sepPointersOn = true; localStorage.removeItem('sep_inv_pointers'); _ptrVisit = ''; renderHome()`);
  const ptr = page.locator('.inv-pointer');
  await expect(ptr).toHaveAttribute('data-pointer', 'home-customise');
  await expect(ptr).toContainText('New: Customise moves, sizes and adds the cards on Home.');
  // It takes no focus and moves nothing: it floats.
  expect(await ev(page, `document.activeElement && document.activeElement.closest && !!document.activeElement.closest('.inv-pointer')`)).toBe(false);
  expect(await ptr.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  await ptr.locator('[data-action="invPointerOk"]').click();
  await expect(ptr).toHaveCount(0);
  // Seen once, for the person signed in on this device: not again on the next visit, nor after a reload.
  await switchTab(page, 'pageRegister');
  await openHome(page);
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-pointer="home-customise"]')).toHaveCount(0);
  expect(JSON.parse(await ev(page, `localStorage.getItem('sep_inv_pointers')`) as string)['-']['home-customise']).toBeGreaterThan(0);
  // One a screen visit: the next pointer waits for the next screen. Escape shuts it.
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="case"]').click();
  await ev(page, `document.querySelector('[data-action="invPowerCaseFull"]').scrollIntoView({ block: 'center' })`);
  await expect(page.locator('[data-pointer="case-full"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.inv-pointer')).toHaveCount(0);
  // Read the guide opens the pointer's guide at its section.
  await switchTab(page, 'pageStock');
  const stock = page.locator('[data-pointer="stock-spend"]');
  await ev(page, `document.querySelector('#pageStock [data-action="invStockSpend"]').scrollIntoView({ block: 'center' })`);
  await expect(stock).toHaveCount(1);
  await stock.locator('[data-action="invPointerGuide"]').click();
  await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#knowContent')).toContainText('The stock message, entry by hand, and reordering');
  expect(await ev(page, `_kbOpen`)).toBe('app-stock');
});

test('pointers: never over typed work or a dialog the control is not in', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await openHome(page);
  await ev(page, `window.__sepPointersOn = true; dialogOpen('<div class="inv-dialog" role="dialog">' + dialogHeadHtml('Over it') + '</div>', { dismiss: true }); _ptrVisit = ''; uiPointerTick()`);
  await page.waitForTimeout(900);
  await expect(page.locator('.inv-pointer')).toHaveCount(0);
  await ev(page, `dialogCloseScrim(document.querySelector('.inv-scrim-dialog')); _pageTyped = true; _ptrVisit = ''; uiPointerTick()`);
  await expect(page.locator('.inv-pointer')).toHaveCount(0);
  await ev(page, `_pageTyped = false; _ptrVisit = ''; uiPointerTick()`);
  await expect(page.locator('.inv-pointer')).toHaveCount(1);
});

test('the messages guide: the Messages screen has one, and every pointer’s guide holds the section it opens at', async ({ page }) => {
  await loadAppWithState(page, longBook());
  const r = await ev(page, `UI_POINTERS.map(function (p) { var a = kbFind(p.guide[0]); if (!a) return p.id + ': no guide';
    if (!p.guide[1]) return 'ok'; var secs = (kbParse(a.body).sections || []).map(function (s) { return (s.title || '').toLowerCase(); });
    return secs.some(function (t) { return t.indexOf(p.guide[1].toLowerCase()) >= 0; }) ? 'ok' : p.id + ': no section ' + p.guide[1]; })`) as string[];
  expect(r.filter(x => x !== 'ok')).toEqual([]);
  expect(await ev(page, `kbFind('app-messages').links.map(function (l) { return l.id; })`)).toEqual(['pageMessages']);
});
