import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab, todayIso } from './fixtures';
import { longBook } from './load-fixture';
import { guardBook, withUsers, unlock, g } from './p140-guard.fixture';
import { FOUR, OLD, withFour } from './p234-sign-in.fixture';

// P259: the QA chain over UI pass 3's U3–U9 (owner, 6 Nov 2026: "Run the QA chain"). Castor (the sign-in), Iuno (money and
// controls) and Vulcanus (production, plant, power) audited what U3, U6, U7 and U8 built; U4 and U5 had their own chains. Each test
// holds one finding and fails on the build before its fix. Every name, PIN and figure is made up.

import { PINS } from './p140-guard.fixture';
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

test.describe('P259: the sign-in (Castor)', () => {
  test('H-1: the screen that sets four digits is gone once the app is put away, and Later refuses once it is old', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-sup');
    const lock = page.locator('#guardRoot');
    await lock.locator('#grdPin').fill(OLD.super);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-upgrade]')).toBeVisible();
    // Put away and back: the PIN is typed again, never Later on a screen left standing.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(lock.locator('[data-grd-upgrade]')).toHaveCount(0);
    await expect(lock.locator('[data-action="invGuardLater"]')).toHaveCount(0);
    await expect(lock.locator('#grdPin')).toBeVisible();
    // Typed again, then left two minutes: Later signs nobody in.
    await lock.locator('#grdPin').fill(OLD.super);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock.locator('[data-grd-upgrade]')).toBeVisible();
    await ev(page, '_grdUpgradeAt -= 130000');
    await lock.locator('[data-action="invGuardLater"]').click();
    await expect(lock).toBeVisible();
    await expect(lock.locator('[data-grd-err]')).toHaveText('Type your PIN again.');
    expect(await ev(page, 'grdSessRead()')).toBeNull();
  });

  test('M-1: Enter with fewer than four digits sends nothing and spends no try', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    await lock.locator('#grdPin').fill(FOUR.owner.slice(0, 3));
    await lock.locator('#grdPin').press('Enter');
    await page.waitForTimeout(400);
    const fail = await page.evaluate(() => localStorage.getItem('sep_inv_guard_fail'));
    expect(fail === null || !/U-own/.test(fail)).toBe(true);
    await expect(lock.locator('[data-grd-err]')).not.toContainText('Wrong PIN');
    // The PIN asked again in a dialog: three digits are refused there too, with no try spent.
    await lock.locator('#grdPin').fill(FOUR.owner);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
    // The PIN asked again, straight: just signed in, guardAsk would not ask inside its window.
    await ev(page, `(function(){ window.__asked = null; grdPinAsk(grdUser(), 'A test').then(function(ok) { window.__asked = ok; }); })()`);
    const ask = page.locator('.inv-scrim-dialog #grdAskPin');
    await expect(ask).toBeVisible();
    await ask.fill(FOUR.owner.slice(0, 3));
    await ask.press('Enter');
    await expect(page.locator('.inv-scrim-dialog [data-grd-err]')).toHaveText('Type the four digits.');
    const fail2 = await page.evaluate(() => localStorage.getItem('sep_inv_guard_fail'));
    expect(fail2 === null || !/U-own/.test(fail2)).toBe(true);
  });

  test('L-1: a PIN from before that is already four good digits signs in with no question, and is marked four from then', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    await ev(page, `(function(){ var u = S.users.find(function(x){ return x.id === 'U-own'; }); delete u.secret.len; return saveState(); })()`);
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    const lock = page.locator('#guardRoot');
    await expect(lock.locator('[data-grd-old]')).toBeVisible();
    await lock.locator('#grdPin').fill(FOUR.owner);
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
    await expect.poll(async () => (await readStoredState(page)).users.find((u: any) => u.id === 'U-own').secret.len).toBe(4);
  });
});

test.describe('P259: money and controls (Iuno)', () => {
  test('H-1: an ID that sees money and not wages sees no labour tier on the live cost and no payout on the report', async ({ page }) => {
    const s: any = longBook();
    s.guardCfg = { ...(s.guardCfg || {}), roles: { office: { pages: ['pageHome', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pageStats', 'pageReports'], may: ['billing'], wages: false, finance: true } } };
    await loadAppWithState(page, s);
    await withUsers(page, { roles: s.guardCfg.roles });
    await unlock(page, 'U-off', PINS.office);
    expect(await ev(page, 'grdSeesWages()')).toBe(false);
    await page.goto('/sep-invoicing.html?tab=pageStats&v=tables/cost');
    await page.locator('body.inv-booted').waitFor();
    if (await page.locator('#guardRoot').count()) await unlock(page, 'U-off', PINS.office);
    const labour = page.locator('#liveCost [data-cost="labour"]');
    await expect(labour).toHaveCount(1);
    await expect(labour.locator('[data-cost-tiers-held]')).toHaveCount(1);
    expect(await labour.innerText()).not.toMatch(/Hourly pool|Monthly crew|EXTRA pool/);
    // The weekly report: the heads and hours, never the payout or the pool.
    await g(page, `rptSet('weekly', localDateStr())`);
    await switchTab(page, 'pageReports');
    const doc = page.locator('.inv-rpt-doc');
    await expect(doc.locator('[data-rpt-p="wages-held"]')).toHaveCount(1);
    expect(await doc.innerText()).not.toMatch(/Payout, as recorded|EXTRA pool/);
  });

  test('H-1: a report drawn for an ID that sees wages needs wages to open from the queue', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await g(page, `rptSet('weekly', localDateStr())`);
    await switchTab(page, 'pageReports');
    const need = await ev(page, `(function(){ rptPrint(); var n = _printNeed; closePrintPreview(); return n; })()`) as any;
    expect(need.wages).toBe(true);
  });

  test('H-2: one figure for what the period left, on Stats, the money question and the report, toned by its own sign', async ({ page }) => {
    await loadAppWithState(page, longBook());
    // A line nothing weighs this month (a part with no weight, billed by the piece): the weighed lines' figure and the period's
    // differ by its ₹5,000, so a card reading contribution × the weighed kilos cannot pass.
    await ev(page, `(function(){ var mine = S.invoices.filter(function(i) { return String(i.date).slice(0, 7) === localDateStr().slice(0, 7) && i.status !== 'cancelled'; })[0];
      var x = JSON.parse(JSON.stringify(mine)); x.id = 'P259-UNW'; x.items = [{ id: 'P259-L', partNumber: 'ZZ-UNWEIGHED', desc: '', unit: 'NOS', qty: 10, rate: 500, amount: 5000 }];
      x.taxableValue = 5000; x.grandTotal = 5900; x.invoiceNumber = (x.invoiceNumber || 0) + 90000; x.displayNumber = 'P259/UNW'; S.invoices.push(x); _bookWrites++; })()`);
    const r = await ev(page, `(function(){
      var per = 'mtd', a = statsPulseArgs(per), cost = a.periodCost.perKg, kg = a.tonnage.kg;
      var left = statsPeriodLeft(sumTaxable(a.filtered), cost, kg);
      var card = advQuestions(a).find(function(q) { return q.key === 'money'; });
      var rng = statsRangeIso(per), doc = rptHtml('monthly', rng.from);
      return { left: left, word: statsSigned(left), abs: formatCurrency(Math.abs(left)), byKg: formatCurrency(Math.abs(gstRound((a.tonnage.revKnown / kg - cost) * kg))),
        cov: a.tonnage.coverage, live: a.periodCost.label, tone: statsLeftTone(sumTaxable(a.filtered), cost, kg), card: card.html, say: card.answer.say, doc: doc, mtd: /on mtd/.test(card.html) };
    })()`) as any;
    expect(r.cov).toBeLessThan(1);
    expect(r.live).toBe('live cost ');
    expect(r.abs).not.toBe(r.byKg);
    expect(r.card).toContain(r.word);
    // The card's sentence says the period's figure, not contribution × the weighed kilos (Cipher, Edict V).
    expect(r.say).toContain(r.abs);
    expect(r.say).not.toContain(r.byKg);
    expect(r.mtd).toBe(false);
    // The report's month says the same rupees, in the same tone, as left on the period.
    const money = (r.left >= 0 ? '' : '&minus;') + await ev(page, `rptMoney(Math.abs(${r.left}))`);
    expect(r.doc).toContain(money);
    expect(r.doc).toContain('left on the period after the full cost');
    await switchTab(page, 'pageStats');
    const tile = page.locator('#statsVerdict [data-tile="margin"]');
    await expect(tile).toHaveClass(new RegExp('inv-tile-' + r.tone));
    await expect(tile.locator('.inv-badge')).toHaveCount(0);
  });

  test('M-1: Top parts judges a price as By part does: within 5% under the cost is a warning, not red', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const html = await ev(page, `wdgDef('topitems').draw({ by: 'rate', cost: 7.7, top: { rows: [{ part: 'PLATE-9', desc: '', perKg: 7.5, kg: 100, kgKnown: true, amount: 750, clientName: 'DELTA AUTO', clientId: 'c-x', base: 'plate-9' }] } }, 'm', {})`) as string;
    expect(html).toContain('inv-chart-ranked-fill-warning');
    expect(html).not.toContain('inv-chart-ranked-fill-danger');
  });

  test('L-1: a part billed nothing (replating) has no price to judge: a dash, never Below cost', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const t = await ev(page, `(function(){ var real = buildTopItems;
      buildTopItems = function() { return { total: 1, dropped: 0, rows: [{ part: 'PLATE-9', desc: '', perKg: 0, kg: 54, kgKnown: true, amount: 0, clientName: 'DELTA AUTO', clientId: 'c-x', base: 'plate-9' }] }; };
      try { var m = statsPartTable({ filtered: [], periodCost: { perKg: 8 } }); return { v: m.rows[0].v.perKg, h: JSON.stringify(m.rows[0].h) }; } finally { buildTopItems = real; } })()`) as any;
    expect(t.v).toBeNull();
    expect(t.h).not.toContain('Below cost');
  });

  test('L-2, L-3: the picture draws a stretch with no invoice as a gap, and says credit notes that name no invoice', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const r = await ev(page, `(function(){ var seen = [], real = window.chartBars, cn = window.cnCreditByInvoice;
      window.chartBars = function(d, o) { seen.push(d.map(function(x) { return x.value; })); return real(d, o); };
      window.cnCreditByInvoice = function() { var x = cn(); x.unplaced = { n: 1, amount: 500 }; return x; };
      var prev = isoAddDays(localDateStr().slice(0, 8) + '01', -1).slice(0, 8) + '01', cut = isoAddDays(prev, 20);
      S.invoices = S.invoices.filter(function(i) { return !(i.date >= prev && i.date <= cut); }); _bookWrites++;
      try { var h = rptPictureHtml('monthly', prev); return { bars: seen.length ? seen[0] : null, zeros: seen.length ? seen[0].filter(function(v) { return v === 0; }).length : -1, foot: h }; }
      finally { window.chartBars = real; window.cnCreditByInvoice = cn; } })()`) as any;
    // A whole month past: its weeks with no invoice are gaps, never zero bars; one week at least still bills.
    expect(r.bars.filter((v: any) => v === null).length).toBeGreaterThan(0);
    expect(r.bars.some((v: any) => v > 0)).toBe(true);
    expect(r.zeros).toBe(0);
    expect(r.foot).toContain('1 credit note (');
    expect(r.foot).toContain('names no invoice in the book and is not taken off');
  });
});

test.describe('P259: production, plant and power (Vulcanus)', () => {
  test('H-1: the power record lists every calendar month, a month with no cut included, and the picture draws them', async ({ page }) => {
    await loadAppWithState(page, longBook());
    // A book of its own: one cut about 75 days ago, one about 10, none between. Every month from the first to today is listed.
    const r = await ev(page, `(function(){
      var t = localDateStr(), d1 = isoAddDays(t, -75), d2 = isoAddDays(t, -10);
      S.production.entries = S.production.entries.filter(function(e) { return e.kind !== 'downtime'; });
      [d1, d2].forEach(function(d, k) { S.production.entries.push({ id: 'QD' + k, kind: 'downtime', date: d, time: '11:05', to: '11:25',
        downtime: { cause: 'power' }, basis: 'pickling', src: 'paste', at: 4 }); });
      if (typeof _prodVer !== 'undefined') _prodVer++;
      _bookWrites++;
      var a = powerAnalysis(), all = a.months.map(function(x) { return x.month; });
      var mid = isoAddDays(d1.slice(0, 7) + '-28', 7).slice(0, 7), m = a.months.find(function(x) { return x.month === mid; });
      var contiguous = all.every(function(x, i) { return !i || isoAddDays(all[i - 1] + '-28', 7).slice(0, 7) === x; });
      // The picture draws the cut's month with its cut, recorded or not, and the empty months as zero or a gap, never as cuts.
      var seen = null, cb = window.chartBars;
      window.chartBars = function(d, o) { if (!seen && o && o.paper && o.ariaLabel === 'Cuts by month') seen = d.map(function(x) { return [x.label, x.value]; }); return cb(d, o); };
      try { powerCasePictureHtml(); } finally { window.chartBars = cb; }
      // Power → Cuts folds only a month with a cut, the newest of them open.
      var box = document.createElement('div'); box.innerHTML = powerCutsHtml(a);
      var folds = Array.prototype.map.call(box.querySelectorAll('[data-power-month]'), function(f) { return [f.getAttribute('data-power-month'), !!f.open || f.hasAttribute('open')]; });
      return { mid: mid, found: !!m, cuts: m ? m.cuts : null, contiguous: contiguous, first: all[0], last: all[all.length - 1],
        want: [d1.slice(0, 7), t.slice(0, 7)], bars: seen, total: (seen || []).reduce(function(n, b) { return n + (b[1] || 0); }, 0), folds: folds, m1: d1.slice(0, 7), m2: d2.slice(0, 7) };
    })()`) as any;
    expect(r.total).toBe(2);
    expect(r.folds.map((f: any) => f[0]).sort()).toEqual([r.m1, r.m2].filter((x: string, i: number, xs: string[]) => xs.indexOf(x) === i).sort());
    expect(r.folds[0]).toEqual([r.m2, true]);
    expect(r.first).toBe(r.want[0]);
    expect(r.last).toBe(r.want[1]);
    expect(r.found).toBe(true);
    expect(r.cuts).toBe(0);
    expect(r.contiguous).toBe(true);
  });

  test('M-2, L-4: the year tile says what its figure is; with no year to read, the payback says so', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const r = await ev(page, `(function(){ var real = powerAnalysis, out = {};
      powerAnalysis = function() { var a = real(); if (a.year) { a.year.low = a.year.high = 127191; a.year.lowMonth = a.year.highMonth = localDateStr().slice(0, 7); } return a; };
      try { out.one = powerCasePictureHtml(); } finally { powerAnalysis = real; }
      powerAnalysis = function() { var a = real(); a.year = null; a.options = null; return a; };
      try { out.none = powerCasePictureHtml(); } finally { powerAnalysis = real; }
      return out; })()`) as any;
    expect(r.one).toContain('at the complete month');
    expect(r.one).not.toContain('the complete months’ range');
    expect(r.none).toContain('read once there is a year to read against');
  });

  test('M-3: the day’s picture draws a line whose pieces nothing weighs as a gap, never 0 kg, and says the pieces', async ({ page }) => {
    const s: any = longBook();
    const day = (() => { const d = new Date(todayIso() + 'T12:00:00'); d.setDate(d.getDate() - 500); return d.toISOString().slice(0, 10); })();
    s.production = s.production || { entries: [] };
    s.production.entries = (s.production.entries || []).concat([{ id: 'P259-1', kind: 'plated', date: day, line: 'vat-a1', slot: 'general', part: 'ZZ-UNWEIGHED',
      qty: 2400, unit: 'NOS', basis: 'hand', src: 'hand', at: Date.now() }]);
    await loadAppWithState(page, s);
    const h = await ev(page, `rptPictureHtml('daily', '${day}')`) as string;
    expect(h).toContain('Plated, but no piece weighed');
    expect(h).toContain('2,400 pieces not weighed');
  });

  test('L-5: a first-visit pointer goes when typing starts, and its Escape shuts it alone', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await ev(page, `(function(){ dialogOpen('<div class="inv-dialog-body"><input id="p259In" class="inv-input"></div>'); var p = document.createElement('div'); p.className = 'inv-pointer'; document.body.appendChild(p); })()`);
    await page.locator('#p259In').fill('x');
    await expect(page.locator('.inv-pointer')).toHaveCount(0);
    await ev(page, `(function(){ var p = document.createElement('div'); p.className = 'inv-pointer'; document.body.appendChild(p); })()`);
    await page.locator('#p259In').press('Escape');
    await expect(page.locator('.inv-pointer')).toHaveCount(0);
    await expect(page.locator('#p259In')).toBeVisible();
    // The pointer's Escape went no further: the typed dialog asked nothing and stands alone (Cipher, Edict V).
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
    await expect(page.getByText('Discard what you typed?')).toHaveCount(0);
  });

  test('L-6: By month judges a month’s price only from 90% weighed', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const h = await ev(page, `(function(){ var real = statsMonthsData;
      statsMonthsData = function() { return [{ month: '2026-01', label: 'Jan 2026', rev: 7000, kg: 1000, real: 7, cost: 8, contrib: -1, labour: null, labCov: 0, measured: 0.5, coverage: 0.5 }]; };
      try { return JSON.stringify(statsMonthTable().rows[0].h.real); } finally { statsMonthsData = real; } })()`) as string;
    expect(h).toContain('data-price-chip=\\"thin\\"');
    expect(h).not.toContain('Below cost');
  });

  test('M-7: a line half down is danger on Equipment as on Floor’s card', async ({ page }) => {
    await loadAppWithState(page, longBook());
    expect(await ev(page, `pltCapTone({ n: 3, nAvail: 1, pct: 1 / 3, down: [1, 2], units: [] })`)).toBe('danger');
    expect(await ev(page, `pltCapTone({ n: 4, nAvail: 3, pct: 0.75, down: [1], units: [] })`)).toBe('warning');
    // A line's own units only: one of two rectifiers down (supporting equipment) is a warning, danger only with none working.
    expect(await ev(page, `pltCapTone({ n: 2, nAvail: 1, pct: 0.5, down: [1], units: [], support: true })`)).toBe('warning');
    expect(await ev(page, `pltCapTone({ n: 2, nAvail: 0, pct: 0, down: [1, 2], units: [], support: true })`)).toBe('danger');
  });
});
