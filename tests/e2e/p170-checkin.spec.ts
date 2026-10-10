import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, readStoredState, type SepState, toolbarMore } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P170 (owner, 7 Oct 2026, docs/WORKERS_AND_PLANT.md W5): the office QR. A worker's phone opens checkin.html from the sheet,
// writes a check-in and sends it to the office on WhatsApp; the app reads the chat and checks each one against a proxy.
// Made-up names, numbers and places only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const PLANT = { lat: 22.8001, lng: 86.1501 };
const KEY = 'TESTK1';
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company || {}, { name: 'TEST WORKS' });
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true, card: 'SEP-0001', profile: { phone: '98765 43210' } },
    { id: 2, name: 'Bina Devi', comp: 'monthly', dayRate: 500, area: 'barrel', active: true, card: 'SEP-0002', profile: { phone: '91234 56780' } },
    { id: 3, name: 'Chandan Oraon', comp: 'daily', dayRate: 400, area: 'flex', active: true, card: 'SEP-0003' }];
  s.checkinCfg = { office: '919000000001', lat: PLANT.lat, lng: PLANT.lng, radius: 150, key: KEY, keyOn: todayIso() };
  return s;
}
const dmy = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
/* A check-in as the worker's page writes it, with its WhatsApp line; `code` overrides the worked code (a hand-made one). */
async function msg(page: Page, o: { from: string; card: string; hhmm: string; sent?: string; lat?: number; lng?: number; code?: string }) {
  const iso = todayIso(), [h, m] = o.hhmm.split(':').map(Number);
  const lat = (o.lat ?? PLANT.lat).toFixed(6), lng = (o.lng ?? PLANT.lng).toFixed(6);
  const code = o.code || await g(page, `ckCode('${KEY}', '${o.card}', '${iso}', ${h * 60 + m}, '${lat},${lng}', '')`);
  const sent = o.sent || o.hhmm, sh = +sent.split(':')[0], clock = (sh % 12 || 12) + ':' + sent.split(':')[1] + (sh < 12 ? ' am' : ' pm');
  return `${dmy(iso)}, ${clock} - ${o.from}: SEP check-in\nCard ${o.card}\nTime ${dmy(iso)} ${o.hhmm}\nPlace ${lat},${lng} ±12 m\nCode ${code}`;
}

test.describe('P170 the office QR', () => {
  test('the worker’s page writes the check-in the app checks, and opens WhatsApp to the office', async ({ page, context }) => {
    await loadAppWithState(page, book());
    const url: string = await g(page, `ckUrl(ckCfg())`);
    expect(url).toContain('/checkin.html#o=919000000001&la=22.80010&lo=86.15010&r=150&k=TESTK1&n=TEST%20WORKS');
    expect(await g(page, `qrMatrix(${JSON.stringify(url)}) !== null`)).toBe(true);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: PLANT.lat + 0.0002, longitude: PLANT.lng, accuracy: 12 });
    const phone = await context.newPage();
    await phone.goto(url.replace(/^https?:\/\/[^/]+/, ''));
    await expect(phone.locator('#ckCo')).toHaveText('TEST WORKS');
    await phone.fill('#ckCard', '2');
    await phone.click('#ckGo');
    await expect(phone.locator('#ckSay')).toHaveText('At the plant. Now send it.');
    const text = await phone.locator('#ckMsg').textContent();
    expect(text).toMatch(/^SEP check-in\nCard SEP-0002\nTime \d\d\/\d\d\/\d{4} \d\d:\d\d\nPlace 22\.800300,86\.150100 ±12 m\nCode [0-9A-Z]{4}$/);
    const href = await phone.locator('#ckSend').getAttribute('href');
    expect(href!.startsWith('https://wa.me/919000000001?text=')).toBe(true);
    expect(decodeURIComponent(href!.split('text=')[1])).toBe(text);
    expect(await phone.evaluate(() => localStorage.getItem('sep_ck_card'))).toBe('SEP-0002');
    // The app reads it: the code the page worked out is the code the app works out.
    const r: any = await g(page, `ckReview(ckFromText(${JSON.stringify('07/10/2026, 8:27 am - +91 91234 56780: ' + text)}))[0].notes.filter(function (n) { return /code/i.test(n[1]); }).length`);
    expect(r).toBe(0);
    // A link missing its settings says so and offers nothing.
    await phone.goto('/checkin.html#o=91');
    await expect(phone.locator('#ckSay')).toContainText('not complete');
    await expect(phone.locator('#ckGo')).toBeHidden();
  });

  test('the checks against a proxy: another’s phone, outside the plant, a hand-made code, one phone two people, sent late', async ({ page }) => {
    await loadAppWithState(page, book());
    const text = [
      await msg(page, { from: '+91 98765 43210', card: 'SEP-0001', hhmm: '08:20' }),                 // Asha, her own phone: clean
      await msg(page, { from: '+91 98765 43210', card: 'SEP-0002', hhmm: '08:22' }),                 // Bina's card, Asha's phone
      await msg(page, { from: '+91 91234 56780', card: 'SEP-0002', hhmm: '08:40', lat: 22.82 }),     // Bina, 2 km away
      await msg(page, { from: 'Chandan', card: 'SEP-0003', hhmm: '08:30', code: 'ZZZZ' }),           // a code typed by hand
      await msg(page, { from: 'Chandan', card: 'SEP-0003', hhmm: '17:02', sent: '19:30' }),          // sent hours after it was made
    ].join('\n');
    const rows: any[] = await g(page, `ckReview(ckFromText(${JSON.stringify(text)})).map(function (r) { return { who: r.w && r.w.name, tone: r.tone, tick: r.tick, notes: r.notes.map(function (n) { return n[1]; }).join(' | ') }; })`);
    expect(rows.map(r => r.who + ':' + r.tone)).toEqual(['Asha Kumari:ok', 'Bina Devi:danger', 'Chandan Oraon:danger', 'Bina Devi:danger', 'Chandan Oraon:warning']);
    expect(rows[1].notes).toContain('Sent from Asha Kumari’s phone.');
    expect(rows[1].notes).toContain('The same phone checked in Asha Kumari that day.');
    expect(rows[2].notes).toContain('The code does not match');
    expect(rows[3].notes).toContain('2.2 km from the plant.');
    expect(rows[4].notes).toContain('Sent 2 hours after the time it carries.');
    expect(rows.map(r => r.tick)).toEqual([true, false, false, false, true]);
  });

  test('pasted in the paste box: reviewed, the ticked ones saved as the day’s in and out, a repeat already in the day', async ({ page }) => {
    await loadAppWithState(page, book());
    const text = [await msg(page, { from: '+91 98765 43210', card: 'SEP-0001', hhmm: '08:20' }),
      await msg(page, { from: '+91 98765 43210', card: 'SEP-0002', hhmm: '08:22' }),
      await msg(page, { from: '+91 98765 43210', card: 'SEP-0001', hhmm: '17:10' })].join('\n');
    await switchTab(page, 'pageStaff');
    await g(page, `addPaste(${JSON.stringify(text)})`);
    const dlg = page.locator('[data-ck-review]');
    await expect(dlg.locator('[data-ck-row]')).toHaveCount(3);
    await expect(dlg.locator('#ckRedNote')).toContainText('1 check-in fails');
    await expect(page.locator('#ckSaveBtn')).toHaveText('Save 2 check-ins');
    await page.locator('#ckSaveBtn').click();
    const m: any = await g(page, `(function () { var d = attDay('${todayIso()}'); return { a: [d.marks[1].inMin, d.marks[1].outMin, d.marks[1].hours], b: d.marks[2] || null, via: d.scans[1].map(function (s) { return s.via; }) }; })()`);
    expect(m.a).toEqual([500, 1030, 8]);
    expect(m.b).toBeNull();
    expect(m.via).toEqual(['checkin', 'checkin']);
    // The same chat pasted again: both already in the day, nothing to save.
    await g(page, `addPaste(${JSON.stringify(text)})`);
    await expect(page.locator('[data-ck-review] [data-ck-note]', { hasText: 'Already in the day.' })).toHaveCount(2);
    await expect(page.locator('#ckSaveBtn')).toHaveText('Nothing to save');
  });

  test('the owner sets it up and prints the sheet; a supervisor has no door to it', async ({ page }) => {
    const s: any = book();
    delete s.checkinCfg;
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await toolbarMore(page, 'Office QR');   // the Roster toolbar's More (TM4b)
    await page.fill('#ckOffice', '+91 90000 00001');
    await page.fill('#ckLat', '22.8001');
    await page.fill('#ckLng', '86.1501');
    await page.locator('[data-action="invCkPrint"]').click();
    const sheet = page.locator('#invPrintBody [data-ck-sheet]');
    await expect(sheet).toContainText('Mark your attendance');
    await expect(sheet).toContainText('TEST WORKS');
    await expect(sheet.locator('svg.inv-qr path')).toHaveCount(1);
    const cfg: any = await g(page, `ckCfg()`);
    expect([cfg.office, cfg.lat, cfg.lng, cfg.radius, /^[0-9A-Z]{6}$/.test(cfg.key)]).toEqual(['919000000001', 22.8001, 86.1501, 150, true]);
    expect((await readStoredState(page) as any).checkinCfg.key).toBe(cfg.key);
  });

  test('a supervisor reads check-ins but never sets up the sheet', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    // The Roster toolbar's More has no Office QR for a supervisor (TM4b).
    await toolbarMore(page);
    await expect(page.locator('[data-tb-more-dialog] [data-tb-pick]', { hasText: 'Import a roster' })).toHaveCount(1);
    await expect(page.locator('[data-tb-more-dialog] [data-tb-pick][data-action="invCkSetup"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await g(page, `ckSetupOpen()`);
    await expect(page.locator('[data-ck-setup]')).toHaveCount(0);
  });
});
