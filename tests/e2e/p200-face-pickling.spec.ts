import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, todayIso, waitForBoot, workingDaysBack, answerAsk } from './fixtures';
import { PINS, guardBook, unlock, lockNow } from './p140-guard.fixture';

// P200: the pickling hand's face (docs/ENTRY_FACES.md, F2; owner, 10 Oct 2026: "[the pickling hand] - Pickling", "When it goes
// into the tank", "Trusted but open for me to verify if cross verification with other linked data doesn't happen"). A load and
// material counted in are entered on Mine itself; each save is the record a paste of the same message makes, and gives the
// message for the group, which pasted later is known and never read twice; the entry is set against what it links to, and the
// owner is asked only where they disagree. Made-up names; every date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const [today, wd1, wd2] = workingDaysBack(3);
const dmy = (iso: string) => { const d = iso.split('-'); return `${d[2]}/${d[1]}/${d[0].slice(2)}`; };

function line(id: string, partNumber: string, desc: string, unit: string, qty: number, nosQty?: number) {
  return { id, partNumber, desc, unit, qty, nosQty: nosQty || 0, rate: 1, amount: qty, invoiced: false };
}
function book() {
  const s: any = guardBook();
  s.clients = [...s.clients,
    { id: 11, name: 'NOVA CLAMPS', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
    { id: 12, name: 'ORBIT PRESS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 13, name: 'QUIET WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.incomingMaterial = [...s.incomingMaterial,
    { id: 'IM-301', challanNo: '301', challanDate: wd2, clientId: 11, clientName: 'NOVA CLAMPS', receivedDate: wd2, notes: '', createdAt: 1,
      items: [line('L1', 'CLAMP 165X83 (NT)', '40X6', 'NOS', 1000), line('L2', 'CLAMP 133X83 (NT)', '35X6', 'NOS', 400)] },
    { id: 'IM-77', challanNo: '77', challanDate: wd1, clientId: 12, clientName: 'ORBIT PRESS', receivedDate: wd1, notes: '', createdAt: 2,
      items: [line('L3', '5206 4920 0106', 'Bracket', 'KG', 120, 500)] }];
  return s;
}
/* The owner and the pickling hand, whose face is the loads and what comes in. */
async function withHand(page: Page) {
  await page.evaluate(async (pins) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, faces?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, faces ? { faces } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-pick', 'Dina Roy', 'floor', pins.office, ['pickling', 'incoming'])];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
}
/* Entries put straight into the book, as a face or the register wrote them. */
async function seed(page: Page, entries: any[]) {
  await page.evaluate((list) => {
    const w = window as any;
    w.prodData().entries.push(...list);
    w.prodTouch();
    return w.saveState();
  }, entries);
}
const face = (id: string, date: string, time: string, clientId: number, part: string, gauge: string, qty: number, extra?: any) =>
  ({ id, kind: 'pickled', date, time, clientId, part, partNumber: part, gauge, qty, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Dina Roy', at: 1, ...(extra || {}) });
const run = (id: string, date: string, time: string, line: string, clientId: number, part: string, qty: number, extra?: any) =>
  ({ id, kind: 'plated', date, time, line, lineSrc: 'written', slot: 'general', clientId, part, qty, unit: 'NOS', basis: 'register', src: 'photo', at: 1, ...(extra || {}) });

test.describe('P200: the pickling hand’s face', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T11:30:00') });
    await loadAppWithState(page, book());
    await withHand(page);
  });

  test('a load into the tank on Mine: the client’s open parts first, saved as a paste’s record, its message refused when pasted', async ({ page }) => {
    await unlock(page, 'U-pick', PINS.office);
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
    await page.locator('[data-face-duty="pickling"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('[data-face-form="pickling"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.search)).toContain('v=pickling');
    await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'form');
    // The clients with material open lead; a client's parts with a challan open lead, with what is open on them.
    expect(await page.locator('#faceClient optgroup').first().getAttribute('label')).toBe('Material open');
    expect(await page.locator('#faceClient optgroup').first().locator('option').allInnerTexts()).toEqual(['NOVA CLAMPS', 'ORBIT PRESS']);
    await page.locator('#faceClient').selectOption('11');
    const parts = page.locator('#facePart optgroup[label="On a challan, open"] option');
    await expect(parts).toHaveCount(2);
    const p165 = parts.filter({ hasText: '165X83' });
    await expect(p165).toContainText('1,000 NOS open');
    await page.locator('#facePart').selectOption({ label: (await p165.innerText()).trim() });
    await expect(page.locator('[data-face-open]')).toHaveText('Open on challan 301: 1,000 NOS');
    await expect(page.locator('#faceUnit')).toHaveValue('NOS');
    await expect(page.locator('#faceTime')).toHaveValue('11:30');
    // Typed and left: asked first, Stay keeps the form as typed.
    await page.locator('#faceQty').fill('600');
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#faceQty')).toHaveValue('600');
    await page.locator('[data-action="invFaceSave"]').click();

    // The record a paste makes, entered by the person, with the key of its message.
    const e = await ev(page, `S.production.entries.find(function(x){ return x.src === 'face'; })`);
    expect(e).toMatchObject({ kind: 'pickled', date: today, time: '11:30', clientId: 11, part: 'CLAMP 165X83 (NT)', partNumber: 'CLAMP 165X83 (NT)', gauge: '40X6',
      qty: 600, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Dina Roy' });
    expect(e.msgHash).toBeTruthy();
    // The form stays for the next: the client carries over, the part and the figure clear; the load is listed with its message.
    await expect(page.locator('#faceClient')).toHaveValue('11');
    await expect(page.locator('#facePart')).toHaveValue('');
    await expect(page.locator('#faceQty')).toHaveValue('');
    const row = page.locator('[data-card="faceSaved"] [data-face-entry]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Into the tank at 11:30 AM · 600 NOS');
    const href = await row.locator('[data-face-send]').getAttribute('href');
    expect(href!.startsWith('https://wa.me/?text=')).toBe(true);
    const msg = decodeURIComponent(href!.slice('https://wa.me/?text='.length));
    expect(msg).toBe(`${dmy(today)}\nNOVA CLAMPS\nCLAMP 165X83 (NT) (40X6) - 600 NOS\nPICKLING TIME 11:30 AM`);
    // Mine says it is in, and lists it.
    await page.locator('[data-card="faceSaved"] [data-action="invFaceFormDone"]').click();
    await expect(page.locator('[data-face-duty="pickling"]')).toHaveAttribute('data-state', 'in');
    await expect(page.locator('#faceEntered [data-face-entry]')).toHaveCount(1);

    // The message sent to the group and pasted later by the owner is known as entered: left out, nothing to save.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('[data-tdy-input="pickling"] .inv-step-meta')).toContainText('by Dina Roy');
    const pasted = `${dmy(today)}, 11:34 am - Dina Roy: ` + msg;
    await ev(page, `prodOpenPaste(${JSON.stringify(pasted)})`);
    await expect(page.locator('[data-prod-msg="0"]')).toContainText('Entered on a face by Dina Roy: left out.');
    await expect(page.locator('[data-action="invProdSaveReview"]')).toBeDisabled();
    // The same load typed again by hand (another spelling, a few minutes on) is left out by its figures.
    const retyped = `${dmy(today)}, 11:40 am - Dina Roy: Nova clamps\nclamp 165x83(40x6)--600 nos\npickling time 11:32am`;
    await ev(page, `prodOpenPaste(${JSON.stringify(retyped)})`);
    await expect(page.locator('#prodTwinNote')).toContainText('1 line in this paste was entered on a face already');
    await expect(page.locator('[data-prod-twin]')).toContainText('Entered on a face by Dina Roy at 11:30 AM');
    await expect(page.locator('[data-action="invProdSaveReview"]')).toBeDisabled();
  });

  test('Material in, counted against the challan, and a correction from Mine', async ({ page }) => {
    await unlock(page, 'U-pick', PINS.office);
    await page.locator('[data-face-duty="incoming"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#faceClient').selectOption('12');
    await page.locator('#faceChallan').selectOption('IM-77');
    const l3 = page.locator('[data-face-line="L3"]');
    await expect(l3).toContainText('The challan says 500 NOS');
    await l3.locator('input').fill('480');
    await page.locator('[data-action="invFaceSave"]').click();
    const a = await ev(page, `S.production.entries.find(function(x){ return x.kind === 'arrived'; })`);
    expect(a).toMatchObject({ date: today, time: '11:30', clientId: 12, part: '5206 4920 0106', qty: 480, unit: 'NOS', basis: 'floor-in', src: 'face', imId: 'IM-77',
      imItemId: 'L3', challanNo: '77', by: 'Dina Roy' });
    // Twenty short of the challan: the question is on the entry at once, red, since the challan bills what did not come.
    const row = page.locator('[data-card="faceSaved"] [data-face-entry]');
    await expect(row.locator('[data-face-check]')).toContainText('To check: challan 77 says 500 NOS: 20 NOS short');
    await expect(row.locator('[data-face-check] .inv-dot')).toHaveClass(/inv-dot-danger/);
    const msg = decodeURIComponent((await row.locator('[data-face-send]').getAttribute('href'))!.split('text=')[1]);
    expect(msg).toBe(`${dmy(today)}\nINCOMING MATERIAL TIME 11:30 AM\nORBIT PRESS\n5206 4920 0106 - 480 NOS`);

    // Correct: the form on the entry as it stands; saved, it takes the entry's place and Mine lists both.
    await row.locator('[data-action="invFaceCorrect"]').click();
    await expect(page.locator('#faceContent .inv-pagehead-title')).toHaveText('Correct what came in');
    await expect(page.locator('#faceQty')).toHaveValue('480');
    await page.locator('#faceQty').fill('500');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('#faceVerdict')).toBeVisible();
    const st = await ev(page, `S.production.entries.filter(function(x){ return x.kind === 'arrived'; })`);
    expect(st).toHaveLength(2);
    expect(st[1]).toMatchObject({ replaces: st[0].id, qty: 500, imItemId: 'L3' });
    await expect(page.locator('#faceEntered [data-face-entry="' + st[0].id + '"]')).toContainText('Corrected');
    await expect(page.locator('#faceEntered [data-face-entry="' + st[1].id + '"] [data-face-check]')).toHaveCount(0);

    // Not in the book yet: the part typed as written.
    await page.locator('[data-face-duty="incoming"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#faceClient').selectOption('13');
    await page.locator('#faceChallan').selectOption('__none');
    await page.locator('#facePart').selectOption('__typed');
    await page.locator('#facePartText').fill('HINGE PLATE 7');
    await page.locator('#faceQty').fill('90');
    await page.locator('#faceChallanNo').fill('0412');
    await page.locator('[data-action="invFaceSave"]').click();
    const b = await ev(page, `S.production.entries.filter(function(x){ return x.kind === 'arrived'; }).pop()`);
    expect(b).toMatchObject({ clientId: 13, part: 'HINGE PLATE 7', qty: 90, unit: 'NOS', challanNo: '0412', src: 'face' });
    expect(b.imItemId).toBeUndefined();
    // A form is left with its page: Mine opens on the face again.
    await page.locator('.inv-navbar-item[data-ws="today"]').click();
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();
    await page.locator('.inv-navbar-item[data-ws="mine"]').click();
    await expect(page.locator('#faceVerdict')).toBeVisible();
    await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'overview');
  });

  test('the checks: no plating, past the challan, a count, no challan, a run with no load; the owner rules Looks right', async ({ page }) => {
    await seed(page, [
      // wd2: a load that never met a run, though VAT A2 was recorded; and a count with no challan in the book.
      face('F1', wd2, '09:00', 11, 'CLAMP 165X83 (NT)', '40X6', 600),
      run('R0', wd2, '10:00', 'vat-a2', 12, 'BRACKET 9', 50),
      { id: 'P0', kind: 'pickled', date: wd2, time: '08:45', clientId: 12, part: 'BRACKET 9', qty: 50, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 },
      { id: 'A1', kind: 'arrived', date: wd2, time: '09:10', clientId: 13, part: 'HINGE PLATE 7', qty: 90, unit: 'NOS', basis: 'floor-in', src: 'face', by: 'Dina Roy', at: 1 },
      // wd1: two loads of the 133 clamp against a challan of 400, and a VAT A1 run no load became.
      face('F2', wd1, '09:00', 11, 'CLAMP 133X83 (NT)', '35X6', 300),
      face('F3', wd1, '10:00', 11, 'CLAMP 133X83 (NT)', '35X6', 300),
      run('R1', wd1, '09:30', 'vat-a1', 11, 'CLAMP 133X83 (NT)', 600, { gauge: '35X6' }),
      run('R2', wd1, '14:00', 'vat-a1', 12, 'GUIDE 88', 40),
      // wd1: counted twenty short of challan 77's 500.
      { id: 'A2', kind: 'arrived', date: wd1, time: '09:05', clientId: 12, part: '5206 4920 0106', partNumber: '5206 4920 0106', qty: 480, unit: 'NOS', basis: 'floor-in', src: 'face',
        imId: 'IM-77', imItemId: 'L3', challanNo: '77', by: 'Dina Roy', at: 1 },
    ]);
    const c = await ev(page, `(function(){ var c = faceChecks(); var o = {}; Object.keys(c.byId).forEach(function(id){ o[id] = c.byId[id].map(function(x){ return x.code + ':' + x.tone; }); }); return o; })()`);
    expect(c).toEqual({ F1: ['noplate:amber'], A1: ['inNoChallan:amber'], F3: ['over:amber'], A2: ['count:red'], R2: ['noload:amber'] });
    const texts = await ev(page, `[faceCheckOf(prodIndex().byId.F3)[0].text, faceCheckOf(prodIndex().byId.F1)[0].text]`);
    expect(texts[0]).toBe('200 NOS past its challans: they hold 400 NOS, 300 NOS of it pickled before this load');
    expect(texts[1]).toContain('no plating of it found by noon on');
    // One task a check and a day, the owner's; the count short is red.
    const tasks = await ev(page, `TODO_RULE_FNS.faceCheck().map(function(t){ return t.key + '|' + t.tone; }).sort()`);
    expect(tasks).toEqual([`faceCheck:count|${wd1}|red`, `faceCheck:inNoChallan|${wd2}|amber`, `faceCheck:noload|${wd1}|amber`, `faceCheck:noplate|${wd2}|amber`, `faceCheck:over|${wd1}|amber`]);

    // The owner opens them on Production → Entries → To check, and keeps the load that had no plating as entered.
    await unlock(page, 'U-own', PINS.owner);
    await ev(page, `todoGo({ kind: 'production', tab: 'entries', flag: 'check' })`);
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(5);
    const f1 = page.locator('#prodEntries [data-prod-entry="F1"]');
    await expect(f1.locator('[data-prod-badges]')).toContainText('to check');
    await expect(f1.locator('[data-face-check-q="noplate"]')).toContainText('To check: no plating of it found');
    await ev(page, `faceCheckOk('F1', 'noplate')`);
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(4);
    const f = (await readStoredState(page)).production.entries.find((x: any) => x.id === 'F1');
    expect(f.checkOk).toMatchObject({ codes: ['noplate'], by: 'Asha Rao' });   // saved: read from what a reload would load
    expect(await ev(page, `TODO_RULE_FNS.faceCheck().some(function(t){ return t.key.indexOf('faceCheck:noplate') === 0; })`)).toBe(false);
  });

  test('a named load links to the register’s run of its kind or code, never to a run naming another part', async ({ page }) => {
    await seed(page, [
      face('F1', wd1, '09:00', 11, 'CLAMP 165X83 (NT)', '40X6', 600),
      run('R1', wd1, '10:00', 'vat-a1', 11, 'CLAMP', 360, { gaugeOptions: ['35X6', '35X8', '40X6'] }),
      run('R2', wd1, '10:30', 'vat-a2', 11, 'CLAMP 133X83', 240, { gauge: '40X6' }),
      run('R3', wd1, '11:00', 'vat-a2', 11, 'CLAMP', 150, { gaugeOptions: ['25X6', '30X6'] }),
      face('F2', wd1, '09:30', 12, '5206 4920 0106', '', 50),
      run('R4', wd1, '11:00', 'vat-a2', 12, 'KUDAL(0106)', 50),
      // A pasted load names a part no run is of: still unknown.
      { id: 'P1', kind: 'pickled', date: wd1, time: '09:40', clientId: 11, part: 'CLAMP 90X81', gauge: '40X6', qty: 100, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 },
    ]);
    const m = await ev(page, `(function(){ var m = prodIndex().match; return { f1: m.F1, f2: m.F2, p1: m.P1, l1: prodLoadLine(prodIndex().byId.F1) }; })()`);
    expect(m.f1).toMatchObject({ ids: ['R1'], line: 'vat-a1', by: 'kind' });
    expect(m.f2).toMatchObject({ ids: ['R4'], line: 'vat-a2', by: 'code' });
    expect(m.p1).toMatchObject({ ids: [] });
    expect(m.l1).toMatchObject({ line: 'vat-a1', how: 'plating' });
  });
});
