import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P189 (owner, 9 Oct 2026): "When I paste '08/10/26 - / 5 pm - 8 pm - Mehta clamp 165x83(40x6) - 400 nos + Clamp
// 140/146x91(32x6) - 606 nos = 1006 nos VAT A1 / 9 PM - 4 AM - General 188 CD - 300.4 KG VAT A1' as a production
// message, the parser refuses to read it even when the data is available. Same for Barrel and VAT A2 production pasted
// as text rather than uploaded as an image." The register typed as text, a slot a line, was read as no kind at all and
// the paste was refused ("No pickling or production lines found"). Made-up clients, the owner's shapes.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
function dmy(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
function iso(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const OWNER = () => `${dmy(-1)} -
5 pm - 8 pm - Nova clamp 165x83(40x6) - 400 nos + Clamp 140/146x91(32x6) - 606 nos = 1006 nos VAT A1
9 PM - 4 AM - Durga 188 CD - 300.4 KG VAT A1 `;

async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState);
}
const read = (page: Page, text: string) => page.evaluate(t => (window as any).parseProdPaste(t, (window as any).prodCtx()).map((m: any) => ({
  kind: m.kind, date: m.read.date, notes: m.read.notes.map((x: any) => x.text),
  items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, line: it.line, slot: it.slot, time: it.time, to: it.to, clientId: it.clientId,
    part: it.part, gauge: it.gauge, qty: it.qty, unit: it.unit, issues: it.issues.map((x: any) => x.tone + ':' + x.code) })),
})), text);

test.describe('P189: production typed as text, a slot a line', () => {
  test("the owner's message is read: two parts on one slot, the total checked, a run past midnight", async ({ page }) => {
    await load(page);
    const [m] = await read(page, OWNER());
    expect(m.kind).toBe('runs');
    expect(m.items.map((x: any) => [x.kind, x.date, x.line, x.slot, x.time, x.to, x.clientId, x.part, x.gauge, x.qty, x.unit])).toEqual([
      ['plated', iso(-1), 'vat-a1', 'ot', '17:00', '20:00', 11, 'clamp 165x83(40x6)', '40X6', 400, 'NOS'],
      ['plated', iso(-1), 'vat-a1', 'ot', '17:00', '20:00', 11, 'Clamp 140/146x91(32x6)', '32X6', 606, 'NOS'],
      ['plated', iso(-1), 'vat-a1', 'ot', '21:00', '04:00', 12, '188 CD', '', 300.4, 'KG'],
    ]);
    // 400 + 606 is the 1006 written: nothing to check, nothing asked.
    expect(m.items.flatMap((x: any) => x.issues)).toEqual([]);
  });

  test('pasted on Production it is checked and saved as runs on its line', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageProduction');
    await page.locator('#pageProduction [data-action="invProdPaste"]').click();
    await page.locator('#prodPasteText').fill(OWNER());
    await page.locator('[data-action="invProdRead"]').click();
    await expect(page.locator('[data-prod-msg="0"]')).toContainText('Production by slot');
    await expect(page.locator('[data-prod-row]')).toHaveCount(3);
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    const e = s.production.entries.filter((x: any) => !x.voidedAt);
    expect(e.map((x: any) => [x.kind, x.line, x.lineSrc, x.slot, x.time, x.to, x.clientId, x.qty, x.unit, x.basis, x.src])).toEqual([
      ['plated', 'vat-a1', 'written', 'ot', '17:00', '20:00', 11, 400, 'NOS', 'relay', 'paste'],
      ['plated', 'vat-a1', 'written', 'ot', '17:00', '20:00', 11, 606, 'NOS', 'relay', 'paste'],
      ['plated', 'vat-a1', 'written', 'ot', '21:00', '04:00', 12, 300.4, 'KG', 'relay', 'paste'],
    ]);
    // The same message again is the same message: refused, never counted twice.
    await page.locator('#pageProduction [data-action="invProdPaste"]').click();
    await page.locator('#prodPasteText').fill(OWNER());
    await page.locator('[data-action="invProdRead"]').click();
    await expect(page.locator('[data-action="invProdSaveReview"]')).toBeDisabled();
  });

  test('Barrel and VAT A2 by name, a line named above its slots, a sum, a total that disagrees, a cut, a second day', async ({ page }) => {
    await load(page);
    const [m] = await read(page, `${dmy(-2)} -
8:30 am - 5 pm - Nova liner - 2000 nos Barrel
5-8 pm - Durga 188 CD - 120.5 kg berral
VAT A2
8.30 am to 5 pm - Nova clamp(35x6) - 500 nos + 300 nos
6 - 8:30 am - Durga bolt - 1800+450 nos = 2000 nos
Power cut 10:26 AM
Power in 10:36 AM
${dmy(-1)}
8:30am-5pm - Nova liner - 700 nos`);
    expect(m.kind).toBe('runs');
    expect(m.items.map((x: any) => [x.kind, x.date, x.line ?? null, x.slot ?? null, x.time, x.to, x.qty ?? null])).toEqual([
      ['plated', iso(-2), 'barrel', 'general', '08:30', '17:00', 2000],
      ['plated', iso(-2), 'barrel', 'ot', '17:00', '20:00', 120.5],
      ['plated', iso(-2), 'vat-a2', 'general', '08:30', '17:00', 800],
      ['plated', iso(-2), 'vat-a2', 'ot', '06:00', '08:30', 2250],
      ['downtime', iso(-2), null, null, '10:26', '10:36', null],
      ['plated', iso(-1), 'vat-a2', 'general', '08:30', '17:00', 700],
    ]);
    // 1800 + 450 is not the 2000 written: said, never chosen.
    expect(m.items[3].issues).toContain('amber:total');
  });

  test('a slot with no line written is asked; no AM or PM is read from the shop’s hours and said', async ({ page }) => {
    await load(page);
    const [m] = await read(page, `${dmy(-1)}\n8:30 - 5 - Nova liner - 2000 nos`);
    expect(m.kind).toBe('runs');
    expect([m.items[0].time, m.items[0].to, m.items[0].line, m.items[0].slot]).toEqual(['08:30', '17:00', null, 'general']);
    expect(m.items[0].issues).toEqual(expect.arrayContaining(['amber:meridiem', 'amber:noline']));
  });

  test('the other kinds keep their own readers', async ({ page }) => {
    await load(page);
    const kinds = await page.evaluate(d => [
      `NOVA CLAMPS\nCLAMP133×83(35×6)-774 nos\nPickling Time 9:00AM`,
      `${d} berral production\nNova liner - 2000 nos`,
      `Power cut 10:26 AM`,
      `${d}\n-----production-----\nNova liner - 2000 nos`,
    ].map(t => (window as any).prodKind(t)), dmy(-1));
    expect(kinds).toEqual(['pickling', 'production', 'power', 'production']);
  });
});
