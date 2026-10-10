import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openVerdict, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { longBook } from './load-fixture';
import { unlock } from './p140-guard.fixture';

// P188: Floor's map (docs/TAB_MAP.md TM4). Floor is Overview · People · Production · Stock · Power, and the Overviews of People,
// Production, Stock and Power are gone: Floor's Overview holds a hero for each, shown to the roles that open its screen, then the
// line cards worst first. Each screen leads with its verdict card and one toolbar row; what needs the owner comes first and the
// rest folds. Every old Overview address lands where §5 says. Names and figures are made up; dates are built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const where = (p: Page) => p.evaluate(() => { const l = (window as any).navLoc(); return [l.tab, l.v || '']; });
const RANK: Record<string, number> = { danger: 0, warning: 1, ok: 2, info: 3, neutral: 4 };
const tabs = (page: Page, page_: string) => page.locator(`#${page_} .inv-viewtabs:not(#wsTabs) .inv-viewtab`);
/* The ids (or the first class) of a container's children, in order. */
const kids = (page: Page, sel: string) => page.locator(sel).evaluate(el => Array.from(el.children).map(c => c.id || (c as HTMLElement).dataset.fold
  || Object.keys((c as HTMLElement).dataset)[0] || c.className.split(' ')[0]));

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The `n`th working day (Sundays not counted) back from today. */
function wday(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  for (let k = 0; k < n;) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0) k++; }
  return isoOf(d);
}
const cut = (id: string, date: string, time: string, to: string, dt: any = {}) => ({ id, kind: 'downtime', date, time, to,
  downtime: { cause: 'power', setAt: 1, ...dt }, basis: 'relay', src: 'paste', at: 1 });
function powerBook(n: number): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const entries = [];
  for (let k = 1; k <= n; k++) entries.push(cut('C' + k, wday(k), '11:00', '11:40', { reason: 'R1', where: 'vat-a2' }));
  entries.push(cut('C9', wday(9), '15:00', '15:10'));
  s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  s.power = { causes: [{ id: 'R1', kind: 'reason', name: 'Panel MCB trip', aliases: [], scope: 'plant', at: 1, by: 'Owner' }] };
  return s;
}

const PINS = { owner: '48291637', super: '24681357', floor: '13572468' };
/* The owner, a supervisor and a floor hand, made in the page by the guard's own hash; the page reloads onto the lock. */
async function withFloorUsers(page: Page) {
  await page.evaluate(async pins => {
    const w = window as any, S = (0, eval)('S');
    const mk = async (id: string, name: string, role: string, pin: string) => ({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null });
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-sup', 'Birsa Munda', 'supervisor', pins.super), await mk('U-flr', 'Dhan Oraon', 'floor', pins.floor)];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
}
const heroes = (page: Page) => page.locator('#flrHeroes > [data-card]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.card));

test.describe('P188: Floor’s map', () => {
  test('Floor’s row is five; its Overview leads with four heroes, People carrying the verdict, then the line cards worst first', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageFloor');
    expect(await page.locator('#wsTabs .inv-viewtab').allInnerTexts()).toEqual(['Overview', 'People', 'Production', 'Stock', 'Power']);
    expect(await heroes(page)).toEqual(['flr-people', 'flr-prod', 'flr-stock', 'flr-power']);
    await expect(page.locator('#flrHeroes > [data-card="flr-people"]')).toHaveAttribute('data-verdict', '');
    await expect(page.locator('#floorContent [data-verdict]')).toHaveCount(1);
    // The stepper, the heroes, the line cards: no tile strip leads the page any more (on site, plated and power are the heroes').
    const order = await kids(page, '#floorContent');
    expect(order.slice(0, 3)).toEqual(['flrStepper', 'flrHeroes', 'flrLines']);
    const tones = await page.locator('#flrLines > [data-line]').evaluateAll(els => els.map(e => (/inv-hero-(danger|warning|ok|info|neutral)/.exec(e.className) || [])[1] || 'neutral'));
    expect(tones).toHaveLength(4);
    for (let i = 1; i < tones.length; i++) expect(RANK[tones[i]]).toBeGreaterThanOrEqual(RANK[tones[i - 1]]);
    // The heroes are shut on the phone, each to its line; one opened shows what it holds and its way to its screen.
    await expect(page.locator('#flrHeroes > [data-card="flr-power"]')).not.toHaveAttribute('open', '');
    await page.locator('#flrHeroes > [data-card="flr-power"] > summary').click();
    await expect(page.locator('#flrHeroes [data-flr-power="month"]')).toBeVisible();
    await page.locator('#flrHeroes > [data-card="flr-power"] [data-action="invFlrPower"]').click();
    await expect.poll(() => where(page)).toEqual(['pagePower', 'cuts']);
  });

  test('every old Overview address and remembered tab lands where the redirect table says', async ({ page }) => {
    await loadAppWithState(page, longBook());
    const cases: [string, string[]][] = [
      ['/?tab=pageStaff&v=overview', ['pageFloor', '']],
      ['/?tab=pageProduction&v=overview', ['pageFloor', '']],
      ['/?tab=pageProduction&v=overview/hand', ['pageProduction', 'lines/hand']],
      ['/?tab=pagePower&v=overview', ['pageFloor', '']],
      ['/?tab=pageStock&v=overview', ['pageStock', 'list']]];
    for (const [addr, want] of cases) {
      await page.goto(addr);
      await waitForBoot(page);
      await expect.poll(() => where(page), { message: addr }).toEqual(want);
    }
    // A form opened over the old Overview stays open, on Lines.
    await page.goto('/?tab=pageProduction&v=overview/hand');
    await waitForBoot(page);
    await expect(page.locator('#prodHandQty')).toBeVisible();
    // A device that remembered an Overview opens the first view.
    await page.evaluate(() => { localStorage.setItem('sep_inv_power_tab', 'overview'); localStorage.setItem('sep_inv_prod_tab', 'overview'); });
    await page.goto('/');
    await waitForBoot(page);
    await switchTab(page, 'pagePower');
    expect(await tabs(page, 'pagePower').allInnerTexts()).toEqual(['Cuts', 'Causes', 'Load & bills', 'Case']);
    await expect(page.locator('#pagePower .inv-viewtab[aria-selected="true"]')).toHaveText('Cuts');
    await switchTab(page, 'pageProduction');
    expect(await tabs(page, 'pageProduction').allInnerTexts()).toEqual(['Lines', 'In plant', 'Entries', 'Equipment']);
    await expect(page.locator('#pageProduction .inv-viewtab[aria-selected="true"]')).toHaveText('Lines');
    // A saved task naming the old views opens the first, and search names the screens where they are now.
    await g(page, `todoGo({ kind: 'power', tab: 'overview' })`);
    await expect.poll(() => where(page)).toEqual(['pagePower', 'cuts']);
    await g(page, `todoGo({ kind: 'production', tab: 'overview' })`);
    await expect.poll(() => where(page)).toEqual(['pageProduction', 'lines']);
    expect(await g(page, `srchData().list.filter(function(x) { return x.kind === 'screen' && /^(power|production|stock|people)$/.test(x.key); }).map(function(x) { return x.key + '>' + JSON.stringify(x.go); })`)).not.toContainEqual(expect.stringContaining('overview'));
  });

  test('each role sees the heroes of the screens it opens: the floor role People without its link, Production and Stock, no Power', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await withFloorUsers(page);
    await unlock(page, 'U-flr', PINS.floor);
    await switchTab(page, 'pageFloor');
    expect(await heroes(page)).toEqual(['flr-people', 'flr-prod', 'flr-stock']);
    await expect(page.locator('#flrHeroes [data-card="flr-people"] [data-action="invFlrStaff"]')).toHaveCount(0);
    await expect(page.locator('#flrHeroes [data-card="flr-people"]')).toHaveAttribute('data-verdict', '');
    // The reorder's cash is Stock's own figure, which Stock shows every role that opens it (QA4-4): the hero says it too.
    const need = await page.evaluate(() => (window as any).stockReorderList().total);
    expect(need).toBeGreaterThan(0);
    await expect(page.locator('#flrHeroes [data-flr-reorder]')).toHaveCount(1);
    // The supervisor opens all four screens.
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardLockNow"]').click();
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageFloor');
    expect(await heroes(page)).toEqual(['flr-people', 'flr-prod', 'flr-stock', 'flr-power']);
    await expect(page.locator('#flrHeroes [data-card="flr-people"] [data-action="invFlrStaff"]')).toHaveCount(1);
  });

  test('People: Attendance’s Day · Week · Month, each led by its verdict; Day’s extra one line a row; Pay and Areas led by theirs, the charts folded', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStaff');
    expect(await tabs(page, 'pageStaff').allInnerTexts()).toEqual(['Attendance', 'Pay', 'Areas', 'Roster']);
    await expect(page.locator('[data-att-period] .inv-seg-btn')).toHaveText(['Day', 'Week', 'Month']);
    // Day: the verdict before everything but the tabs, and each extra row one line until opened.
    expect((await kids(page, '#attContent')).filter(k => k !== 'inv-viewtabs')[0]).toBe('attDayVerdict');
    await g(page, `(function() { var d = localDateStr(); S.attendance[d] = S.attendance[d] || { marks: {}, extra: [] }; S.attendance[d].extra = [{ area: 'vat-a2', hours: 8, kind: 'general' }, { area: 'barrel', hours: 8, kind: 'general' }]; renderAttendance(); })()`);
    const extra = page.locator('#attExtra details[data-extra-row]');
    await expect(extra).toHaveCount(2);
    await expect(page.locator('#attExtra details[data-extra-row][open]')).toHaveCount(0);
    await expect(page.locator('#attExtra [data-att-extra-hours]').first()).toBeHidden();
    await extra.first().locator('summary').click();
    await expect(page.locator('#attExtra [data-att-extra-hours]').first()).toBeVisible();
    // Week: its verdict, then attendance by week (it led Staff's Overview), shut.
    await page.locator('[data-att-period] [data-view="week"]').click();
    expect((await kids(page, '#attContent')).filter(k => k !== 'inv-viewtabs')[0]).toBe('attWeekVerdict');
    await expect(page.locator('#attContent details[data-fold="att-weeks"]')).not.toHaveAttribute('open', '');
    // Month: the register's verdict, saying there is no page yet.
    await page.locator('[data-att-period] [data-view="register"]').click();
    await expect(page.locator('#aregSummary')).toContainText('No register page this month');
    // Pay: the payout against its usual, then labour per kg and the payroll against the bank, both shut.
    await tabs(page, 'pageStaff').filter({ hasText: 'Pay' }).click();
    expect((await kids(page, '#attContent')).filter(k => k !== 'inv-viewtabs')[0]).toBe('payForecast');
    await expect(page.locator('#payForecast .inv-hero-title')).toHaveText(/^Payout (heading for )?₹/);
    await expect(page.locator('details[data-fold="pay-labour-kg"]')).not.toHaveAttribute('open', '');
    await expect(page.locator('#dashPayBank')).toContainText('Payroll against the bank');
    await expect(page.locator('#dashLabour')).toContainText('Paid, bank');
    // The bank's series is money: a role with wages and no money sees the records without it.
    await g(page, `grdSeesMoney = function() { return false; }; renderAttendance();`);
    await expect(page.locator('#dashPayBank')).toContainText('Monthly payroll');
    await expect(page.locator('#dashPayBank')).not.toContainText('Paid, bank');
    await expect(page.locator('#dashLabour')).not.toContainText('Paid, bank');
    // Areas: its verdict, then the extra checked; the hours and the absorption folded.
    await tabs(page, 'pageStaff').filter({ hasText: 'Areas' }).click();
    expect((await kids(page, '#attContent')).filter(k => k !== 'inv-viewtabs')[0]).toBe('areaVerdict');
    await expect(page.locator('#attContent details[data-fold="areaHours"]')).not.toHaveAttribute('open', '');
    // Roster: its verdict, To watch among its factors.
    await tabs(page, 'pageStaff').filter({ hasText: 'Roster' }).click();
    await expect(page.locator('#attRosterVerdict')).toContainText('active');
    await expect(page.locator('#attRosterVerdict .inv-tile-label').filter({ hasText: 'To watch' })).toHaveCount(1);
  });

  test('Roster: a check-in due is the verdict’s tile, which shows those hands alone; a row’s tier is its group, never a badge', async ({ page }) => {
    // Three of the long book's ten hands checked in today, so seven are due: the tile's subset is a real one.
    const book: any = longBook();
    book.peopleCheckins = book.staff.slice(0, 3).map((w: any, i: number) => ({ id: 'CI-' + i, staffId: w.id, on: todayIso(), score: 4, at: 1 }));
    await loadAppWithState(page, book);
    await switchTab(page, 'pageStaff');
    await tabs(page, 'pageStaff').filter({ hasText: 'Roster' }).click();
    const rows = page.locator('#attRoster [data-action="invAttEditWorker"]');
    await expect(rows).toHaveCount(10);
    // No row repeats the verdict's count as a badge; the tier is the group, the area and the rate the meta line's two facts.
    await expect(page.locator('#attRoster .inv-badge')).toHaveCount(0);
    await expect(page.locator('#attRoster [data-roster-group^="tier-"]').first()).toBeVisible();
    const meta = await page.locator('#attRoster [data-roster-meta]').allInnerTexts();
    expect(meta.every(m => m.split('·').length <= 2)).toBe(true);
    await openVerdict(page);
    const due = page.locator('#attRosterVerdict [data-action="invAttRosterFilter"][data-v="due"]');
    await expect(due.locator('.inv-tile-value')).toHaveText('7');
    await expect(page.locator('#attRosterVerdict .inv-tile').filter({ hasText: 'To watch' })).not.toHaveAttribute('data-action', /./);
    await due.click();
    await expect(rows).toHaveCount(7);
    await expect(page.locator('#attRoster .inv-panel-title')).toContainText('Check-ins due');
    await expect(page.locator('#attRosterVerdict [data-v="due"]')).toHaveAttribute('aria-pressed', 'true');
    // The filter says itself under the toolbar on the phone, and a second press of the tile (or the token) shows everyone.
    await expect(page.locator('#attContent .inv-token')).toContainText('Check-ins due');
    await page.locator('#attContent .inv-token').click();
    await expect(rows).toHaveCount(10);
    await expect(page.locator('#attRosterVerdict [data-v="due"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('Production: Lines and Entries lead with their verdicts and Paste; Entries shows thirty with qualifying badges; In plant its exceptions first; Equipment adds a unit', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageProduction');
    const lead = async () => (await kids(page, '#productionContent')).filter(k => k !== 'inv-viewtabs');
    expect((await lead())[0]).toBe('prodLinesVerdict');
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveText(['Paste']);
    await tabs(page, 'pageProduction').filter({ hasText: 'Entries' }).click();
    expect((await lead())[0]).toBe('prodEntriesVerdict');
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveText(['Paste']);
    await expect(page.locator('#prodEntries [data-prod-entry]:visible')).toHaveCount(30);
    await expect(page.locator('#prodEntries [data-action="invShowMore"]')).toBeVisible();
    // The phone badges only what qualifies a figure: where an entry came from is in its fold.
    const badges = await page.locator('#prodEntries [data-prod-badges] .inv-badge').allInnerTexts();
    for (const src of ['register', 'relay', 'hand', 'message', 'import']) expect(badges).not.toContain(src);
    await tabs(page, 'pageProduction').filter({ hasText: 'In plant' }).click();
    const plant = await lead();
    expect(plant[0]).toBe('prodPlantVerdict');
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveCount(0);
    if (plant.indexOf('prodPlantNeeds') >= 0) expect(plant.indexOf('prodPlantNeeds')).toBeLessThan(plant.indexOf('prodPlantList'));
    await tabs(page, 'pageProduction').filter({ hasText: 'Equipment' }).click();
    await expect(page.locator('#productionContent .inv-btn-primary')).toHaveText(['Add a unit']);
    await expect(page.locator('#productionContent .inv-deck-item[data-plt-unit]').first()).toBeVisible();
  });

  test('Stock: one screen, its verdict, one toolbar row on the phone, and Spend and prices folded at the foot', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStock');
    await expect(page.locator('#pageStock .inv-viewtabs:not(#wsTabs)')).toHaveCount(0);
    await expect(page.locator('#stockVerdict')).toBeVisible();
    await expect(page.locator('#pageStock .inv-toolbar:visible')).toHaveCount(1);
    await expect(page.locator('#pageStock [data-action="invStockSpend"]')).toHaveCount(0);
    const spend = page.locator('#pageStock details[data-fold="stock-spend"]');
    await expect(spend).not.toHaveAttribute('open', '');
    await spend.locator('summary').click();
    await expect(page.locator('#dashSupplier')).toBeVisible();
  });

  test('Power: Cuts leads with its card, Enter a cut and what needs the owner, the charts folded after the cuts; the case fitted to the phone', async ({ page }) => {
    const s: any = longBook();
    s.power = Object.assign(s.power || {}, { load: { sanctioned: 25, approved: 50, approvedOn: wday(40), ref: '' } });
    await loadAppWithState(page, s);
    await switchTab(page, 'pagePower');
    // The card, the toolbar, what needs the owner, the cuts by month, and the two charts folded after them.
    const order = (await kids(page, '#powerContent')).filter(k => k !== 'inv-viewtabs');
    expect(order.slice(0, 3)).toEqual(['powerVerdict', 'powerToolbar', 'pcsComplete']);
    expect(order.slice(-2)).toEqual(['powerMonths', 'powerHours']);
    expect(order.slice(3, -2).length).toBeGreaterThan(0);
    expect(order.slice(3, -2).every(k => /^power-\d{4}-\d{2}$/.test(k))).toBe(true);
    await expect(page.locator('#powerContent [data-power-toolbar="cuts"] .inv-btn-primary')).toHaveText('Enter a cut');
    await expect(page.locator('details#powerMonths')).not.toHaveAttribute('open', '');
    await expect(page.locator('details#powerHours')).not.toHaveAttribute('open', '');
    // The load approved and not yet billed is the first thing to look at, in red.
    await expect(page.locator('#pcsComplete > .inv-panel-head')).toContainText('To look at');
    await expect(page.locator('#pcsComplete [data-power-load-row]')).toBeVisible();
    await expect(page.locator('#pcsComplete [data-power-load-row] .inv-dot-danger')).toHaveCount(1);
    await expect(page.locator('#powerVerdict')).toHaveClass(/inv-hero-danger/);
    // A cut is one line of two facts; what its damage is made of is in its fold.
    const row = page.locator('#powerContent details[data-power-cut]').first();
    expect((await row.locator('summary .inv-row-meta').first().innerText()).split(' · ').length).toBe(2);
    // Causes, Load & bills and Case each have their own toolbar, or none.
    await tabs(page, 'pagePower').filter({ hasText: 'Causes' }).click();
    await expect(page.locator('#powerContent [data-power-toolbar]')).toHaveCount(0);
    await expect(page.locator('#pcsVerdict')).toBeVisible();
    await tabs(page, 'pagePower').filter({ hasText: 'Load & bills' }).click();
    await expect(page.locator('#powerContent .inv-btn-primary')).toHaveText(['Edit load']);
    await expect(page.locator('#powerLoad')).toHaveClass(/inv-hero-danger/);
    await expect(page.locator('#powerLoad .inv-hero-title')).toHaveText('Approved 50 kVA, billed at 25');
    await tabs(page, 'pagePower').filter({ hasText: 'Case' }).click();
    await expect(page.locator('#powerContent .inv-btn-primary')).toHaveText(['Print the case']);
    const fit = await page.locator('#powerCaseSheet').evaluate(el => {
      const doc = el.querySelector('[data-power-case]') as HTMLElement;
      return { zoom: Number(getComputedStyle(el).getPropertyValue('--pp-zoom')), right: doc.getBoundingClientRect().right, width: document.documentElement.clientWidth };
    });
    expect(fit.zoom).toBeLessThan(1);
    expect(fit.right).toBeLessThanOrEqual(fit.width);
  });

  test('Causes: a tile is coloured only once three cuts stand behind it; with fewer it gives the count', async ({ page }) => {
    await loadAppWithState(page, powerBook(1));
    await switchTab(page, 'pagePower');
    await tabs(page, 'pagePower').filter({ hasText: 'Causes' }).click();
    const tile = (k: string) => page.locator(`[data-pcs-tiles] [data-power-tile="${k}"]`);
    await expect(page.locator('#pcsVerdict .inv-hero-title')).toHaveText('Panel MCB trip costs most');
    await expect(page.locator('#pcsVerdict')).toHaveClass(/inv-hero-neutral/);
    await expect(tile('plant')).toContainText('on 1 cut');
    await expect(tile('plant')).not.toHaveClass(/inv-tile-(warning|danger|info|ok)/);
    await expect(tile('top')).not.toHaveClass(/inv-tile-(warning|danger|info|ok)/);
    // The cut with no reason is completed on Cuts: Causes links there, and draws no list of its own to complete.
    await expect(page.locator('#pcsVerdict [data-pcs-todo]')).toHaveText('1 cut to complete, on Cuts');
    await expect(page.locator('#powerContent #pcsComplete')).toHaveCount(0);
    await loadAppWithState(page, powerBook(3));
    await switchTab(page, 'pagePower');
    await tabs(page, 'pagePower').filter({ hasText: 'Causes' }).click();
    await expect(tile('plant')).toContainText('on 3 cuts');
    await expect(tile('plant')).toHaveClass(/inv-tile-warning/);
    await expect(tile('top')).toHaveClass(/inv-tile-danger/);
    await expect(page.locator('#pcsVerdict')).toHaveClass(/inv-hero-danger/);
    // A cut with no reason left to complete is a link to Cuts.
    await g(page, `S.production.entries.push({ id: 'C10', kind: 'downtime', date: localDateStr(), time: '10:00', downtime: { cause: 'power', open: true }, basis: 'relay', src: 'paste', at: 1 }); _prodVer++; renderPower();`);
    await page.locator('#pcsVerdict > summary').click();
    await page.locator('#pcsVerdict [data-pcs-todo]').click();
    await expect.poll(() => where(page)).toEqual(['pagePower', 'cuts']);
    await expect(page.locator('#pcsComplete [data-pcs-cut="C10"]')).toBeVisible();
  });
});
