import { type Page } from '@playwright/test';
import { switchTab } from './fixtures';
import { PAGES } from './sweep-fixture';

// P79: a change inside a view never moves the page (owner, 27 Sep 2026: "check if clicking a drop down or selecting
// an option from the drop-down is leading the page to go back to the top, I noticed this behaviour in receivables").
// At every stop the sweep scrolls each <select> (and each unpressed filter chip or segment) to near the top of its
// scroller, so whatever sits above it (the view tabs, the toolbar) is off-screen, makes the change, and measures:
// the control, or the one the re-render drew in its place, must still be where it was, and its scroller must not
// have gone back to the top. Every change the app answers with a real navigation is listed in NAVIGATES, with why.

/* Every control the sweep changed, so a spec can say it reached them. */
export const probed: string[] = [];

export type Jump = { where: string; control: string; before: number; after: number; scrollBefore: number; scrollAfter: number };

/* Controls whose change is a navigation by design: they open another page, so the page is meant to move. */
export const NAVIGATES: Array<[RegExp, string]> = [
  // Settings → Appearance repaints the whole app (theme, palette, density); nothing to hold in place, and the spacing
  // itself changes under a density switch, so a row moving there is the point of it.
  [/invAppearance/, 'density and theme change every size on the screen'],
];

const SPACER = 'p79Spacer';

/* A tall block after everything, so every page can be scrolled far enough to take its view tabs off-screen. */
async function addSpacer(page: Page) {
  await page.evaluate(id => {
    if (document.getElementById(id)) return;
    const d = document.createElement('div');
    d.id = id;
    d.setAttribute('style', 'height:1600px');
    document.body.appendChild(d);
  }, SPACER);
}

/* Probe every select, then every unpressed chip, inside `scope`. `where` names the stop. */
export async function probeStop(page: Page, where: string, scope: string, jumps: Jump[], seen: Set<string>, opts: { chips?: boolean } = {}) {
  await addSpacer(page);
  const keys: Array<{ key: string; kind: 'select' | 'chip' }> = await page.evaluate(([scope, chips]) => {
    const root = (scope === 'dialog' ? Array.from(document.querySelectorAll('.inv-scrim-dialog')).pop() : document.querySelector(scope as string)) as HTMLElement | null;
    if (!root) return [];
    const keyOf = (el: Element) => {
      if (el.id) return '#' + CSS.escape(el.id);
      const attrs = Array.from(el.attributes).filter(a => /^data-|^aria-label$/.test(a.name) && a.name !== 'aria-pressed')
        .map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
      return el.tagName.toLowerCase() + (el.classList.contains('inv-chip') ? '.inv-chip' : '') + attrs;
    };
    const vis = (el: HTMLElement) => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const out: Array<{ key: string; kind: 'select' | 'chip' }> = [];
    root.querySelectorAll('select').forEach(s => { if (vis(s as HTMLElement) && !(s as HTMLSelectElement).disabled && (s as HTMLSelectElement).options.length > 1) out.push({ key: keyOf(s), kind: 'select' }); });
    if (chips) root.querySelectorAll('.inv-chip[aria-pressed="false"], .inv-seg-btn[aria-pressed="false"], .inv-tile[aria-pressed="false"]').forEach(b => {
      if (vis(b as HTMLElement)) out.push({ key: keyOf(b), kind: 'chip' });
    });
    return out;
  }, [scope, !!opts.chips] as const);
  for (const { key, kind } of keys) {
    const id = where + ' ' + key;
    if (seen.has(id)) continue;
    seen.add(id);
    if (NAVIGATES.some(([re]) => re.test(key))) continue;
    const r = await page.evaluate(async ([scope, key, kind]) => {
      const root = (scope === 'dialog' ? Array.from(document.querySelectorAll('.inv-scrim-dialog')).pop() : document.querySelector(scope as string)) as HTMLElement | null;
      const el = root && root.querySelector(key as string) as HTMLElement | null;
      if (!el || !el.checkVisibility()) return null;
      // Its scroller: the nearest ancestor that scrolls, else the window.
      const scrollerOf = (n: HTMLElement): HTMLElement | null => {
        for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
          const oy = getComputedStyle(p).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
        }
        return null;
      };
      const sc = scrollerOf(el);
      const top = () => (sc ? sc.scrollTop : window.scrollY);
      // Near the top of what is showing, so the tabs and toolbar above it are out of sight.
      if (sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
      else window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 140);
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const scrollBefore = top(), before = el.getBoundingClientRect().top;
      const dialogs = document.querySelectorAll('.inv-scrim-dialog').length;
      const pageId = (document.querySelector('.inv-page-active') as HTMLElement | null)?.id;
      if (kind === 'select') {
        const s = el as HTMLSelectElement;
        const opt = Array.from(s.options).find(o => !o.disabled && o.value !== s.value && !o.selected);
        if (!opt) return null;
        s.focus({ preventScroll: true });
        s.value = opt.value;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.click();
      }
      await new Promise(res => setTimeout(res, 60));
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const opened = document.querySelectorAll('.inv-scrim-dialog').length !== dialogs;
      const moved = (document.querySelector('.inv-page-active') as HTMLElement | null)?.id !== pageId;
      const again = (root && root.isConnected ? root : document).querySelector(key as string) as HTMLElement | null;
      const after = again && again.checkVisibility() ? again.getBoundingClientRect().top : null;
      return { before, after, scrollBefore, scrollAfter: top(), opened, moved };
    }, [scope, key, kind] as const);
    if (!r) continue;
    probed.push(where + ' ' + key);
    // A question the change asked (a unit change on a line with entries asks first): answer cancel and go on.
    if (r.opened) {
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.inv-scrim-dialog')).pop()?.querySelector('[data-ans="cancel"], [data-action="invCloseOverlay"]') as HTMLElement | null; if (b) b.click(); else (window as any).closeOverlay(); });
    }
    if (r.moved) continue;
    const toTop = r.scrollBefore > 200 && r.scrollAfter < 40;
    const shifted = r.after != null ? Math.abs(r.after - r.before) > 60 : Math.abs(r.scrollAfter - r.scrollBefore) > 60;
    if (toTop || shifted) jumps.push({ where, control: key, before: Math.round(r.before), after: r.after == null ? -1 : Math.round(r.after), scrollBefore: Math.round(r.scrollBefore), scrollAfter: Math.round(r.scrollAfter) });
  }
}

const probePage = (page: Page, where: string, jumps: Jump[], seen: Set<string>) => probeStop(page, where, '.inv-page-active', jumps, seen, { chips: true });

/* Every page, every view tab on it, and the sub-views whose selects only show once something is opened. */
export async function walkSelects(page: Page, jumps: Jump[]) {
  const seen = new Set<string>();
  for (const id of PAGES) {
    await switchTab(page, id);
    await probePage(page, id, jumps, seen);
    const n = await page.locator(`#${id} .inv-viewtab:visible`).count();
    for (let i = 0; i < n; i++) {
      const t = page.locator(`#${id} .inv-viewtab:visible`).nth(i);
      if (!(await t.count())) break;
      const label = ((await t.innerText()).trim().split('\n')[0] || String(i)).replace(/[^A-Za-z0-9]+/g, '-');
      await t.click();
      await page.waitForTimeout(50);
      const where = `${id} › ${label}`;
      await probePage(page, where, jumps, seen);
      // What only shows once a row is opened.
      const opens: Record<string, string[]> = {
        'pageFinance › Receivables': ['[data-action="invBankClient"]', '[data-action="invBankChange"]'],
        'pageFinance › Bank': ['[data-action="invBankEdit"]'],
        'pageFinance › Bills-notes': ['[data-action="invCostBillOpen"]', '[data-action="invCnFormOpen"][data-mode="new"]'],
        'pageStock › Lines': ['[data-action="invStockOpen"]'],
      };
      for (const sel of opens[where] || []) {
        const b = page.locator(`#${id} ${sel}:visible`).first();
        if (!(await b.count())) continue;
        await b.evaluate(el => (el as HTMLElement).click());
        await page.waitForTimeout(50);
        await probePage(page, `${where} + ${sel}`, jumps, seen);
      }
    }
  }
  // Dialogs whose form carries selects.
  for (const [name, js] of [['client-edit', 'openClientEdit(1)'], ['worker-edit', 'openWorkerEdit(1)'], ['item-edit', 'openItemEdit(1)'], ['todo-new', 'todoOpenEdit(null)'], ['settings', 'openSettings()']]) {
    await page.evaluate(src => { (window as any).closeOverlay(); (window as any).closeSettings?.(); (0, eval)(src); }, js);
    // A sheet slides in: measure once it has landed, or the slide reads as a jump.
    await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => null))));
    await page.waitForTimeout(100);
    await probeStop(page, 'dialog ' + name, 'dialog', jumps, seen, { chips: true });
    await page.evaluate(() => { (window as any).closeSettings?.(); (window as any).closeOverlay(); });
  }
}
