import { expect, type Page } from '@playwright/test';
import { loadAppWithState, todayIso } from './fixtures';
import { longBook } from './load-fixture';
import { walkFamily, geistReady } from './p235-family.fixture';

// P235 (UI pass 3, U2R; docs/UI_PASS_3.md §24b–§24d): one skeleton on every card, its type's surface, salience by severity, titles
// whole in Geist, chart labels a size a person reads, and nothing focused when Home is drawn. Shared by the phone and the desktop.

/* What is wrong with the skeleton of every card on the board. */
export async function skeletonProblems(page: Page, where: string): Promise<string[]> {
  const bad = await page.evaluate(() => {
    const w = window as any, out: string[] = [];
    const px = (v: string) => Math.round(parseFloat(v) * 10) / 10;
    const resolve = (host: HTMLElement, token: string) => {
      const p = document.createElement('div');
      p.style.background = 'var(' + token + ')';
      p.style.color = 'var(' + token + ')';
      host.appendChild(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    };
    document.querySelectorAll('#homeBoard .inv-widget').forEach(el => {
      const card = el as HTMLElement, def = w.wdgDef(card.dataset.w), size = card.dataset.size as string, at = card.dataset.w + '@' + size;
      const cs = getComputedStyle(card);
      // The frame: the head 44 px, the corner 14 px, the sides the head's and the body's alike (16 px, a phone's Small 14).
      const head = card.querySelector(':scope > .inv-widget-head') as HTMLElement | null, body = card.querySelector(':scope > .inv-widget-body') as HTMLElement | null;
      if (!head || !body) { out.push(at + ': no head or no body'); return; }
      if (Math.abs(head.getBoundingClientRect().height - 44) > 0.5) out.push(at + ': head ' + head.getBoundingClientRect().height + 'px');
      if (cs.borderTopLeftRadius !== '14px') out.push(at + ': corner ' + cs.borderTopLeftRadius);
      const side = !document.body.classList.contains('inv-desktop') && size === 's' ? 14 : 16;
      if (px(getComputedStyle(head).paddingLeft) !== side || px(getComputedStyle(body).paddingLeft) !== side) out.push(at + ': sides ' + getComputedStyle(head).paddingLeft + ' / ' + getComputedStyle(body).paddingLeft);
      // The order: head, its Choose (the phone's, under it), body, foot; in the body what it says before what it shows; in the foot
      // the Act before the Source, the Source the last line.
      const kids = Array.from(card.children).map(k => (k as HTMLElement).className.split(' ')[0]);
      const want = ['inv-widget-head', 'inv-widget-choose', 'inv-widget-body', 'inv-widget-foot'];
      let last = -1;
      kids.forEach(k => { const i = want.indexOf(k); if (i < 0) out.push(at + ': a part out of the skeleton: ' + k); else if (i <= last) out.push(at + ': ' + k + ' out of order'); else last = i; });
      // A Briefing's answer is a sentence in the figure's place (§24d): what the card says, first.
      const says = ['inv-brief-ans', 'inv-widget-fig', 'inv-widget-line', 'inv-widget-sub'];
      let seen = -1, shown = false;
      Array.from(body.children).forEach(k => {
        const c = (k as HTMLElement).className.split(' ')[0], i = says.indexOf(c);
        if (i < 0) { shown = true; return; }
        if (shown) out.push(at + ': ' + c + ' after what the card shows');
        if (i <= seen) out.push(at + ': ' + c + ' out of order');
        seen = i;
      });
      const foot = card.querySelector(':scope > .inv-widget-foot');
      if (foot) {
        const fk = Array.from(foot.children).map(k => (k as HTMLElement).className.split(' ')[0]);
        if (fk.some(k => k !== 'inv-widget-act' && k !== 'inv-widget-src')) out.push(at + ': the foot holds ' + fk.join(', '));
        if (fk.indexOf('inv-widget-src') >= 0 && fk[fk.length - 1] !== 'inv-widget-src') out.push(at + ': the Source is not the last line');
      }
      // Its type, and the type's surface (red's tint in its place).
      if (card.dataset.type !== def.type || w.WDG_TYPES.indexOf(def.type) < 0) out.push(at + ': type ' + card.dataset.type);
      // A trend (the month against the last, a period's answer, a record of days) keeps its tone on its figure and lamp and is never
      // edged or tinted: an edge asks for something today (owner, 21 Oct 2026: "Red only for today"; P241). Every other card as before.
      const trend = card.hasAttribute('data-trend');
      // Marked so only in what it says (its data drawn); a widget whose answer decides it (Production, the last day: today's or not)
      // is read as drawn.
      if (typeof def.trend !== 'function' && trend !== (!!def.trend && card.dataset.state === 'ok')) out.push(at + ': data-trend ' + trend + ' where the widget says ' + !!def.trend);
      const tone = trend ? 'neutral' : card.dataset.tone;
      const surf = tone === 'danger' ? '--card-danger' : def.type === 'ledger' ? '--ty-ledger' : def.type === 'plant' ? '--ty-plant' : '--surface';
      if (card.dataset.state === 'ok' || tone !== 'danger') {
        const want2 = resolve(card, surf);
        if (cs.backgroundColor !== want2) out.push(at + ': surface ' + cs.backgroundColor + ' is not ' + surf + ' ' + want2);
      }
      // Salience: quiet below amber; amber a top edge in the warning's mark, red the danger's; the world outside never edged.
      const sh = cs.boxShadow || '';
      if (tone === 'warning' || tone === 'danger') {
        const mark = resolve(card, tone === 'warning' ? '--warning-mark' : '--danger-mark');
        if (!/inset/.test(sh) || sh.indexOf(mark) < 0) out.push(at + ': ' + tone + ' with no top edge in its mark (' + sh + ')');
        if (def.type === 'outside') out.push(at + ': the world outside edged ' + tone);
      } else if (/inset/.test(sh)) out.push(at + ': an edge on a ' + (trend ? 'trend' : tone) + ' card');
      // The title whole at its size (the short one at Small; a desktop's Small its own where a phone's short would say less, the
      // canvas's "Cash coming in?" against the phone's "Getting paid?").
      const t = card.querySelector('.inv-widget-title') as HTMLElement | null;
      if (t) {
        const desk = document.body.classList.contains('inv-desktop');
        const name = size === 's' ? (desk && def.shortDesk) || def.short || def.title : def.title;
        if (t.textContent !== name) out.push(at + ': title "' + t.textContent + '"');
        if (t.scrollWidth > t.clientWidth + 1) out.push(at + ': title cut: "' + name + '" ' + t.scrollWidth + ' > ' + t.clientWidth);
      }
      // Every chart label 11 px or more as drawn (a bare chart's viewBox is the card's own pixels).
      card.querySelectorAll('svg text').forEach(tx => {
        const svg = (tx as SVGElement).ownerSVGElement as SVGSVGElement, r = svg.getBoundingClientRect();
        if (!r.width || !(tx as SVGGraphicsElement).getBBox().width) return;
        const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
        const scale = vb ? Math.min(r.width / vb.width, r.height / vb.height) : 1;
        const eff = parseFloat(getComputedStyle(tx).fontSize) * scale;
        if (eff < 10.9) out.push(at + ': a chart label at ' + Math.round(eff * 10) / 10 + 'px: "' + (tx.textContent || '').slice(0, 20) + '"');
      });
    });
    return out;
  });
  return bad.map(b => where + ' · ' + b);
}

export async function familySkeleton(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  const { bad, drawn } = await walkFamily(page, ['long', 'empty', 'crore'], skeletonProblems);
  expect(drawn).toBeGreaterThan(90);
  expect(errs).toEqual([]);
  expect(bad).toEqual([]);
}

export async function nothingFocused(page: Page) {
  await page.clock.install({ time: new Date(todayIso() + 'T10:15:00') });
  await loadAppWithState(page, longBook());
  await geistReady(page);
  await page.locator('#homeDash:not(.inv-hidden) #homeBoard .inv-widget').first().waitFor();
  expect(await page.evaluate(() => document.activeElement === document.body || !document.activeElement)).toBe(true);
}
