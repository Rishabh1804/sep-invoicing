import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadAppWithState, emptyState, noSeedIM } from './fixtures';
import { longBook, census, LOOKS } from './load-fixture';
import { bigSweepState, sweep, problems, type Stop } from './sweep-fixture';
import { withUsers, unlock, lockNow, PINS, guardBook } from './p140-guard.fixture';

// P224's walk (UI pass 3, U2; docs/UI_PASS_3.md §7i), shared by the phone and the desktop: every widget at every size it allows,
// on three books (the long book, the empty book, the crore book: a ₹12,34,56,789 invoice and an 80-character client name), in
// light and dark; then each preset and three seeded random arrangements of every widget; then each role, the guard on, shown
// only what it may see. A widget fails on what is past its box, a cut (taller than its size's cap), a block over 120
// characters, an error drawn; the screen on everything P76's sweep and P197's looks fail on.

const BOOKS: Array<[string, () => any]> = [['long', longBook], ['empty', () => ({ ...emptyState(), incomingMaterial: noSeedIM() })], ['crore', bigSweepState]];
// Every preset (U2R, §24i: Owner, Office, Supervisor and Floor), each as its role would see it with the guard off.
const PRESETS = ['owner', 'office', 'supervisor', 'floor'];

/* The board drawn again with this layout for the person on the device (as arranging writes it). */
export async function drawBoard(page: Page, list: Array<[string, string]>) {
  await page.evaluate(l => {
    const w = window as any, who = w.wdgPerson();
    const st = { v: 1, people: { [who]: { home: { preset: 'custom', desk: l, phone: l } } } };
    localStorage.setItem('sep_inv_layout', JSON.stringify(st));
    w.renderHome();
  }, list);
  await page.locator('#homeDash:not(.inv-hidden) #homeBoard').waitFor();
  await page.waitForTimeout(60);
}

/* What is wrong with the widgets on the board, each named id@size. */
export async function widgetProblems(page: Page, where: string): Promise<string[]> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const sel = '.inv-row-meta, .inv-note, .inv-callout, .inv-hero-sub, .inv-tile-sub, .inv-row-title, .inv-widget-sub, .inv-widget-line, .inv-deck-sub, .inv-deck-title, .inv-blank-body, .inv-blank-title';
    document.querySelectorAll('#homeBoard .inv-widget').forEach(c => {
      const card = c as HTMLElement, at = card.dataset.w + '@' + card.dataset.size;
      if (card.dataset.state === 'error') out.push(at + ': drawn as an error');
      if (card.scrollHeight > card.clientHeight + 1) out.push(at + ': cut, ' + (card.scrollHeight - card.clientHeight) + 'px past its size');
      // Under its foot: a body shrunk to leave the foot its room, its last rows drawn beneath the foot's links.
      const body = card.querySelector('.inv-widget-body') as HTMLElement | null;
      if (body && body.scrollHeight > body.clientHeight + 1) out.push(at + ': ' + (body.scrollHeight - body.clientHeight) + 'px under its foot');
      const box = card.getBoundingClientRect();
      const inScroller = (el: Element) => { for (let p = el.parentElement; p && p !== card; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible' && getComputedStyle(p).overflowX !== 'clip') return true; return false; };
      for (const el of Array.from(card.querySelectorAll('*')) as HTMLElement[]) {
        if (!el.checkVisibility() || inScroller(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) { out.push(at + ': past its box: ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' "' + (el.innerText || '').trim().slice(0, 30) + '"'); break; }
      }
      card.querySelectorAll(sel).forEach(el => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length > 120 && (el as HTMLElement).checkVisibility() && !Array.from(el.querySelectorAll(sel)).some(x => (x.textContent || '').trim().length > 120))
          out.push(at + ': a block of ' + t.length + ' characters: "' + t.slice(0, 50) + '…"');
      });
    });
    return out;
  });
  return bad.map(b => where + ' · ' + b);
}

/* A seeded shuffle (mulberry32), so a failing arrangement can be drawn again. */
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export async function walkWidgets(page: Page, layout: string) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  const bad: string[] = [];
  const stops: Stop[] = [];
  let drawn = 0;
  const seen: Record<string, string[]> = {};
  const check = async (where: string) => {
    bad.push(...await widgetProblems(page, where));
    stops.push(await sweep(page, where));
    const c = await census(page);
    c.looks.filter(l => !LOOKS.includes(l)).forEach(l => bad.push(where + ': a box look not on LOOKS: ' + l + ' (' + (c.wears[l] || []).join(', ') + ')'));
    for (const l of c.looks) for (const w of c.wears[l] || []) if (!(seen[l] = seen[l] || []).includes(w)) seen[l].push(w);
    drawn += await page.locator('#homeBoard .inv-widget').count();
  };
  for (const [book, make] of BOOKS) {
    await loadAppWithState(page, make());
    const defs: Array<{ id: string; sizes: string[] }> = await page.evaluate(() => (window as any).WIDGET_DEFS.filter((d: any) => (window as any).wdgSees(d)).map((d: any) => ({ id: d.id, sizes: d.sizes })));
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const size of ['s', 'm', 'l']) {
        const list = defs.filter(d => d.sizes.includes(size)).map(d => [d.id, size] as [string, string]);
        if (!list.length) continue;
        await drawBoard(page, list);
        await check(`${layout} ${book} ${scheme} every widget at ${size}`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });
    // Each preset as its role would see it (the guard off, so every widget a preset names is drawn), and three random boards.
    for (const p of PRESETS) {
      // As the layout on show draws it (wdgPresetList): an entry marked for the desktop alone is not on the phone (P241).
      const list = await page.evaluate(p => { const w = window as any; return w.wdgPresetList('home', w.wdgLay(), p); }, p);
      await drawBoard(page, list);
      await check(`${layout} ${book} the ${p} preset`);
    }
    for (const seed of [11, 23, 47]) {
      const r = rng(seed), list = defs.map(d => [d.id, d.sizes[Math.floor(r() * d.sizes.length)]] as [string, string]);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      await drawBoard(page, list);
      await check(`${layout} ${book} random arrangement ${seed}`);
    }
  }
  // LOOKS_DUMP=<dir> writes every look the boards wore with what wears it (P197's dump for the map's screens): how LOOKS is
  // regenerated after a step changes what a card wears.
  if (process.env.LOOKS_DUMP) fs.writeFileSync(path.join(process.env.LOOKS_DUMP, 'looks-widgets-' + test.info().project.name + '-' + layout.replace(/\W+/g, '_') + '.json'), JSON.stringify(seen, null, 1) + '\n');
  return { errs, bad: bad.concat(problems(stops, { cutMeta: false })), drawn };
}

/* Each role, the guard on, with every widget in its layout: only what it may see is drawn, and the gallery holds the same. */
export async function walkRoles(page: Page) {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  const all = await page.evaluate(() => (window as any).WIDGET_DEFS.map((d: any) => [d.id, d.sizes[0]]));
  const out: Record<string, string[]> = {};
  for (const [uid, pin] of [['U-own', PINS.owner], ['U-off', PINS.office], ['U-sup', PINS.super]]) {
    await page.evaluate(([l, uid]) => {
      const st = JSON.parse(localStorage.getItem('sep_inv_layout') || '{"v":1,"people":{}}');
      st.people[uid as string] = { home: { preset: 'custom', desk: l, phone: l } };
      localStorage.setItem('sep_inv_layout', JSON.stringify(st));
    }, [all, uid] as [string[][], string]);
    await unlock(page, uid, pin);
    await page.locator('#homeDash:not(.inv-hidden) #homeBoard').waitFor();
    const r = await page.evaluate(() => {
      const w = window as any, wrong: string[] = [];
      const drawn = Array.from(document.querySelectorAll('#homeBoard .inv-widget')).map(e => (e as HTMLElement).dataset.w as string);
      drawn.forEach(id => {
        const n = w.wdgDef(id).needs || {};
        if (n.page && !w.grdSees(n.page)) wrong.push(id + ' opens ' + n.page);
        if (n.money && !w.grdSeesMoney()) wrong.push(id + ' shows money');
        if (n.wages && !w.grdSeesWages()) wrong.push(id + ' shows wages');
        if (n.perm && !w.grdCan(n.perm)) wrong.push(id + ' needs ' + n.perm);
      });
      return { drawn, wrong };
    });
    expect(r.wrong, uid).toEqual([]);
    out[uid] = r.drawn;
    await lockNow(page);
  }
  return out;
}
