import { test, expect } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab, openSettingsAt, waitForBoot } from './fixtures';
import { ev, T, wd, addDays, day, addWd, short, NOVA, ORBIT, KAPPA, book, tasks, bust } from './p204-flow.fixture';
import { PINS, unlock } from './p140-guard.fixture';

// P204: the flow thread (docs/ENTRY_FACES.md §5, T1–T3; owner, 10 Oct 2026: "Target default one day, can be edited as per material
// or overall as well. Say, they ask for a particular material to be done on a priority basis - we can plan that out"; "Mehta 7 days -
// as we give 2% discount, every other client 45 days"). A turnaround target from a challan's day to its despatch, in working days,
// the plant's, a client's or a part's; payment terms, the plant's or a client's; a challan wanted by a day. Material past its target
// is a task by client, a job wanted by a day and not plated is one by challan, an invoice past its client's terms is the rule that
// read 90 days. Floor's Overview and a client's page show the flow: the median working days to each step against the target, the
// days to pay against the terms, and when each open challan and invoice is expected. Made-up names and figures; every date from today.

test.describe('P204: the flow thread', () => {
  test('T1: the plant’s target and terms in Settings, a client’s and a part’s own on the client; the rebate client’s 7 days set once', async ({ page }) => {
    await loadAppWithState(page, book());
    // The client whose name reads Mehta takes 7 days once; every other reads the plant's.
    let st = await readStoredState(page);
    expect(st._clientTerms1).toBe(true);
    expect(st.clients.find((c: any) => c.id === 13).payTermsDays).toBe(7);
    expect(st.clients.find((c: any) => c.id === 11).payTermsDays).toBeUndefined();
    expect(await ev(page, `[flowTerms(13), flowTerms(11), flowTarget(11, 'BRACKET 7')]`)).toEqual([{ days: 7, src: 'client' }, { days: 45, src: 'plant' }, { days: 1, src: 'plant' }]);

    // Settings → Checks & alerts → Turnaround and terms: the same day is a target; terms are days.
    await openSettingsAt(page, 'flow');
    await expect(page.locator('#setFlowTurn')).toHaveValue('1');
    await expect(page.locator('#setFlowTerms')).toHaveValue('45');
    await page.locator('#setFlowTurn').fill('0');
    await page.locator('#setFlowTerms').fill('30');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="flow"]').click();
    await expect.poll(async () => (await readStoredState(page)).flowCfg).toEqual({ turnDays: 0, termsDays: 30 });
    await expect(page.locator('details[data-sec="flow"] > summary')).toContainText('back the same day · paid in 30 days');
    await page.keyboard.press('Escape');

    // The client's own: terms, a target, and a part of its own; a part with no days is refused, and nothing is saved.
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invEditClient"][data-id="11"]').click();
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog').last();
    await expect(dlg.locator('#ceditTerms')).toHaveAttribute('placeholder', '30');
    await dlg.locator('#ceditTerms').fill('10');
    await dlg.locator('#ceditTurn').fill('3');
    await dlg.locator('#ceditTurnPart0').fill('BRACKET 7');
    await dlg.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('BRACKET 7: give its working days, from 0 to 60');
    expect((await readStoredState(page)).clients.find((c: any) => c.id === 11).payTermsDays).toBeUndefined();
    await dlg.locator('#ceditTurnDays0').fill('0');
    await dlg.locator('[data-action="invSaveClient"]').click();
    await expect.poll(async () => { const c = (await readStoredState(page)).clients.find((x: any) => x.id === 11); return [c.payTermsDays, c.turnaroundDays, c.turnaroundParts]; })
      .toEqual([10, 3, [{ part: 'BRACKET 7', days: 0 }]]);
    expect(await ev(page, `[flowTarget(11, 'bracket-7'), flowTarget(11, 'BRACKET 8'), flowTarget(12, 'TINA 3302'), flowTerms(11)]`))
      .toEqual([{ days: 0, src: 'part' }, { days: 3, src: 'client' }, { days: 0, src: 'plant' }, { days: 10, src: 'client' }]);

    // Set once: terms cleared on the rebate client stay cleared through a reload.
    await ev(page, `S.clients.find(function(c) { return c.id === 13; }).payTermsDays = undefined; saveState()`);
    await page.reload();
    await waitForBoot(page);
    expect((await readStoredState(page)).clients.find((c: any) => c.id === 13).payTermsDays).toBeUndefined();
  });

  test('T2: material past its target is a task by client, red two working days past; where it stands is In plant’s; a target of its own clears it', async ({ page }) => {
    await loadAppWithState(page, book());
    const late = await tasks(page, 'flowLate');
    expect(late.map(t => [t.key, t.tone, t.title])).toEqual([
      ['flowLate:11', 'red', NOVA + ': 2 challan lines past the turnaround target'],
      ['flowLate:12', 'amber', ORBIT + ': 1 challan line past the turnaround target']]);
    // The floor's record is thin, so a line nothing was set against is said to have no record, never to be waiting to pickle.
    expect(late[0].sub).toBe('1 with no floor record, 1 pickled, not plated · the oldest from ' + await ev(page, `formatDate('${wd[5]}')`));
    expect(late[0].facts).toEqual(expect.arrayContaining([['Most past it', '4 working days'], ['Open on them', '70.0 kg'], ['Target', '1 working day']]));
    expect(late[1].facts).toEqual(expect.arrayContaining([['Open on them', '300 NOS']]));
    // Once the floor's record covers the month, In plant says waiting to pickle, and so does the task.
    await ev(page, `PROD_COVER_OK = 0; _flowMemo = null`);
    expect((await tasks(page, 'flowLate'))[1].sub).toContain('1 waiting to pickle');
    // A target of its own: ORBIT's three days clears it; NOVA's part target clears one of its two lines.
    await ev(page, `S.clients.find(function(c) { return c.id === 12; }).turnaroundDays = 3; S.clients.find(function(c) { return c.id === 11; }).turnaroundParts = [{ part: 'BRACKET 8', days: 10 }]; saveState()`);
    await bust(page);
    const after = await tasks(page, 'flowLate');
    expect(after.map(t => [t.key, t.title])).toEqual([['flowLate:11', NOVA + ': 1 challan line past the turnaround target']]);
    expect(after[0].sub).toMatch(/^1 pickled, not plated/);
  });

  test('T2: a challan wanted by a day: set on Challans, badged, asked on the day and red after it; the form keeps it too', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invToggleIM"][data-id="IM-104"]').click();
    await page.locator('[data-action="invFlowPrio"][data-id="IM-104"]').click();
    const dlg = page.locator('.inv-scrim-dialog .inv-dialog').last();
    await expect(dlg).toContainText('Wanted by · challan 104');
    await dlg.locator('#flowPrioAll').fill(T);
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect.poll(async () => (await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-104').priority).toBe(T);
    await expect(page.locator('[data-im="IM-104"] [data-flow-wanted]')).toHaveClass(/inv-badge-warning/);
    let t = await tasks(page, 'flowPriority');
    expect(t.map(x => [x.key, x.tone, x.title, x.sub])).toEqual([['flowPriority:IM-104', 'amber', NOVA + ' challan 104 is wanted today', '2 lines with no plating recorded']]);

    // A line of its own wins over the challan's day: wanted a working day ago, the task is red and says how late.
    await page.locator('[data-action="invFlowPrio"][data-id="IM-104"]').click();
    await dlg.locator('[data-flow-prio="IM-104-1"]').fill(wd[1]);
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect.poll(async () => (await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-104').items[1].priority).toBe(wd[1]);
    await expect(page.locator('[data-im="IM-104"] [data-flow-wanted]')).toHaveClass(/inv-badge-danger/);
    t = await tasks(page, 'flowPriority');
    expect(t[0]).toMatchObject({ tone: 'red', title: NOVA + ' challan 104 was wanted by ' + await ev(page, `formatDate('${wd[1]}')`), sub: '2 lines with no plating recorded · 1 working day late' });

    // Taken off, nothing is asked.
    await page.locator('[data-action="invFlowPrio"][data-id="IM-104"]').click();
    await dlg.locator('#flowPrioAll').fill('');
    await dlg.locator('[data-flow-prio="IM-104-1"]').fill('');
    await dlg.locator('[data-action="invFlowPrioSave"]').click();
    await expect(page.locator('[data-im="IM-104"] [data-flow-wanted]')).toHaveCount(0);
    expect(await tasks(page, 'flowPriority')).toEqual([]);

    // The challan form carries the day too: an edit keeps what the form says.
    await page.locator('[data-action="invToggleIM"][data-id="IM-105"]').click();
    await page.locator('[data-action="invEditChallan"][data-id="IM-105"]').click();
    await page.locator('#imWantedBy').fill(day(3));
    await page.locator('[data-action="invSaveChallan"]').click();
    await expect.poll(async () => (await readStoredState(page)).incomingMaterial.find((m: any) => m.id === 'IM-105').priority).toBe(day(3));
    await expect(page.locator('[data-im="IM-105"] [data-flow-wanted]')).toHaveClass(/inv-badge-info/);
  });

  test('T2: an invoice past its client’s terms is the owed task, with the terms named; within them, nothing', async ({ page }) => {
    await loadAppWithState(page, book());
    const owed = (await tasks(page, 'owed90')).sort((a, b) => a.key.localeCompare(b.key));
    expect(owed.map(t => [t.key, t.title])).toEqual([
      ['owed90:11', NOVA + ' owes ₹5,900.00 past its 45-day terms'],
      ['owed90:13', KAPPA + ' owes ₹2,360.00 past its 7-day terms']]);
    expect(owed[0].sub).toBe('1 invoice, the oldest ' + await ev(page, `formatDate('${day(-50)}')`) + ', 5 days past them');
    expect(owed[0].facts).toEqual(expect.arrayContaining([['Terms', '45 days']]));
    // The move under it says the same.
    expect(await ev(page, `advTaskMoves(todoAppAll().find(function(t) { return t.key === 'owed90:13'; }))[0].say`)).toContain('about ₹2,360.00 past its 7-day terms');
  });

  test('T3: Floor’s Overview carries the turnaround as a fifth hero, shut to its line, on a row of its own; open, each step against the target and the terms', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    const heroes = page.locator('#flrHeroes > [data-card]');
    await expect(heroes).toHaveCount(5);
    const hero = page.locator('#flrHeroes > [data-card="flr-flow"]');
    await expect(hero).not.toHaveAttribute('open', '');
    // Weighted by value: ₹1,000 back the same day, ₹2,000 in one working day, ₹6,000 in three: the median is three.
    await expect(hero.locator('.inv-hero-fig')).toHaveText('3d');
    await expect(hero.locator('.inv-hero-title')).toHaveText('Back in 3 working days, 33% of the value on target');
    await expect(hero.locator('.inv-hero-sub')).toHaveText('3 lines past the target now');
    // Alone on its row, it takes the row.
    const [w, row] = await Promise.all([hero.evaluate(e => e.getBoundingClientRect().width), page.locator('#flrHeroes').evaluate(e => e.getBoundingClientRect().width)]);
    expect(Math.abs(w - row)).toBeLessThan(2);
    await hero.locator(':scope > summary').click();
    await expect(hero.locator('[data-flow-step="pickle"] .inv-row-end')).toHaveText('1 d');
    await expect(hero.locator('[data-flow-step="plate"] .inv-row-end')).toHaveText('—');
    await expect(hero.locator('[data-flow-step="despatch"]')).toContainText('median of 3 lines · the target: 1 working day · 33% of the value within it');
    await expect(hero.locator('[data-flow-step="pay"]')).toContainText('20 d');
    await expect(hero.locator('[data-flow-step="pay"]')).toContainText('median of 1 receipt set against invoices · terms 45 days');
    await expect(hero.locator('[data-flow-late]')).toContainText('2 with no floor record, 1 pickled, not plated');
    // Its door is In plant, for every client.
    await ev(page, `_prodPlantClient = '12'`);
    await hero.locator('[data-action="invFlowPlant"]').click();
    await expect(page.locator('#pageProduction.inv-page-active')).toHaveCount(1);
    expect(await ev(page, `[_prodTab, _prodPlantClient]`)).toEqual(['plant', '']);
  });

  test('T3: a client’s page: its flow, each open challan expected back and late against its target, each open invoice past its terms, slow or expected', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invEditClient"][data-id="11"]').click();
    const p = page.locator('[data-client-flow="11"]');
    await expect(p.locator('.inv-panel-count')).toHaveText('1-day target · 45-day terms');
    await expect(p.locator('[data-flow-verdict] .inv-row-title')).toHaveText('Back in 3 working days');
    await expect(p.locator('[data-flow-verdict] .inv-row-meta')).toHaveText('33% of the value on target · challans of the last 90 days, 6 lines · under 5 despatched: expected days at the plant’s pace');
    await expect(p.locator('[data-flow-verdict] .inv-row-end')).toContainText('Slipping');
    // Five working days old against a one-day target: late, and red past two; back today at the earliest.
    const c104 = p.locator('[data-flow-challan="IM-104"]');
    await expect(c104).toHaveAttribute('data-flow-over', '4');
    await expect(c104.locator('.inv-dot')).toHaveClass(/inv-dot-danger/);
    await expect(c104.locator('.inv-row-end')).toHaveText('Late · back ~' + short(T));
    await expect(c104.locator('.inv-row-meta')).toHaveText('came in ' + short(wd[5]) + ' · with no floor record · usually 3 working days (the plant’s)');
    // Today's: back at the plant's usual three working days.
    await expect(p.locator('[data-flow-challan="IM-105"] .inv-row-end')).toHaveText('Back ~' + short(addWd(T, 3)));
    // The invoices: past the terms; slower than the twenty days the book pays in; expected.
    await expect(p.locator('[data-flow-invoice="INV-91"]')).toHaveAttribute('data-flow-pay', 'past');
    await expect(p.locator('[data-flow-invoice="INV-91"] .inv-row-end')).toHaveText('Past terms');
    await expect(p.locator('[data-flow-invoice="INV-92"]')).toHaveAttribute('data-flow-pay', 'slow');
    await expect(p.locator('[data-flow-invoice="INV-92"] .inv-row-end')).toHaveText('Slow · expected ~' + short(day(-5)));
    await expect(p.locator('[data-flow-invoice="INV-92"] .inv-row-meta')).toContainText('the book pays in 20 days');
    await expect(p.locator('[data-flow-invoice="INV-3"]')).toHaveAttribute('data-flow-pay', 'due');
    await expect(p.locator('[data-flow-invoice="INV-3"] .inv-row-end')).toHaveText('Expected ~' + short(addDays(wd[5], 20)));

    // On Performance, a page of analyses whose tools fold, it folds shut on the phone, and its head says the verdict.
    await page.keyboard.press('Escape');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
    await page.locator('#cpClientSelect').selectOption('11');
    const f = page.locator('#pageClients [data-client-flow="11"]');
    await expect(f).toHaveJSProperty('open', false);
    await expect(f.locator(':scope > summary .inv-dot-warning')).toHaveText('Back in 3 working days, 33% of the value on target');
    await f.locator(':scope > summary').click();
    await expect(f.locator('[data-flow-challan="IM-104"] .inv-row-end')).toHaveText('Late · back ~' + short(T));
  });

  test('T3: a role that does not see money sees the flow with no payment row, and no figure in rupees', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate(async (pins) => {
      const w = window as any;
      const mk = async (id: string, name: string, role: string, pin: string) => ({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null });
      const S = (0, eval)('S');
      S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-sup', 'Birsa Munda', 'supervisor', pins.super)];
      await w.saveState();
    }, PINS);
    await page.reload();
    await waitForBoot(page);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageFloor');
    const hero = page.locator('#flrHeroes > [data-card="flr-flow"]');
    await hero.locator(':scope > summary').click();
    await expect(hero.locator('[data-flow-step="despatch"]')).toHaveCount(1);
    await expect(hero.locator('[data-flow-step="pay"]')).toHaveCount(0);
    await expect(hero).not.toContainText('₹');
    // The task is the floor's to see, in quantities.
    const late = await tasks(page, 'flowLate');
    expect(late.map(t => t.key)).toEqual(['flowLate:11', 'flowLate:12']);
    expect(JSON.stringify(late)).not.toContain('₹');
  });
});
