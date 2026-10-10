import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openStatsTab, readStoredState, recentTs, switchTab, todayIso, type SepState, openPulse, toolbarMore, openWidget } from './fixtures';
import { sweepState } from './sweep-fixture';

// P128: the intelligence screens' QA findings (30 Sep 2026) — Clients → Performance, the Stats stories and figures,
// the insights, History and Home. Every client, part and figure is made up; every date is built from today.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
/* A day of the month k months from this one (k < 0 is back), clamped to that month's length. */
const monthDay = (k: number, day: number) => {
  const t = new Date(todayIso() + 'T00:00:00'), last = new Date(t.getFullYear(), t.getMonth() + k + 1, 0).getDate();
  return iso(new Date(t.getFullYear(), t.getMonth() + k, Math.min(day, last)));
};

let seq = 0;
type Line = { part: string; desc?: string; unit: 'KG' | 'NOS'; qty: number; rate: number; amount?: number };
function inv(clientId: number, date: string, lines: Line[]) {
  seq += 1;
  const n = String(seq).padStart(5, '0');
  const items = lines.map(l => ({ partNumber: l.part, desc: l.desc || l.part, hsn: '998873', unit: l.unit, qty: l.qty, rate: l.rate,
    amount: l.amount != null ? l.amount : Math.round(l.qty * l.rate * 100) / 100, nosQty: null }));
  const taxable = Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100, tax = Math.round(taxable * 9) / 100;
  return { id: 'INV-' + seq, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed', clientId, clientName: '',
    gstType: 'intra', clientAddress: { state: 'JHARKHAND', stateCode: '20' }, items, taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax,
    igstPer: 0, igstAmt: 0, grandTotal: Math.round((taxable + 2 * tax) * 100) / 100, createdAt: recentTs() };
}
function challan(clientId: number, date: string, part: string) {
  seq += 1;
  return { id: 'IM-P' + seq, challanNo: String(500 + seq), challanDate: date, clientId, clientName: '', vehicleNo: '', receivedDate: date, createdAt: recentTs(),
    items: [{ id: `IM-P${seq}-0`, partNumber: part, desc: part, hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100, nosQty: null, invoiced: false, invoiceId: null }] };
}
const client = (id: number, name: string, mode: string, ratePerKg: number, extra: Record<string, unknown> = {}) =>
  ({ id, name, billingMode: mode, gstType: 'intra', gstin: '', isActive: true, rates: [{ ratePerKg, effectiveFrom: '2020-04-01' }], itemRates: [], ...extra });
function book(clients: unknown[], invoices: unknown[], extra: Record<string, unknown> = {}): SepState {
  const s: any = emptyState();
  s.clients = clients;
  s.invoices = invoices;
  s.incomingMaterial = noSeedIM();
  return Object.assign(s, extra) as SepState;
}

async function openPerf(page: Page, clientId?: number) {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
  await page.locator('#cpClientSelect').waitFor();
  if (clientId != null) await page.locator('#cpClientSelect').selectOption(String(clientId));
}
/* A Performance card, opened where it is folded (Materials worked and By the hour fold on the phone). */
async function openCard(page: Page, card: string): Promise<Locator> {
  const el = page.locator(`[data-card="${card}"]`);
  if (await el.evaluate(e => e.tagName === 'DETAILS' && !(e as HTMLDetailsElement).open)) await el.locator(':scope > summary').click();
  return page.locator(`[data-card="${card}"]`);
}

/* A piece client billing the most (so Performance opens on it with nothing picked), with a part's times set and a
   production record timing that part's rounds at 40 minutes, and a smaller client whose clamp must not leak in. */
function perfBook(): SepState {
  seq = 0;
  const plated = (id: string, date: string, times: string[]) => ({ id, kind: 'plated', date, line: 'vat-a2', lineSrc: 'written', clientId: 1, part: 'BRACKET 4401',
    qty: 40 * times.length, unit: 'NOS', basis: 'register', src: 'photo', time: times[0], to: times[times.length - 1], rounds: times.map(t => ({ time: t, qty: 40 })), at: 1 });
  return book([
    client(1, 'ALPHA PIECE WORKS', 'piece', 14, { partTimes: [{ id: 'PT-A1', base: 'BRACKET4401', gauge: '', name: 'BRACKET 4401', line: 'vat-a2', pieces: 40, plateMin: 30, at: 1 }] }),
    client(2, 'BETA CLAMP CO', 'weight', 12),
  ], [
    inv(1, dayOff(-20), [{ part: 'BRACKET 4401', unit: 'NOS', qty: 400, rate: 5 }, { part: 'CLAMP 90X40', unit: 'NOS', qty: 100, rate: 2 }]),
    inv(1, dayOff(-5), [{ part: 'BRACKET 4401', unit: 'NOS', qty: 400, rate: 5 }]),
    inv(2, dayOff(-10), [{ part: 'CLAMP 120X60', unit: 'KG', qty: 50, rate: 12 }]),
  ], { production: { entries: [plated('P1', dayOff(-12), ['9:00', '9:40', '10:20', '11:00']), plated('P2', dayOff(-6), ['9:00', '9:40', '10:20'])],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } });
}

test.describe('P128: Clients → Performance', () => {
  test('G5-1: opened with no client picked, Materials worked searches the client shown, not every client', async ({ page }) => {
    await loadAppWithState(page, perfBook());
    await openPerf(page);
    await expect(page.locator('#cpClientSelect')).toHaveValue('1');
    const worked = await openCard(page, 'worked');
    await worked.locator('#cpMatSearch').fill('clamp');
    await expect(worked.locator('[data-cp-worked-total]')).toContainText('“clamp” · 1 part');
    await expect(worked.locator('[data-cp-worked="1|90X40|"]')).toHaveCount(1);
    await expect(worked.locator('[data-cp-worked^="2|"]')).toHaveCount(0);
  });

  test('G5-1: opened with no client picked, By the hour edits, saves, takes the measure and removes on the client shown', async ({ page }) => {
    await loadAppWithState(page, perfBook());
    await openPerf(page);
    const hours = await openCard(page, 'hours');
    const row = hours.locator('[data-cp-time="PT-A1"]');
    await row.locator('summary').click();
    await row.locator('[data-action="invCpTimeEdit"]').click();
    // The form opens on the part being edited, never a blank new one.
    await expect(page.locator('#cpTimePart')).toBeDisabled();
    await expect(page.locator('#cpTimePart')).toHaveValue('BRACKET4401|');
    await page.locator('#cpTimePieces').fill('48');
    await page.locator('[data-action="invCpTimeSave"]').click();
    await expect.poll(async () => (await readStoredState(page)).clients[0].partTimes[0].pieces).toBe(48);
    // Set at 30, measured at 40 on five rounds: Use takes the measure.
    await row.locator('summary').click();
    await row.locator('[data-action="invCpTimeUseMeasured"]').click();
    await expect.poll(async () => (await readStoredState(page)).clients[0].partTimes[0].plateMin).toBe(40);
    await row.locator('summary').click();
    await row.locator('[data-action="invCpTimeRemove"]').click();
    await answerAsk(page, 'ok');
    await expect.poll(async () => (await readStoredState(page)).clients[0].partTimes.length).toBe(0);
  });

  test('G5-13: Remove asks before a part’s set times and their history go', async ({ page }) => {
    await loadAppWithState(page, perfBook());
    await openPerf(page, 1);
    const row = (await openCard(page, 'hours')).locator('[data-cp-time="PT-A1"]');
    await row.locator('summary').click();
    await row.locator('[data-action="invCpTimeRemove"]').click();
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('BRACKET 4401');
    await expect(page.locator('[data-card="hours"] [data-cp-time="PT-A1"]')).toHaveCount(1);
    expect((await readStoredState(page)).clients[0].partTimes).toHaveLength(1);
    await page.locator('[data-card="hours"] [data-cp-time="PT-A1"] [data-action="invCpTimeRemove"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-card="hours"] [data-cp-time="PT-A1"]')).toHaveCount(0);
    await expect.poll(async () => (await readStoredState(page)).clients[0].partTimes.length).toBe(0);
  });

  test('G5-4: a piece of a nos_to_weight part earns its line’s amount ÷ pieces, not pieces × ₹/kg', async ({ page }) => {
    seq = 0;
    // 100 pieces of a 0.5 kg part at ₹14/kg: ₹700 on the line, ₹7.00 a piece; the line's rate is the ₹/kg.
    await loadAppWithState(page, book([client(1, 'DELTA WEIGHT PARTS', 'nos_to_weight', 14,
      { partTimes: [{ id: 'PT-D1', base: 'PLATE7001', gauge: '', name: 'PLATE 7001', line: 'vat-a1', pieces: 20, plateMin: 30, at: 1 }] })],
      [inv(1, dayOff(-3), [{ part: 'PLATE 7001', unit: 'NOS', qty: 100, rate: 14, amount: 700 }])], { partWeights: { 'PLATE 7001': 0.5 } }));
    await openPerf(page, 1);
    const row = (await openCard(page, 'hours')).locator('[data-cp-time="PT-D1"]');
    // 20 pieces × ₹7 = ₹140 a round of 30 + 15 minutes: ₹186.67 an hour.
    await expect(row.locator('summary')).toContainText('₹186.67');
    await row.locator('summary').click();
    await expect(row).toContainText('₹7.00/pc');
    // What a round earns is a fact row of its own (the tab map, TM5f: it was a sentence).
    await expect(row.locator('[data-cp-earns]')).toContainText('A round earns');
    await expect(row.locator('[data-cp-earns]')).toContainText('₹140.00');
  });

  test('G5-8: the materials period counts back whole months, clamped at a short month', async ({ page }) => {
    await loadAppWithState(page, book([client(1, 'EPSILON CO', 'weight', 10)], []));
    // Given its today, as the page would read it on those days: 31 May back three months is 28 Feb, never 3 Mar.
    const from = await g(page, `(function(){ var keep = _cpPeriod, out = [['3m','2026-05-31'],['6m','2026-08-31'],['3m','2024-05-31'],['3m','2026-03-31'],['3m','2026-07-31'],['6m','2026-09-30']]
      .map(function(x) { _cpPeriod = x[0]; var r = cpPeriodRange(x[1]); return r.from + '/' + r.to; }); _cpPeriod = keep; return out; })()`);
    expect(from).toEqual(['2026-02-28/2026-05-31', '2026-02-28/2026-08-31', '2024-02-29/2024-05-31', '2025-12-31/2026-03-31', '2026-04-30/2026-07-31', '2026-03-30/2026-09-30']);
  });

  test('G5-9: month on month as ₹/kg is a rate, and a month with nothing weighed is a gap, not ₹0.00', async ({ page }) => {
    seq = 0;
    await loadAppWithState(page, book([client(1, 'THETA RATE CO', 'weight', 13)], [
      inv(1, monthDay(-2, 10), [{ part: 'BUSH 9', unit: 'NOS', qty: 50, rate: 10 }]),
      inv(1, todayIso(), [{ part: 'SHAFT 7', unit: 'KG', qty: 100, rate: 13 }]),
    ]));
    await openPerf(page, 1);
    await page.locator('[data-action="invPerfSeries"][data-series="rate"]').click();
    const bars = page.locator('[data-cp-trend] rect.inv-chart-bar');
    await expect(bars).toHaveCount(1);
    await expect(bars.locator('title')).toHaveText(/: ₹13\.00\/kg$/);
  });

  test('UX-5: on the phone Performance leads with what needs the owner; the tools fold and steady parts wait behind Show more', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await openPerf(page);
    // Materials worked is folded to its head on the phone, and says what is in it.
    const worked = page.locator('[data-card="worked"]');
    await expect(worked).toHaveJSProperty('open', false);
    await expect(worked.locator(':scope > summary')).toContainText('Materials worked');
    // Steady parts are counted on their fold's head and shown when it is opened (the tab map, TM5f); stopped and new lead.
    const steady = page.locator('[data-cp-group="steady"]');
    const n = Number((await steady.locator(':scope > summary').innerText()).replace(/\D+/g, ''));
    expect(n).toBeGreaterThan(0);
    await expect(steady.locator('[data-cp-mat]:visible')).toHaveCount(0);
    await steady.locator(':scope > summary').click();
    await expect(steady.locator('[data-cp-mat]:visible')).toHaveCount(Math.min(n, 10));
    if (n > 10) await steady.locator('[data-action="invShowMore"]').click();
    await expect(steady.locator('[data-cp-mat]:visible')).toHaveCount(n);
    // The page was 3.1 phone screens on this book with every steady part and Materials worked drawn open.
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    await page.locator('#cpClientSelect').waitFor();
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
    expect(screens).toBeLessThan(2.4);
    // The fold is the device's: opened once, it stays open.
    await openCard(page, 'worked');
    // The fold is kept on the details' toggle event, a task of its own: a reload straight after the click can beat it.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sep_inv_folds') || '')).toContain('"cp-worked":true');
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    await expect(page.locator('[data-card="worked"]')).toHaveJSProperty('open', true);
  });
});

test.describe('P128: Stats', () => {
  test('G5-3: the Who-is-driving-it story says a client’s name as text, never as markup', async ({ page }) => {
    seq = 0;
    const evil = '<img src=x data-p128-xss onerror="window.__p128=1">';
    // The named client fills the plant this month at ₹2/kg, below any cost, and is the biggest mover; the other billed
    // only on the same days last month.
    const invs = [inv(1, todayIso(), [{ part: 'PART X1', unit: 'KG', qty: 5000, rate: 2 }]),
      inv(2, monthDay(-1, new Date(todayIso() + 'T00:00:00').getDate()), [{ part: 'PART Y1', unit: 'KG', qty: 100, rate: 12 }])];
    invs[0].clientName = evil; invs[1].clientName = 'QUIET OTHER CO';
    await loadAppWithState(page, book([client(1, evil, 'weight', 2), client(2, 'QUIET OTHER CO', 'weight', 12)], invs));
    // The questions are Pulse's since the tab map (TM2b).
    await openPulse(page);
    const story = page.locator('[data-tdy-q="clients"]');
    await expect(story.locator('[data-story-say]')).toHaveCount(2);
    await expect(story.locator('[data-story-say]').first()).toContainText('<img src=x');
    await expect(story.locator('[data-story-say]').last()).toContainText('<img src=x');
    await expect(page.locator('#pageHome [data-p128-xss]')).toHaveCount(0);
    expect(await g(page, 'window.__p128')).toBeUndefined();
  });

  test('G5-5: a period whose only weighed line was billed at ₹0 says nothing is weighed, never "Infinity%"', async ({ page }) => {
    seq = 0;
    const b: any = book([client(1, 'EPSILON REPLATE CO', 'weight', 13)], [inv(1, todayIso(), [
      { part: 'SHAFT 12', unit: 'KG', qty: 100, rate: 13, amount: 0 },
      { part: 'BUSH 34', unit: 'NOS', qty: 50, rate: 10 },
    ])]);
    b.invoices[0].items[0].zeroReason = 'replating';
    await loadAppWithState(page, b);
    for (const tab of ['clients', 'cost', 'trends']) {
      await openStatsTab(page, tab);
      for (const sel of ['#statsContent', '#statsToolbar']) {
        await expect(page.locator(sel)).not.toContainText('Infinity');
        await expect(page.locator(sel)).not.toContainText('NaN');
      }
    }
    await openStatsTab(page, 'trends');
    await expect(page.locator('#statsHeadline [data-callout="weighed"]')).toContainText('Nothing priced was weighed');
    // Pulse reads the same period (its cards were the Overview's).
    await openPulse(page);
    await expect(page.locator('#homeQuestions')).not.toContainText('Infinity');
    await expect(page.locator('#homeQuestions')).not.toContainText('NaN');
  });

  test('G5-6: GST and the total incl. GST are net of credit notes, as the taxable is, and agree with Finance’s GST due', async ({ page }) => {
    seq = 0;
    // ₹10,000 + ₹900 + ₹900 billed; a note takes ₹1,000 + ₹90 + ₹90 off it.
    await loadAppWithState(page, book([client(1, 'ZETA NET CO', 'weight', 10)], [inv(1, todayIso(), [{ part: 'RING 5', unit: 'KG', qty: 1000, rate: 10 }])], {
      creditNotes: [{ id: 'CN-1', cnNumber: '001', displayNumber: 'CN/001/26-27', kind: 'adjustment', reason: 'rate correction', date: todayIso(), clientId: 1,
        clientName: 'ZETA NET CO', invoiceIds: ['INV-1'], invoiceNumbers: ['SEP/TEST-00001'], taxableValue: 1000, cgstAmt: 90, sgstAmt: 90, igstAmt: 0, grandTotal: 1180,
        status: 'active', gstType: 'intra', createdAt: recentTs() }],
    }));
    const net = await g(page, `JSON.stringify(statsInvoices().map(function(i) { return [i.taxableValue, i.cgstAmt, i.sgstAmt, i.igstAmt, i.grandTotal]; }))`);
    expect(JSON.parse(net as string)).toEqual([[9000, 810, 810, 0, 10620]]);
    // The headline is Trends' verdict card, and the GST is Money → GST's (the tab map, TM2b).
    await openStatsTab(page, 'trends');
    await expect(page.locator('#statsHeadline [data-tile="revenue"]')).toContainText('₹10,620.00 incl. GST');
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="gst"]').click();
    await expect(page.locator('#finGst')).toContainText('₹1,620.00');
    expect(await g(page, `finGstByMonth([localDateStr().slice(0, 7)])[0].due`)).toBe(1620);
  });

  test('G5-10: an invoice typed decades out of range leaves the trend and month on month on the months that have work', async ({ page }) => {
    seq = 0;
    const y = +todayIso().slice(0, 4);
    await loadAppWithState(page, book([client(1, 'KAPPA TREND CO', 'weight', 13)], [
      inv(1, todayIso(), [{ part: 'P1', unit: 'KG', qty: 100, rate: 13 }]),
      inv(1, monthDay(-1, 10), [{ part: 'P1', unit: 'KG', qty: 100, rate: 10 }]),
      inv(1, `${y + 36}-01-15`, [{ part: 'P1', unit: 'KG', qty: 10, rate: 50 }]),
      inv(1, `${y - 27}-06-15`, [{ part: 'P1', unit: 'KG', qty: 10, rate: 40 }]),
    ]));
    const t = JSON.parse(await g(page, `JSON.stringify(buildTrendSeries('month', 'revenue').map(function(d) { return [d.key, d.value]; }))`) as string);
    expect(t).toHaveLength(12);
    expect(t[t.length - 1]).toEqual([todayIso().slice(0, 7), 1300]);
    expect(t[t.length - 2]).toEqual([monthDay(-1, 10).slice(0, 7), 1000]);
    const m = JSON.parse(await g(page, `JSON.stringify(cpMonthly(1, 12).map(function(r) { return [r.month, r.revenue]; }))`) as string);
    expect(m[m.length - 1]).toEqual([todayIso().slice(0, 7), 1300]);
    expect(m[m.length - 2]).toEqual([monthDay(-1, 10).slice(0, 7), 1000]);
  });
});

test.describe('P128: insights', () => {
  test('G5-7: a client’s three falling months read the same figures in the line and in the facts', async ({ page }) => {
    seq = 0;
    await loadAppWithState(page, book([client(1, 'ETA FALLING CO', 'weight', 10)], [
      inv(1, monthDay(-3, 10), [{ part: 'P', unit: 'KG', qty: 1, rate: 30000.6 }]),
      inv(1, monthDay(-2, 10), [{ part: 'P', unit: 'KG', qty: 1, rate: 25000.4 }]),
      inv(1, monthDay(-1, 10), [{ part: 'P', unit: 'KG', qty: 1, rate: 20000.5 }]),
    ]));
    const t = JSON.parse(await g(page, `JSON.stringify(TODO_RULE_FNS.insClientDown())`) as string);
    expect(t).toHaveLength(1);
    expect(t[0].sub.split(' → ').map((x: string) => x.replace(/^\S+ /, ''))).toEqual(t[0].facts.slice(0, 3).map((f: string[]) => f[1]));
    expect(t[0].sub).toContain('₹30,000.60');
  });

  test('G5-14: a client set inactive is not reported as gone quiet', async ({ page }) => {
    seq = 0;
    const b: any = book([client(1, 'LAMBDA QUIET ACTIVE', 'weight', 10), client(2, 'MU QUIET LEFT', 'weight', 10, { isActive: false })], []);
    // Each sent a challan every week until 60 days ago and billed ₹25,000 in the last three months.
    b.incomingMaterial = [];
    for (const c of [1, 2]) for (let k = 0; k < 6; k++) b.incomingMaterial.push(challan(c, dayOff(-60 - 7 * k), 'PIN 5'));
    b.invoices = [1, 2].map(c => inv(c, dayOff(-45), [{ part: 'PIN 5', unit: 'KG', qty: 2500, rate: 10 }]));
    await loadAppWithState(page, b);
    expect(await g(page, `TODO_RULE_FNS.insQuiet().map(function(t) { return t.key; })`)).toEqual(['insQuiet:1']);
  });

  test('G5-15: a month realising low is snoozed against the month, not against every invoice’s paisa of realisation', async ({ page }) => {
    seq = 0;
    // The page's today is held at the 20th of this month so the month has its five working days whatever today is.
    const today = todayIso().slice(0, 8) + '20', ym = today.slice(0, 7);
    const back = (k: number) => { const d = new Date(today + 'T00:00:00'); d.setDate(10); d.setMonth(d.getMonth() - k); return iso(d); };
    await loadAppWithState(page, book([client(1, 'NU REAL CO', 'weight', 10)], [
      ...[1, 2, 3].map(k => inv(1, back(k), [{ part: 'P', unit: 'KG', qty: 1000, rate: 10 }])),
      inv(1, ym + '-10', [{ part: 'P', unit: 'KG', qty: 1000, rate: 5 }]),
    ]));
    const r = JSON.parse(await g(page, `(function() {
      var keep = localDateStr; localDateStr = function() { return '${today}'; };
      try {
        var a = TODO_RULE_FNS.insRealLow();
        S.invoices.push({ id: 'INV-X', date: '${ym}-12', status: 'active', clientId: 1, taxableValue: 4600, items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1000, rate: 4.6, amount: 4600 }] });
        var b = TODO_RULE_FNS.insRealLow();
        return JSON.stringify([a.map(function(t) { return [t.title, t.sig]; }), b.map(function(t) { return [t.title, t.sig]; })]);
      } finally { localDateStr = keep; }
    })()`) as string);
    expect(r[0]).toHaveLength(1);
    expect(r[1]).toHaveLength(1);
    // The figure moved (₹5.00 → ₹4.80/kg) and the task says so; a snooze until the figures change is not undone by it.
    expect(r[0][0][0]).not.toBe(r[1][0][0]);
    expect(r[0][0][1]).toBe(r[1][0][1]);
  });
});

test.describe('P128: History and Home', () => {
  test('G5-11: a deleted attendance day reads Deleted, in danger, with the deletion’s icon', async ({ page }) => {
    await loadAppWithState(page, book([client(1, 'XI CO', 'weight', 10)], [], {
      attendanceDeletes: [{ id: 'AD-1', key: dayOff(-3), iso: dayOff(-3), reason: 'entered twice', how: 'by hand', at: recentTs(), marks: 3, extra: 1, day: { marks: {}, extra: [] } }],
    }));
    await switchTab(page, 'pageHistory');
    const row = page.locator('[data-ev="attDelete"]');
    await expect(row).toContainText('Attendance day deleted');
    await expect(row.locator('.inv-dot-danger')).toHaveText('Deleted');
    const paths = await row.locator('.inv-row-lead svg path').evaluateAll(ps => ps.map(p => p.getAttribute('d')));
    expect(paths).toEqual([...(await g(page, `HISTORY_ICONS.void`) as string).matchAll(/ d="([^"]+)"/g)].map(m => m[1]));
  });

  test('G5-12: Home’s realisation line joins only what it has: no dangling separator with nothing to compare', async ({ page }) => {
    seq = 0;
    await loadAppWithState(page, book([client(1, 'OMICRON HOME CO', 'weight', 13)], [inv(1, todayIso(), [{ part: 'P1', unit: 'KG', qty: 100, rate: 13 }])]));
    await openWidget(page, 'mtd');
    const t = (await page.locator('#mtdPerKgDelta').innerText()).trim();
    expect(t).toMatch(/cost ₹[\d,.]+$/);
  });

  test('G5-16: Edit Home keeps one primary on the page', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await openPulse(page);
    // Edit Home is under More in Pulse's head since the tab map (TM2b: one toolbar row).
    await toolbarMore(page, 'Edit Home');
    await expect(page.locator('#homeEdit')).toBeVisible();
    await expect(page.locator('#pageHome .inv-btn-primary:visible')).toHaveCount(1);
    await expect(page.locator('[data-action="invHomeEditDone"]')).toHaveClass(/inv-btn-secondary/);
  });

  test.describe('on the desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

    /* Every row of a strip of tiles is filled to its right edge, and no figure is cut by its tile. */
    async function stripFilled(page: Page, sel: string) {
      return page.evaluate(s => {
        const strip = document.querySelector(s) as HTMLElement;
        const r = strip.getBoundingClientRect(), rows: Record<number, number> = {};
        const tiles = Array.from(strip.children) as HTMLElement[];
        tiles.forEach(t => { const b = t.getBoundingClientRect(); const k = Math.round(b.top); rows[k] = Math.max(rows[k] || 0, b.right); });
        return { tiles: tiles.length, rows: Object.keys(rows).length, filled: Object.values(rows).every(right => right >= r.right - 2),
          cut: tiles.filter(t => { const v = t.querySelector('.inv-tile-value') as HTMLElement; return v && v.scrollWidth > v.clientWidth + 1; }).length };
      }, sel);
    }

    test('UX-4: Home’s tiles fill every row at half width, three or four of them, at 1280 and 1024', async ({ page }) => {
      // Month to date at half width too: four tiles in a half-width widget.
      await page.addInitScript(() => localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom',
        order: ['mtd', 'quick', 'money', 'todo', 'attendance', 'unbilled', 'sync', 'zinc', 'recent', 'production', 'power', 'stock'],
        hidden: { production: true, power: true, stock: true }, wide: { quick: true, recent: true } })));
      await loadAppWithState(page, sweepState());
      await openPulse(page);
      for (const w of [1280, 1024]) {
        await page.setViewportSize({ width: w, height: 800 });
        await expect(page.locator('body')).toHaveClass(/inv-desktop/);
        await expect.poll(async () => (await stripFilled(page, '#homeFin .inv-tiles')).filled, { message: `Money at ${w}` }).toBe(true);
        expect((await stripFilled(page, '#homeFin .inv-tiles')).cut).toBe(0);
        const mtd = await stripFilled(page, '#homeTiles');
        expect(mtd.tiles).toBe(4);
        expect(mtd.filled, `Month to date at ${w}`).toBe(true);
        expect(mtd.rows).not.toBe(3);
      }
      // A widget set to full width still lays four across.
      await page.setViewportSize({ width: 1280, height: 800 });
      await toolbarMore(page, 'Edit Home');
      await page.locator('[data-action="invHomeWide"][data-w="mtd"][data-v="1"]').click();
      await expect.poll(async () => (await stripFilled(page, '#homeTiles')).rows).toBe(1);
    });
  });
});
