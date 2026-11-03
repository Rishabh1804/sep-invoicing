import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P256: the final confirmation screen over the new messages (owner, 31 Oct 2026: "the parser should be able to sort every new
// message and then bring up a final confirmation screen up for me"; production "Always" waits for a tick, "but repetitive work
// must be designed better"; a roll that disagrees with marks typed by hand asks hand by hand). Every message grouped by the day
// it reports and by kind in the floor's order; rolls, stock and cash ticked by their confidence, production waiting, with one
// tick for a day's group and one for every message like it; what the book holds already left out; the hand-by-hand override
// here and in the ordinary paste review; the batch saved through each reader's own save, as the four paste boxes save it; and
// the summary. Made-up names, clients and figures.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
// Two working days in a row in the last fortnight, neither a Saturday nor a Sunday.
const D1 = (() => { let d = shift(todayIso(), -6); while ([0, 5, 6].includes(new Date(d + 'T00:00:00').getDay())) d = shift(d, -1); return d; })();
const D2 = shift(D1, 1);
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const short = (d: string) => new Date(d + 'T00:00:00').getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][new Date(d + 'T00:00:00').getMonth()];
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'pickling-vat', onFloor: true, active: true },
  { id: 4, name: 'Echo Tudu', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }];
const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }];

const IN = (d: string) => `${dmy(d)}/ IN TIME
------8:30 AM------
----VAT A 1----
01) ALFA
02) ECHO
----VAT A 2----
03) BRAVO
----PICKLING 1&2----
04) CHARLIE`;
const OUT = (d: string) => `${dmy(d)}/ OUT TIME
-------5:00 PM------
01) ALFA
02) CHARLIE
-------7:00 PM----
03) ECHO
04) BRAVO`;
const LOAD1 = `NOVA CLAMPS\nCLAMP133×83(35×6)-774 nos\nPickling Time 9:00AM`;
const LOAD2 = `DURGA AUTO\n0740- 280 nos\nPickling time 10:30am`;
const LOAD3 = `NOVA CLAMPS\nCLAMP133×83(35×6)-500 nos\nPickling Time 9:15AM`;
const STOCK = (d: string) => `Camical use camical stock ${dmy(d)}/\n\n1) A SOLLT 48-12=36 LTR\n2) HCL 400-20=380 LTR`;
const CASH = `HCL 250\nJAR 150\nSABUN 320\nKILO ROMEO 700\n----------------\nONLY 1420`;
const wa = (d: string, at: string, who: string, text: string) => `${dmy(d)}, ${at} - ${who}: ${text}`;
const CHAT = [
  wa(D1, '7:50 am', 'Supervisor', IN(D1)),
  wa(D1, '9:40 am', 'Pickler', LOAD1),
  wa(D1, '11:05 am', 'Pickler', LOAD2),
  wa(D1, '5:20 pm', 'Supervisor', OUT(D1)),
  wa(D1, '6:00 pm', 'Supervisor', STOCK(D1)),
  wa(D2, '7:50 am', 'Supervisor', IN(D2)),
  wa(D2, '9:40 am', 'Pickler', LOAD3),
  wa(D2, '12:00 pm', 'Supervisor', CASH),
  wa(D2, '3:00 pm', 'Owner', 'ok')].join('\n');

function book(extra?: any): SepState {
  return { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...(extra || {}) } as unknown as SepState;
}
/* The chat taken in as the zip reader takes it in, then the screen opened over the import. */
async function ingestAndOpen(page: Page, text = CHAT) {
  await ev(page, `(function(){ msgIngest(relaySplit(${JSON.stringify(text)}), 'zip', 'IMP-T'); saveState(); mcOpen({ importId: 'IMP-T' }); })()`);
  await expect(page.locator('[data-mc]')).toBeVisible();
}
const box = (page: Page, kind: string, day: string) => page.locator(`[data-mc-day="${day}"] [data-mc-row][data-kind="${kind}"] input.inv-check`);
const groupTick = (page: Page, day: string, kind: string) => page.locator(`[data-action="invMsgMcGroup"][data-key="g:${day}:${kind}"]`);

/* What a save wrote, without its ids and clocks: the two routes must write the same. */
const PROJECT = `(function(){
  var att = {}; Object.keys(S.attendance || {}).sort().forEach(function(d) {
    var r = S.attendance[d], m = {};
    Object.keys(r.marks || {}).sort().forEach(function(id) { var k = r.marks[id]; m[id] = [k.st, k.area, k.hours, k.ot, k.inMin, k.outMin, k.src || ''].join('|'); });
    att[d] = { marks: m, extra: (r.extra || []).map(function(x) { return [x.kind, x.area, x.hours, x.from || '', x.to || '', (x.crew || []).join(',')].join('|'); }).sort() };
  });
  var items = {}; (S.stock.items || []).forEach(function(i) { items[i.id] = i.name + '/' + i.unit; });
  return {
    att: att,
    rolls: (S.relayPastes || []).map(function(p) { return [p.hash, p.kind, p.date, (p.days || []).join(','), p.sentBy, p.sentOn, p.sentAt].join('|'); }).sort(),
    prod: (S.production.entries || []).map(function(e) { return [e.kind, e.date, e.time, e.clientId, e.part, e.qty, e.unit, e.basis, e.sentBy, e.raw].join('|'); }).sort(),
    prodPastes: (S.production.pastes || []).map(function(p) { return [p.hash, p.kind, p.day, p.sentBy, p.sentOn].join('|'); }).sort(),
    stock: (S.stock.entries || []).map(function(e) { return [items[e.itemId], e.kind, e.qty, e.date, e.from || '', e.days || '', e.sentBy].join('|'); }).sort(),
    stockItems: Object.keys(items).map(function(k) { return items[k]; }).sort(),
    cash: (S.cashOut || []).map(function(e) { return [e.date, e.what, e.amount, e.cat, e.week].join('|'); }).sort()
  };
})()`;

test.describe('P256: the confirmation screen', () => {
  test('grouped by day and by kind in the floor’s order; rolls, stock and cash ticked by their confidence, production waiting', async ({ page }) => {
    await loadAppWithState(page, book());
    await ingestAndOpen(page);
    // Two days, in order, each its kinds in the floor's order.
    expect(await page.locator('[data-mc-day]').evaluateAll(els => els.map(e => e.getAttribute('data-mc-day')))).toEqual([D1, D2]);
    expect(await page.locator(`[data-mc-day="${D1}"] [data-mc-group]`).evaluateAll(els => els.map(e => e.getAttribute('data-kind')))).toEqual(['in', 'out', 'pickling', 'stock']);
    expect(await page.locator(`[data-mc-day="${D2}"] [data-mc-group]`).evaluateAll(els => els.map(e => e.getAttribute('data-kind')))).toEqual(['in', 'pickling', 'cash']);
    // What nothing here saves (a message no reader takes, a weekly payment summary) is one panel shut at the foot.
    await expect(page.locator('[data-mc-rest]')).toContainText('Nothing to save');
    await expect(page.locator('[data-mc-rest] [data-mc-row]')).toHaveCount(0);
    // Each roll says what it would write.
    await expect(page.locator(`[data-mc-day="${D1}"] [data-mc-row][data-kind="in"] [data-mc-what]`)).toContainText('4 present');
    // The default ticks: a roll, stock or cash message at 90% or more with no red question; production never.
    const recs: any[] = await ev(page, `msgStore().map(function(r){ return { id: r.id, kind: r.kind, conf: _mc.read[r.id].conf, red: _mc.read[r.id].red.length, tick: !!_mc.tick[r.id] }; })`) as any[];
    for (const r of recs) {
      const want = ['in', 'out', 'stock', 'cash'].includes(r.kind) && r.conf >= 0.9 && !r.red;
      expect([r.kind, r.tick]).toEqual([r.kind, want]);
    }
    expect(recs.filter(r => r.kind === 'pickling').every(r => !r.tick)).toBe(true);
    await expect(box(page, 'in', D1)).toBeChecked();
    // Production is a summary row per day: how many, whose, and how much, opening to its messages.
    const sum = page.locator(`[data-mc-sum="g:${D1}:pickling"]`);
    await expect(sum).toContainText('Pickling loads · 2');
    await expect(sum).toContainText('NOVA CLAMPS');
    await expect(sum).toContainText('DURGA AUTO');
    await expect(sum).toContainText('1,054 NOS');
    await expect(sum).toContainText('0 of 2 ticked');
    await expect(page.locator(`[data-mc-day="${D1}"] [data-mc-row][data-kind="pickling"]`)).toHaveCount(0);
    await sum.locator('button.inv-row-main').click();
    await expect(page.locator(`[data-mc-day="${D1}"] [data-mc-row][data-kind="pickling"]`)).toHaveCount(2);
    // The message nobody's reader takes offers Not a report.
    await page.locator('[data-mc-sum="rest"] button.inv-row-main').click();
    await expect(page.locator('[data-mc-row][data-kind="other"] [data-action="invMsgMcNotReport"]')).toBeVisible();
    // The foot counts.
    const ticked = recs.filter(r => r.tick).length;
    await expect(page.locator('[data-mc-count]')).toContainText(`${ticked} of 8 ticked`);
    // Nothing there to save is not counted as something to look at.
    await expect(page.locator('[data-mc-count]')).not.toContainText('to look at');
  });

  test('production ticked a day’s group at a time, and every message like one', async ({ page }) => {
    await loadAppWithState(page, book());
    await ingestAndOpen(page);
    await expect(groupTick(page, D1, 'pickling')).toHaveText(`Tick the 2 pickling load messages of ${short(D1)}`);
    await groupTick(page, D1, 'pickling').click();
    await expect(box(page, 'pickling', D1)).toHaveCount(2);
    await expect(box(page, 'pickling', D1).nth(0)).toBeChecked();
    await expect(box(page, 'pickling', D1).nth(1)).toBeChecked();
    await expect(page.locator(`[data-mc-sum="g:${D1}:pickling"]`)).toContainText('2 of 2 ticked');
    // The other day's load waits until it is ticked too.
    expect(await ev(page, `_mc.list.filter(function(r){ return r.kind === 'pickling' && _mc.tick[r.id]; }).length`)).toBe(2);
    await groupTick(page, D1, 'pickling').click();
    expect(await ev(page, `_mc.list.filter(function(r){ return r.kind === 'pickling' && _mc.tick[r.id]; }).length`)).toBe(0);
    // "Like this one": the same sender, the same kind, no red question, on every day.
    await expect(page.locator(`[data-mc-sum="g:${D1}:pickling"] button.inv-row-main`)).toHaveAttribute('aria-expanded', 'true');
    await page.locator(`[data-mc-day="${D1}"] [data-mc-row][data-kind="pickling"] [data-action="invMsgMcLike"]`).first().click();
    expect(await ev(page, `_mc.list.filter(function(r){ return r.kind === 'pickling' && _mc.tick[r.id]; }).length`)).toBe(3);
    // Once anything is ticked, leaving asks first.
    await page.locator('[data-mc] .inv-dialog-close').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('[data-mc]')).toBeVisible();
  });

  test('a message the book holds already is left out, and said', async ({ page }) => {
    await loadAppWithState(page, book());
    // The in-time roll of the first day was saved through the paste box before the export came.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(wa(D1, '7:50 am', 'Supervisor', IN(D1)));
    await page.locator('[data-action="invRelayRead"]').click();
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    await ingestAndOpen(page);
    await expect(page.locator('#mcHeld')).toContainText('1 message is in the book already');
    await expect(page.locator(`[data-mc-day="${D1}"] [data-mc-row][data-kind="in"]`)).toHaveCount(0);
    await page.locator('#mcHeld [data-action="invMsgMcFold"]').click();
    await expect(page.locator('[data-mc-held]')).toContainText('Saved before');
  });

  test('marks typed by hand: kept by default, the message used hand by hand or for all, the old marks logged', async ({ page }) => {
    const typed = { [D2]: { marks: { 2: { st: 'P', area: 'barrel', hours: 8, ot: 0 }, 4: { st: 'A', ot: 0, hours: 0, area: 'flex' } }, extra: [], note: '' } };
    await loadAppWithState(page, book({ attendance: JSON.parse(JSON.stringify(typed)) }));
    await ingestAndOpen(page, wa(D2, '7:50 am', 'Supervisor', IN(D2)));
    await expect(page.locator('#mcHand [data-mc-hand]')).toHaveCount(2);
    await expect(page.locator('#relayHandNote')).toContainText('2 marks typed by hand differ');
    // Keep is the default; use the message for one hand.
    await expect(page.locator(`[data-mc-hand="${D2}|2"]`)).toHaveAttribute('data-use', '0');
    await page.locator(`[data-action="invMsgMcHand"][data-iso="${D2}"][data-id="2"][data-use="1"]`).click();
    await expect(page.locator(`[data-mc-hand="${D2}|2"]`)).toHaveAttribute('data-use', '1');
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles')).toBeVisible();
    let st: any = await readStoredState(page);
    expect(st.attendance[D2].marks[2]).toMatchObject({ st: 'P', area: 'vat-a2', src: 'relay' });
    expect(st.attendance[D2].marks[4]).toMatchObject({ st: 'A' });
    expect(st.attendance[D2].marks[4].src).toBeUndefined();
    const log = st.attendanceDeletes.find((x: any) => x.how === 'override');
    expect(log).toMatchObject({ iso: D2, marks: 1 });
    expect(log.day.marks[2]).toMatchObject({ st: 'P', area: 'barrel' });
    await expect(page.locator(`[data-mc-done-day="${D2}"]`)).toContainText('1 over what was typed');
    await page.locator('[data-action="invMsgMcDone"]').click();
    await expect(page.locator('[data-mc]')).toHaveCount(0);

    // The ordinary paste review asks the same, and "for all" takes the message for every hand.
    await loadAppWithState(page, book({ attendance: JSON.parse(JSON.stringify(typed)) }));
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(wa(D2, '7:50 am', 'Supervisor', IN(D2)));
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('[data-relay-hand]')).toHaveCount(2);
    await page.locator('[data-action="invRelayHandAll"]').click();
    await expect(page.locator(`[data-relay-hand="${D2}|4"]`)).toHaveAttribute('data-use', '1');
    await page.locator('[data-action="invRelaySave"]').click();
    st = await readStoredState(page);
    expect(st.attendance[D2].marks[2]).toMatchObject({ area: 'vat-a2', src: 'relay' });
    expect(st.attendance[D2].marks[4]).toMatchObject({ st: 'P', area: 'vat-a1', src: 'relay' });
    expect(st.attendanceDeletes.find((x: any) => x.how === 'override').marks).toBe(2);

    // Saved without a choice, the marks typed by hand stay as typed.
    await loadAppWithState(page, book({ attendance: JSON.parse(JSON.stringify(typed)) }));
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(wa(D2, '7:50 am', 'Supervisor', IN(D2)));
    await page.locator('[data-action="invRelayRead"]').click();
    await page.locator('[data-action="invRelaySave"]').click();
    st = await readStoredState(page);
    expect(st.attendance[D2].marks[2]).toMatchObject({ area: 'barrel' });
    expect(st.attendance[D2].marks[4]).toMatchObject({ st: 'A' });
    expect((st.attendanceDeletes || []).filter((x: any) => x.how === 'override')).toHaveLength(0);
  });

  test('one save writes what the four paste boxes write, marks each message saved, and says what changed', async ({ page }) => {
    await loadAppWithState(page, book());
    await ingestAndOpen(page);
    // Tick everything there is to save: production's groups and the stock.
    await groupTick(page, D1, 'pickling').click();
    await groupTick(page, D2, 'pickling').click();
    for (const k of ['stock', 'cash']) { const b = page.locator(`[data-mc-row][data-kind="${k}"] input.inv-check`); if (!(await b.isChecked())) await b.check(); }
    for (const b of await page.locator('[data-mc-row][data-kind="in"] input.inv-check, [data-mc-row][data-kind="out"] input.inv-check').all()) if (!(await b.isChecked())) await b.check();
    await expect(page.locator('[data-mc-count]')).toContainText('8 of 8 ticked');
    await page.locator('[data-action="invMsgMcSave"]').click();
    await expect(page.locator('#mcDoneTiles [data-tile="saved"]')).toContainText('8');
    await expect(page.locator('#mcDoneLeft')).toContainText('Not read');
    await expect(page.locator(`[data-mc-done-day="${D1}"]`)).toContainText('2 production entries');
    await expect(page.locator(`[data-mc-done-day="${D2}"]`)).toContainText('4 cash lines');
    const viaScreen: any = await ev(page, PROJECT);
    const st: any = await readStoredState(page);
    const byKind = (k: string) => st.messages.filter((m: any) => m.kind === k);
    expect(st.messages.filter((m: any) => m.status === 'saved')).toHaveLength(8);
    expect(byKind('other')[0].status).toBe('notread');
    expect(byKind('in').every((m: any) => m.saved[0].store === 'relayPastes')).toBe(true);
    expect(byKind('pickling').every((m: any) => m.saved[0].store === 'production.pastes')).toBe(true);
    expect(byKind('stock')[0].saved[0].store).toBe('stock.pastes');
    expect(byKind('cash')[0].saved[0].store).toBe('cashPastes');
    // Saved again, nothing counts twice: every message is left out.
    await page.locator('[data-action="invMsgMcDone"]').click();
    await ev(page, `mcOpen({ importId: 'IMP-T' })`);
    await expect(page.locator('#mcHeld')).toContainText('8 messages are in the book already');

    // The same messages through the paste boxes, on a fresh book.
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill([wa(D1, '7:50 am', 'Supervisor', IN(D1)), wa(D1, '5:20 pm', 'Supervisor', OUT(D1)), wa(D2, '7:50 am', 'Supervisor', IN(D2))].join('\n'));
    await page.locator('[data-action="invRelayRead"]').click();
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    await ev(page, `prodOpenPaste(${JSON.stringify([wa(D1, '9:40 am', 'Pickler', LOAD1), wa(D1, '11:05 am', 'Pickler', LOAD2), wa(D2, '9:40 am', 'Pickler', LOAD3)].join('\n'))})`);
    await page.locator('[data-action="invProdSaveReview"]').click();
    await ev(page, `relayOpenStock(${JSON.stringify(wa(D1, '6:00 pm', 'Supervisor', STOCK(D1)))})`);
    await page.locator('[data-action="invStockSavePaste"]').click();
    await ev(page, `cashReviewOpen(${JSON.stringify(CASH)}, '${D2}')`);
    await page.locator('[data-action="invPayCashSave"]').click();
    await expect(page.locator('[data-cash-review]')).toHaveCount(0);
    const viaBoxes: any = await ev(page, PROJECT);
    expect(viaScreen.prod.length).toBe(3);
    expect(viaScreen.cash.length).toBe(4);
    expect(viaScreen).toEqual(viaBoxes);
  });
});
