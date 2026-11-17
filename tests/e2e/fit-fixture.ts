import type { Page } from '@playwright/test';
import { bigSweepState } from './sweep-fixture';
import type { SepState } from './fixtures';

// P274: text in a box fits the box. Every name and figure here is made up (HR-10).

/* The crore book (bigSweepState) with every other name and figure that can run long made longer still: a part number and a
   description past any real one, a worker's full name, a supplier's, a cheque and a bank balance in crores. */
export function fitState(): SepState {
  const s = bigSweepState() as any;
  const part = 'QX1-MOUNTING-BRACKET-ASSEMBLY-LH-0001234567';
  const desc = 'ZINC ELECTROPLATING OF MOUNTING BRACKET ASSEMBLY LEFT HAND WITH TRIVALENT BLUE PASSIVATION AND SEALER';
  s.items[0].partNumber = part; s.items[0].desc = desc;
  for (const x of s.invoices) for (const l of x.items) if (l.partNumber === 'BRKT-0') { l.partNumber = part; l.desc = desc; }
  for (const c of s.incomingMaterial) for (const l of c.items) if (l.partNumber === 'BRKT-0') { l.partNumber = part; l.desc = desc; }
  s.staff[0].name = 'Ramchandra Prasad Kumar Mahato Singh';
  for (const e of s.stock.entries) if (e.supplier === 'Alpha Metals') e.supplier = 'DELTA AUTO NON-FERROUS METALS AND ALLOYS TRADING PRIVATE LIMITED';
  s.bank.cheques[0].amount = 123456789;
  s.bank.rows[4].balance = 123456789.5;
  s.bank.rows[3].cr = 98765432.1;
  return s;
}

/* CI's browser draws text about 0.5% wider than the sandbox's (docs/atlas/core/tests.md): laid over a page measured near a limit. */
export const CI_TEXT = '* { letter-spacing: 0.005em }';

/* The hits a spec fails on, one line each. A field's own text wider than the field is left out: a typed value scrolls in its input,
   a native select draws its own cut, and neither is a box the app draws round text. */
export function fitShown(hits: FitHit[]): string[] {
  return hits.filter(h => !(h.kind === 'field' && h.el.endsWith(' text'))).map(h => `${h.where}: ${h.kind} ${h.px}px ${h.el} "${h.text}"`);
}

export type FitHit = { where: string; kind: 'spill' | 'clipped' | 'padding' | 'hug' | 'field' | 'starved'; el: string; text: string; px: number };

/* Text against the box that holds it, read from the rendered page (the top dialog if one is open, else the page and the shell's
   bars). A box is the nearest element that draws an edge the eye reads as one: a border, or a fill unlike the one behind it.
   For each line of text, as the browser lays it out:
   - spill: the line runs past the box's inner edge (into its border or out of it), and nothing clips it;
   - clipped: an element that hides overflow (and draws no ellipsis) cuts the line;
   - hug: the line sits less than `hug` px from a drawn edge of its box, left or right (text touching its border);
   - field: an input's or a select's own text is wider than the field shows, or its text starts at its border.
   A line inside a scroller between it and its box is the scroller's (a wide table scrolls), and is skipped. */
export async function fitScan(page: Page, where: string, hug = 3): Promise<FitHit[]> {
  return page.evaluate(([where, hug]) => {
    const hits: any[] = [];
    const alpha = (c: string) => { const m = c.match(/rgba?\(([^)]*)\)/); if (!m) return c === 'transparent' ? 0 : 1; const a = m[1].split(/[ ,/]+/).filter(Boolean); return a.length > 3 ? parseFloat(a[3]) : 1; };
    const bgOf = (el: Element | null): string => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (alpha(b) > 0.05) return b; } return 'rgb(0,0,0)'; };
    const name = (el: Element) => el.tagName.toLowerCase() + (typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? '.' + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (el.id ? '#' + el.id : '');
    /* Which sides of an element draw an edge: a border of a visible colour, or (all four) a fill unlike its parent's. */
    const edges = (el: Element) => {
      const cs = getComputedStyle(el);
      const side = (s: string) => parseFloat((cs as any)['border' + s + 'Width']) >= 0.5 && cs.getPropertyValue('border-' + s.toLowerCase() + '-style') !== 'none' && alpha((cs as any)['border' + s + 'Color']) > 0.1;
      const fill = alpha(cs.backgroundColor) > 0.05 && cs.backgroundColor !== bgOf(el.parentElement);
      return { l: side('Left') || fill, r: side('Right') || fill, t: side('Top') || fill, b: side('Bottom') || fill, any: side('Left') || side('Right') || side('Top') || side('Bottom') || fill };
    };
    const dlg = document.querySelectorAll('.inv-scrim');
    const roots: Element[] = dlg.length ? [dlg[dlg.length - 1]] : Array.from(document.querySelectorAll('.inv-page-active, .inv-topbar, .inv-navbar, .inv-sidebar, .inv-wsbar, #wsTabs')).filter(Boolean);
    const seen = new Set<string>();
    const push = (h: any) => { const k = h.kind + '|' + h.el + '|' + h.text; if (!seen.has(k)) { seen.add(k); hits.push(h); } };
    for (const root of roots) {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
        const txt = n.textContent || '';
        if (!txt.trim()) continue;
        const host = n.parentElement!;
        if (!host.checkVisibility({ visibilityProperty: true, opacityProperty: true } as any)) continue;
        // Text read to a screen reader only (a 1px box clipped to nothing), and paper (a document drawn as it prints).
        let srOnly = false;
        for (let e: Element | null = host; e && e !== root; e = e.parentElement) if (getComputedStyle(e).clip !== 'auto') { srOnly = true; break; }
        if (srOnly) continue;
        if (host.closest('svg, .inv-print-body, .inv-rpt-doc, .inv-qt-doc, .inv-ps-sheet, .inv-idc-sheet, .inv-ck-sheet, .inv-cn-doc, .inv-print-invoice, .inv-as-page, .inv-qc-page, .inv-pcp-doc, .inv-sr-doc, .inv-qr')) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        const rects = Array.from(r.getClientRects()).filter(q => q.width > 0.5 && q.height > 0.5);
        if (!rects.length) continue;
        // The box, and the first clipping ancestor on the way to it.
        let box: Element | null = null, clip: Element | null = null, scroller = false;
        for (let e: Element | null = host; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (!clip && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
            if (/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY)) { scroller = true; }
            clip = e;
          }
          if (edges(e).any) { box = e; break; }
          if (scroller) break;
        }
        if (scroller && clip !== box) continue;
        // An ellipsis or a line clamp is a designed cut (P76's untitled holds it to a title): neither clipped nor spilled.
        const lineClamped = (e: Element | null) => !!e && getComputedStyle(e).webkitLineClamp !== 'none' && getComputedStyle(e).webkitLineClamp !== '';
        const designed = !!clip && (getComputedStyle(clip).textOverflow === 'ellipsis' || lineClamped(clip));
        if (designed) clip = null;
        const label = txt.trim().slice(0, 50);
        if (clip && !scroller) {
          const cb = clip.getBoundingClientRect(), ccs = getComputedStyle(clip);
          const L = cb.left + parseFloat(ccs.borderLeftWidth), R = cb.right - parseFloat(ccs.borderRightWidth);
          const T = cb.top + parseFloat(ccs.borderTopWidth), B = cb.bottom - parseFloat(ccs.borderBottomWidth);
          const over = Math.max(...rects.map(q => Math.max(q.right - R, L - q.left, q.bottom - B - 1, T - q.top - 1)));
          if (over > 1) push({ where, kind: 'clipped', el: name(clip) + ' > ' + name(host), text: label, px: Math.round(over) });
        }
        if (!box) continue;
        const bb = box.getBoundingClientRect(), bcs = getComputedStyle(box), ed = edges(box);
        if (bb.width < 1) continue;
        const L = bb.left + parseFloat(bcs.borderLeftWidth), R = bb.right - parseFloat(bcs.borderRightWidth);
        const T = bb.top + parseFloat(bcs.borderTopWidth), B = bb.bottom - parseFloat(bcs.borderBottomWidth);
        if (!clip && !scroller && !designed) {
          const over = Math.max(...rects.map(q => Math.max(q.right - R, L - q.left, q.bottom - B - 1, T - q.top - 1)));
          if (over > 1) { push({ where, kind: 'spill', el: name(box) + ' > ' + name(host), text: label, px: Math.round(over) }); continue; }
        }
        // Into the padding: the line runs past the content edge of the box or of anything between it and the box, into a side padded
        // to keep text off the edge (the other side keeps its inset, so the text sits lopsided against the border).
        if (!designed && !scroller) {
          let into = 0, at: Element | null = null;
          for (let e: Element | null = host; e; e = e === box ? null : e.parentElement) {
            const ecs = getComputedStyle(e), eb = e.getBoundingClientRect();
            const pL = parseFloat(ecs.paddingLeft), pR = parseFloat(ecs.paddingRight);
            const cl = eb.left + parseFloat(ecs.borderLeftWidth) + pL, cr = eb.right - parseFloat(ecs.borderRightWidth) - pR;
            const o = Math.max(...rects.map(q => Math.max(pR >= hug ? q.right - cr : 0, pL >= hug ? cl - q.left : 0)));
            if (o > into) { into = o; at = e; }
          }
          if (into > 1) { push({ where, kind: 'padding', el: name(box) + ' > ' + name(at!) + ' > ' + name(host), text: label, px: Math.round(into) }); continue; }
        }
        // Hug: only a box the text is meant to sit inside (not the page, a panel's whole width, or a full-bleed band).
        if (bb.width >= document.documentElement.clientWidth - 2) continue;
        const gl = Math.min(...rects.map(q => q.left - L)), gr = Math.min(...rects.map(q => R - q.right));
        const g = Math.min(ed.l ? gl : 99, ed.r ? gr : 99);
        if (g < hug && g > -1) push({ where, kind: 'hug', el: name(box) + ' > ' + name(host), text: label, px: Math.round(g * 10) / 10 });
      }
      // Starved: an ellipsis is a designed cut, but one that leaves under three characters' room says nothing.
      for (const el of Array.from(root.querySelectorAll('*')) as HTMLElement[]) {
        const cs = getComputedStyle(el);
        if (cs.textOverflow !== 'ellipsis' || !el.checkVisibility() || el.scrollWidth <= el.clientWidth + 1) continue;
        if (el.clientWidth < parseFloat(cs.fontSize) * 2.5) push({ where, kind: 'starved', el: name(el), text: (el.innerText || '').trim().slice(0, 50), px: el.clientWidth });
      }
      // Fields: what a field shows of its own text.
      const canvas = document.createElement('canvas').getContext('2d')!;
      for (const f of Array.from(root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color]), select, textarea')) as HTMLInputElement[]) {
        if (!f.checkVisibility({ visibilityProperty: true, opacityProperty: true } as any)) continue;
        const cs = getComputedStyle(f);
        const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
        let text = '', avail = f.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (f.tagName === 'SELECT') { const s = f as unknown as HTMLSelectElement; text = s.selectedOptions[0]?.text || ''; }
        else if (f.tagName === 'INPUT' && !/date|time|month|week|number/.test(f.type)) text = f.value || f.placeholder || '';
        // The field's text starts inside the edge the eye reads as its box: the field's own border or fill, else the wrapper that
        // draws one (a search field is a bare input in an .inv-search box with its icon).
        let fb: Element | null = f;
        while (fb && fb !== document.body && !edges(fb).any) fb = fb.parentElement;
        if (fb && fb !== document.body && cs.textAlign !== 'center') {
          const r0 = f.getBoundingClientRect(), b0 = fb.getBoundingClientRect(), bcs0 = getComputedStyle(fb);
          const gl = fb === f ? pl : (r0.left + pl) - (b0.left + parseFloat(bcs0.borderLeftWidth));
          if (gl < hug + 1 && b0.width < document.documentElement.clientWidth - 2)
            push({ where, kind: 'field', el: name(f) + ' padding', text: (text || f.getAttribute('aria-label') || '').slice(0, 40), px: Math.round(gl) });
        }
        if (!text || f.tagName === 'TEXTAREA') continue;
        canvas.font = cs.font;
        const w = canvas.measureText(text).width + (parseFloat(cs.letterSpacing) || 0) * text.length;
        if (w > avail + 1) push({ where, kind: 'field', el: name(f) + ' text', text: text.slice(0, 50), px: Math.round(w - avail) });
      }
    }
    return hits;
  }, [where, hug] as const);
}
