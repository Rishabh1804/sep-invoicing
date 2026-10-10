import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, todayIso, waitForBoot, answerAsk } from './fixtures';
import { PINS, guardBook, unlock, lockNow } from './p140-guard.fixture';

// P202: the register clerk's face (docs/ENTRY_FACES.md, F4; owner, 10 Oct 2026: "[the register clerk] - Attendance, VAT
// Production"). The VAT register page is typed on Mine a round a row (VAT A1) or a batch a row (VAT A2), kept on the phone until
// saved, and read by the register photo's own reader, so its runs are what a photo of the same page gives; the day's power cuts are
// one log on it. Made-up names; every date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const today = todayIso();
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dmy = () => { const d = today.split('-'); return `${d[2]}/${d[1]}/${d[0].slice(2)}`; };

function book() {
  const s: any = guardBook();
  s.staff = [
    { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Charu', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
    { id: 4, name: 'Delta', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
    { id: 5, name: 'Echo', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true }];
  s.attendance = {};
  s.clients = [...s.clients,
    { id: 11, name: 'NOVA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 12, name: 'ORBIT ENGG', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
  s.incomingMaterial = [...s.incomingMaterial, { id: 'IM-301', challanNo: '301', challanDate: today, clientId: 11, clientName: 'NOVA CLAMPS', receivedDate: today, notes: '',
    createdAt: 1, items: [{ id: 'L1', partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'NOS', qty: 4000, rate: 1, amount: 4000, invoiced: false }] }];
  // Three earlier days of NOVA's clamp on VAT A1, every round of 120: the round its line runs.
  s.production = { entries: [1, 2, 3].map(n => ({ id: 'R' + n, kind: 'plated', date: addDays(today, -n), time: '09:00', to: '10:00', line: 'vat-a1', lineSrc: 'written', slot: 'general',
    clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP 165X83(40X6)', gauge: '40X6', qty: 360, unit: 'NOS', basis: 'register', src: 'import',
    rounds: [{ time: '9:00 AM', qty: 120, written: '120' }, { time: '9:30 AM', qty: 120, written: '120' }, { time: '10:00 AM', qty: 120, written: '120' }] })),
    pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {} } };
  return s;
}
/* The owner and the register clerk, whose face is the attendance sheet and the VAT register. */
async function withClerk(page: Page) {
  await page.evaluate(async (pins) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, faces?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, faces ? { faces } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-clk', 'Gita Bose', 'supervisor', pins.super, ['attsheet', 'vat'])];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
}
const cell = (page: Page, k: number, key: string) => page.locator(`[data-face-vat="${k}"][data-k="${key}"]`);
async function typeIn(page: Page, k: number, key: string, v: string) { const c = cell(page, k, key); await c.fill(v); await c.blur(); }
async function openVat(page: Page) {
  await page.locator('[data-face-duty="vat"] [data-action="invFaceOpen"]').last().click();
  await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'form');
}
const runs = (page: Page, line = 'vat-a1') => ev(page, `prodIndex().live.filter(function(e){ return e.pageId && e.line === '${line}'; }).map(function(e){
  return [e.client, e.part, e.qty, e.time + '-' + e.to, (e.rounds || []).length, e.src, e.basis, e.lineSrc]; })`);

test.describe('P202: the register clerk’s face', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T17:30:00') });
    await loadAppWithState(page, book());
    await withClerk(page);
    await unlock(page, 'U-clk', PINS.super);
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
  });

  test('the VAT page: rounds as the register writes them, kept on the phone, saved as a photo’s runs, saved again put right', async ({ page }) => {
    await openVat(page);
    await expect(page).toHaveURL(/v=vat%2Fvat-a1/);
    await expect(page.locator('[data-action="invFaceVatStyle"][data-style="rounds"]')).toHaveAttribute('aria-pressed', 'true');
    // A run's client and part where it begins; its rounds a line each, a sum the reader adds up as the register means it.
    await page.locator('#faceVatClient0').selectOption('11');
    await page.locator('#faceVatPart0').fill('CLAMP 165X83(40X6)');
    await page.locator('#faceVatPart0').blur();
    await typeIn(page, 0, 'time', '09:45');
    await typeIn(page, 0, 'fig', '120');
    await page.locator('[data-action="invFaceVatAdd"]').click();
    await typeIn(page, 1, 'time', '10:20');
    await typeIn(page, 1, 'fig', '3+4x120');
    await expect(page.locator('[data-face-vat-reading="1"]')).toHaveText('= 840 (7 × 120)');
    // The ditto: a round added carries the run's client and part, drawn once at the run's head.
    await expect(page.locator('[data-face-vat-run]')).toHaveCount(1);
    await page.locator('[data-action="invFaceVatAdd"]').click();
    await page.locator('[data-action="invFaceVatSplit"]').click();
    await page.locator('#faceVatClient2').selectOption('12');
    await page.locator('#faceVatPart2').fill('TINA(3303)');
    await page.locator('#faceVatPart2').blur();
    await typeIn(page, 2, 'time', '11:00');
    await typeIn(page, 2, 'fig', '98x8+1');
    await expect(page.locator('[data-face-vat-run]')).toHaveCount(2);
    await expect(page.locator('[data-face-vat-reads="2"]')).toContainText('Read as ORBIT ENGG · TINA(3303) · 785 NOS in 1 round');
    await expect(page.locator('[data-face-vat-counted]')).toHaveText('1,745 NOS');
    // The paper's day total against the rounds.
    await page.locator('#faceVatTotal').fill('1750');
    await page.locator('#faceVatTotal').blur();
    await expect(page.locator('[data-face-vat-total-q]')).toHaveText('The page’s day total is 1750; the rows counted add to 1745. A row may be missed or misread.');

    // Kept on this phone as it is typed: a reload brings the page back, and Mine says it is typed and not saved.
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('[data-face-vat-state]')).toHaveAttribute('data-face-vat-state', 'draft');
    await expect(cell(page, 1, 'fig')).toHaveValue('3+4x120');
    expect(await ev(page, `faceStep(faceDuty('vat'), '${today}').text`)).toBe('VAT A1 typed on this phone, not saved');
    // The Mine door is drawn after the reload (the session was kept; the bar was drawn before the book said who is in).
    await expect(page.locator('.inv-navbar-item[data-ws="mine"]')).toHaveCount(1);
    expect(await ev(page, `S.production.entries.filter(function(e){ return e.pageId; }).length`)).toBe(0);

    // A figure the reader cannot add up is never saved as nothing.
    await typeIn(page, 2, 'fig', '98y8');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Round 3: "98y8" could not be added up');
    await typeIn(page, 2, 'fig', '98x8+1');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Page saved: 2 runs, 1,745 NOS');

    // Saved as the photo's reader saves a page: plated runs on the line as written, the register's basis, the page they came from.
    expect(await runs(page)).toEqual([
      ['NOVA CLAMPS', 'CLAMP 165X83(40X6)', 960, '09:45-10:20', 2, 'face', 'register', 'written'],
      ['ORBIT ENGG', 'TINA(3303)', 785, '11:00-11:00', 1, 'face', 'register', 'written']]);
    const pg = await ev(page, `S.production.pages[0]`);
    expect(pg).toMatchObject({ date: today, line: 'vat-a1', style: 'rounds', total: 1750, counted: 1745, by: 'Gita Bose', uid: 'U-clk' });
    expect(pg.rows).toEqual([
      { time: '09:45', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '120' },
      { time: '10:20', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '3+4x120' },
      { time: '11:00', to: '', client: '12', part: 'TINA(3303)', fig: '98x8+1' }]);
    expect(await ev(page, `localStorage.getItem('sep_inv_face_page')`)).toBe('{}');
    await expect(page.locator('[data-face-vat-state]')).toHaveAttribute('data-face-vat-state', 'saved');
    // The page for the group, in the shop's shape, and the day total it does not meet asked of the owner.
    const href = await page.locator('[data-face-send="page"]').getAttribute('href');
    expect(decodeURIComponent(href!.split('text=')[1])).toBe(`${dmy()}\nVAT A1 REGISTER\n9:45 AM - NOVA CLAMPS - CLAMP 165X83(40X6) - 120\n` +
      `10:20 AM - NOVA CLAMPS - CLAMP 165X83(40X6) - 3+4x120\n11:00 AM - ORBIT ENGG - TINA(3303) - 98x8+1\nTOTAL 1,745 NOS`);
    expect(await ev(page, `TODO_RULE_FNS.faceCheck().map(function(t){ return t.key; })`)).toEqual([`faceCheck:total|${today}`]);
    await expect(page.locator('[data-card="faceSaved"] [data-face-check]').first()).toContainText('the page’s day total is 1,750; its rounds add to 1,745');

    // Saved again with one figure changed: the run whose rows are as they were stays (its id, whatever was set on it); the one that
    // changed is voided, saying why, and its new reading added; the page before is kept, marked replaced.
    const ids = await ev(page, `prodIndex().live.filter(function(e){ return e.pageId; }).map(function(e){ return e.id; })`);
    await typeIn(page, 2, 'fig', '98x8+2');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Page saved again: 1 run new, 1 run put right, 1 as it was');
    const after = await ev(page, `S.production.entries.filter(function(e){ return e.pageId; }).map(function(e){ return [e.id, e.qty, e.voidedAt ? e.voidReason : 'live']; })`);
    expect(after.filter((x: any) => x[2] === 'live').map((x: any) => x[1]).sort()).toEqual([786, 960]);
    expect(after.find((x: any) => x[0] === ids[0])).toEqual([ids[0], 960, 'live']);
    expect(after.find((x: any) => x[0] === ids[1])).toEqual([ids[1], 785, 'The page was entered again on Mine']);
    expect(await ev(page, `S.production.pages.map(function(p){ return !!p.replacedBy; })`)).toEqual([true, false]);
    // Mine says the register is in.
    await page.locator('[data-card="faceSaved"] [data-action="invFaceFormDone"]').click();
    await expect(page.locator('[data-face-duty="vat"]')).toHaveAttribute('data-state', 'part');
  });

  test('VAT A2’s batches: began, ended, the figure at the end; the day’s power cuts are one log', async ({ page }) => {
    await page.goto(`/?tab=pageFace&v=vat%2Fvat-a2`);
    await waitForBoot(page);
    await expect(page.locator('[data-action="invFaceVatLine"][data-line="vat-a2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="invFaceVatStyle"][data-style="batches"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#faceVatClient0').selectOption('12');
    await page.locator('#faceVatPart0').fill('TINA(3302)');
    await page.locator('#faceVatPart0').blur();
    await typeIn(page, 0, 'time', '10:30');
    await typeIn(page, 0, 'to', '11:45');
    await typeIn(page, 0, 'fig', '3x156');
    // A batch whose start is left blank began where the one before it ended, as the reader takes an END with no START.
    await page.locator('[data-action="invFaceVatAdd"]').click();
    await typeIn(page, 1, 'to', '13:05');
    await typeIn(page, 1, 'fig', '3x156');
    await expect(page.locator('[data-face-vat-reads="0"]')).toContainText('936 NOS in 2 batches');
    // A batch that ends before it begins is refused.
    await typeIn(page, 1, 'time', '13:30');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Batch 2: it ends before it begins');
    await typeIn(page, 1, 'time', '');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Page saved: 1 run, 936 NOS');
    expect(await runs(page, 'vat-a2')).toEqual([['ORBIT ENGG', 'TINA(3302)', 936, '10:30-13:05', 2, 'face', 'register', 'written']]);
    expect(await ev(page, `S.production.entries.find(function(e){ return e.pageId; }).rounds.map(function(r){ return [r.time, r.qty, !!r.batch]; })`))
      .toEqual([['11:45 AM', 468, true], ['1:05 PM', 468, true]]);
    const href = await page.locator('[data-face-send="page"]').getAttribute('href');
    expect(decodeURIComponent(href!.split('text=')[1])).toBe(`${dmy()}\nVAT A2 REGISTER\n10:30 AM TO 11:45 AM - ORBIT ENGG - TINA(3302) - 3x156\nTO 1:05 PM - ORBIT ENGG - TINA(3302) - 3x156\nTOTAL 936 NOS`);
    // Batches written as rounds: a batch's end is the round's time.
    await page.locator('[data-action="invFaceVatStyle"][data-style="rounds"]').click();
    await expect(cell(page, 0, 'time')).toHaveValue('11:45');
    await expect(cell(page, 1, 'time')).toHaveValue('13:05');
    await page.locator('[data-action="invFaceVatStyle"][data-style="batches"]').click();
    await expect(cell(page, 0, 'to')).toHaveValue('11:45');

    // The day's power cuts: one saved with its time back, one open; two close cuts in the one log stay two.
    await page.locator('#faceCutAt').fill('10:26');
    await page.locator('#faceCutBack').fill('10:36');
    await page.locator('[data-action="invFaceVatCut"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Cut saved');
    await page.locator('#faceCutAt').fill('10:40');
    await page.locator('[data-action="invFaceVatCut"]').click();
    await expect(page.locator('[data-face-cut]')).toHaveCount(2);
    await page.locator('#faceCutAt').fill('10:40');
    await page.locator('[data-action="invFaceVatCut"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('That cut is already saved');
    // The pickling hand's message reported the first: it is the same cut, counted once, and both lines' pages list the day's cuts.
    await ev(page, `prodData().entries.push({ id: 'PC1', kind: 'downtime', date: '${today}', time: '10:27', to: '10:35', downtime: { cause: 'power', open: false }, basis: 'pickling', src: 'paste', pasteId: 'PP1', at: 1 }); prodTouch(); saveState(); renderFace()`);
    expect(await ev(page, `prodDowntimeDay('${today}').map(function(c){ return [c.time, c.to, c.reports]; })`)).toEqual([['10:26', '10:36', 2], ['10:40', null, 1]]);
    await page.locator('[data-action="invFaceVatLine"][data-line="vat-a1"]').click();
    await expect(page.locator('[data-face-cut]')).toHaveCount(2);
    expect(await ev(page, `prodData().entries.filter(function(e){ return e.kind === 'downtime' && e.src === 'face'; }).map(function(e){ return [e.logId, e.basis, e.by]; })`))
      .toEqual([[`face|${today}`, 'register', 'Gita Bose'], [`face|${today}`, 'register', 'Gita Bose']]);
    // The open cut is completed where it is shown.
    await page.locator('[data-face-cut] [data-action="invFaceVatCutOpen"]', { hasText: 'Power back' }).click();
    await expect(page.locator('[data-pcs-dialog]')).toBeVisible();
    await expect(page.locator('#pcsTo')).toBeVisible();
  });

  test('a page a photo also holds is warned both ways; corrected in Production it is the owner’s; a round its line never ran is asked', async ({ page }) => {
    // A photo of the A1 page for today is already in the book: the page warns before it is entered, and asks at the save.
    await ev(page, `prodData().photos.push({ id: 'PF1', sha: 'x', date: '${today}' }); prodData().entries.push({ id: 'PH1', kind: 'plated', date: '${today}', time: '09:00', to: '09:30', line: 'vat-a1',
      lineSrc: 'written', slot: 'general', clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP 165X83(40X6)', qty: 240, unit: 'NOS', basis: 'register', src: 'photo', photoId: 'PF1',
      rounds: [{ time: '9:00 AM', qty: 120 }, { time: '9:30 AM', qty: 120 }], at: 1 }); prodTouch(); saveState()`);
    // The page opens on the line with nothing recorded yet that day; the A1 page is a tap away, and warns.
    await openVat(page);
    await expect(page.locator('[data-action="invFaceVatLine"][data-line="vat-a2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-face-vat-dup]')).toHaveCount(0);
    await page.locator('[data-action="invFaceVatLine"][data-line="vat-a1"]').click();
    await expect(page.locator('[data-face-vat-dup]')).toContainText('A photo of the VAT A1 register for this day is already in the book (1 run)');
    await page.locator('#faceVatClient0').selectOption('11');
    await page.locator('#faceVatPart0').fill('CLAMP 165X83(40X6)');
    await page.locator('#faceVatPart0').blur();
    await typeIn(page, 0, 'time', '11:00');
    await typeIn(page, 0, 'fig', '130');
    // A round its line has not run this part at: said as the photo's check says it.
    await expect(page.locator('[data-face-vat-row="0"] [data-face-vat-q="rack"]')).toContainText('130 has not been seen as a round of this part on VAT A1 (usually 120)');
    await page.locator('[data-action="invFaceSave"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Count the day twice?');
    await expect(page.locator('.inv-toast').last()).toContainText('Page saved: 1 run, 130 NOS');
    // Saved, the round is asked of the owner, against the record before the page's day.
    expect(await ev(page, `TODO_RULE_FNS.faceCheck().map(function(t){ return t.key + '|' + t.title; })`))
      .toEqual([`faceCheck:rack|${today}|1 run at a round its line has not run before · ${await ev(page, `formatDate('${today}')`)}`]);
    expect(await ev(page, `faceCheckOf(prodIndex().live.find(function(e){ return e.pageId; }))[0].text`)).toBe('a round of 130, never run for it on VAT A1 before (usually 120)');
    // The photo's check of the same day and line says the page was entered on Mine.
    const ph = await ev(page, `_prodPhoto = { json: { page: 'production', date: '${dmy()}', line: 'VAT-A1', rows: [{ time: '11:00 AM', customer: 'NOVA CLAMPS', part: 'CLAMP 165X83(40X6)', qtyText: '130' }] },
      choices: {}, photoDate: '${today}', url: '', meta: {}, sha: 'y', dupSha: null }; var h = prodPhotoHtml(); _prodPhoto = null; h`);
    expect(ph).toContain('data-prod-photo-mine');
    expect(ph).toContain('The VAT A1 page for this day was entered on Mine by Gita Bose, with the same rounds. Saving the photo as well counts the day twice.');

    // The owner puts the run right in Production: the page is the owner's now, and saving it again here is refused.
    const run = await ev(page, `prodIndex().live.find(function(e){ return e.pageId; }).id`);
    await ev(page, `prodData().entries.push({ id: 'FIX1', kind: 'plated', date: '${today}', time: '11:00', line: 'vat-a1', lineSrc: 'set', slot: 'general', clientId: 11, client: 'NOVA CLAMPS',
      part: 'CLAMP 165X83(40X6)', qty: 120, unit: 'NOS', basis: 'register', src: 'hand', replaces: '${run}', at: 2 }); prodTouch(); saveState()`);
    await typeIn(page, 0, 'fig', '120');
    await page.locator('[data-action="invFaceSave"]').click();
    expect(await answerAsk(page, 'ok')).toContain('This page has 1 run put right in Production (Entries)');
    expect(await ev(page, `S.production.pages.length`)).toBe(1);

    // Back on Mine, then the owner: Today has VAT A1 in, and once the day's lines are all in it names who entered them.
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('[data-tdy-input="production"] .inv-step-meta')).toContainText('VAT A1 in');
    expect(await ev(page, `faceInputBy('production', '${today}')`)).toEqual(['Gita Bose']);
  });

  test('the clerk’s sheet against the supervisor’s roll: each hand that differs is said on the day and ruled by the owner', async ({ page }) => {
    // The supervisor's in-time roll, pasted by the owner: Alfa and Bravo on VAT A1, Charu on the barrel, Delta absent.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    const roll = `${dmy()}/ in time\n----8:30 AM----\n----VAT A1----\n1) ALFA\n2) BRAVO\n----BARREL----\n3) CHARU\n----MONTHLY ABSENT----\n4) DELTA`;
    await ev(page, `relayOpen(${JSON.stringify(roll)}); relayRead(); relaySave();`);
    expect(await ev(page, `Object.keys(S.attendance['${today}'].marks).map(function(id){ var m = S.attendance['${today}'].marks[id]; return id + m.st + m.area; })`))
      .toEqual(['1Pvat-a1', '2Pvat-a1', '3Pbarrel', '4Aflex']);
    // The clerk's sheet, typed on People → Day as the sheet (the duty opens it): Alfa a half day, Charu on VAT A2, Delta present,
    // Echo present (the roll names nobody of that name); Bravo left as the roll has him.
    await lockNow(page);
    await unlock(page, 'U-clk', PINS.super);
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#attSheetEntry')).toBeVisible();
    await page.locator('#attSheetEntry [data-action="invAttSet"][data-id="1"][data-st="H"]').click();
    await page.locator('#attSheetEntry [data-action="invAttSet"][data-id="4"][data-st="P"]').click();
    await page.locator('#attSheetEntry [data-action="invAttSet"][data-id="5"][data-st="P"]').click();
    await page.locator('#attSheetEntry [data-att-area][data-id="3"]').selectOption('vat-a2');
    // Every mark typed carries who typed it; the one left alone is still the roll's.
    expect(await ev(page, `[1, 2, 3, 4, 5].map(function(id){ var m = S.attendance['${today}'].marks[id]; return m.by || m.src; })`)).toEqual(['U-clk', 'relay', 'U-clk', 'U-clk', 'U-clk']);
    await expect(page.locator('[data-att-roll-diffs]')).toHaveAttribute('data-att-roll-diffs', '4');
    await expect(page.locator('#attSheetEntry [data-att-sheet-row="3"] [data-att-roll-q="area"]')).toContainText('VAT A2 on the sheet, Barrel on the roll');
    // Mine says so too; the rulings are the owner's, so the clerk sees the question without them.
    await page.locator('[data-ws="mine"]').first().click();
    await expect(page.locator('[data-face-duty="attsheet"] .inv-step-meta')).toContainText('4 differ from the roll');

    // The owner: one task for the day, a hand a fact.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    const task = await ev(page, `TODO_RULE_FNS.faceAttRoll()[0]`);
    expect(task.title).toBe(`4 hands where the clerk’s sheet and the roll disagree · ${await ev(page, `formatDate('${today}')`)}`);
    expect(task.facts).toEqual([
      ['Alfa', 'half day on the sheet (VAT A1), present on the roll (VAT A1)'],
      ['Charu', 'VAT A2 on the sheet, Barrel on the roll'],
      ['Delta', 'present on the sheet (VAT A2), absent on the roll'],
      ['Echo', 'present on the sheet (Pickling A1+A2); the roll does not name them']]);
    expect(task.go).toEqual({ kind: 'staffDay', date: today });
    // Ruled a hand at a time, in its day: the roll's mark put on the day, or the sheet's kept.
    await ev(page, `todoGo(${JSON.stringify(task.go)})`);
    await expect(page.locator('#pageStaff.inv-page-active')).toBeVisible();
    await ev(page, `attEditOpen(4)`);
    await expect(page.locator('[data-att-roll-ruling="absent"]')).toContainText('present on the sheet (VAT A2), absent on the roll');
    await page.locator('[data-att-roll-ruling] [data-action="invAttRollUse"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('The roll’s mark is on the day');
    expect(await ev(page, `S.attendance['${today}'].marks[4]`)).toMatchObject({ st: 'A', src: 'relay' });
    await expect(page.locator('[data-att-roll-ruling]')).toHaveCount(0);
    await page.locator('[data-att-edit] [data-att-done]').click();
    await ev(page, `attEditOpen(3)`);
    await page.locator('[data-att-roll-ruling] [data-action="invAttRollOk"]').click();
    expect(await ev(page, `S.attendance['${today}'].marks[3].rollOk`)).toMatchObject({ sig: 'area|P|barrel', by: 'Asha Rao' });
    await page.locator('[data-att-edit] [data-att-done]').click();
    // A hand the roll does not name has nothing to put back: only Looks right.
    await ev(page, `attEditOpen(5)`);
    await expect(page.locator('[data-att-roll-ruling="missing"] [data-action="invAttRollUse"]')).toHaveCount(0);
    await page.locator('[data-att-edit] [data-att-done]').click();
    expect(await ev(page, `faceAttDiffs('${today}').map(function(d){ return d.w.name + ':' + d.kind; })`)).toEqual(['Alfa:half', 'Echo:missing']);
    // A ruling is for the roll it was given against: a later roll reading Charu elsewhere asks again.
    const roll2 = `${dmy()}/ in time\n----8:30 AM----\n----VAT A1----\n1) CHARU`;
    await ev(page, `relayOpen(${JSON.stringify(roll2)}); relayRead(); relaySave();`);
    expect(await ev(page, `faceAttDiffs('${today}').map(function(d){ return d.w.name + ':' + d.text; })`)).toContain('Charu:VAT A2 on the sheet, VAT A1 on the roll');
    // The sheet's marks stood throughout: the roll saved later never wrote over them.
    expect(await ev(page, `S.attendance['${today}'].marks[3]`)).toMatchObject({ st: 'P', area: 'vat-a2', by: 'U-clk' });
  });
});
