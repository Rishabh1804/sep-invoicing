import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, todayIso, waitForBoot, switchTab, emptyState, noSeedIM, recentTs, answerAsk, type SepState } from './fixtures';
import { PINS, guardBook, unlock, lockNow } from './p140-guard.fixture';

// P216: the QA chain before PR 146 merges, the entry faces on Mine (the VAT register page, the attendance sheet, the rolls),
// Knowledge, History's verdict and the To-do's folded tasks. Each test fails on the build before its fix. Made-up names; every
// date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const today = todayIso();
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dmy = () => { const d = today.split('-'); return `${d[2]}/${d[1]}/${d[0].slice(2)}`; };
/* A hero's tone, as P194 reads it. */
const toneOf = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => {
  const re = /^inv-(?:hero|tile|fig|dot)-(ok|warning|danger|info|neutral)$/;
  const of = (e: Element) => { for (const c of Array.from(e.classList)) { const m = re.exec(c); if (m) return m[1]; } return null; };
  return of(el) || Array.from(el.querySelectorAll('*')).map(of).find(Boolean) || 'none';
});

/* The floor: five made-up hands, two clients with material, and three earlier days of NOVA's clamp on VAT A1. */
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
    { id: 12, name: 'ORBIT ENGG', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
    // Names the register's reader cannot take apart from the front: an ampersand, a digit.
    { id: 21, name: 'M & M AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 22, name: '3M ENGINEERING', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.incomingMaterial = [...s.incomingMaterial, { id: 'IM-301', challanNo: '301', challanDate: today, clientId: 11, clientName: 'NOVA CLAMPS', receivedDate: today, notes: '',
    createdAt: 1, items: [{ id: 'L1', partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'NOS', qty: 4000, rate: 1, amount: 4000, invoiced: false }] }];
  s.production = { entries: [1, 2, 3].map(n => ({ id: 'R' + n, kind: 'plated', date: addDays(today, -n), time: '09:00', to: '10:00', line: 'vat-a1', lineSrc: 'written', slot: 'general',
    clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP 165X83(40X6)', gauge: '40X6', qty: 360, unit: 'NOS', basis: 'register', src: 'import',
    rounds: [{ time: '9:00 AM', qty: 120, written: '120' }, { time: '9:30 AM', qty: 120, written: '120' }, { time: '10:00 AM', qty: 120, written: '120' }] })),
    // M & M's clamps: a round of 150 is 25X6 or 30X6 (a gauge rule on the client, as the owner set Mehta's).
    gaugeRules: [{ id: 'GR-mm', clientId: 21, family: 'CLAMP', racks: [150], gauges: ['25X6', '30X6'], note: 'test', at: 1 }],
    pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {} } };
  return s;
}
type Who = { id: string; name: string; role: string; pin: string; faces?: string[] };
const OWNER: Who = { id: 'U-own', name: 'Asha Rao', role: 'owner', pin: PINS.owner };
const CLERK: Who = { id: 'U-clk', name: 'Gita Bose', role: 'supervisor', pin: PINS.super, faces: ['attsheet', 'vat'] };
/* The users, made by the guard's own hash; the page reloaded onto the lock. */
async function withUsers(page: Page, users: Who[]) {
  await page.evaluate(async (list) => {
    const w = window as any;
    const S = (0, eval)('S');
    S.users = [];
    for (const u of list) S.users.push(Object.assign({ id: u.id, name: u.name, role: u.role, secret: await w.grdMakeSecret(u.pin), active: true, createdAt: Date.now(), createdBy: null }, u.faces ? { faces: u.faces } : {}));
    await w.saveState();
  }, users);
  await page.reload();
  await waitForBoot(page);
}
async function signIn(page: Page, u: Who) {
  if (await page.locator('#guardRoot').count() === 0) await lockNow(page);
  await unlock(page, u.id, u.pin);
}
const cell = (page: Page, k: number, key: string) => page.locator(`[data-face-vat="${k}"][data-k="${key}"]`);
async function typeIn(page: Page, k: number, key: string, v: string) { const c = cell(page, k, key); await c.fill(v); await c.blur(); }
async function openVat(page: Page) {
  await page.locator('[data-face-duty="vat"] [data-action="invFaceOpen"]').last().click();
  await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'form');
}
/* The in-time roll as the supervisor writes it, pasted by the owner: Alfa and Bravo on VAT A1, Charu on the barrel, Delta absent. */
const ROLL = () => `${dmy()}/ in time\n----8:30 AM----\n----VAT A1----\n1) ALFA\n2) BRAVO\n----BARREL----\n3) CHARU\n----MONTHLY ABSENT----\n4) DELTA`;
const pasteRoll = (page: Page, roll = ROLL()) => ev(page, `relayOpen(${JSON.stringify(roll)}); relayRead(); relaySave();`);
const diffs = (page: Page) => ev(page, `faceAttDiffs('${today}').map(function(d){ return d.w.name + ':' + d.kind; })`);

test.describe('P216: the entry faces on Mine', () => {
  // Each sign-in checks a PIN by the guard's own hash: three or four of them run past the default 30 seconds.
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T17:30:00') });
    await loadAppWithState(page, book());
  });

  // A7 #1: the VAT page sent the client picked as a name, and the reader read names only from their first words.
  test('a VAT page run is the client picked, whatever its name reads as: no question, its rules, saved with its id', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, CLERK);
    await openVat(page);
    await page.locator('#faceVatClient0').selectOption('21');
    await page.locator('#faceVatPart0').fill('CLAMP');
    await page.locator('#faceVatPart0').blur();
    await typeIn(page, 0, 'time', '09:00');
    await typeIn(page, 0, 'fig', '150');
    await page.locator('[data-action="invFaceVatAdd"]').click();
    await page.locator('[data-action="invFaceVatSplit"]').click();
    await page.locator('#faceVatClient1').selectOption('22');
    await page.locator('#faceVatPart1').fill('BRKT 7');
    await page.locator('#faceVatPart1').blur();
    await typeIn(page, 1, 'time', '10:00');
    await typeIn(page, 1, 'fig', '40');
    // Read as the clients picked, never "not a client in the book"; M & M's gauge rule reads the round of 150.
    await expect(page.locator('[data-face-vat-q="client"]')).toHaveCount(0);
    await expect(page.locator('[data-face-vat-reads="0"]')).toContainText('Read as M & M AUTO · CLAMP · gauge 25X6 or 30X6 · 150 NOS');
    await expect(page.locator('[data-face-vat-reads="1"]')).toContainText('Read as 3M ENGINEERING · BRKT 7');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Page saved: 2 runs, 190 NOS');
    expect(await ev(page, `prodIndex().live.filter(function(e){ return e.pageId; }).map(function(e){ return [e.clientId, e.client, e.gaugeOptions || null]; })`))
      .toEqual([[21, 'M & M AUTO', ['25X6', '30X6']], [22, '3M ENGINEERING', null]]);
  });

  // A7 #2: a cut saved on the VAT page was drawn on Mine as a pickling load, with a load's message and Correct.
  test('a power cut saved on the VAT page is a cut on Mine’s What you entered: its times, Power back or Why, no load’s message or Correct', async ({ page }) => {
    await withUsers(page, [OWNER, { ...CLERK, faces: ['pickling', 'vat'] }]);
    await signIn(page, CLERK);
    await openVat(page);
    await page.locator('#faceCutAt').fill('10:26');
    await page.locator('#faceCutBack').fill('10:36');
    await page.locator('[data-action="invFaceVatCut"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Cut saved');
    await page.locator('#faceCutAt').fill('10:40');
    await page.locator('[data-action="invFaceVatCut"]').click();
    await expect(page.locator('[data-face-cut]')).toHaveCount(2);
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    const cuts = page.locator('#faceEntered [data-face-cut-entry]');
    await expect(cuts).toHaveCount(2);
    await expect(cuts.nth(0)).toContainText('Power cut');
    await expect(page.locator('#faceEntered')).not.toContainText('Into the tank');
    await expect(page.locator('#faceEntered [data-face-entry]')).toHaveCount(0);
    await expect(page.locator('#faceEntered [data-action="invFaceCorrect"], #faceEntered [data-face-send]')).toHaveCount(0);
    await expect(page.locator('#faceEntered [data-face-cut-entry]', { hasText: '10:26 AM – 10:36 AM' }).locator('[data-action="invFaceVatCutOpen"]')).toHaveText('Why');
    // The open cut is completed where it is shown.
    await page.locator('#faceEntered [data-face-cut-entry]', { hasText: 'no time back yet' }).locator('[data-action="invFaceVatCutOpen"]').click();
    await expect(page.locator('[data-pcs-dialog]')).toBeVisible();
    await expect(page.locator('#pcsTo')).toBeVisible();
    // Nothing on Mine puts a load in a cut's place.
    expect(await ev(page, `faceDutyOfEntry(prodData().entries.find(function(e){ return e.kind === 'downtime'; }).id)`)).toBeNull();
  });

  // A7 #3: All present wrote marks with nobody's name on them, so the clerk's sheet was never set against the roll.
  test('All present on the clerk’s sheet: every mark carries who typed it, and is set against the roll', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, CLERK);
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#pageStaff.inv-page-active')).toBeVisible();
    await ev(page, `attAllPresent()`);
    expect(await ev(page, `[1, 2, 3, 4, 5].map(function(id){ return S.attendance['${today}'].marks[id].by; })`)).toEqual(['U-clk', 'U-clk', 'U-clk', 'U-clk', 'U-clk']);
    // The supervisor's roll, pasted later by the owner: Delta absent there, present on the clerk's sheet, is asked.
    await signIn(page, OWNER);
    await pasteRoll(page);
    expect(await diffs(page)).toEqual(['Delta:absent', 'Echo:missing']);
  });

  // A7 #8: Looks right was kept against the roll's reading alone, so a mark the clerk changed later was never asked again.
  test('Looks right holds for the marks it was given: the clerk moving the hand again asks again', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, OWNER);
    await pasteRoll(page);
    await signIn(page, CLERK);
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#attSheetEntry [data-att-area][data-id="1"]').selectOption('vat-a2');
    expect(await diffs(page)).toEqual(['Alfa:area']);
    await signIn(page, OWNER);
    await ev(page, `faceAttOk('${today}', '1')`);
    expect(await diffs(page)).toEqual([]);
    // The clerk moves Alfa again: another disagreement than the one the owner ruled on.
    await signIn(page, CLERK);
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#attSheetEntry [data-att-area][data-id="1"]').selectOption('barrel');
    expect(await ev(page, `faceAttDiffs('${today}').map(function(d){ return d.w.name + ':' + d.text; })`)).toEqual(['Alfa:Barrel on the sheet, VAT A1 on the roll']);
  });

  // A7 #9: the clerk's sheet step was in once anybody marked the day, and Material in once any challan was typed in the office.
  test('Mine’s steps are the person’s own: the sheet once they mark it, Material in once it is counted', async ({ page }) => {
    const PICK: Who = { id: 'U-pck', name: 'Ravi Kant', role: 'floor', pin: PINS.office, faces: ['pickling', 'incoming'] };
    await withUsers(page, [OWNER, CLERK, PICK]);
    await signIn(page, OWNER);
    await pasteRoll(page);
    // The roll is in and a challan was typed in the office today: neither is the clerk's sheet, nor the count on arrival.
    await signIn(page, CLERK);
    await expect(page.locator('[data-face-duty="attsheet"]')).toHaveAttribute('data-state', 'wait');
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#attSheetEntry [data-action="invAttSet"][data-id="5"][data-st="P"]').click();
    await page.locator('.inv-navbar-item[data-ws="mine"]').first().click();
    await expect(page.locator('[data-face-duty="attsheet"]')).toHaveAttribute('data-state', 'in');
    await signIn(page, PICK);
    await expect(page.locator('[data-face-duty="incoming"]')).toHaveAttribute('data-state', 'wait');
    // Counted on arrival, on the face: in.
    await page.locator('[data-face-duty="incoming"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#faceClient').selectOption('11');
    await page.locator('#faceChallan').selectOption('IM-301');
    await page.locator('[data-face-cnt="L1"]').fill('4000');
    await page.locator('[data-action="invFaceSave"]').click();
    await page.locator('[data-card="faceSaved"] [data-action="invFaceFormDone"]').click();
    await expect(page.locator('[data-face-duty="incoming"]')).toHaveAttribute('data-state', 'in');
  });

  // A7 #10: Today credited the clerk with the supervisor's roll for one mark typed after it.
  test('Today names a roll by whoever wrote it on a face, never by a mark typed on the day after it', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, OWNER);
    await pasteRoll(page);
    await signIn(page, CLERK);
    await page.locator('[data-face-duty="attsheet"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#attSheetEntry [data-action="invAttSet"][data-id="5"][data-st="P"]').click();
    // The owner's Today: the roll was pasted, nobody wrote it on a face; the clerk's mark after it is not the roll.
    await signIn(page, OWNER);
    expect(await ev(page, `faceInputBy('roll-in', '${today}')`)).toEqual([]);
    await expect(page.locator('[data-tdy-input="roll-in"] .inv-step-meta')).not.toContainText('Gita Bose');
    // A roll written on the clerk's face is theirs.
    await ev(page, `relayPastes().forEach(function(p){ p.face = 'Gita Bose'; }); saveState()`);
    expect(await ev(page, `faceInputBy('roll-in', '${today}')`)).toEqual(['Gita Bose']);
  });

  // A7 #6: an ID whose role makes no floor entries was offered every form, and refused only at its Save.
  test('an ID whose role makes no floor entries is told so on each step of Mine, never handed a form', async ({ page }) => {
    const DESK: Who = { id: 'U-dsk', name: 'Mira Das', role: 'office', pin: PINS.office, faces: ['pickling', 'vat'] };
    await withUsers(page, [OWNER, DESK]);
    await signIn(page, DESK);
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-face-duty] [data-action="invFaceOpen"]')).toHaveCount(0);
    await expect(page.locator('[data-face-duty="vat"] .inv-step-meta')).toContainText('Floor entries are not open to this ID');
    await ev(page, `faceOpen('vat')`);
    await expect(page.locator('#pageFace')).not.toHaveAttribute('data-screen', 'form');
    // The owner's guide says so.
    expect(await ev(page, `kbFind('app-faces-owner').body`)).toContain('**Floor entry**');
  });

  // A7 #11: See their screen outlived the owner's own sign-in.
  test('the owner seeing a person’s screen: the owner signing in again ends it', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, OWNER);
    await ev(page, `faceSeeAs('U-clk')`);
    await expect(page.locator('#faceVerdict .inv-hero-eyebrow')).toContainText('Gita Bose’s screen, as they see it');
    await lockNow(page);
    await unlock(page, OWNER.id, OWNER.pin);
    expect(await ev(page, `_faceUid`)).toBeNull();
    await expect(page.locator('#pageFace.inv-page-active')).toHaveCount(0);
  });

  // A7 #7: Print the day as entered printed a VAT page as typed after the owner voided one of its runs in Production.
  test('the day as entered: a VAT page whose run the owner voided prints from the runs the book holds', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await ev(page, `prodData().pages.push({ id: 'PG1', date: '${today}', line: 'vat-a1', style: 'rounds', by: 'Gita Bose', uid: 'U-clk', at: 1, counted: 1745, total: 1745,
        rows: [{ time: '09:45', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '120' }, { time: '10:20', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '3+4x120' },
          { time: '11:00', to: '', client: '12', part: 'TINA(3303)', fig: '98x8+1' }] });
      prodData().entries.push({ id: 'V1', kind: 'plated', date: '${today}', time: '09:45', to: '10:20', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 11, client: 'NOVA CLAMPS',
        part: 'CLAMP 165X83(40X6)', qty: 960, unit: 'NOS', basis: 'register', src: 'face', pageId: 'PG1', by: 'Gita Bose', rounds: [{ time: '9:45 AM', qty: 120, written: '120' }, { time: '10:20 AM', qty: 840, written: '3+4x120' }], at: 2 },
        { id: 'V2', kind: 'plated', date: '${today}', time: '11:00', to: '11:00', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 12, client: 'ORBIT ENGG',
        part: 'TINA(3303)', qty: 785, unit: 'NOS', basis: 'register', src: 'face', pageId: 'PG1', by: 'Gita Bose', rounds: [{ time: '11:00 AM', qty: 785, written: '98x8+1' }], at: 2,
        voidedAt: 3, voidReason: 'Not plated on this line', voidBy: 'Asha Rao' }); prodTouch(); saveState()`);
    await signIn(page, CLERK);
    await page.locator('[data-action="invFacePrint"][data-kind="filled"]').click();
    const vat = page.locator('.inv-print-view-active [data-sheet="vat-filled"][data-line="vat-a1"]');
    await expect(vat).toContainText('3+4x120');
    await expect(vat).not.toContainText('98x8+1');
    await expect(vat).not.toContainText('ORBIT ENGG');
  });

  // A7 #18: the VAT page's notes ran past the 120 characters a face holds to (P195), the photo's warning to 168.
  test('the VAT page says each state in one line, the photo’s warning included', async ({ page }) => {
    await withUsers(page, [OWNER, CLERK]);
    await signIn(page, CLERK);
    await openVat(page);
    const len = async (sel: string) => ((await page.locator(sel).textContent()) || '').replace(/\s+/g, ' ').trim().length;
    expect(await len('[data-face-vat-state]')).toBeLessThanOrEqual(120);
    await page.locator('[data-action="invFaceVatStyle"][data-style="batches"]').click();
    expect(await len('[data-face-vat-state]')).toBeLessThanOrEqual(120);
    await page.locator('[data-action="invFaceVatStyle"][data-style="rounds"]').click();
    // A photo of the page is in the book: still said, in a line.
    await ev(page, `prodData().photos.push({ id: 'PF1', sha: 'x', date: '${today}' }); prodData().entries.push({ id: 'PH1', kind: 'plated', date: '${today}', time: '09:00', to: '09:30', line: 'vat-a1',
      lineSrc: 'written', slot: 'general', clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP 165X83(40X6)', qty: 240, unit: 'NOS', basis: 'register', src: 'photo', photoId: 'PF1',
      rounds: [{ time: '9:00 AM', qty: 120 }, { time: '9:30 AM', qty: 120 }], at: 1 }); prodTouch(); saveState(); renderFace()`);
    await expect(page.locator('[data-face-vat-dup]')).toContainText('A photo of the VAT A1 page for this day is in the book (1 run)');
    expect(await len('[data-face-vat-dup]')).toBeLessThanOrEqual(120);
    // Saved, then changed on the phone.
    await page.locator('#faceVatClient0').selectOption('11');
    await page.locator('#faceVatPart0').fill('CLAMP 165X83(40X6)');
    await page.locator('#faceVatPart0').blur();
    await typeIn(page, 0, 'time', '11:00');
    await typeIn(page, 0, 'fig', '120');
    await page.locator('[data-action="invFaceSave"]').click();
    expect(await answerAsk(page, 'ok')).toContain('Count the day twice?');
    await expect(page.locator('[data-face-vat-state]')).toHaveAttribute('data-face-vat-state', 'saved');
    await typeIn(page, 0, 'fig', '121');
    await expect(page.locator('[data-face-vat-state]')).toHaveAttribute('data-face-vat-state', 'draft');
    expect(await len('[data-face-vat-state]')).toBeLessThanOrEqual(120);
    // How a batch is written, and the page a photo holds, are the clerk's guide's now.
    expect(await ev(page, `kbFind('app-face-clerk').body`)).toContain('enter only what the photo does not hold');
  });
});

test.describe('P216: History’s verdict counts what was removed', () => {
  function historyBook() {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [...s.clients, { id: 2, name: 'SPARE WORKS', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }];
    s.invoices = [{ id: 'INV-7', invoiceNumber: '00007', displayNumber: 'SEP/TEST-00007', date: today, status: 'active', invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG',
      clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'BRKT-1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130 }], taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7,
      igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '', challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs() }];
    s.invNextNum = 8;
    s.creditNotes = [{ id: 'CN-1', cnNumber: 1, displayNumber: 'CN/001/26-27', date: today, clientId: 1, clientName: 'TEST CLIENT KG', kind: 'adjustment', reason: 'Rate correction',
      taxable: 10, cgstAmt: 0.9, sgstAmt: 0.9, igstAmt: 0, total: 11.8, createdAt: recentTs() }];
    s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true }];
    s.attendance = { [today]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, src: 'relay' } }, extra: [] } };
    s.production = { entries: [{ id: 'PE-1', kind: 'plated', date: today, time: '09:00', line: 'vat-a1', clientId: 1, part: 'BRKT-1', qty: 100, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 }],
      pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {} } };
    return s as SepState;
  }
  /* Each act its own save, ten seconds after the last; the verdict as History draws it. */
  const step = async (page: Page, js: string) => { await page.clock.fastForward(10000); await ev(page, js + '; saveState()'); };
  const removed = async (page: Page) => { await switchTab(page, 'pageHistory'); await ev(page, 'renderHistory()'); return page.locator('#historyVerdict [data-history-removed]').getAttribute('data-history-removed'); };
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T09:00:00') });
    await loadAppWithState(page, historyBook());
  });

  // A7 #4: a day read again from its rolls and a number accounted for counted as removals.
  test('a day read again from its rolls, and a number accounted for, remove nothing', async ({ page }) => {
    await step(page, `attDeleteRecord('${today}', 'read again', 'reread'); S.attendance['${today}'] = { marks: { 1: { st: 'P', area: 'vat-a2', hours: 8, src: 'relay' } }, extra: [] }`);
    await step(page, `getVoidedNumbers().push({ invoiceNumber: '00003', displayNumber: 'SEP/TEST-00003', date: '', clientId: null, clientName: '', taxableValue: 0, grandTotal: 0, lastState: 'unknown',
      wasCancelled: false, reason: 'spoiled pad', reserved: true, source: 'reconciled', voidedAt: Date.now() })`);
    expect(await removed(page)).toBe('0');
    await expect(page.locator('#historyVerdict')).toContainText('nothing removed this week');
  });

  // A1 #2: a credit note cancelled, an entry voided or a client removed is the change log's alone, and was never counted.
  test('what the change log removed, voided or cancelled counts, each act once', async ({ page }) => {
    await step(page, `S.creditNotes[0].cancelledAt = Date.now(); S.creditNotes[0].cancelReason = 'raised twice'`);
    await step(page, `prodData().entries[0].voidedAt = Date.now(); prodData().entries[0].voidReason = 'typed twice'; prodTouch()`);
    await step(page, `S.clients = S.clients.filter(function(c){ return c.id !== 2; })`);
    // An invoice deleted is its tombstone and the invoice removed, in one save: one removal.
    await step(page, `var inv = S.invoices[0]; recordVoidedNumber(inv, 'typo', false); S.invoices.splice(0, 1); imSyncBilled()`);
    expect(await removed(page)).toBe('4');
    await expect(page.locator('#historyVerdict')).toContainText('4 removed or cancelled this week');
  });

  // Seen by b6, fixed by the lead: the list drew a deleted invoice twice (its tombstone, and the change log's "removed invoice",
  // which the tombstone names by number, not id), and a quotation's acts beside the change log's rows of the same saves.
  test('an invoice deleted is one row on the list, its tombstone’s; a quotation issued and voided is one row each', async ({ page }) => {
    const rows = (re: string) => ev(page, `filteredHistoryEvents().filter(function(e){ return ${re}.test(e.text || ''); }).map(function(e){ return e.kind; })`);
    await step(page, `var inv = S.invoices[0]; recordVoidedNumber(inv, 'typo', false); S.invoices.splice(0, 1); imSyncBilled()`);
    expect(await rows('/SEP\\/TEST-00007/')).toEqual(['void']);
    await step(page, `S.quotations = (S.quotations || []).concat([{ id: 'Q-9', num: 9, fy: '26-27', displayNumber: 'SEP/QTN/26-27/009', rev: 0, revOf: null, revReason: '',
      date: '${today}', clientId: 1, to: { name: 'TEST CLIENT KG', address: '', gstin: '', state: '', attn: '' }, intro: '',
      lines: [{ item: 'BRACKET', partNumber: 'BRKT-1', desc: '', basis: 'kg', rate: 14, refWeightKg: null, note: '' }], gstPct: 18, sac: '998873',
      transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15, terms: [], status: 'issued', issuedAt: Date.now(), createdAt: Date.now(), at: Date.now() }])`);
    await step(page, `var q = S.quotations.find(function(x){ return x.id === 'Q-9'; }); q.status = 'void'; q.voidReason = 'sent to the wrong firm'; q.voidedAt = Date.now(); q.at = q.voidedAt`);
    expect((await rows('/QTN\\/26-27\\/009/') as string[]).sort()).toEqual(['quote', 'quoteVoid']);
    // The change log keeps every entry under Changes.
    expect(await ev(page, `(function(){ var t = _historyType; _historyType = 'change'; var n = filteredHistoryEvents().length; _historyType = t; return n; })()`)).toBeGreaterThanOrEqual(3);
  });
});

test.describe('P216: Knowledge', () => {
  test.describe.configure({ timeout: 90_000 });
  const art = (id: string, kind: string, title: string, extra: any = {}) => ({ id, kind, title, summary: 'About ' + title, body: 'Text.', tags: [], links: [], roles: [],
    status: 'published', version: 1, versions: [], src: 'app', by: 'Asha Rao', byId: 'U-own', at: 1, ...extra });

  // A7 #5: list.map(kbRowHtml) handed the index as `brief`, and every row after the first lost what it is about.
  test('every row of Start’s Latest and of a fault’s incidents says what it is about', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.kb = { articles: [art('A1', 'process', 'Pickling'), art('A2', 'process', 'Rinsing', { at: 2 }), art('A3', 'process', 'Drying', { at: 3 }),
      art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels', causes: [] }),
      art('I1', 'incident', 'Peeling on VAT A1', { on: addDays(today, -3), faultId: 'F1' }), art('I2', 'incident', 'Peeling on VAT A2', { on: addDays(today, -2), faultId: 'F1' })],
    trained: [], paths: [] };
    await loadAppWithState(page, s as SepState);
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="start"]').click();
    const metas = await page.locator('#kbRecent [data-kb-row] .inv-row-meta').allTextContents();
    expect(metas.length).toBe(6);
    // Each says its kind and what it is about (a fault, its symptom).
    metas.forEach(m => expect(m).toContain(' · '));
    await ev(page, `kbOpenArticle('F1')`);
    const inc = await page.locator('[data-kb-fault-incidents] [data-kb-row] .inv-row-meta').allTextContents();
    expect(inc.length).toBe(2);
    inc.forEach(m => expect(m).toContain('· About Peeling on VAT'));
  });

  const kbBook = () => {
    const s: any = guardBook();
    s.kb = { articles: [art('D1', 'decision', 'A second rectifier', { decidedOn: addDays(today, -40), reviewOn: addDays(today, -1) }),
      art('W1', 'process', 'Racking', { by: 'Kiran Joshi', byId: 'U-sup',
        pending: { by: 'Chitra Sen', byId: 'U-off', at: 5, v: 1, title: 'Racking', summary: 'About Racking', body: 'Text, changed.', fields: ['body'] } })],
    trained: [], paths: [] };
    return s as SepState;
  };
  const KB_USERS: Who[] = [OWNER, { id: 'U-sup', name: 'Kiran Joshi', role: 'supervisor', pin: PINS.super }, { id: 'U-off', name: 'Chitra Sen', role: 'office', pin: PINS.office }];
  async function knowAs(page: Page, id: string, pin: string, tab: string) {
    if (await page.locator('#guardRoot').count() === 0) await lockNow(page);
    await unlock(page, id, pin);
    await switchTab(page, 'pageKnow');
    await page.locator(`#knowContent .inv-viewtab[data-tab="${tab}"]`).click();
  }

  // A7 #12: Start showed every role the decisions due for review, which are the owner's to do (kbReview).
  test('a decision due for review is on the owner’s Start alone', async ({ page }) => {
    await loadAppWithState(page, kbBook());
    await withUsers(page, KB_USERS);
    await knowAs(page, 'U-sup', PINS.super, 'start');
    await expect(page.locator('#kbReviewDue')).toHaveCount(0);
    await knowAs(page, 'U-own', PINS.owner, 'start');
    await expect(page.locator('#kbReviewDue')).toHaveCount(1);
  });

  // Seen by b6, fixed by the lead: Records told every role a decision was due for review, and Drafts and waiting listed another's
  // change proposed to a published article; both are the owner's and the proposer's, as on Start.
  test('Records counts a review for the owner alone, and Drafts and waiting lists a proposed change to whoever sees it', async ({ page }) => {
    await loadAppWithState(page, kbBook());
    await withUsers(page, KB_USERS);
    const drafts = async () => {
      await ev(page, `_kbFilter.status = 'draft'; renderKnow()`);
      const n = await page.locator('#knowContent [data-kb-row="W1"]').count();
      await ev(page, `_kbFilter.status = ''; renderKnow()`);
      return n;
    };
    await knowAs(page, 'U-sup', PINS.super, 'records');
    await expect(page.locator('#knowContent [data-kb-verdict="records"] .inv-hero-title')).not.toContainText('due for review');
    await page.locator('#knowContent .inv-viewtab[data-tab="library"]').click();
    expect(await drafts()).toBe(0);
    await knowAs(page, 'U-off', PINS.office, 'library');
    expect(await drafts()).toBe(1);
    await knowAs(page, 'U-own', PINS.owner, 'records');
    await expect(page.locator('#knowContent [data-kb-verdict="records"] .inv-hero-title')).toContainText('1 decision due for review');
  });

  // A7 #13: another's change proposed to an article a person wrote read as waiting on its writer; it is its proposer's.
  test('another’s change to an article a person wrote is not waiting on them: it is its proposer’s', async ({ page }) => {
    await loadAppWithState(page, kbBook());
    await withUsers(page, KB_USERS);
    await knowAs(page, 'U-sup', PINS.super, 'library');
    await expect(page.locator('#knowContent [data-kb-verdict="library"] .inv-hero-title')).not.toContainText('waiting for approval');
    await page.locator('#knowContent .inv-viewtab[data-tab="start"]').click();
    await expect(page.locator('#kbMine')).toHaveCount(0);
    await expect(page.locator('#kbAllClear .inv-hero-sub')).toHaveText('nothing of yours waiting, no training due');
    // The writer of the change sees it waiting, on the Library's verdict and on Start.
    await knowAs(page, 'U-off', PINS.office, 'library');
    await expect(page.locator('#knowContent [data-kb-verdict="library"] .inv-hero-title')).toContainText('1 waiting for approval');
    await page.locator('#knowContent .inv-viewtab[data-tab="start"]').click();
    await expect(page.locator('#kbMine [data-kb-row="W1"]')).toHaveCount(1);
  });

  // A7 #14: lessons taught to only some read green, and paths no hand is on read "0 lessons taught to some".
  test('Training’s verdict: part-taught is not up to date, and paths no hand is on say so', async ({ page }) => {
    const lesson = (id: string, title: string) => art(id, 'guide', title);
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.staff = [{ id: 1, name: 'Hand A', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true },
      { id: 2, name: 'Hand B', comp: 'hourly', area: 'vat-a2', hourRate: 60, active: true, onFloor: true }];
    s.kb = { articles: [lesson('G1', 'Rinsing')], trained: [{ id: 't1', staffId: 1, name: 'Hand A', articleId: 'G1', v: 1, at: 5, on: addDays(today, -3) }],
      paths: ['floor', 'supervisor', 'office'].map(r => ({ id: 'kbp-' + r, title: 'Basics ' + r, role: r, articles: ['G1'] })) };
    await loadAppWithState(page, s as SepState);
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="training"]').click();
    const v = '#knowContent > [data-verdict]';
    await expect(page.locator(v + ' .inv-hero-title')).toHaveText('1 lesson taught to some');
    expect(await toneOf(page, v)).toBe('neutral');
    // Every lesson on a path no hand on the roster is for (the office's, with everyone on the floor): nobody to judge.
    await ev(page, `kbData().paths = [{ id: 'kbp-f', title: 'F', role: 'floor', articles: [] }, { id: 'kbp-s', title: 'S', role: 'supervisor', articles: [] },
      { id: 'kbp-o', title: 'O', role: 'office', articles: ['G1'] }]; kbData().trained = []; saveState(); renderKnow()`);
    await expect(page.locator(v + ' .inv-hero-title')).toHaveText('No hand on the roster is on these paths');
    expect(await toneOf(page, v)).toBe('neutral');
  });

  // A1 #5: a link to a screen that has moved, and a search jump to one, did nothing (pageTodo is Needs you's now).
  test('a link to a screen that moved opens where it went, and is named so; a search jump to it too', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.kb = { articles: [art('L1', 'process', 'Chasing the list', { links: [{ type: 'screen', id: 'pageTodo', label: 'To-do' }] })], trained: [], paths: [] };
    await loadAppWithState(page, s as SepState);
    await switchTab(page, 'pageKnow');
    await ev(page, `kbOpenArticle('L1')`);
    const chip = page.locator('[data-action="invKbLinkGo"][data-id="L1"]');
    await expect(chip).toHaveText('Screen: Needs you');
    await chip.click();
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();
    expect(await ev(page, `tdyView()`)).toBe('needs');
    await switchTab(page, 'pageIM');
    await ev(page, `srchGo({ kind: 'place', loc: { tab: 'pageTodo', v: '', id: '', d: '' } })`);
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();
  });
});

test.describe('P216: the To-do’s folded tasks', () => {
  // A2 #1: t.members.map(todoAppRowHtml) handed the index as `brief`: every member after the first lost its line and reason.
  test('a fold’s dialog draws every member in full', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [1, 2, 3].map(id => ({ id, name: ['ALPHA', 'BETA', 'GAMMA'][id - 1], billingMode: 'weight', rates: [], isActive: true }));
    await loadAppWithState(page, s as SepState);
    await page.evaluate(() => {
      const w: any = window;
      const owed = (id: number, amount: number) => ({ key: 'owed90:' + id, rule: 'owed90', tone: 'amber', clientId: id, amount, title: 'Client ' + id + ' owes',
        sub: 'Line of client ' + id, why: 'Receivables · over 90 days', facts: [], clears: 'c', go: { kind: 'finance', tab: 'receipts', client: id }, goLabel: 'Open the client', sig: String(amount) });
      Object.keys(w.TODO_RULE_FNS).forEach(k => { w.TODO_RULE_FNS[k] = () => []; });
      w.TODO_RULE_FNS.owed90 = () => [owed(1, 100), owed(2, 500), owed(3, 250)];
    });
    await ev(page, `todoOpenFold('fold:owed90')`);
    const rows = page.locator('[data-todo-fold="owed90"] [data-todo="app"]');
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(rows.nth(i).locator('.inv-row-meta').first()).toContainText('Line of client');
  });
});
