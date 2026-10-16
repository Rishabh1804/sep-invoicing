import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { emptyState, loadAppWithState, openPulse, openSettingsAt, switchTab } from './fixtures';

// P228: icons v3 (docs/UI_PASS_3.md §4). One set, ICONS in state.js, drawn by iconSvg on a 24 grid with the glyph inside 2–22:
// every name a module draws exists in it; every name the spec lists is there (the board's 64, the kept names, the aliases as one
// shape); each icon stays inside the grid; a tint is a fill-only path (`d:`) in the accent, the tone in a toned place; body.html's
// slots are filled at boot; nothing but state.js and the drawings §4 lets stay writes an <svg>; the brand's mark is one builder
// (markSvg); and the licences of the shapes, Lucide's ISC and Feather's MIT, go with the build and show in Settings.

const ROOT = path.join(__dirname, '..', '..');
const SPLIT = path.join(ROOT, 'split');
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

/* The names §4 lists: the board's 64 by group, the names kept and redrawn, and the four aliases. */
const BOARD = [
  'home', 'today', 'office', 'floor', 'money', 'add', 'search', 'settings', 'history', 'book', 'clock', 'widgets', 'sync', 'idscan', 'print', 'alert',
  'invoice', 'challan', 'client', 'quote', 'creditNote', 'pipeline', 'dispatch', 'prospect', 'bank', 'cheque', 'cash', 'gst', 'wages', 'owed', 'forecast', 'report',
  'vat', 'barrel', 'pickling', 'rack', 'zinc', 'chemical', 'part', 'weight', 'worker', 'idcard', 'attendance', 'overtime', 'power', 'cut', 'efficiency', 'upkeep',
  'truck', 'export', 'calendar', 'turnaround', 'dtp', 'correlation', 'heat', 'stats', 'storm', 'fair', 'rain', 'news', 'planner', 'market', 'info', 'done',
];
const KEPT = ['back', 'next', 'close', 'check', 'plus', 'more', 'filter', 'external', 'send', 'eye', 'pencil', 'trash', 'copy', 'link', 'caution', 'warning',
  'cancel', 'activity', 'rss', 'mine', 'file', 'filePlus', 'fileUp', 'box', 'boxPlus', 'flask', 'users', 'userCheck', 'message', 'task', 'clipboard',
  'clipboardCheck', 'tag', 'receipt', 'note', 'chart', 'shield', 'phone', 'compass', 'route', 'scale', 'wrench', 'flag', 'fork', 'flip', 'zap', 'nut'];
/* Every name the set held before v3 (62): none may go, or a call site would draw nothing. */
const OLD = ['back', 'next', 'close', 'check', 'plus', 'more', 'filter', 'search', 'external', 'flip', 'send', 'print', 'eye', 'pencil', 'trash', 'copy', 'link',
  'clock', 'history', 'info', 'caution', 'warning', 'cancel', 'activity', 'rss', 'today', 'office', 'floor', 'money', 'mine', 'settings', 'book', 'file',
  'filePlus', 'fileUp', 'box', 'boxPlus', 'flask', 'rack', 'zap', 'users', 'userCheck', 'message', 'task', 'clipboard', 'clipboardCheck', 'tag', 'cheque',
  'receipt', 'note', 'chart', 'shield', 'phone', 'sync', 'bank', 'compass', 'route', 'nut', 'scale', 'wrench', 'flag', 'fork'];
const ALIASES: Array<[string, string]> = [['power', 'zap'], ['upkeep', 'wrench'], ['stats', 'chart'], ['know', 'info']];
/* The drawings that are not icons, and stay where they are (§4): people.js's bars, plant.js's, planview.js's charts and stars,
   qr.js's QR, the charts. */
const SVG_OK = ['state.js', 'people.js', 'plant.js', 'planview.js', 'qr.js', 'charts.js'];

const src = (f: string) => readFileSync(path.join(SPLIT, f), 'utf8');
/* A module's code with its comments taken out (P76's way), so a comment naming a slot or an icon is not read as one. */
const code = (f: string) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const modules = () => readdirSync(SPLIT).filter(f => /\.js$/.test(f));
const all = (re: RegExp, s: string) => Array.from(s.matchAll(re), m => m[1]);

/* Every 24-grid icon on screen, and every one of the set drawn into the page: each one's drawing inside [1.5, 22.5]. */
async function bboxes(page: Page, everyName: boolean) {
  return page.evaluate(every => {
    const w: any = window;
    let host: HTMLElement | null = null;
    if (every) {
      host = document.createElement('div');
      host.id = 'p228set';
      host.innerHTML = Object.keys(w.ICONS).map(n => '<span data-p228="' + n + '">' + w.iconSvg(n) + '</span>').join('');
      document.querySelector('.inv-page-active')!.appendChild(host);
    }
    const out: Array<{ name: string; box: number[]; drawn: number }> = [];
    // An icon of the set is an SVG on the 24 grid drawn with the set's stroke (ICON_ATTRS); the mark, charts and the QR are not.
    const svgs = Array.from(document.querySelectorAll('svg')).filter(s => s.getAttribute('viewBox') === '0 0 24 24' && s.hasAttribute('stroke-width')) as SVGSVGElement[];
    for (const svg of svgs) {
      if (svg.closest('.inv-ico-mark') || !svg.checkVisibility()) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, drawn = 0;
      for (const el of Array.from(svg.querySelectorAll('path, circle, rect')) as SVGGraphicsElement[]) {
        if (getComputedStyle(el).display === 'none') continue;
        const b = el.getBBox();
        drawn++;
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      }
      const span = svg.parentElement && svg.parentElement.getAttribute('data-p228');
      const where = span || (svg.parentElement ? svg.parentElement.tagName.toLowerCase() + '.' + (svg.parentElement.className || '') : '');
      out.push({ name: where, box: [x0, y0, x1, y1].map(v => Math.round(v * 1000) / 1000), drawn });
    }
    if (host) host.remove();
    return out;
  }, everyName);
}
const outside = (list: Array<{ name: string; box: number[]; drawn: number }>) =>
  list.filter(r => !r.drawn || r.box[0] < 1.5 || r.box[1] < 1.5 || r.box[2] > 22.5 || r.box[3] > 22.5).map(r => r.name + ' ' + JSON.stringify(r.box));

test.describe('P228: icons v3, the set', () => {
  test('every icon name a module draws is in ICONS, and every name §4 lists is there', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const names: string[] = await g(page, 'Object.keys(ICONS)');
    const have = new Set(names);
    // The names written in the source: iconSvg('…'), ICONS.x and ICONS['x'], a slot's data-icon, a door's icon.
    const used = new Set<string>();
    const wsDoors = new Set<string>();
    for (const f of modules()) {
      const s = code(f);
      all(/iconSvg\(\s*'([^']+)'/g, s).forEach(n => used.add(n));
      // ICONS itself, never another table named …_ICONS (HISTORY_ICONS, WS_ICONS), whose keys are not the set's.
      all(/(?<![\w$])ICONS\.([A-Za-z_$][\w$]*)/g, s).forEach(n => used.add(n));
      all(/(?<![\w$])ICONS\[\s*'([^']+)'\s*\]/g, s).forEach(n => used.add(n));
      all(/data-icon="([^"]+)"/g, s).forEach(n => used.add(n));
      all(/wsDoorHtml\('[^']*',\s*'[^']*',\s*'([A-Za-z]+)'/g, s).forEach(n => wsDoors.add(n));
    }
    for (const f of readdirSync(SPLIT).filter(f => /\.html$/.test(f))) all(/data-icon="([^"]+)"/g, src(f)).forEach(n => used.add(n));
    expect(used.size).toBeGreaterThan(40);
    expect([...used].filter(n => !have.has(n))).toEqual([]);
    // The names passed through data: the workspaces' doors, the guides' subjects, and every table that holds an icon's paths.
    const data = await page.evaluate(() => {
      const w: any = window;
      const blank = (o: Record<string, unknown>) => Object.keys(o).filter(k => typeof o[k] !== 'string' || !(o[k] as string).length);
      return {
        workspaces: w.WORKSPACES.map((x: any) => x.icon).filter((n: string) => !w.ICONS[n] || !w.WS_ICONS[n]),
        wsIcons: blank(w.WS_ICONS),
        guides: Object.keys(w.KB_GUIDE_ICON).filter(k => !w.ICONS[w.KB_GUIDE_ICON[k]]),
        kinds: blank(w.KB_KIND_SVG), ctx: blank(w.KB_CTX_SVG), history: blank(w.HISTORY_ICONS), add: blank(w.ADD_ICON),
        hand: w.ADD_HAND.filter((h: any) => typeof h[2] !== 'string' || !h[2].length).map((h: any) => h[0]),
      };
    });
    expect(data).toEqual({ workspaces: [], wsIcons: [], guides: [], kinds: [], ctx: [], history: [], add: [], hand: [] });
    expect([...wsDoors].filter(n => !names.includes(n))).toEqual([]);
    expect(await g(page, `${JSON.stringify([...wsDoors])}.filter(function(n) { return !WS_ICONS[n]; })`)).toEqual([]);
    // §4's lists: the board's 64 (its groups, sixteen each), the kept names, every name the set had before.
    expect(BOARD).toHaveLength(64);
    expect(BOARD.filter(n => !have.has(n))).toEqual([]);
    expect(KEPT.filter(n => !have.has(n))).toEqual([]);
    expect(OLD).toHaveLength(62);
    expect(OLD.filter(n => !have.has(n))).toEqual([]);
    // An alias is one shape under two names.
    for (const [a, b] of ALIASES) expect(await g(page, `ICONS.${a} === ICONS.${b} && ICONS.${a}.length > 0`), a + ' = ' + b).toBe(true);
    // Lucide's own shapes (lucide-static 0.460.0), as the spec names them: the house, the gear, the sliders, the scanned QR.
    const icon = (n: string) => g(page, `ICONS.${n}`) as Promise<string>;
    expect(await icon('home')).toContain('M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z');
    expect(await icon('settings')).toContain('M12.22 2h-.44a2 2 0 0 0-2 2v.18');
    expect(await icon('filter')).toContain('<path d="M21 4H14"/>');
    expect(await icon('idscan')).toContain('<path d="M17 12v4a1 1 0 0 1-1 1h-4"/>');
    // The settings gear and the toolbar's Filter never look alike.
    expect(await icon('settings')).not.toBe(await icon('filter'));
  });

  test('a tint is a fill-only path stored d:, laid under the lines, and only a path carries one', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const set: Record<string, string> = await g(page, 'ICONS');
    const bad: string[] = [];
    let tinted = 0;
    for (const [n, s] of Object.entries(set)) {
      // The marker is the start of a path's data, nowhere else.
      if ((s.match(/d:/g) || []).length !== (s.match(/<path d="d:/g) || []).length) bad.push(n + ': a d: marker that is not a path’s');
      // Every tint before every line, so the lines are drawn over it.
      const els = s.match(/<(path|circle|rect)\b[^>]*>/g) || [];
      const firstLine = els.findIndex(e => !/^<path d="d:/.test(e));
      if (els.slice(firstLine).some(e => /^<path d="d:/.test(e))) bad.push(n + ': a tint after a line');
      if (/^<path d="d:/.test(els[0] || '')) tinted++;
    }
    expect(bad).toEqual([]);
    expect(tinted).toBeGreaterThan(40);
    // Drawn, the marker is gone and the tint is its class: the accent at a fifth, never a stroke.
    const drawn: string = await g(page, `iconSvg('vat')`);
    expect(drawn).not.toContain('d:');
    expect(drawn.match(/class="inv-ico-tint"/g) || []).toHaveLength(1);
    const ink = await page.evaluate(() => {
      const w: any = window;
      const host = document.createElement('div');
      host.innerHTML = '<span id="p228a">' + w.iconSvg('alert') + '</span>' +
        '<details class="inv-hero inv-hero-danger" open><summary class="inv-hero-head"><span id="p228b">' + w.iconSvg('alert') + '</span></summary></details>' +
        '<span class="inv-badge inv-badge-ok" id="p228c">' + w.iconSvg('done') + ' Good</span>' +
        '<button type="button" class="inv-btn inv-btn-primary" id="p228d">' + w.iconSvg('print') + ' Print</button>';
      document.querySelector('.inv-page-active')!.appendChild(host);
      const colour = (v: string) => { const d = document.createElement('i'); d.style.color = v; host.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const tint = (id: string) => getComputedStyle(document.querySelector('#' + id + ' .inv-ico-tint')!);
      const r = {
        opacity: tint('p228a').fillOpacity, stroke: tint('p228a').stroke,
        plain: tint('p228a').fill === colour('var(--accent)'),
        toned: tint('p228b').fill === colour('var(--danger)'),
        badge: tint('p228c').fill === getComputedStyle(document.getElementById('p228c')!).color,
        primary: tint('p228d').fill === getComputedStyle(document.getElementById('p228d')!).color,
        accent: colour('var(--accent)'), danger: colour('var(--danger)'),
      };
      host.remove();
      return r;
    });
    expect(ink.accent).not.toBe(ink.danger);
    expect(ink).toMatchObject({ opacity: '0.22', stroke: 'none', plain: true, toned: true, badge: true, primary: true });
  });

  test('every icon of the set, and every one on screen, stays inside the 24 grid', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const set = await bboxes(page, true);
    expect(set.length).toBeGreaterThan(100);
    expect(outside(set)).toEqual([]);
    await openPulse(page);
    const shell = await bboxes(page, false);
    expect(shell.length).toBeGreaterThan(10);
    expect(outside(shell)).toEqual([]);
  });

  test('body.html is slots: each filled from the set at boot, the shell’s icons where they were', async ({ page }) => {
    const body = src('body.html');
    expect(body).not.toContain('<svg');
    expect((body.match(/<span data-icon="[A-Za-z]+"><\/span>/g) || []).length).toBeGreaterThanOrEqual(18);
    await loadAppWithState(page, emptyState());
    await expect(page.locator('[data-icon]')).toHaveCount(0);
    // A slot is its icon: the top bar's, the print bar's, the quick actions'.
    for (const sel of ['#navBack', '.inv-topbar [data-action="invOpenSettings"].inv-topbar-btn', '.inv-topbar [data-action="invGoHistory"].inv-topbar-btn',
      '.inv-topbar [data-action="invKbHelp"].inv-topbar-btn', '.inv-topbar [data-action="invNewWindow"]', '.inv-ws-search', '[data-action="invClosePrint"]',
      '#invPrintRemote', '[data-action="invPrint"]', '[data-home-w="quick"] [data-action="invCreateNew"]']) {
      await expect(page.locator(sel + ' > svg[aria-hidden="true"]'), sel).toHaveCount(1);
    }
    await expect(page.locator('[data-home-w="quick"] [data-action="invHomeQuick"] > svg')).toHaveCount(5);
    // The back arrow is the set's own, as the browser holds it once parsed.
    expect(await page.locator('#navBack > svg').evaluate(s => s.outerHTML)).toBe(await g(page,
      `(function() { var t = document.createElement('template'); t.innerHTML = iconSvg('back'); return t.content.firstElementChild.outerHTML; })()`));
    // The print bar's icons are sized by the stylesheet, as the attributes they had sized them.
    const size = await page.evaluate(() => {
      const pv = document.getElementById('invPrintView')!;
      pv.classList.add('inv-print-view-active');
      const r = document.querySelector('[data-action="invPrint"] > svg')!.getBoundingClientRect();
      pv.classList.remove('inv-print-view-active');
      return [r.width, r.height];
    });
    expect(size).toEqual([20, 20]);
    // Today's tick inside a step's dot is the set's check, heavier (inv-ico-bold), never an SVG of its own.
    const bold = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = (window as any).TDY_CHECK_SVG;
      document.querySelector('.inv-page-active')!.appendChild(host);
      const svg = host.querySelector('svg')!;
      const t = document.createElement('template');
      t.innerHTML = (window as any).iconSvg('check');
      const r = { cls: svg.getAttribute('class'), width: getComputedStyle(svg).strokeWidth, same: svg.innerHTML === t.content.firstElementChild!.innerHTML };
      host.remove();
      return r;
    });
    expect(bold).toEqual({ cls: 'inv-ico-bold', width: '3px', same: true });
  });

  test('no module but state.js and the drawings §4 lets stay writes an <svg>', async ({ page }) => {
    const hits: string[] = [];
    for (const f of modules()) {
      if (SVG_OK.includes(f)) continue;
      src(f).split('\n').forEach((line, i) => { if (/<svg\b/.test(line)) hits.push(f + ':' + (i + 1) + ': ' + line.trim().slice(0, 120)); });
    }
    for (const f of readdirSync(SPLIT).filter(f => /\.html$/.test(f))) if (/<svg\b/.test(src(f))) hits.push(f);
    expect(hits).toEqual([]);
    // The mark's two copies went to the one builder.
    expect(src('guard.js')).toContain("markSvg('sm', 'tile')");
    expect(src('workspace.js')).toContain("markSvg('sm', 'tile')");
    await page.goto('about:blank');
  });

  test('the door on screen carries its tint; a door at rest draws its line alone', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const doors = await page.evaluate(() => Array.from(document.querySelectorAll('.inv-navbar-item')).map(b => ({
      on: b.classList.contains('inv-navbar-item-on'),
      tints: Array.from(b.querySelectorAll('.inv-ico-tint')).map(t => getComputedStyle(t).display),
    })));
    const on = doors.filter(d => d.on), rest = doors.filter(d => !d.on && d.tints.length);
    expect(on).toHaveLength(1);
    expect(on[0].tints.length).toBeGreaterThan(0);
    expect(on[0].tints.every(d => d !== 'none')).toBe(true);
    expect(rest.length).toBeGreaterThan(1);
    expect(rest.every(d => d.tints.every(x => x === 'none'))).toBe(true);
  });

  test('the brand’s mark: one builder, never a fixed id; the lock draws it', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    const m = await page.evaluate(() => {
      const w: any = window;
      const host = document.createElement('div');
      host.innerHTML = w.markSvg('sm', 'tile') + w.markSvg('lg', 'brass') + w.markSvg('lg', 'brass');
      document.querySelector('.inv-page-active')!.appendChild(host);
      const ids = Array.from(host.querySelectorAll('[id]')).map(e => e.id);
      const marks = Array.from(host.querySelectorAll('svg')).map(s => s.getAttribute('class'));
      const brass = host.querySelectorAll('svg')[1] as SVGSVGElement;
      const body = brass.querySelector('path')!;
      const colour = (v: string) => { const d = document.createElement('i'); d.style.color = v; host.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const r = {
        ids, marks,
        filled: body.getAttribute('fill') === 'url(#' + ids[0] + ')',
        // The gradient's two stops are coloured by the stylesheet (stop-color's default is black).
        stops: Array.from(brass.querySelectorAll('stop')).map(s => getComputedStyle(s).stopColor).filter(c => c && c !== 'rgb(0, 0, 0)').length,
        tile: getComputedStyle(host.querySelector('svg rect')!).fill === colour('var(--accent)'),
        nut: getComputedStyle(host.querySelector('svg g path')!).stroke === colour('var(--on-accent)'),
        lock: w.grdLockHtml(),
      };
      host.remove();
      return r;
    });
    expect(m.marks).toEqual(['inv-ico-mark inv-ico-mark-tile', 'inv-ico-mark inv-ico-mark-lg inv-ico-mark-brass', 'inv-ico-mark inv-ico-mark-lg inv-ico-mark-brass']);
    // Two brass marks on the page at once hold two ids (P76 fails a duplicate id); the tile holds none.
    expect(m.ids).toHaveLength(2);
    expect(new Set(m.ids).size).toBe(2);
    expect(m.filled).toBe(true);
    expect(m.stops).toBe(2);
    expect(m.tile).toBe(true);
    expect(m.nut).toBe(true);
    expect(m.lock).toContain('class="inv-ico-mark inv-ico-mark-tile"');
    expect(m.lock).not.toContain('viewBox="0 0 512 512"');
  });

  test('the licences go with the build, and Settings shows them in full', async ({ page }) => {
    const flat = (s: string) => s.replace(/\s+/g, ' ');
    const ISC = 'Copyright (c) 2026 Lucide Icons and Contributors Permission to use, copy, modify, and/or distribute this software for any purpose ' +
      'with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. ' +
      'THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF ' +
      'MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES ' +
      'WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF ' +
      'OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.';
    const MIT = 'Copyright (c) 2013-present Cole Bemis Permission is hereby granted, free of charge, to any person obtaining a copy of this software ' +
      'and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, ' +
      'copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished ' +
      'to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial ' +
      'portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE ' +
      'WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE ' +
      'FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE ' +
      'SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
    // The built page keeps comments: both notices sit in it in full, as the comment above ICONS states them.
    const built = flat(readFileSync(path.join(ROOT, 'sep-invoicing.html'), 'utf8'));
    expect(built).toContain(ISC);
    expect(built).toContain(MIT);
    expect(built).toContain('The following Lucide icons are derived from the Feather project: airplay,');
    // Settings → Data & device → Backup, storage & build → Licences: a dialog of the app's own, never the browser's.
    const popups: string[] = [];
    page.on('dialog', d => { popups.push(d.message()); d.dismiss().catch(() => {}); });
    await loadAppWithState(page, emptyState());
    await openSettingsAt(page, 'data');
    await page.locator('details[data-sec="data"] [data-action="invLicences"]').click();
    const dlg = page.locator('.inv-scrim-dialog [data-licences]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.inv-dialog-title')).toHaveText('Licences');
    const text = flat(await dlg.innerText());
    expect(text).toContain(ISC);
    expect(text).toContain(MIT);
    expect(text).toContain('derived from the Feather project: airplay,');
    // Esc shuts the licences and leaves Settings open under them.
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('#settingsScrim')).toHaveCount(1);
    expect(popups).toEqual([]);
  });
});

test.describe('P228: icons v3, on the desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('the rail: its mark from markSvg, the door on screen tinted, the rest at rest; every icon inside the grid', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await expect(page.locator('#invSidebar .inv-side-brand > svg.inv-ico-mark.inv-ico-mark-tile')).toHaveCount(1);
    await expect(page.locator('[data-icon]')).toHaveCount(0);
    const rail = await page.evaluate(() => Array.from(document.querySelectorAll('#invSidebar .inv-side-item')).map(b => ({
      on: b.classList.contains('inv-side-item-on'),
      tints: Array.from(b.querySelectorAll('.inv-ico-tint')).map(t => getComputedStyle(t).display),
    })));
    const on = rail.filter(d => d.on), rest = rail.filter(d => !d.on && d.tints.length);
    expect(on).toHaveLength(1);
    expect(on[0].tints.every(d => d !== 'none')).toBe(true);
    expect(rest.length).toBeGreaterThan(1);
    expect(rest.every(d => d.tints.every(x => x === 'none'))).toBe(true);
    // The desktop's own tools (History, the book, a new window) and the rail.
    const shell = await bboxes(page, false);
    expect(shell.length).toBeGreaterThan(8);
    expect(outside(shell)).toEqual([]);
    await switchTab(page, 'pageHistory');
    expect(outside(await bboxes(page, false))).toEqual([]);
  });
});
