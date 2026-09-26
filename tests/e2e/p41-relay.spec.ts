import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P41: the supervisor's in-time and out-time rolls, pasted from WhatsApp and
// read into the Staff tab's day, plus the Home quick actions that reach every
// entry screen. Names and messages here are made up in the shop's own shapes —
// the real rolls and roster never enter this repo (it is public). The parser
// was calibrated separately against the real rolls and their hand decode.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function dmy(offset = -1): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2);
}
function iso(offset = -1): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STAFF = [
  { id: 'W1', name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 'W2', name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 'W3', name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 'W4', name: 'Esha', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 'W5', name: 'Gopal', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
  { id: 'W6', name: 'Hari', comp: 'hourly', area: 'office', hourRate: 50, active: true, onFloor: false },
  { id: 'W7', name: 'Jatin', comp: 'monthly', area: 'gate', dayRate: 500, active: true, onFloor: false },
  { id: 'W8', name: 'Kiran', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
];

const IN = () => `${dmy(0)}, 10:15 am - Supervisor One: ${dmy()}/ in time
----6:00 AM---
----VAT A 1----
1) ARUN
2) BALA
EXTRA 3 HOURS
MEHTA CLAMP 1000 NOS
----8:30 AM---
---VAT A 1----
1) ARUN
2) CHAND
EXTRA 8 HOURS
---berral & pickling---
3) BALA
4) GOPALL
---office & gate keeper
5) HARI
6) JATIN
--monthly absent---
7) ESHA
---weekly absent---
8) ZORO`;

const OUT = () => `${dmy()}/ out time
----5:00 pm---
1) CHAND
2) GOPAL
----8:00 PM---
VAT A 1
3) ARUN
4) BALA
EXTRA 6 HOURS`;

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...extra } as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}

test.describe('P41: attendance rolls from WhatsApp', () => {
  test('the parser reads slots, lines, absentees, spellings and EXTRA tags', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){ var r = parseRelayRoll(relaySplit(${JSON.stringify(IN())})[0].text, S.staff);
      var d = r.days['${iso()}'];
      var m = {}; Object.keys(d.people).forEach(function(id){ var w = staffById(id); m[w.name] = relayPersonMark(d.people[id], w, null); });
      return { kind: r.kind, date: r.date, m: m, extra: d.extra, issues: r.issues.map(function(i){ return i.tone + ':' + i.text; }), notes: d.notes }; })()`) as any;
    expect(r.kind).toBe('in');
    expect(r.date).toBe(iso());
    // A 6 AM start pays 11 floored hours; a monthly hand's OT is the hours over 8.
    expect(r.m.Arun).toMatchObject({ st: 'P', area: 'vat-a1', hours: 11, ot: 3 });
    expect(r.m.Bala).toMatchObject({ st: 'P', area: 'barrel', hours: 11, ot: 0 });
    expect(r.m.Chand).toMatchObject({ area: 'vat-a1', hours: 8 });
    // One letter off, read as the roster name and flagged.
    expect(r.m.Gopal).toMatchObject({ area: 'barrel', hours: 8 });
    expect(r.issues).toContain('amber:"GOPALL" read as Gopal.');
    // The office and the gate share a header; each stands at his own post.
    expect(r.m.Hari.area).toBe('office');
    expect(r.m.Jatin).toMatchObject({ area: 'gate', hours: 12, ot: 0 });
    expect(r.m.Esha).toMatchObject({ st: 'A', area: 'flex', hours: 0 });
    expect(r.issues.some((i: string) => i.startsWith('red:"ZORO"'))).toBe(true);
    expect(r.extra).toEqual([
      { kind: 'block', areas: ['vat-a1'], crew: ['Arun', 'Bala'], hours: 3, from: '06:00', to: '08:30' },
      { kind: 'coverage', area: 'vat-a1', hours: 8 },
    ]);
    expect(r.notes).toContain('MEHTA CLAMP 1000 NOS');

    // Times the relay writes in its own ways.
    const t = await g(page, `[relayTimes('6-8 PM').map(function(x){return x.min;}), relayOutMin(relayTimes('12 AM')[0]), relayOutMin(relayTimes('6 AM')[0]), relayTimes('5: PM 6 AM').map(function(x){return x.min;}), relayTimes('188 CD 2400 NOS').length]`);
    expect(t).toEqual([[360, 1200], 1440, 1800, [1020, 360], 0]);
  });

  test('in and out rolls pasted together: checked, a name placed once, saved, and a repeat refused', async ({ page }) => {
    await load(page);
    await paste(page, IN() + '\n' + OUT());
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('1');
    await page.locator('[data-relay-map="ZORO"]').selectOption('W8');
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('0');
    const arun = page.locator('.inv-rl-row').filter({ hasText: 'Arun' });
    await expect(arun).toContainText('6 AM – 8 PM · 14 h · OT 6 h');
    await expect(page.locator('.inv-rl-extra')).toHaveCount(3);
    await page.locator('[data-action="invRelaySave"]').click();

    const s = await readStoredState(page);
    const day = s.attendance[iso()];
    expect(day.marks.W1).toMatchObject({ st: 'P', area: 'vat-a1', hours: 14, ot: 6, src: 'relay' });
    expect(day.marks.W2).toMatchObject({ hours: 14, ot: 0 });
    expect(day.marks.W3).toMatchObject({ hours: 8 });
    expect(day.marks.W8).toMatchObject({ st: 'A', area: 'flex' });
    expect(day.extra).toContainEqual({ kind: 'block', areas: ['vat-a1'], crew: ['W1', 'W2'], hours: 6, from: '17:00', to: '20:00', area: 'vat-a1', src: 'relay' });
    expect(day.extra).toHaveLength(3);
    // The placed spelling is remembered on the worker.
    expect(s.staff.find((w: any) => w.id === 'W8').relayNames).toEqual(['ZORO']);
    expect(s.relayPastes).toHaveLength(2);
    // Saving lands on the day it saved.
    await expect(page.locator('#attDate')).toHaveValue(iso());

    await paste(page, IN());
    await expect(page.locator('.inv-stk-banner-red')).toContainText('already saved');
    await expect(page.locator('[data-action="invRelaySave"]')).toBeDisabled();
  });

  test('the in-time roll alone reads out at 5 PM; the out-time roll then updates it', async ({ page }) => {
    await load(page);
    await paste(page, IN());
    await expect(page.locator('.inv-stk-issue-info')).toContainText('No out-time roll yet');
    await page.locator('[data-action="invRelaySave"]').click();
    expect((await readStoredState(page)).attendance[iso()].marks.W1).toMatchObject({ hours: 11, ot: 3 });

    await paste(page, OUT());
    const arun = page.locator('.inv-rl-row').filter({ hasText: 'Arun' });
    await expect(arun).toContainText('Updated');
    await expect(arun).toContainText('14 h');
    await page.locator('[data-action="invRelaySave"]').click();
    const day = (await readStoredState(page)).attendance[iso()];
    expect(day.marks.W1).toMatchObject({ hours: 14, ot: 6 });
    // The in-time EXTRA rows were not added a second time.
    expect(day.extra.filter((e: any) => e.kind === 'coverage')).toHaveLength(1);
  });

  test('a mark entered by hand is kept, and says so', async ({ page }) => {
    await load(page, { attendance: { [iso()]: { marks: { W3: { st: 'H', ot: 0, hours: 4, area: 'vat-a2' } }, extra: [], note: '' } } } as any);
    await paste(page, IN());
    const chand = page.locator('.inv-rl-row').filter({ hasText: 'Chand' });
    await expect(chand).toContainText('Kept');
    await expect(chand).toContainText('Entered by hand as Half day');
    await page.locator('[data-action="invRelaySave"]').click();
    expect((await readStoredState(page)).attendance[iso()].marks.W3).toEqual({ st: 'H', ot: 0, hours: 4, area: 'vat-a2' });
  });

  test('Home quick actions open each screen on the job', async ({ page }) => {
    await load(page);
    await page.locator('[data-action="invHomeQuick"][data-go="stock"]').click();
    await expect(page.locator('#pageStock.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-action="invStockSaveManual"]')).toBeVisible();

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="attendance"]').click();
    await expect(page.locator('#pageStaff.inv-page-active')).toBeVisible();
    await expect(page.locator('#attDate')).toHaveValue(todayIso());

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="paste"]').click();
    await expect(page.locator('#relayPasteText')).toBeVisible();

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="task"]').click();
    await expect(page.locator('#todoNew')).toBeFocused();

    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="challan"]').click();
    await expect(page.locator('#pageIM.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-form="challan"]').first()).toBeVisible();
  });

  test('a stock message pasted in the same box goes to the Stock check', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="paste"]').click();
    await page.locator('#relayPasteText').fill(`[${dmy(0)}, 2:05 pm] Supervisor One: Chemical use chemical stock\n${dmy(-6)}/-${dmy(0)}/\n\n1) Q558 NIL\n\n2) MONICOL 6-1=5 KG`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#pageStock.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeVisible();
  });
});
