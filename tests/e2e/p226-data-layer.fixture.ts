import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso, type SepState } from './fixtures';
import { longBook, workDaysBack } from './load-fixture';
import { dayOff } from './sweep-fixture';

// P226 (docs/UI_PASS_3.md §6, §20): the data layer, shaped for SQL (split/dataview.js). Every view carries exactly the columns
// §6's table names, each in its declared type or null; unknown stays null, never 0; a sum over a view is the figure its screen
// shows (Stats' months, Production → Lines' week, Money's Cash hero) and every other view agrees with the function its screen
// draws with; each view is worked out once a book state and kept until a save (a production view also until _prodVer moves).
// Run on both layouts (p226-data-layer.spec.ts, p226-data-layer.desktop.spec.ts). §16's paths in CHG_TRACK are U2's: they do
// not exist before it.

/* §6's table, column for column. */
export const P226_COLS: Record<string, string[]> = {
  invoice_lines: ['date', 'month', 'invoice_id', 'line', 'number', 'client_id', 'part', 'gauge', 'unit', 'qty', 'kg', 'kg_src', 'taxable', 'taxable_net', 'tax'],
  invoices: ['id', 'number', 'date', 'client_id', 'state', 'state_since', 'taxable', 'taxable_net', 'tax', 'total', 'terms_days', 'due_on', 'paid_on', 'paid_how', 'open_amount'],
  receipts: ['id', 'source', 'date', 'client_id', 'amount', 'placed', 'how', 'invoice_ids'],
  challan_lines: ['id', 'challan_id', 'date', 'client_id', 'challan_no', 'part', 'unit', 'qty', 'open_qty', 'open_amount', 'billed_qty', 'wanted_by'],
  production_days: ['date', 'line', 'kg', 'kg_est', 'pieces', 'pieces_unweighed', 'rounds', 'efficiency', 'earned', 'cut_minutes'],
  attendance_days: ['date', 'roster', 'on_site', 'floor_heads', 'floor_need', 'ot_hours', 'extra_hours', 'recorded'],
  power_cuts: ['id', 'date', 'from', 'to', 'minutes', 'working_minutes', 'reason', 'where', 'damage'],
  stock_lines: ['id', 'name', 'unit', 'level', 'days_left', 'use_day', 'last_price', 'supplier_id'],
  bank_rows: ['id', 'date', 'amount_in', 'amount_out', 'balance', 'category', 'party', 'client_id'],
  cost_months: ['month', 'kg', 'labour', 'zinc', 'chemicals', 'power', 'other', 'measured_share'],
  daily: ['date', 'week', 'cutMin', 'heads', 'otHours', 'zinc', 'invSize', 'tonnes', 'real', 'dtp', 'eff'],
  market_tata: ['month', 'cv_total', 'cv_domestic', 'cv_export', 'hcv', 'released_on'],
  weather_days: ['date', 't_max', 't_min', 'rain_mm', 'thunder'],
};

/* The long book (the sweep's, scaled toward the owner's shape) with what makes every column speak once: a line-day with no run
   and a day with no marks inside the record (the gaps a null stands for), the register's rounds on VAT A1, the floor's number,
   a challan wanted by a day. Every name and figure is made up; every date is built from today. */
export const P226_GAP_RUN = () => workDaysBack(20)[4];
export const P226_GAP_ATT = () => workDaysBack(22)[6];
export function p226Book(): SepState {
  const s = longBook() as any;
  s.production.entries = s.production.entries.filter((e: any) => e.id !== 'LB' + 4);
  s.production.entries.forEach((e: any) => {
    if (!/^LA\d+$/.test(e.id)) return;
    const a = Math.floor(e.qty / 3);
    e.rounds = [{ time: '09:00', qty: a }, { time: '12:00', qty: a }, { time: '15:30', qty: e.qty - 2 * a }];
  });
  delete s.attendance[P226_GAP_ATT()];
  s.areaTargets = { 'vat-a1': 2, 'vat-a2': 2, barrel: 2, 'pickling-vat': 1 };
  const open = s.incomingMaterial.find((m: any) => m.items.some((it: any) => !it.invoiced));
  open.priority = dayOff(2);
  // Three lines of ₹100 and a credit note of ₹100 against them: each line nets to ₹66.666…, rounded ₹66.67 three times, a paisa
  // more than the invoice's ₹200.00. The lines are to foot to the invoice.
  const date = dayOff(-5), line = (p: string) => ({ partNumber: p, desc: p, hsn: '998873', unit: 'KG', qty: 10, rate: 10, amount: 100, nosQty: null });
  s.invoices.push({ id: 'INV-P226', invoiceNumber: '09226', displayNumber: 'SEP/TEST-09226', date, status: 'active', invoiceState: 'dispatched', clientId: 2,
    clientName: s.clients.find((c: any) => c.id === 2).name, clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [line('P226-A'), line('P226-B'), line('P226-C')], taxableValue: 300, cgstPer: 9, cgstAmt: 27, sgstPer: 9, sgstAmt: 27, igstPer: 0, igstAmt: 0, grandTotal: 354,
    amountInWords: '', challanNo: '', challanDate: date, poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime() });
  s.creditNotes.push({ id: 'CN-P226', cnNumber: '009', displayNumber: 'CN/009/26-27', kind: 'adjustment', reason: 'rate', date, clientId: 2, clientName: 'x',
    invoiceIds: ['INV-P226'], invoiceNumbers: ['SEP/TEST-09226'], invoiceDates: [date], taxableValue: 100, cgstAmt: 9, sgstAmt: 9, igstAmt: 0, grandTotal: 118, status: 'active', gstType: 'intra' });
  return s;
}

/* The views' rows checked against their columns in the page: problems listed, and the columns no row fills. */
async function census(page: Page) {
  return page.evaluate(() => {
    const w = window as any, out: any = { names: Object.keys(w.DV_VIEWS), cols: {}, counts: {}, problems: [] as string[], empty: [] as string[], frozen: true };
    for (const n of out.names) {
      const def = w.DV_VIEWS[n], cols = w.dvCols(n), rows = w.dvRows(n);
      out.cols[n] = cols.map((c: any) => c.name);
      out.counts[n] = rows.length;
      if (def.name !== n) out.problems.push(n + ': named ' + def.name);
      if (!Array.isArray(def.stores) || !def.stores.length || def.stores.some((x: any) => typeof x !== 'string' || !x)) out.problems.push(n + ': stores');
      if (typeof def.rows !== 'function') out.problems.push(n + ': no rows()');
      if (!Object.isFrozen(rows) || (rows.length && !Object.isFrozen(rows[0]))) out.frozen = false;
      cols.forEach((c: any) => {
        if (['text', 'int', 'num', 'date', 'bool'].indexOf(c.type) < 0) out.problems.push(n + '.' + c.name + ': type ' + c.type);
        if (!('unit' in c)) out.problems.push(n + '.' + c.name + ': no unit');
      });
      rows.forEach((r: any, i: number) => {
        if (Object.keys(r).join() !== out.cols[n].join()) out.problems.push(n + '[' + i + ']: keys ' + Object.keys(r).join());
        cols.forEach((c: any) => {
          const v = r[c.name];
          if (v === null) return;
          let ok = false;
          if (c.type === 'text') {
            ok = typeof v === 'string' && v.trim() !== '';
            if (ok && c.unit === 'month') ok = /^\d{4}-\d{2}$/.test(v);
            if (ok && c.unit === 'HH:MM') ok = /^\d{2}:\d{2}$/.test(v);
            if (ok && c.unit === 'json') { try { ok = Array.isArray(JSON.parse(v)); } catch { ok = false; } }
          } else if (c.type === 'int') ok = Number.isInteger(v);
          else if (c.type === 'num') ok = typeof v === 'number' && isFinite(v);
          else if (c.type === 'date') ok = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime());
          else if (c.type === 'bool') ok = typeof v === 'boolean';
          // Money is rounded to the paisa at the boundary.
          if (ok && c.unit === '₹') ok = Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
          if (!ok) out.problems.push(n + '[' + i + '].' + c.name + ' = ' + JSON.stringify(v) + ' is not ' + c.type + (c.unit ? ' ' + c.unit : ''));
        });
      });
      if (rows.length) cols.forEach((c: any) => { if (rows.every((r: any) => r[c.name] === null)) out.empty.push(n + '.' + c.name); });
    }
    return out;
  });
}

export function dataLayerSpec(layout: 'phone' | 'desktop') {
  test.describe(`P226 (${layout}): the data layer`, () => {
    test('every view carries exactly §6’s columns, each in its type or null, frozen; on the long book every column speaks', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const c = await census(page);
      expect(c.names).toEqual(Object.keys(P226_COLS));
      for (const n of c.names) expect(c.cols[n], n).toEqual(P226_COLS[n]);
      expect(c.problems).toEqual([]);
      expect(c.frozen).toBe(true);
      // Every view but the market's has rows; those wait for S.market (U2).
      for (const n of c.names) {
        if (n === 'market_tata' || n === 'weather_days') expect(c.counts[n], n).toBe(0);
        else expect(c.counts[n], n).toBeGreaterThan(0);
      }
      expect(c.empty).toEqual([]);
    });

    test('unknown is null, never 0: a line-day with no run, a day with no marks, an invoice before receivables start, no statement', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const gap = P226_GAP_RUN(), att = P226_GAP_ATT();
      const r = await page.evaluate(([gap, att]) => {
        const w = window as any, rows = (n: string, q?: any) => w.dvRows(n, q);
        const from = w.bankRecvFrom(w.bankRows());
        return {
          gap: rows('production_days', { date: gap }),
          att: rows('attendance_days', { date: att })[0],
          attNext: rows('attendance_days', (x: any) => x.date > att && x.recorded)[0],
          before: rows('invoices', (x: any) => x.state !== 'cancelled' && x.date < from)[0],
          after: rows('invoices', (x: any) => x.state !== 'cancelled' && x.date >= from)[0],
          cancelled: rows('invoices', { state: 'cancelled' })[0],
          debit: rows('bank_rows', (x: any) => x.amount_out > 0)[0],
          run: rows('production_days', (x: any) => x.pieces != null && x.cut_minutes === 0)[0],
          bath: rows('stock_lines', { name: 'Zinc' })[0],
          daily: rows('daily', { date: gap })[0],
          firstDaily: rows('daily')[0],
          noLme: rows('daily', (x: any) => x.date < Object.keys((0, eval)('S').zinc.lmeHistory).sort()[0])[0],
        };
      }, [gap, att]);
      const vat2 = r.gap.find((x: any) => x.line === 'vat-a2');
      expect(vat2).toEqual({ date: gap, line: 'vat-a2', kg: null, kg_est: null, pieces: null, pieces_unweighed: null, rounds: null, efficiency: null, earned: null, cut_minutes: null });
      // The other lines ran that day.
      expect(r.gap.find((x: any) => x.line === 'vat-a1').kg).toBeGreaterThan(0);
      expect(r.att).toEqual({ date: att, roster: null, on_site: null, floor_heads: null, floor_need: null, ot_hours: null, extra_hours: null, recorded: false });
      expect(r.attNext.on_site).toBeGreaterThan(0);
      expect(r.before.open_amount).toBeNull();
      expect(r.before.paid_on).toBeNull();
      expect(typeof r.after.open_amount).toBe('number');
      // What is known to be nothing stays 0: a cancelled invoice bills and is owed nothing, a debit brings nothing in, a run with no cut.
      expect([r.cancelled.taxable_net, r.cancelled.open_amount, r.cancelled.due_on]).toEqual([0, 0, null]);
      expect(r.debit.amount_in).toBe(0);
      expect(r.run.cut_minutes).toBe(0);
      // A bath line has no days left; a day before the statement no days to pay; a day with no LME no zinc.
      expect(r.bath.days_left).toBeNull();
      expect(r.firstDaily.dtp).toBeNull();
      expect(r.noLme.zinc).toBeNull();
      // The day a line has no run is still a day of the record: the lines that ran give it its tonnes, its marks its heads.
      expect(r.daily.heads).toBeGreaterThan(0);

      // No statement: nothing is known of what was paid, and the statement's views are empty.
      const s: any = p226Book();
      s.bank.rows = []; s.bank.imports = []; s.bank.cheques = [];
      await loadAppWithState(page, s);
      const n = await page.evaluate(() => {
        const w = window as any, inv = w.dvRows('invoices', (x: any) => x.state !== 'cancelled');
        return { receipts: w.dvRows('receipts').length, bank: w.dvRows('bank_rows').length, invoices: inv.length,
          known: inv.filter((x: any) => x.open_amount != null || x.paid_on != null || x.paid_how != null).length,
          dtp: w.dvRows('daily').filter((x: any) => x.dtp != null).length };
      });
      expect(n).toEqual({ receipts: 0, bank: 0, invoices: n.invoices, known: 0, dtp: 0 });
      expect(n.invoices).toBeGreaterThan(0);
    });

    test('a sum over a view is the figure its screen shows: Stats’ months, Lines’ week, Money’s Cash hero', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const today = todayIso();

      // Stats: each month's net revenue, tonnage and realisation (statsMonthRows), from the lines and from the invoices.
      const months = await page.evaluate((today) => {
        const w = window as any, upto = (x: any) => x.date <= today;
        const all = w.dvSum('invoice_lines', 'month', { taxable_net: 'sum', kg: 'sum' }, upto);
        const weighed = w.dvSum('invoice_lines', 'month', { taxable_net: 'sum', kg: 'sum' }, (x: any) => upto(x) && x.kg != null);
        return w.statsMonthRows(6).map((m: any) => {
          const a = all.find((g: any) => g.month === m.month), b = weighed.find((g: any) => g.month === m.month);
          const inv = w.dvRows('invoices', (x: any) => upto(x) && x.date.slice(0, 7) === m.month).reduce((t: number, x: any) => t + x.taxable_net, 0);
          return { month: m.month, rev: w.gstRound(m.rev), lines: a ? a.taxable_net : 0, invoices: w.gstRound(inv), kg: m.kg, lineKg: a ? a.kg : 0,
            real: m.real, lineReal: b && b.kg ? b.taxable_net / b.kg : null,
            cells: [w.formatNum((a ? a.kg : 0) / 1000, 1), b && b.kg ? w.formatNum(b.taxable_net / b.kg, 2) : '—'] };
        });
      }, today);
      expect(months.length).toBe(6);
      for (const m of months) {
        expect(m.lines, m.month).toBe(m.rev);
        expect(m.invoices, m.month).toBe(m.rev);
        expect(m.lineKg, m.month).toBeCloseTo(m.kg, 6);
        // Stats reads realisation off each line's own rounded share; the view's lines foot to the invoice, so the two differ by at
        // most a paisa a credited invoice over the month's kilos (the ₹/kg drawn is the same, below).
        if (m.real == null) expect(m.lineReal).toBeNull(); else expect(m.lineReal!, m.month).toBeCloseTo(m.real, 4);
      }
      expect(months.some((m: any) => m.rev > 0)).toBe(true);
      // The lines foot to their invoice: three lines netting to ₹66.666… each are ₹66.67, ₹66.67 and ₹66.66, not three of ₹66.67.
      const foot = await page.evaluate(() => {
        const w = window as any, net = w.statsInvoices().find((i: any) => i.id === 'INV-P226'), rows = w.dvRows('invoice_lines', { invoice_id: 'INV-P226' });
        return { stats: w.gstRound(net.items.reduce((t: number, x: any) => t + x.amount, 0)), net: net.taxableValue, lines: rows.map((x: any) => [x.line, x.taxable, x.taxable_net, x.tax]) };
      });
      expect(foot.stats).toBe(200.01);
      expect(foot.net).toBe(200);
      expect(foot.lines).toEqual([[1, 100, 66.67, 18], [2, 100, 66.67, 18], [3, 100, 66.66, 18]]);
      // As Trends' six months draw them: the tonnes and the ₹ a kilo, month by month.
      await switchTab(page, 'pageStats');
      await page.locator('#statsToolbar .inv-viewtab[data-tab="trends"]').click();
      const drawn = await page.locator('#statsMonths table tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).slice(1, 3).map((td) => (td.textContent || '').trim())));
      expect(drawn).toEqual(months.map((m: any) => m.cells));

      // Production → Lines: the pay week before this one, line by line, as prodLineWeek reads it and as its week table draws it.
      const prev = await page.evaluate(() => { const w = window as any; return w.isoAddDays(w.attWeekStartOf(w.localDateStr()), -1); });
      const week = await page.evaluate((sat) => {
        const w = window as any;
        return w.PROD_LINES.map((l: string) => {
          const L = w.prodLineWeek(l, sat), rows = w.dvRows('production_days', (x: any) => x.line === l && x.date >= L.from && x.date <= L.to);
          const kg = rows.reduce((t: number, x: any) => t + (x.kg || 0), 0), days = rows.filter((x: any) => x.pieces != null).length;
          return { line: l, kg: L.cur.kg, dvKg: kg, days: L.cur.days, dvDays: days };
        });
      }, prev);
      for (const x of week) {
        expect(x.dvKg, x.line).toBeCloseTo(x.kg, 6);
        expect(x.dvDays, x.line).toBe(x.days);
      }
      expect(week.reduce((t: number, x: any) => t + x.kg, 0)).toBeGreaterThan(0);
      await switchTab(page, 'pageProduction');
      await page.evaluate((sat) => { (0, eval)('prodSetTab')('lines'); (0, eval)('_prodDay = ' + JSON.stringify(sat)); (0, eval)('renderProduction')(); }, prev);
      const expected = await page.evaluate((sat) => {
        const w = window as any, ws = w.attWeekStartOf(sat), days = [0, 1, 2, 3, 4, 5, 6].map((k) => w.isoAddDays(ws, k));
        return w.PROD_LINES.map((l: string) => [w.PROD_LINE_LABEL[l]].concat(days.map((d: string) => {
          const r = w.dvRows('production_days', { date: d, line: l })[0];
          if (!r || r.pieces == null) return '—';
          const kg = r.kg || 0;
          return (kg > 0 ? (r.kg_est ? '≈ ' : '') + w.formatNum(kg, 0) : '') + (r.pieces_unweighed ? (kg > 0 ? ' + ' : '') + Math.round(r.pieces_unweighed).toLocaleString('en-IN') + ' pcs' : '');
        })));
      }, prev);
      const table = await page.locator('#prodWeek tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())));
      expect(table.slice(0, 3)).toEqual(expected);

      // Money: the last row's balance is the Cash hero's figure, to the paisa (its title), as bankRows reads it.
      await switchTab(page, 'pageFinance');
      const hero = await page.locator('[data-card="fin-cash"] .inv-hero-fig span[title]').first().getAttribute('title');
      const bal = await page.evaluate(() => {
        const w = window as any, rows = w.dvRows('bank_rows'), b = w.bankRows();
        return { dv: w.formatCurrency(rows[rows.length - 1].balance), fn: w.formatCurrency(b[b.length - 1].balance) };
      });
      expect(bal.dv).toBe(bal.fn);
      expect(hero).toBe(bal.dv);
    });

    test('every other view agrees with the function its screen draws with', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const r = await page.evaluate(() => {
        const w = window as any, today = w.localDateStr(), sum = (list: any[], f: (x: any) => number) => list.reduce((t, x) => t + (f(x) || 0), 0);
        const cls = w.bankClassify(w.bankRows()), recv = w.bankReceivables(cls);
        // Receipts: placed on each client as Receivables counts them, and the ones with no client.
        const receipts = recv.map((x: any) => ({ client: x.client.id, fn: x.received, dv: w.gstRound(sum(w.dvRows('receipts', { client_id: x.client.id, placed: true }), (y) => y.amount)) }));
        const loose = { fn: w.bankLooseReceipts(cls, w.bankRecvFrom()).length, dv: w.dvRows('receipts', { placed: false }).length };
        // What each client's invoices still owe, as Receivables' open list holds it.
        const open = recv.map((x: any) => ({ client: x.client.id, fn: w.gstRound(sum(x.open.filter((o: any) => o.inv), (o) => o.due)),
          dv: w.gstRound(sum(w.dvRows('invoices', { client_id: x.client.id }), (y) => y.open_amount)) }));
        // Each invoice as its own detail reads its payment (finInvoicePayment): open, or paid on the day and the way that settled it.
        const pay = (0, eval)('S').invoices.filter((i: any) => i.status === 'active').map((i: any) => {
          const p = w.finInvoicePayment(i), d = w.dvRows('invoices', { id: i.id })[0];
          const last = p && p.paid && p.paid.length ? p.paid[p.paid.length - 1] : null, settled = p && !p.before && !(p.open > 0.005);
          const fn = !p || p.before ? [null, null, null]
            : [p.open, settled && last && last.how !== 'account' ? last.date : null, settled && last ? (last.how === 'account' ? 'on account' : last.pending ? 'cheque' : last.how) : null];
          return { id: i.id, fn, dv: [d.open_amount, d.paid_on, d.paid_how] };
        });
        // The challans' open share: In plant's Book, the same figure as Home's unbilled.
        const challans = { fn: w.prodInPlant().book, dv: w.dvSum('challan_lines', null, { open_amount: 'sum' })[0].open_amount };
        // Power: the cuts and their damage, as the case counts them.
        const pa = w.powerAnalysis(), cuts = { fn: [pa.cuts.length, pa.totals.cost], dv: [w.dvRows('power_cuts').length, w.dvSum('power_cuts', null, { damage: 'sum' })[0].damage] };
        // Stock: each line in use, as its status reads it.
        const stock = w.stockData().items.filter((i: any) => i.active !== false).map((i: any) => {
          const st = w.stockStatus(i), d = w.dvRows('stock_lines', { id: i.id })[0];
          return { id: i.id, fn: [st.level, st.daysLeft, st.rate ? st.rate.rate : null], dv: [d.level, d.days_left, d.use_day] };
        });
        // Cost months: the kilos and the live cost a kilo, as Trends' six months read them.
        const cost = w.statsMonthRows(6).filter((m: any) => m.kg > 0).map((m: any) => {
          const d = w.dvRows('cost_months', { month: m.month })[0];
          return { month: m.month, kg: m.kg, dvKg: d.kg, cost: m.cost, dvCost: (d.labour + d.zinc + d.chemicals + d.power + d.other) / d.kg };
        });
        // Attendance over the last four weeks: the overtime and EXTRA of Hours by area, and each day's on site as its card reads it.
        const from = w.isoAddDays(today, -27), hrs = w.areaHoursForRange(from, today).rows, days = w.dvRows('attendance_days', (x: any) => x.date >= from);
        const att = { ot: [w.gstRound(sum(hrs, (a) => a.ot)), w.gstRound(sum(days, (x) => x.ot_hours))], extra: [w.gstRound(sum(hrs, (a) => a.extra)), w.gstRound(sum(days, (x) => x.extra_hours))],
          onSite: days.filter((x: any) => x.recorded).every((x: any) => { const s = w.attDaySummary(x.date); return x.on_site === s.p + s.half && x.roster === s.roster.length; }) };
        // Daily: a row a working day (a Sunday only where worked), its week the pay week's Saturday, a weekly series one figure a week.
        const daily = w.dvRows('daily'), byWeek: any = {};
        daily.forEach((x: any) => { (byWeek[x.week] = byWeek[x.week] || []).push(x); });
        const shape = {
          weekSat: daily.every((x: any) => new Date(x.week + 'T00:00:00').getDay() === 6 && w.isoDaysBetween(x.date, x.week) >= 0 && w.isoDaysBetween(x.date, x.week) <= 6),
          weekly: Object.keys(byWeek).every((k) => byWeek[k].every((x: any) => x.real === byWeek[k][0].real && x.dtp === byWeek[k][0].dtp)),
          sundays: daily.filter((x: any) => new Date(x.date + 'T00:00:00').getDay() === 0).every((x: any) => x.heads != null || x.tonnes != null || x.eff != null || w.prodDayPlated(x.date).nos + w.prodDayPlated(x.date).kg > 0),
          heads: daily.every((x: any) => { const s = w.attDaySummary(x.date); return x.heads === (s.marked ? s.p + s.half * 0.5 : null); }),
          tonnes: daily.every((x: any) => { const p = w.prodDayPlated(x.date); return x.tonnes === (Object.keys(p.lines).length && p.whole ? p.kg / 1000 : null); }),
          // A day's dark working minutes are its cuts' as the case counts them, on the days it reads a rate over.
          cutMin: daily.filter((x: any) => x.cutMin != null).every((x: any) => x.cutMin === sum(pa.cuts.filter((c: any) => c.date === x.date), (c) => c.cost.inside)) &&
            daily.some((x: any) => x.cutMin > 0) && pa.span.days.every((d: string) => d < pa.cuts[0].date || !daily.some((x: any) => x.date === d) || daily.find((x: any) => x.date === d).cutMin != null ||
              pa.quiet.some((q: any) => d >= q.from && d <= q.to)),
          // The last working day to today, no day missing between.
          last: daily[daily.length - 1].date === today || new Date(today + 'T00:00:00').getDay() === 0,
        };
        return { receipts, loose, open, pay, challans, cuts, stock, cost, att, shape };
      });
      for (const x of r.receipts) expect(x.dv, 'client ' + x.client).toBe(x.fn);
      expect(r.receipts.some((x: any) => x.fn > 0)).toBe(true);
      expect(r.loose.dv).toBe(r.loose.fn);
      for (const x of r.open) expect(x.dv, 'client ' + x.client).toBe(x.fn);
      for (const x of r.pay) expect(x.dv, x.id).toEqual(x.fn);
      // Paid and open both occur, and a paid one says how.
      expect(r.pay.some((x: any) => x.fn[2] != null) && r.pay.some((x: any) => x.fn[0] > 0)).toBe(true);
      expect(r.challans.dv).toBe(r.challans.fn);
      expect(r.cuts.dv).toEqual(r.cuts.fn);
      for (const x of r.stock) expect(x.dv, x.id).toEqual(x.fn);
      expect(r.cost.length).toBeGreaterThan(0);
      for (const x of r.cost) { expect(x.dvKg, x.month).toBeCloseTo(x.kg, 6); expect(x.dvCost, x.month).toBeCloseTo(x.cost, 4); }
      expect(r.att.ot[1]).toBe(r.att.ot[0]);
      expect(r.att.extra[1]).toBe(r.att.extra[0]);
      expect(r.att.extra[0]).toBeGreaterThan(0);
      expect(r.att.onSite).toBe(true);
      expect(r.shape).toEqual({ weekSat: true, weekly: true, sundays: true, heads: true, tonnes: true, cutMin: true, last: true });
    });

    test('the cache: the same rows until a save, then worked out again; a production view on _prodVer too; each view on its own', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const r = await page.evaluate(async () => {
        const w = window as any, S = (0, eval)('S');
        const lines = w.dvRows('invoice_lines'), prod = w.dvRows('production_days'), stock = w.dvRows('stock_lines');
        const same = w.dvRows('invoice_lines') === lines && w.dvRows('production_days') === prod && w.dvRows('stock_lines') === stock;
        let threw = false;
        try { lines.push({}); } catch { threw = true; }
        // The production record's version moves with no save: its views are worked out again, the rest are kept.
        w.prodTouch();
        const touched = { lines: w.dvRows('invoice_lines') === lines, prod: w.dvRows('production_days') === prod, stock: w.dvRows('stock_lines') === stock };
        const prod2 = w.dvRows('production_days');
        // A change saved: the next read of each view is worked out again and carries it.
        const inv = S.invoices.filter((i: any) => i.status === 'active' && (i.items || []).length === 1).pop();
        inv.items[0].amount = 4321; inv.taxableValue = 4321;
        await w.saveState();
        const lines2 = w.dvRows('invoice_lines');
        return { same, threw, touched, rebuilt: lines2 !== lines, prodRebuilt: w.dvRows('production_days') !== prod2, kept: w.dvRows('invoice_lines') === lines2,
          taxable: lines2.find((x: any) => x.invoice_id === inv.id).taxable, before: lines.find((x: any) => x.invoice_id === inv.id).taxable };
      });
      expect(r.same).toBe(true);
      expect(r.threw).toBe(true);
      expect(r.touched).toEqual({ lines: true, prod: false, stock: true });
      expect([r.rebuilt, r.prodRebuilt, r.kept]).toEqual([true, true, true]);
      expect(r.taxable).toBe(4321);
      expect(r.before).not.toBe(4321);
    });

    test('dvRows filters, dvSum groups with nulls left out and counted, dvCols copies; a name that is not there throws', async ({ page }) => {
      await loadAppWithState(page, p226Book());
      const r = await page.evaluate(() => {
        const w = window as any, all = w.dvRows('production_days');
        const byObj = w.dvRows('production_days', { line: 'barrel' }), byFn = w.dvRows('production_days', (x: any) => x.line === 'barrel');
        const g = w.dvSum('production_days', 'line', { kg: 'sum', efficiency: 'avg', earned: 'max', rounds: 'count', date: 'min' });
        const manual = w.PROD_LINES.slice().sort().map((l: string) => {
          const rs = all.filter((x: any) => x.line === l), k = rs.filter((x: any) => x.kg != null), e = rs.filter((x: any) => x.efficiency != null), m = rs.filter((x: any) => x.earned != null);
          return { line: l, kg: k.length ? k.reduce((t: number, x: any) => t + x.kg, 0) : null, efficiency: e.length ? e.reduce((t: number, x: any) => t + x.efficiency, 0) / e.length : null,
            earned: m.length ? Math.max.apply(null, m.map((x: any) => x.earned)) : null, rounds: rs.filter((x: any) => x.rounds != null).length,
            date: rs.map((x: any) => x.date).sort()[0], n: rs.length,
            nulls: { kg: rs.length - k.length, efficiency: rs.length - e.length, earned: rs.length - m.length, rounds: rs.filter((x: any) => x.rounds == null).length, date: 0 } };
        });
        const two = w.dvSum('invoice_lines', ['month', 'client_id'], { taxable_net: 'sum' });
        const one = w.dvSum('invoice_lines', null, { taxable_net: 'sum', gauge: 'count' });
        const lines = w.dvRows('invoice_lines');
        const empty = w.dvSum('production_days', null, { kg: 'sum', kg_est: 'count' }, () => false);
        const throws = ['dvRows("nope")', 'dvCols("nope")', 'dvSum("invoices", "nope", {})', 'dvSum("invoices", null, { state: "sum" })', 'dvSum("invoices", "state", { state: "count" })',
          'dvRows("invoices", { nope: 1 })', 'dvSum("invoices", null, { taxable: "median" })'].map((s) => { try { (0, eval)(s); return false; } catch { return true; } });
        const cols = w.dvCols('invoices');
        cols[0].name = 'changed';
        return { barrel: [byObj.length, byFn.length, byObj.every((x: any) => x.line === 'barrel')], inList: w.dvRows('production_days', { line: ['vat-a1', 'vat-a2'] }).length,
          sizes: w.PROD_LINES.map((l: string) => all.filter((x: any) => x.line === l).length), g, manual,
          two: { groups: two.length, total: w.gstRound(two.reduce((t: number, x: any) => t + x.taxable_net, 0)), sorted: two.every((x: any, i: number) => !i || two[i - 1].month < x.month || (two[i - 1].month === x.month && two[i - 1].client_id < x.client_id)) },
          one, total: w.gstRound(lines.reduce((t: number, x: any) => t + x.taxable_net, 0)), gauges: lines.filter((x: any) => x.gauge != null).length, lineCount: lines.length,
          empty, throws, copied: w.dvCols('invoices')[0].name };
      });
      expect(r.barrel[0]).toBe(r.barrel[1]);
      expect(r.barrel[2]).toBe(true);
      expect(r.inList).toBe(r.sizes[0] + r.sizes[1]);
      expect(r.g).toEqual(r.manual);
      // Something is left out of each measure, and counted.
      expect(r.g.some((x: any) => x.nulls.kg > 0 && x.nulls.efficiency > 0 && x.nulls.rounds > 0)).toBe(true);
      expect(r.two.total).toBe(r.total);
      expect(r.two.sorted).toBe(true);
      expect(r.one).toEqual([{ taxable_net: r.total, gauge: r.gauges, n: r.lineCount, nulls: { taxable_net: 0, gauge: r.lineCount - r.gauges } }]);
      // Over nothing: one group, a sum unknown (null), a count 0.
      expect(r.empty).toEqual([{ kg: null, kg_est: 0, n: 0, nulls: { kg: 0, kg_est: 0 } }]);
      expect(r.throws).toEqual([true, true, true, true, true, true, true]);
      expect(r.copied).toBe('id');
    });

    test('a credit note takes rupees off a line, never kilos: a piece line with no weight on record weighs what it billed', async ({ page }) => {
      // A piece client's line with no part weight and no Items Master row is weighed by its amount over the client's ₹/kg
      // (lineWeightKg's rate route). Stats nets each line by its credit notes, and the netted amount had been weighed: a 2% rebate
      // took 2% of those kilos off the plant's tonnage (the data layer's builder found it, 16 Oct 2026).
      const s: any = p226Book(), date = dayOff(-6);
      s.clients.push({ id: 77, name: 'P226 PIECE WORKS', billingMode: 'piece', gstType: 'intra', gstin: '', isActive: true,
        rates: [{ ratePerKg: 5, effectiveFrom: '2020-04-01' }], itemRates: [] });
      s.invoices.push({ id: 'INV-P226-PC', invoiceNumber: '09227', displayNumber: 'SEP/TEST-09227', date, status: 'active', invoiceState: 'dispatched', clientId: 77,
        clientName: 'P226 PIECE WORKS', clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
        items: [{ partNumber: 'P226-NOWEIGHT', desc: 'BRACKET', hsn: '998873', unit: 'NOS', qty: 500, rate: 2, amount: 1000, nosQty: 500 }],
        taxableValue: 1000, cgstPer: 9, cgstAmt: 90, sgstPer: 9, sgstAmt: 90, igstPer: 0, igstAmt: 0, grandTotal: 1180, amountInWords: '', challanNo: '', challanDate: date,
        poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: new Date(date + 'T10:00:00').getTime() });
      s.creditNotes.push({ id: 'CN-P226-PC', cnNumber: '010', displayNumber: 'CN/010/26-27', kind: 'rebate', reason: 'discount', date, clientId: 77, clientName: 'P226 PIECE WORKS',
        invoiceIds: ['INV-P226-PC'], invoiceNumbers: ['SEP/TEST-09227'], invoiceDates: [date], discountPct: 2, batchTaxable: 1000, taxableValue: 20,
        cgstAmt: 1.8, sgstAmt: 1.8, igstAmt: 0, grandTotal: 23.6, status: 'active', gstType: 'intra', periodFrom: date, periodTo: date });
      await loadAppWithState(page, s);
      const r = await page.evaluate(() => {
        const w = window as any, net = w.statsInvoices().find((i: any) => i.id === 'INV-P226-PC');
        const line = w.dvRows('invoice_lines', { invoice_id: 'INV-P226-PC' })[0];
        return { netAmount: net.items[0].amount, weighed: w.weighLines([net]).kg, view: line.kg, src: line.kg_src, taxableNet: line.taxable_net };
      });
      // The rupees come down by the note's 2%; the kilos stay 1,000 ÷ ₹5 = 200.
      expect(r.netAmount).toBe(980);
      expect(r.taxableNet).toBe(980);
      expect(r.weighed).toBeCloseTo(200, 6);
      expect(r.view).toBeCloseTo(200, 6);
      expect(r.src).toBe('rate');
    });

    test('a power cut’s key is the report typed first, whichever id sorts first: the register’s log and the pickling message are one cut', async ({ page }) => {
      // The hub's key for a cut (§6) is one of its reports' ids. A report typed later can carry an id that sorts first (an imported
      // file's own ids), so the key is the report typed first, and a report joining it later never moves it.
      const s: any = p226Book(), d = dayOff(-3);
      // The day's other cuts are left out, so the two reports are the day's one cut.
      s.production.entries = s.production.entries.filter((e: any) => !(e.kind === 'downtime' && e.date === d)).concat([
        { id: 'zz-first', kind: 'downtime', date: d, time: '10:40', to: '11:05', downtime: { cause: 'power' }, basis: 'register', src: 'hand', at: 1000 },
        { id: 'aa-later', kind: 'downtime', date: d, time: '10:42', to: '11:05', downtime: { cause: 'power' }, basis: 'pickling', src: 'import', at: 9000 },
      ]);
      await loadAppWithState(page, s);
      const cuts = await page.evaluate((day) => (window as any).dvRows('power_cuts', { date: day }), d);
      expect(cuts.length, 'the two reports are one cut').toBe(1);
      expect(cuts[0].id).toBe('zz-first');
    });

    test('the market’s views are empty until S.market exists (U2), then read it: this year’s figures, a blank one null', async ({ page }) => {
      const s: any = p226Book(), today = todayIso(), y = dayOff(-1);
      const m1 = today.slice(0, 7), m0 = (() => { const d = new Date(today.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
      s.market = {
        tata: { [m1]: { released: today, url: 'https://example.com/release', at: 1, by: 'Owner', cvTotal: { now: 34567, ly: 32000 }, cvDomestic: { now: 30001, ly: null },
          cvExport: { now: 4566 }, hcv: { now: '12050', ly: 11000 } }, [m0]: { released: '', cvTotal: { now: null, ly: 3 } } },
        weather: { [today]: { tMax: 31.4, tMin: 22, rain: 4.2, thunder: true, symbol: 'rainshowersandthunder_day', at: 1 }, [y]: { tMax: 33, tMin: 24, rain: 0, thunder: false, at: 1 } },
      };
      await loadAppWithState(page, s);
      const r = await page.evaluate(() => { const w = window as any; return { tata: w.dvRows('market_tata'), weather: w.dvRows('weather_days') }; });
      expect(r.tata).toEqual([
        { month: m0, cv_total: null, cv_domestic: null, cv_export: null, hcv: null, released_on: null },
        { month: m1, cv_total: 34567, cv_domestic: 30001, cv_export: 4566, hcv: 12050, released_on: today }]);
      expect(r.weather).toEqual([
        { date: y, t_max: 33, t_min: 24, rain_mm: 0, thunder: false },
        { date: today, t_max: 31.4, t_min: 22, rain_mm: 4.2, thunder: true }]);
    });
  });
}
