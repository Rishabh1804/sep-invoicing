import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P43: the roll's spellings of a name. The roster holds full names ("Arun
// Mahato", "Bala - B.K. Das", "Kiran (Kanu Singh)") with NUMERIC ids, as a real
// device does; the supervisor writes "ARUN", "KANU", "CHAAND". A spelling the
// owner places, or a guess saved without correction, is remembered on the
// worker, so the next roll asks nothing. Names are made up (the repo is public).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function when(offset: number): { dmy: string; iso: string } {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
  return { dmy: `${dd}/${mm}/${String(d.getFullYear()).slice(2)}`, iso: `${d.getFullYear()}-${mm}-${dd}` };
}

const STAFF = [
  { id: 1, name: 'Arun Mahato', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bala - B.K. Das', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'Esha', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 5, name: 'Kiran (Kanu Singh)', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
  { id: 6, name: 'Gopal', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
];

const roll = (dmy: string) => `${dmy}/ in time
----8:30 AM---
---VAT A 1----
1) ARUN
2) BALA
3) CHAAND
---VAT A 2---
4) KANU
5) ESHAA
---berral---
6) ZORO`;

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...extra } as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}

test.describe('P43: names on the roll', () => {
  test('full names, first names, brackets, dashes and spelling drift', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){
      var idx = relayRosterIndex(relayRoster({}));
      var m = function(t) { var h = relayMatchName(t.split(/[\\s\\-–,]+/), idx, true); return h ? [h.w.name, h.sure, h.used] : null; };
      return {
        first: m('ARUN'), full: m('Arun Mahato'), respelt: m('ARUN MAHTO 5 PM'), bracket: m('Arun Mahato(mahto)'),
        dash: m('B.K. DAS'), dashFirst: m('BALA'), inBracket: m('KANU'), fold: m('CHAAND'), sh: m('ESHAA'),
        surname: m('MAHATO'), none: m('ZORO')
      }; })()`) as any;
    expect(r.first).toEqual(['Arun Mahato', true, 1]);
    expect(r.full).toEqual(['Arun Mahato', true, 2]);
    // The first name found him, and "MAHTO" is his surname spelt the shop's way:
    // part of the name, not the rest of the line.
    expect(r.respelt).toEqual(['Arun Mahato', true, 2]);
    expect(r.bracket).toEqual(['Arun Mahato', true, 2]);
    expect(r.dash).toEqual(['Bala - B.K. Das', true, 2]);
    expect(r.dashFirst).toEqual(['Bala - B.K. Das', true, 1]);
    expect(r.inBracket).toEqual(['Kiran (Kanu Singh)', true, 1]);
    expect(r.fold).toEqual(['Chand', false, 1]);
    expect(r.sh).toEqual(['Esha', false, 1]);
    expect(r.surname).toBeNull();
    expect(r.none).toBeNull();

    // A first name two workers share is asked, never guessed.
    const shared = await g(page, `(function(){
      var idx = relayRosterIndex([{ id: 1, name: 'Arun Mahato' }, { id: 9, name: 'Arun Das' }]);
      return [relayMatchName(['ARUN'], idx, true), relayMatchName(['ARUN', 'DAS'], idx, true).w.id];
    })()`);
    expect(shared).toEqual([null, 9]);
  });

  test('a placement is kept at once, a saved guess is kept, and the next roll asks nothing', async ({ page }) => {
    await load(page);
    const a = when(-2), b = when(-1);
    await paste(page, roll(a.dmy));
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('1');
    await expect(page.locator('.inv-stk-tile-amber .inv-stk-tile-n')).toHaveText('2');
    // A guess comes with the picker, already on the guess.
    await expect(page.locator('[data-relay-map="CHAAND"]')).toHaveValue('3');

    // Placed: on the worker straight away, before any Save. Ids are numbers.
    await page.locator('[data-relay-map="ZORO"]').selectOption('6');
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('0');
    await expect.poll(async () => (await readStoredState(page)).staff.find((w: any) => w.id === 6).relayNames).toEqual(['ZORO']);

    await page.locator('[data-action="invRelaySave"]').click();
    const s = await readStoredState(page);
    const day = s.attendance[a.iso];
    expect(Object.keys(day.marks).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(day.marks['6']).toMatchObject({ st: 'P', area: 'barrel' });
    // The guesses the owner saw and saved are remembered too.
    expect(s.staff.find((w: any) => w.id === 3).relayNames).toEqual(['CHAAND']);
    expect(s.staff.find((w: any) => w.id === 4).relayNames).toEqual(['ESHAA']);

    await paste(page, roll(b.dmy));
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('0');
    await expect(page.locator('.inv-stk-tile-amber .inv-stk-tile-n')).toHaveText('0');
    await expect(page.locator('.inv-rl-row')).toHaveCount(6);
  });

  test('a wrong guess is put right, and a name can be left out', async ({ page }) => {
    await load(page);
    await paste(page, roll(when(-1).dmy));
    // CHAAND is really Kiran; ZORO is nobody.
    await page.locator('[data-relay-map="CHAAND"]').selectOption('5');
    await page.locator('[data-relay-map="ZORO"]').selectOption('');
    await expect(page.locator('.inv-stk-tile-red .inv-stk-tile-n')).toHaveText('0');
    await expect(page.locator('.inv-stk-issue-info').filter({ hasText: '"ZORO" left out' })).toHaveCount(1);
    await expect(page.locator('.inv-rl-row').filter({ hasText: 'Chand' })).toHaveCount(0);
    const s = await readStoredState(page);
    expect(s.staff.find((w: any) => w.id === 5).relayNames).toEqual(['CHAAND']);
    expect(s.staff.find((w: any) => w.id === 3).relayNames || []).toEqual([]);
  });

  test('the chemical stock written under the roll ends it', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){ var r = parseRelayRoll(${JSON.stringify(roll(when(-1).dmy) + '\n\ncamical use camical stock\n1) ZINK 20-5=15 KG\n2) HCL NIL')}, relayRoster({}));
      return { red: r.issues.filter(function(i){ return i.tone === 'red'; }).map(function(i){ return i.key; }), info: r.issues.filter(function(i){ return i.tone === 'info'; }).length }; })()`) as any;
    expect(r.red).toEqual(['ZORO']);
    expect(r.info).toBe(1);
    const split = await g(page, `relaySplit(${JSON.stringify(roll(when(-1).dmy) + '\n' + when(-1).dmy + '// camical use & camical stock\n1) ZINK 20-5=15 KG')}).length`);
    expect(split).toBe(2);
  });

  test('the roster file\'s aliases are kept as spellings, and the worker screen edits them', async ({ page }) => {
    await load(page);
    const res = await g(page, `applyRosterImport({ staff: [{ name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50 }],
      aliases: { Chand: ['Chaand', 'Chand Singh'], Esha: ['Eesha'] } })`) as any;
    expect(res.spellings).toBe(3);
    expect(await g(page, `[staffById(3).relayNames, staffById(4).relayNames]`)).toEqual([['CHAAND', 'CHANDSINGH'], ['EESHA']]);
    // The file's short canonical finds a roster typed with full names.
    const full = await g(page, `applyRosterImport({ staff: [], aliases: { Arun: ['Aroon'], Kanu: ['Kaanu'] } })`) as any;
    expect(full.spellings).toBe(4);
    expect(await g(page, `[staffById(1).relayNames, staffById(5).relayNames]`)).toEqual([['ARUN', 'AROON'], ['KANU', 'KAANU']]);

    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="4"]').click();
    await expect(page.locator('#wedSpell')).toHaveValue('EESHA');
    await page.locator('#wedSpell').fill('eesha, Isha, esha');
    await page.locator('[data-action="invAttSaveWorker"]').click();
    expect((await readStoredState(page)).staff.find((w: any) => w.id === 4).relayNames).toEqual(['EESHA', 'ISHA']);

    // Merging a duplicate row keeps its name as a spelling of the survivor.
    await g(page, `(function(){ S.staff.push({ id: 7, name: 'Gopal Das', comp: 'hourly', area: 'barrel', active: true }); mergeWorkers(7, 6); })()`);
    expect(await g(page, `staffById(6).relayNames`)).toEqual(['GOPALDAS']);
  });
});
