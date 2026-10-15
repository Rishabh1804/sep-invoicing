import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P221: where an overtime block's crew stood, as the rolls of 9–15 Oct 2026 write them (owner, 15 Oct 2026: the attendance
// parser "misreads area assignment in overtime or if 2 areas have + sign between them"). A block headed by a time alone takes
// its crew's lines; the gate keeper's standing 7 PM is never the block's; one day's correction under a plain line heading is
// that day's; two lines joined by + or & are both; a date written with spaces is the date. Made-up names.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function iso(offset = -1): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dmy(offset = -1, sep = '/'): string {
  const [y, m, d] = iso(offset).split('-');
  return `${d}${sep}${m}${sep}${y.slice(2)}`;
}
const ROSTER = [
  { id: 1, name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Chand', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'Kiran', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
  { id: 5, name: 'Moti', comp: 'monthly', area: 'gate', dayRate: 400, active: true, onFloor: false },
];
async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: ROSTER, attendance: {} } as unknown as SepState);
}
async function pasteAndSave(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
  await page.locator('[data-action="invRelaySave"]').click();
  await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
}
const IN = () => `${dmy()}/ in time
----8:30 AM---
---VAT A 1----
1) ARUN
---VAT A 2----
2) CHAND
--berral & pickling--
3) BALA
---pickling 1&2---
4) KIRAN
---office & gate---
5) MOTI 7:00 AM`;

test.describe('P221: overtime blocks and the lines they ran on', () => {
  test('two lines joined by + or &, and a bare VAT number', async ({ page }) => {
    await load(page);
    const r = await g(page, `['VAT 1+2', 'V A 1&2', 'VAT A1 + VAT A2', 'BERRAL + V A 2', 'VAT 2', 'VAT 1 &', 'PICKLING 1+2', 'VAT A 2 & PICKLING'].map(function(h){ return relayHeaderAreas(h).join('+'); })`);
    expect(r).toEqual(['vat-a1+vat-a2', 'vat-a1+vat-a2', 'vat-a1+vat-a2', 'barrel+vat-a2', 'vat-a2', 'vat-a1', 'pickling-vat', 'vat-a2']);
  });

  test('a block headed by a time alone ran where its crew stood; the gate keeper\'s 7 PM is not the block', async ({ page }) => {
    await load(page);
    await pasteAndSave(page, IN());
    await pasteAndSave(page, `${dmy()}/ OUT TIME
-----5:00 PM---
1) BALA
2) KIRAN
----8:00 PM-----
3) ARUN
4) CHAND
EXTRA 6 HOURS
5) MOTI 7:00 PM`);
    const blocks = (await readStoredState(page)).attendance[iso()].extra.filter((x: any) => x.kind === 'block');
    expect(blocks.map((x: any) => [x.areas.join('+'), x.from, x.to, x.hours, x.crew.join(',')])).toEqual([['vat-a1+vat-a2', '17:00', '20:00', 6, '1,3']]);
    // Written beside the tag, the gate keeper's standing hours made him the whole crew of a block to 7 PM.
    const r = await g(page, `(function(){ var t = ${JSON.stringify(`${dmy()}/ OUT TIME\n1) ARUN 6:00 PM\n2) CHAND 6:00 PM\n3) MOTI 7:00 PM\nEXTRA 2 HOURS`)};
      var d = parseRelayRoll(t, relayRoster({}), null).days['${iso()}']; return d.extra.map(function(x){ return [x.to, x.crew.join(',')]; }); })()`);
    expect(r).toEqual([['18:00', 'Arun,Chand']]);
  });

  test('one day\'s correction under a plain heading is that day\'s; a date with spaces is the date', async ({ page }) => {
    await load(page);
    await g(page, `relayLearnData().heads[relayLearnKey('VAT A1', 'out 20:00')] = { areas: ['vat-a1', 'vat-a2', 'pickling-vat'], was: ['vat-a1'], text: 'VAT A1', slot: 'out 20:00', day: '${iso(-3)}' }; saveState()`);
    const roll = `${dmy()}/ OUT TIME\n------8:00 PM-----\nVAT A1\n1) ARUN\nEXTRA 3 HOURS`;
    const read = () => g(page, `(function(){ var r = parseRelayRoll(${JSON.stringify(roll)}, relayRoster({}), null); return r.days['${iso()}'].extra[0].areas.join('+'); })()`);
    expect(await read()).toBe('vat-a1');
    await g(page, `relayLearnData().heads[relayLearnKey('VAT A1', 'out 20:00')].days = ['${iso(-3)}', '${iso(-2)}']`);
    expect(await read()).toBe('vat-a1+vat-a2+pickling-vat');
    const sunday = await g(page, `parseRelayRoll(${JSON.stringify(`Sunday Duty ${dmy(-1, '/ ')}/ IN TIME 6:00 AM OUT TIME 2:00 PM\n---VAT 1 & -----\n1) ARUN\nEXTRA 8 HOURS`)}, relayRoster({}), '${iso(0)}').date`);
    expect(sunday).toBe(iso());
  });
});
