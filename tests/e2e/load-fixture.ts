import { test, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso, type SepState } from './fixtures';
import { PAPER, challan, dayOff, inv, sweepState } from './sweep-fixture';

// The long book (docs/TAB_MAP.md TM1 item 12): the sweep's book scaled toward the owner's shape, so a list past thirty rows and a
// screen past three phone screens are reachable, and P195 and P197 measure what the owner's book would show. Every name and
// figure is made up; every date is built from today.

const pad = (n: number) => String(n).padStart(2, '0');

/* The last `n` working days (Monday to Saturday) before today, newest first. */
export function workDaysBack(n: number): string[] {
  const out: string[] = [];
  for (let k = 1; out.length < n; k++) {
    const d = dayOff(-k);
    if (new Date(d + 'T00:00:00').getDay() !== 0) out.push(d);
  }
  return out;
}

const MORE = ['DELTA STAMPINGS', 'EPSILON FASTENERS', 'ZETA AUTO PARTS', 'ETA ENGINEERING WORKS', 'THETA PRESSINGS', 'IOTA SPRINGS',
  'KAPPA TUBES', 'LAMBDA WIRE PRODUCTS', 'MU CASTINGS'];
const HANDS = ['Arun Kumar', 'Bina Devi', 'Chandan Mahato', 'Dilip Singh', 'Esha Kumari', 'Faiz Ahmed', 'Gopal Das'];
const AREAS = ['vat-a1', 'vat-a2', 'barrel', 'pickling-vat', 'vat-a1', 'vat-a2', 'barrel'];

export function longBook(): SepState {
  const s = sweepState() as any;

  // Twelve clients.
  const clients = [...s.clients.map((c: any) => ({ id: c.id, name: c.name, rate: c.rates[0].ratePerKg }))];
  MORE.forEach((name, i) => {
    const rate = 9 + (i % 4);
    s.clients.push({ id: 4 + i, name, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
      add1: 'Plot ' + (4 + i), add2: 'Adityapur', add3: '', address: '', isActive: true, notes: '',
      rates: [{ ratePerKg: rate, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] });
    clients.push({ id: 4 + i, name, rate });
  });

  // Sixty challans (thirty awaiting an invoice, a third of them twelve days or more) and sixty invoices across every state and
  // age: twenty-nine of the new invoices bill a challan whole, line for line.
  let n = 21, c = 5;
  const states = ['created', 'printed', 'dispatched', 'delivered', 'filed'];
  for (let k = 0; k < 29; k++) {
    const cl = clients[k % clients.length], date = dayOff(-(4 + k * 2)), ch: any = challan(c, cl, date, null);
    const im = ch.items;
    im.forEach((it: any) => { it.invoiced = false; it.invoiceId = null; });
    s.incomingMaterial.push(ch);
    const v: any = inv(n, dayOff(-(3 + k * 2)), cl, 1, states[k % states.length], k === 7 ? 'cancelled' : 'active');
    v.items = im.map((it: any) => ({ partNumber: it.partNumber, desc: it.desc, hsn: it.hsn, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount,
      nosQty: it.nosQty, imItemId: it.id }));
    v.taxableValue = Math.round(v.items.reduce((a: number, x: any) => a + x.amount, 0) * 100) / 100;
    v.cgstAmt = v.sgstAmt = Math.round(v.taxableValue * 0.09 * 100) / 100;
    v.grandTotal = Math.round((v.taxableValue + 2 * v.cgstAmt) * 100) / 100;
    v.linkedIMIds = [ch.id];
    v.challanNo = ch.challanNo;
    s.invoices.push(v);
    n++; c++;
  }
  for (let k = 0; k < 27; k++) {
    const cl = clients[(k * 5) % clients.length];
    s.incomingMaterial.push(challan(c, cl, dayOff(-(k < 9 ? 12 + k : 1 + (k % 9))), null));
    c++;
  }
  for (let k = 0; k < 14; k++) {
    const cl = clients[(k * 7) % clients.length];
    s.invoices.push(inv(n, dayOff(-(1 + k * 4)), cl, 300 + 37 * k, states[(k + 2) % states.length]));
    n++;
  }
  s.invNextNum = n + 1;

  // Ten hands on the roster and twenty-two working days of marks, each day with two EXTRA rows.
  HANDS.forEach((name, i) => s.staff.push({ id: 4 + i, name, comp: i % 3 ? 'hourly' : 'monthly', dayRate: i % 3 ? 0 : 520, hourRate: i % 3 ? 47.5 : 0,
    area: AREAS[i], onFloor: true, active: true }));
  workDaysBack(22).forEach((d, k) => {
    const marks: any = {};
    s.staff.forEach((w: any, i: number) => {
      const st = (k + i) % 11 === 0 ? 'A' : (k + i) % 13 === 0 ? 'H' : 'P';
      marks[w.id] = { st, ot: st === 'P' && (k + i) % 4 === 0 ? 2 : 0, hours: st === 'A' ? 0 : st === 'H' ? 4 : (k + i) % 4 === 0 ? 10 : 8, area: w.area };
    });
    s.attendance[d] = { marks, extra: [{ area: 'vat-a2', hours: 8, kind: 'general' }, { area: 'barrel', hours: 8, kind: 'general' }], note: '' };
  });

  // Forty stock entries over thirty days: counts, deliveries with their bills, use.
  const st = s.stock.entries;
  for (let k = 1; k <= 26; k++) {
    if (new Date(dayOff(-k) + 'T00:00:00').getDay() === 0) continue;
    st.push({ id: 'LN' + k, itemId: 'N', kind: 'used', qty: 2, date: dayOff(-k), at: 3 });
    if (k % 2) st.push({ id: 'LZ' + k, itemId: 'Z', kind: 'used', qty: 3, date: dayOff(-k), at: 3 });
  }
  st.push({ id: 'LR1', itemId: 'N', kind: 'received', qty: 50, price: 160, date: dayOff(-15), supplier: 'Delta Chemicals', billNo: 'A3', billDate: dayOff(-15), at: 3 });
  st.push({ id: 'LR2', itemId: 'Z', kind: 'received', qty: 200, price: 42, date: dayOff(-11), supplier: 'Epsilon Alkali', billNo: 'E1', billDate: dayOff(-11), at: 3 });

  // Eighty production entries over twenty working days on the three lines, weighed every way the app knows (written kilos, the
  // part's weight on record, its challans, its kind), and a pickling load a day; eight power cuts, two with no time back.
  s.partWeights = Object.assign({}, s.partWeights, { 'BRKT-2': 0.42 });
  const pe = s.production.entries;
  workDaysBack(20).forEach((d, k) => {
    pe.push({ id: 'LA' + k, kind: 'plated', date: d, time: '09:00', to: '16:30', slot: 'general', line: 'vat-a1', lineSrc: 'written', clientId: 1, client: 'Alpha',
      part: 'BRKT-1', qty: 95 + (k % 7) * 5, unit: 'KG', basis: 'register', src: 'photo', at: 4 });
    pe.push({ id: 'LB' + k, kind: 'plated', date: d, time: '09:30', to: '15:00', slot: 'general', line: 'vat-a2', lineSrc: 'written', clientId: 2, client: 'Beta auto',
      part: 'CLAMP 66X42', gauge: '30X6', qty: 300 + (k % 5) * 20, unit: 'NOS', basis: 'register', src: 'photo', at: 4 });
    pe.push({ id: 'LC' + k, kind: 'plated', date: d, slot: 'day', line: 'barrel', lineSrc: 'written', clientId: 3, client: 'Gamma',
      part: k % 3 ? 'BRKT-2' : 'SPACER-9', qty: 800 + (k % 4) * 50, unit: 'NOS', basis: 'relay', src: 'paste', raw: 'Gamma BRKT-2--800 nos', at: 4 });
    pe.push({ id: 'LP' + k, kind: 'pickled', date: d, time: '08:30', clientId: 1, client: 'ALPHA FORGINGS', part: 'BRKT-1', qty: 350, unit: 'NOS',
      basis: 'pickling', src: 'paste', raw: 'BRKT-1--350 nos', at: 4 });
  });
  workDaysBack(16).filter((_, k) => k % 2 === 0).forEach((d, k) => {
    pe.push(k < 2
      ? { id: 'LD' + k, kind: 'downtime', date: d, time: '13:' + pad(10 + k), downtime: { cause: 'power', open: true }, basis: 'relay', src: 'paste', at: 4 }
      : { id: 'LD' + k, kind: 'downtime', date: d, time: '11:' + pad(5 + k), to: '11:' + pad(25 + k), downtime: { cause: 'power', reason: 'PCS-R2' }, basis: 'pickling', src: 'paste', at: 4 });
  });

  // Sixty bank rows over the last two months, oldest first, every balance following the one before: receipts from clients,
  // wages, supplies, cash drawn, and six payees the app could only guess at (Not yet sorted).
  const rows: any[] = [];
  let bal = 150000, idx = 0;
  const unsorted = ['OMEGA TRADERS', 'SIGMA SUPPLY', 'TAU HARDWARE', 'UPSILON STORES', 'PHI AGENCIES', 'CHI ENTERPRISES'];
  for (let k = 0; k < 60; k++) {
    const date = dayOff(-(60 - k)), kind = k % 5;
    let narration = '', dr = 0, cr = 0;
    if (kind === 0) { narration = 'NEFT-' + clients[k % clients.length].name; cr = 18000 + (k % 7) * 1500; }
    else if (kind === 1) { narration = 'NEFT-' + unsorted[k % unsorted.length]; dr = 4000 + (k % 5) * 700; }
    else if (kind === 2) { narration = 'TO SELF'; dr = 9000; }
    else if (kind === 3) { narration = 'NEFT-DELTA CHEMICALS'; dr = 7000 + (k % 3) * 900; }
    else { narration = 'BY INST ' + (600100 + k) + ' CLG'; cr = 12000 + (k % 4) * 2500; }
    bal = Math.round((bal + cr - dr) * 100) / 100;
    rows.push({ id: 'LBK' + k, date, valueDate: date, narration, chq: kind === 4 ? String(600100 + k) : '', dr, cr, balance: bal, dayIdx: idx++ });
  }
  s.bank.rows = rows;
  s.bank.imports = [{ id: 'BL', at: 1, file: 'long.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: bal }];
  // Its cheques received are its own, as the sweep book's are to its statement: one in hand four days, one gone in by its number
  // (the sweep book's second is deposited on a row this statement does not hold).
  const dep = rows.find(r => r.chq === '600154');
  s.bank.cheques = [{ id: 'CHQ1', clientId: 1, amount: 18000, number: '612301', receivedOn: dayOff(-4), at: 1 },
    { id: 'CHQ2', clientId: 1, amount: dep.cr, number: dep.chq, receivedOn: dayOff(-7), at: 1 }];
  return s;
}

/* ---------- The instruments' walk and measures (P195, P197) ---------- */

/* The same face on every machine: the webfont is not fetched (CI reaches Google's fonts and a sandbox cannot), and the page is
   set in Liberation Sans and Mono, which Playwright's own install puts on every runner. A length or a row's wrap measured in
   whatever face a machine happens to have is not a measure (CLAUDE.md, the invoice's grid). Call before the app loads. */
export async function pinFace(page: Page): Promise<void> {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => {
    const put = () => {
      const st = document.createElement('style');
      st.textContent = ":root, :root[data-palette] { --ff-base: 'Liberation Sans', sans-serif !important; --ff-mono: 'Liberation Mono', monospace !important; }";
      document.head.appendChild(st);
    };
    if (document.head) put(); else document.addEventListener('DOMContentLoaded', put);
  });
}

/* Settles a screen for measuring: drawn, nothing focused, the pointer off it, charts and folds laid out. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(250);
  await page.mouse.move(0, 0);
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
  await page.waitForTimeout(50);
}

/* Every screen of the map (docs/TAB_MAP.md §2): each section's row, every view of a screen's own row, then the top bar's tools
   (History, Knowledge and Knowledge's own row). `at(name)` runs on each, named "Section › Row view › Own view". A view's switch
   is a place too (TM4b: Attendance's Day · Week · Month), each option but the one it opens on named after it. */
export async function walkMap(page: Page, at: (name: string) => Promise<void>): Promise<void> {
  const own = () => page.locator('.inv-page-active .inv-viewtabs:not(#wsTabs) .inv-viewtab:visible');
  const switchWalk = async (base: string) => {
    const sw = () => page.locator('.inv-page-active [data-att-period] .inv-seg-btn:visible');
    const k = await sw().count();
    const first = await sw().evaluateAll(els => els.findIndex(e => e.getAttribute('aria-pressed') === 'true'));
    for (let i = 0; i < k; i++) {
      if (i === first) continue;
      const b = sw().nth(i);
      const label = (await b.innerText()).trim();
      await b.click();
      await settle(page);
      await at(base + ' › ' + label);
    }
  };
  const ownWalk = async (base: string) => {
    const m = await own().count();
    if (!m) { await settle(page); await at(base); return; }
    for (let j = 0; j < m; j++) {
      const t = own().nth(j);
      if (!(await t.count())) break;
      const label = ((await t.innerText()).trim().split('\n')[0] || String(j)).replace(/\s+\d+$/, '');
      await t.click();
      await settle(page);
      await at(base + ' › ' + label);
      await switchWalk(base + ' › ' + label);
    }
  };
  for (const ws of ['today', 'office', 'floor', 'money']) {
    const wsLabel = await page.evaluate(w => (window as any).wsGet(w).label, ws);
    await page.evaluate(w => { (window as any).wsGo(w); (window as any).navSoon(); }, ws);
    await settle(page);
    const row = () => page.locator('#wsTabs .inv-viewtab');
    const n = await row().count();
    if (!n) { await ownWalk(wsLabel); continue; }
    for (let i = 0; i < n; i++) {
      const tab = row().nth(i);
      const label = (await tab.innerText()).trim();
      await tab.click();
      await page.locator('.inv-page-active').first().waitFor();
      await settle(page);
      await ownWalk(wsLabel + ' › ' + label);
    }
  }
  await page.locator('.inv-topbar [data-action="invGoHistory"]:visible').first().click();
  await page.locator('#pageHistory.inv-page-active').waitFor();
  await ownWalk('History');
  await page.evaluate(() => (window as any).navOpen({ tab: 'pageKnow', v: 'start', id: '' }));
  await page.locator('#pageKnow.inv-page-active').waitFor();
  await ownWalk('Knowledge');
}

/* P195's measures of the screen on show (the phone): its length in screens, its words and its controls. */
export type Load = { screens: number; blocks: number; chains: number; toolbarRows: number; verdictTop: number | null };
export async function measureLoad(page: Page): Promise<Load> {
  return page.evaluate((PAPER) => {
    const act = document.querySelector('.inv-page.inv-page-active') as HTMLElement;
    const screens = Math.round(document.documentElement.scrollHeight / innerHeight * 100) / 100;
    const sel = '.inv-row-meta, .inv-note, .inv-callout, .inv-hero-sub, .inv-tile-sub, .inv-row-title';
    // What is on the screen's face: never a view or widget the page hides (Today's other view, a widget its layout hides: TM2
    // found Pulse charged with Needs you's tasks and the three widgets TM2c hides, the room I10 says a hidden widget gives
    // back), nor a row uiMoreHtml holds back. A fold's inside counts: it is one tap from the face, and folding a block is not
    // making it short (TM6).
    const drawn = (el: Element) => { for (let a: Element | null = el; a && a !== act; a = a.parentElement) if (getComputedStyle(a).display === 'none') return false; return true; };
    const els = Array.from(act.querySelectorAll(sel)).filter(el => !el.closest(PAPER) && !el.closest('[hidden]') && drawn(el));
    let blocks = 0, chains = 0;
    for (const el of els) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // A block inside another counted block is one block, not two.
      const inner = Array.from(el.querySelectorAll(sel));
      if (t.length > 120 && !inner.some(x => (x.textContent || '').trim().length > 120)) blocks++;
      if (t.split('·').map(x => x.trim()).filter(Boolean).length >= 3 && !inner.some(x => (x.textContent || '').split('·').filter(y => y.trim()).length >= 3)) chains++;
    }
    // The screen's own toolbar rows: its toolbars' controls and its tokens, by the lines they stand on.
    const skip = '.inv-panel, .inv-hero, .inv-callout, .inv-row, .inv-pane, .inv-deck-item, .inv-actionbar, .inv-tiles, .inv-dialog, .inv-table';
    // A row is the controls standing side by side: their heights overlap. A smaller control centred in its row (More beside a
    // primary, 2px lower) is the same row; binning tops by 8px had counted it as a second where the two straddled a boundary.
    const spans: [number, number][] = [];
    act.querySelectorAll('.inv-toolbar, .inv-tokens').forEach(tb => {
      if (tb.closest(skip) || (tb as HTMLElement).offsetParent === null) return;
      Array.from(tb.children).forEach(ch => {
        const r = (ch as HTMLElement).getBoundingClientRect();
        if (r.height > 0 && r.width > 0) spans.push([r.top + window.scrollY, r.bottom + window.scrollY]);
      });
    });
    let toolbarRows = 0, rowBottom = -Infinity;
    spans.sort((a, b) => a[0] - b[0]).forEach(([t, b]) => { if (t >= rowBottom - 1) { toolbarRows++; rowBottom = b; } else rowBottom = Math.max(rowBottom, b); });
    const v = act.querySelector('[data-verdict]') as HTMLElement | null;
    return { screens, blocks, chains, toolbarRows, verdictTop: v ? Math.round(v.getBoundingClientRect().top + window.scrollY) : null };
  }, PAPER);
}

/* P197's reading of the screen on show: its kind, its leading blocks, and every box's look (fill, edges, corners, lift and
   padding, the tone's colour left out, as the census of 9 Oct 2026 read them). */
export type Census = { kind: string; lead: string[]; looks: string[]; verdicts: number; long: number; rowEndBtns: number; pageheadMeta: number };
export async function census(page: Page): Promise<Census> {
  return page.evaluate((PAPER) => {
    const act = document.querySelector('.inv-page.inv-page-active') as HTMLElement;
    const tr = (c: string) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    const px = (v: string) => Math.round(parseFloat(v) || 0);
    const bgOf = (el: Element | null): string => {
      while (el) { const b = getComputedStyle(el).backgroundColor; if (!tr(b)) return b; el = el.parentElement; }
      return 'rgb(0,0,0)';
    };
    const looks = new Set<string>();
    for (const el of Array.from(act.querySelectorAll('*'))) {
      if ((el as HTMLElement).closest(PAPER)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 24) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      const tag = el.tagName.toLowerCase();
      if (['input', 'select', 'textarea', 'svg', 'path', 'option'].includes(tag)) continue;
      if (tag === 'button' || el.matches('a.inv-btn, [role=tab], input[type=button]')) continue;
      const grad = /gradient/.test(cs.backgroundImage);
      const fill = !tr(cs.backgroundColor) && cs.backgroundColor !== bgOf(el.parentElement);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => px((cs as any)['border' + s + 'Width']) > 0 && !tr((cs as any)['border' + s + 'Color']) && (cs as any)['border' + s + 'Style'] !== 'none' ? px((cs as any)['border' + s + 'Width']) : 0);
      const shadow = cs.boxShadow && cs.boxShadow !== 'none';
      if (!(grad || fill || sides.some(Boolean) || shadow)) continue;
      const edge = sides.every(Boolean) ? 'all' + sides[0] : sides.map((v, i) => v ? 'TRBL'[i] + v : '').join('') || 'none';
      looks.add([grad ? 'grad' : fill ? 'fill' : 'nofill', 'edge:' + edge, 'r' + px(cs.borderTopLeftRadius), shadow ? 'lift' : 'flat', 'p' + px(cs.paddingTop) + '/' + px(cs.paddingLeft)].join(' '));
    }
    const comp = (el: Element) => {
      const c = Array.from(el.classList).filter(x => x.startsWith('inv-'));
      return c.find(x => !/-(ok|warning|danger|info|neutral|sm|lg|wide|flush|fit|open|on|off|active|primary|secondary|ghost|link|icon|mono|num)$/.test(x)) || c[0] || el.tagName.toLowerCase();
    };
    const lead: string[] = [];
    const walk = (node: Element, depth: number) => {
      for (const ch of Array.from(node.children)) {
        if (lead.length >= 6) return;
        const r = ch.getBoundingClientRect(), cs = getComputedStyle(ch);
        if (r.height < 8 || cs.display === 'none') continue;
        const plain = /^(div|section)$/.test(ch.tagName.toLowerCase()) && !Array.from(ch.classList).some(x => x.startsWith('inv-')) && depth < 4;
        if (plain) { walk(ch, depth + 1); continue; }
        lead.push(comp(ch) + (ch.hasAttribute('data-verdict') ? '[verdict]' : ''));
      }
    };
    walk(act, 0);
    const rowEndBtns = Array.from(act.querySelectorAll('.inv-row-end')).filter(e => (e as HTMLElement).offsetParent !== null && e.querySelectorAll('.inv-btn').length > 1).length;
    return { kind: act.dataset.screen || '', lead, looks: Array.from(looks).sort(), verdicts: act.querySelectorAll('[data-verdict]').length,
      long: document.querySelectorAll('[data-verdict-long]').length, rowEndBtns,
      pageheadMeta: Array.from(act.querySelectorAll('.inv-pagehead-meta')).filter(e => (e as HTMLElement).offsetParent !== null).length };
  }, PAPER);
}

/* ---------- One look (P197; docs/TAB_MAP.md §3e) ---------- */

/* The box looks the census of 9 Oct 2026 found on every screen and view, both layouts (fill, edges, corners, lift, padding; the
   tone's colour aside): the closed list. A look not on it fails P197 until design §6 names it; a step that retires one takes it
   off. Measured over the long book on eleven days of the calendar, the same 38 every day; 39 since TM4c put the message as sent
   (`inv-quote`) in an entry's fold on a walked screen; 40 since TM5g opened the desktop's pane (`inv-pane`) on one. */
export const LOOKS: string[] = [
  'fill edge:B1 r0 flat p0/0',
  'fill edge:B1 r0 flat p0/12',
  'fill edge:B1 r0 flat p2/2',
  'fill edge:B1 r0 flat p4/12',
  'fill edge:B1 r0 flat p4/8',
  'fill edge:B1 r0 flat p6/12',
  'fill edge:B1 r0 lift p6/12',
  'fill edge:T1 r0 flat p8/2',
  'fill edge:all1 r10 flat p0/0',
  'fill edge:all1 r10 flat p16/12',
  'fill edge:all1 r6 flat p0/0',
  'fill edge:all1 r6 flat p0/10',
  'fill edge:all1 r6 lift p10/12',
  'fill edge:all1 r8 flat p0/0',
  'fill edge:all1 r8 flat p16/12',
  'fill edge:L1 r0 flat p16/16',     // inv-pane, the desktop's detail pane (design §6.14): Quotations' To reprice while nothing is open, since TM5g
  'fill edge:none r4 flat p6/8',     // inv-quote, the text as sent (design §6): in an entry's fold on Production → Entries since TM4c
  'fill edge:none r8 flat p10/12',
  'grad edge:T1 r0 flat p0/0',
  'grad edge:T1B1 r0 flat p0/0',
  'grad edge:all1 r10 flat p0/0',
  'grad edge:all1 r6 lift p10/12',
  'grad edge:all1 r8 flat p0/0',
  'grad edge:all1 r8 lift p12/12',
  'nofill edge:B1 r0 flat p0/0',
  'nofill edge:B1 r0 flat p0/12',
  'nofill edge:B1 r0 flat p10/12',
  'nofill edge:B1 r0 flat p12/12',
  'nofill edge:B1 r0 flat p16/12',
  'nofill edge:B1 r0 flat p2/2',
  'nofill edge:B1 r0 flat p4/8',
  'nofill edge:B1 r0 flat p6/12',
  'nofill edge:B1 r0 flat p6/28',
  'nofill edge:B1 r0 flat p8/12',
  'nofill edge:B1 r0 flat p8/28',
  'nofill edge:T1 r0 flat p8/2',
  'nofill edge:all1 r6 flat p0/0',
  'nofill edge:all1 r6 flat p0/10',
  'nofill edge:all1 r6 lift p10/12',
  'nofill edge:none r0 lift p0/0'
];

/* The screens assembled to one look, by the place walkMap names them; each joins in the step that assembles it (TM1: none). */
export const ONE_LOOK: string[] = [
  // TM2: Today's two views, Stats' three tabs and the Planner's four views (Moves on the kind it opens on).
  'Today › Needs you', 'Today › Pulse',
  'Today › Stats › By client', 'Today › Stats › Cost', 'Today › Stats › Trends',
  'Today › Planner › Play', 'Today › Planner › Ledger', 'Today › Planner › A day', 'Today › Planner › Moves',
  // TM3: Money's five.
  'Money › Overview', 'Money › Receivables', 'Money › Payments', 'Money › Bank', 'Money › GST',
  // TM4: Floor's Overview, People (Attendance's Day, Week and Month, Pay, Areas, Roster), Production's four, Stock, Power's four.
  'Floor › Overview',
  'Floor › People › Attendance', 'Floor › People › Attendance › Week', 'Floor › People › Attendance › Month',
  'Floor › People › Pay', 'Floor › People › Areas', 'Floor › People › Roster',
  'Floor › Production › Lines', 'Floor › Production › In plant', 'Floor › Production › Entries', 'Floor › Production › Equipment',
  'Floor › Stock',
  'Floor › Power › Cuts', 'Floor › Power › Causes', 'Floor › Power › Load & bills', 'Floor › Power › Case',
  // TM5: Office's Pipeline, Challans' Awaiting invoice (Invoiced is TM6f's), Invoices, Clients' three and Sales' two.
  'Office › Pipeline', 'Office › Challans › Awaiting invoice', 'Office › Invoices',
  'Office › Clients › Clients', 'Office › Clients › Parts', 'Office › Clients › Performance',
  'Office › Sales › Prospects', 'Office › Sales › Quotations',
];

/* What keeps the screen on show from its kind's anatomy (§3e), as a list of problems: none is one look. Read off what is drawn:
   the page's own blocks in order (through plain wrappers, the screen's own view-tab row left out), the verdict cards, the
   toolbar's rows, the row ends. */
export async function oneLookProblems(page: Page): Promise<string[]> {
  return page.evaluate((PAPER) => {
    const act = document.querySelector('.inv-page.inv-page-active') as HTMLElement;
    const out: string[] = [];
    const kind = act.dataset.screen || '';
    if (!kind) return ['no data-screen'];
    const shown = (el: Element) => {
      const cs = getComputedStyle(el), r = (el as HTMLElement).getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0;
    };
    const blocks: Element[] = [];
    const walk = (node: Element, depth: number) => {
      for (const ch of Array.from(node.children)) {
        if (!shown(ch)) continue;
        const plain = /^(div|section)$/i.test(ch.tagName) && !Array.from(ch.classList).some(c => c.startsWith('inv-')) && depth < 4;
        if (plain) { walk(ch, depth + 1); continue; }
        if (!ch.matches('.inv-viewtabs')) blocks.push(ch);
      }
    };
    walk(act, 0);
    const name = (el: Element | undefined) => !el ? 'nothing' : (Array.from(el.classList).find(c => c.startsWith('inv-')) || el.tagName.toLowerCase()) + (el.hasAttribute('data-verdict') ? '[verdict]' : '');
    const verdicts = Array.from(act.querySelectorAll('[data-verdict]')).filter(shown);
    // Rows as P195 counts them: controls whose heights overlap stand on one row.
    const rows = (tb: Element) => {
      let n = 0, bottom = -Infinity;
      Array.from(tb.children).filter(shown).map(c => (c as HTMLElement).getBoundingClientRect()).filter(r => r.height > 0 && r.width > 0)
        .sort((a, b) => a.top - b.top).forEach(r => { if (r.top >= bottom - 1) { n++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom); });
      return n;
    };
    const phone = !document.body.classList.contains('inv-desktop');
    if (kind === 'work') {
      if (!blocks[0] || !blocks[0].matches('.inv-hero[data-verdict]')) out.push('leads with ' + name(blocks[0]) + ', not the verdict card');
      if (verdicts.length !== 1) out.push(verdicts.length + ' verdict cards');
      const tbs = blocks.filter(b => b.matches('.inv-toolbar'));
      if (tbs.length > 1) out.push(tbs.length + ' toolbars');
      if (tbs.length && blocks.indexOf(tbs[0]) !== 1) out.push('the toolbar is not under the verdict card');
      tbs.forEach(tb => { if (rows(tb) > 1) out.push('the toolbar runs to ' + rows(tb) + ' rows'); });
      if (Array.from(act.querySelectorAll('.inv-pagehead-meta')).some(shown)) out.push('a page-head line');
      if (blocks.some(b => b.matches('.inv-tiles'))) out.push('a tile strip of its own');
      const firstPanel = blocks.findIndex(b => b.matches('.inv-panel, .inv-panels, .inv-pane-host, .inv-board'));
      if (blocks.slice(0, firstPanel < 0 ? blocks.length : firstPanel).some(b => b.matches('.inv-callout'))) out.push('a callout leads');
      if (phone) {
        const ends = Array.from(act.querySelectorAll('.inv-row-end')).filter(e => shown(e) && e.querySelectorAll('.inv-btn').length > 1);
        if (ends.length) out.push(ends.length + ' row ends with more than one action');
      }
    } else if (kind === 'overview') {
      const head = blocks.findIndex(b => !b.matches('.inv-toolbar, .inv-seg, .inv-pagehead'));
      const first = blocks[head];
      // Heroes side by side (inv-heroes), or packed on the desktop (Needs you's inv-panels, uiMasonry).
      if (!first || !(first.matches('.inv-hero[data-verdict]') || (first.matches('.inv-heroes, .inv-panels') && first.querySelector('.inv-hero[data-verdict]')))) out.push('leads with ' + name(first) + ', not a hero with its verdict');
    } else if (kind === 'document') {
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push('the page scrolls sideways');
      Array.from(act.querySelectorAll('*')).filter(el => el.querySelector(PAPER) && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX))
        .forEach(el => out.push('the paper scrolls sideways in ' + name(el)));
    } else if (kind === 'form') {
      const bar = blocks.findIndex(b => b.matches('.inv-actionbar') || !!b.querySelector('.inv-actionbar'));
      if (bar < 0) out.push('no action bar');
      else if (bar !== blocks.length - 1) out.push('the action bar is not last');
    }
    return out;
  }, PAPER);
}

/* P197's walk, the phone's and the desktop's: every screen of the map read for its kind, its looks and (on ONE_LOOK) its anatomy,
   the census attached for the step's report. */
export async function walkOneLook(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  await pinFace(page);
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, longBook());
  const report: Record<string, Census & { problems: string[] }> = {};
  const bad: string[] = [];
  await walkMap(page, async name => {
    const c = await census(page);
    const want = await page.evaluate(() => (window as any).screenKindOf((window as any).navLoc()));
    if (!c.kind) bad.push(name + ': no data-screen');
    else if (c.kind !== want) bad.push(name + ': data-screen ' + c.kind + ' where SCREEN_KINDS says ' + want);
    c.looks.filter(l => !LOOKS.includes(l)).forEach(l => bad.push(name + ': a box look not on LOOKS: ' + l));
    if (c.long) bad.push(name + ': a verdict card past its limits');
    const problems = await oneLookProblems(page);
    if (ONE_LOOK.includes(name)) problems.forEach(p => bad.push(name + ': ' + p));
    report[name] = { ...c, problems };
  });
  for (const n of ONE_LOOK) if (!report[n]) bad.push(n + ': on ONE_LOOK, not on the map');
  // Every page is on SCREEN_KINDS, and the page no row reaches (Create) declares its kind too.
  const pages: string[] = await page.evaluate(() => Array.from(document.querySelectorAll('.inv-page')).map(p => p.id));
  const kinds: string[] = await page.evaluate(() => Object.keys((window as any).SCREEN_KINDS));
  for (const id of pages) if (!kinds.some(k => k === id || k.startsWith(id + '/'))) bad.push(id + ': not on SCREEN_KINDS');
  for (const id of ['pageCreate'].filter(x => pages.includes(x))) {
    await switchTab(page, id);
    const k = await page.locator('#' + id).getAttribute('data-screen');
    if (!k) bad.push(id + ': no data-screen');
  }
  await test.info().attach('census', { body: JSON.stringify(report, null, 1), contentType: 'application/json' });
  return { errs, bad, report };
}
