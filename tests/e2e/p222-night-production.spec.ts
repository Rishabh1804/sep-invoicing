import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P222: the work written under a night block on the out-time roll (owner, 16 Oct 2026: "Parser is not reading night 8 pm to
// 6 am, the production below it is usually what was plated on the night shift"). The roll's heading names both ends; the work
// under it ran from 8 PM to 6 AM on the roll's day, where it had read as ending at 6 AM with no start. A gauge written after
// the count ("2700 NOS 25×6") is the part's. Made-up names.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function dmy(offset = -1): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
const ROSTER = [
  { id: 1, name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Chand', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'Kiran', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
  { id: 5, name: 'Moti', comp: 'monthly', area: 'gate', dayRate: 400, active: true, onFloor: false },
];
const CLIENTS = [{ id: 'C1', name: 'ZETA CLAMPS PVT LTD', billingMode: 'weight', rate: 10, active: true }];
const OUT = () => `${dmy()}/ OUT TIME
------5:00 PM -----
01) MOTI 7:00 PM
-------8:00 PM-------
----VAT A 1----
02) ARUN
03) BALA
EXTRA 3 HOURS
----------------------------
NIGHT 8 PM TO 6 AM
--------------------------------
------VAT A 2------
1) CHAND
2) KIRAN
EXTRA 12 HOURS
------------------------------------
ZETA CLAMP 2700 NOS 25×6
T BKT 1400 NOS`;

test.describe('P222: the night block\'s production', () => {
  test('the work under NIGHT 8 PM TO 6 AM ran 8 PM to 6 AM on the roll\'s day, on the line above it', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: ROSTER, clients: CLIENTS, attendance: {} } as unknown as SepState);
    const r = await g(page, `(function(){ var m = parseProdPaste(${JSON.stringify(OUT())}, prodCtx())[0];
      return { kind: m.kind, date: m.read.date, items: m.read.items.map(function(e){ return [e.date, e.lineHint, e.slot, e.time, e.to, e.clientId || '', e.part, e.gauge, e.qty, e.unit].join('|'); }) }; })()`);
    const d = dmy().split('/');
    const iso = `20${d[2]}-${d[1]}-${d[0]}`;
    expect(r.kind).toBe('roll');
    expect(r.items).toEqual([
      `${iso}|vat-a2|ot|20:00|06:00|C1|CLAMP|25X6|2700|NOS`,
      `${iso}|vat-a2|ot|20:00|06:00||T BKT||1400|NOS`,
    ]);
    // The attendance side reads the same block the same way.
    const ex = await g(page, `(function(){ var rr = parseRelayRoll(${JSON.stringify(OUT())}, relayRoster({}, null), null);
      return Object.values(rr.days)[0].extra.map(function(x){ return [(x.areas || [x.area]).join('+'), x.from, x.to, x.hours].join('|'); }); })()`);
    expect(ex).toContain('vat-a2|20:00|06:00|12');
  });

  test('a gauge written after the count is the part\'s', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as unknown as SepState);
    const r = await g(page, `['CLAMP 2700 NOS 25×6', 'CLAMP(25X6) 2700 NOS', 'OM 3357-500 NOS', 'LINER 120 NOS 2 BAG'].map(function(t){ var x = prodReadItem(t, null); return [x.part, x.gauge, x.qty].join('|'); })`);
    expect(r).toEqual(['CLAMP|25X6|2700', 'CLAMP(25X6)|25X6|2700', 'OM 3357|' + '|500', 'LINER||120']);
  });
});
