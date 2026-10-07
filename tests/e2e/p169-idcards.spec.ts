import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, answerAsk, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P169 (owner, 7 Oct 2026, docs/WORKERS_AND_PLANT.md W4): ID cards with a QR code, and the scanner that logs them into the day.
// The app's own QR encoder was checked by decoding what it draws (OpenCV's detector, 13 texts, versions 1–10, all read back);
// here its structure is checked in the browser, and the card flow end to end. Made-up names only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company || {}, { name: 'TEST WORKS' });
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true, profile: { designation: 'Line technician', bloodGroup: 'B+' } },
    { id: 2, name: 'Bina Devi', comp: 'monthly', dayRate: 500, area: 'barrel', active: true },
    { id: 3, name: 'Chandan Oraon', comp: 'daily', dayRate: 400, area: 'flex', active: false, card: 'SEP-0003' }];
  return s;
}
const at = (h: number, m: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setHours(h, m, 0, 0); return d.getTime(); };

test.describe('P169 ID cards and the scanner', () => {
  test('the QR is a well-formed code: finders, timing, format bits that check', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var m = qrMatrix('SEP1:W:SEP-0007:' + idcCheck('SEP-0007')), n = m.length;
      var finder = function (r0, c0) { for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) { var e = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4); if (m[r0 + r][c0 + c] !== e) return false; } return true; };
      var timing = true; for (var i = 8; i < n - 8; i++) if (m[6][i] !== (i % 2 === 0) || m[i][6] !== (i % 2 === 0)) timing = false;
      var bits = 0; for (var k = 0; k < 6; k++) bits |= (m[k][8] ? 1 : 0) << k;
      bits |= (m[7][8] ? 1 : 0) << 6; bits |= (m[8][8] ? 1 : 0) << 7; bits |= (m[8][7] ? 1 : 0) << 8; for (var j = 9; j < 15; j++) bits |= (m[8][14 - j] ? 1 : 0) << j;
      var raw = bits ^ 0x5412, data = raw >> 10;
      return { n: n, finders: finder(0, 0) && finder(0, n - 7) && finder(n - 7, 0), timing: timing, level: data >> 3, bch: qrBch(data, 0x537, 11) === (raw & 1023), dark: m[n - 8][8], big: qrMatrix('x'.repeat(213)).length, over: qrMatrix('x'.repeat(214)) };
    })()`);
    expect(r).toEqual({ n: 25, finders: true, timing: true, level: 0, bch: true, dark: true, big: 57, over: null });
  });

  test('a scan logs in, the next out; a repeat is the same scan; undo puts it back', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      idcEnsure(staffById(1));
      var card = staffById(1).card, out = [];
      out.push(idcScan('SEP1:W:' + card + ':' + idcCheck(card), ${at(8, 27)}).kind);
      out.push(idcScan(card, ${at(8, 28)}).same ? 'same' : 'logged');
      out.push(idcScan(card.replace('SEP-000', ''), ${at(17, 5)}).kind);   // a number typed short
      var m = attMark('${todayIso()}', 1);
      var before = [m.inMin, m.outMin, m.hours, m.src || ''];
      idcUndo();
      var m2 = attMark('${todayIso()}', 1);
      return { card: card, out: out, before: before, after: [m2.inMin, m2.outMin == null ? null : m2.outMin], scans: attDay('${todayIso()}').scans[1].length };
    })()`);
    expect(r.card).toBe('SEP-0004');   // past every card given, the leaver's included
    expect(r.out).toEqual(['in', 'same', 'out']);
    expect(r.before).toEqual([507, 1025, 8, '']);
    expect(r.after).toEqual([507, null]);
    expect(r.scans).toBe(1);
  });

  test('refused and said: a misread code, a leaver’s card, a replaced card, a card nobody holds', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var w = staffById(1); idcEnsure(w); var old = w.card;
      w.cardsRetired = [{ card: old, on: '${todayIso()}', why: 'lost' }]; w.card = null; idcEnsure(w);
      return [idcScan('SEP1:W:' + w.card + ':ZZ').why, idcScan('SEP-0003').why, idcScan(old).why, idcScan('SEP-0099').why];
    })()`);
    expect(r[0]).toContain('did not read cleanly');
    expect(r[1]).toContain('not on the active roster');
    expect(r[2]).toContain('was replaced');
    expect(r[3]).toContain('No worker holds card SEP-0099');
  });

  test('the scanner screen takes a typed number where the camera cannot read', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `idcEnsure(staffById(2)); saveState()`);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="day"]').click();
    await page.locator('[data-action="invIdcScan"]').click();
    const card: string = await g(page, `staffById(2).card`);
    await page.fill('#idcType', card);
    await page.keyboard.press('Enter');
    await expect(page.locator('#idcSay')).toContainText('In: Bina Devi');
    await expect(page.locator('#idcLog [data-idc-row]')).toHaveCount(1);
  });

  test('the owner prints the cards: a number given once, ten to a sheet, each with its code', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('#pageStaff [data-action="invIdcPrint"]').first().click();
    await page.locator('[data-action="invIdcPreview"]').click();
    const cards = page.locator('#invPrintBody .inv-idc');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('TEST WORKS');
    await expect(cards.first()).toContainText('Asha Kumari');
    await expect(cards.first()).toContainText('Blood B+');
    await expect(cards.first().locator('svg.inv-qr path')).toHaveCount(1);
    expect(await g(page, `[staffById(1).card, staffById(2).card]`)).toEqual(['SEP-0004', 'SEP-0005']);
  });

  test('a supervisor scans; printing and replacing are the owner’s', async ({ page }) => {
    const s: any = book();
    s.staff[0].card = 'SEP-0010';
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    expect(await g(page, `idcScan('SEP-0010', ${at(9, 0)}).kind`)).toBe('in');
    await g(page, `idcPrintOpen()`);
    await expect(page.locator('.inv-dialog')).toContainText('printed by the owner');
    await expect(page.locator('[data-action="invIdcPreview"]')).toHaveCount(0);
  });
});
