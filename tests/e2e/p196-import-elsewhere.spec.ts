import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, toolbarMore } from './fixtures';

// P196: a file brought to one screen's Import that is another screen's is named and taken there, never refused with no way
// on (owner, 9 Oct 2026: the day's production file, imported on Production → Equipment, read "Not a plant file" and
// stopped). Each screen's Import asks before it refuses; Import it there goes through Add → File's own route and guard.
// Names and figures are made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const lastToast = (page: Page) => page.locator('.inv-toast').last();
const PROD = () => ({ format: 'sep-production', version: 1, exportedAt: new Date().toISOString(), pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} },
  entries: [
    { id: 'PE-T1', kind: 'plated', date: todayIso(), time: '09:00', to: '10:20', line: 'vat-a1', client: 'TEST CLIENT KG', part: 'LINER', qty: 259, unit: 'NOS', basis: 'register' },
    { id: 'PE-T2', kind: 'plated', date: todayIso(), time: '10:30', to: '11:45', line: 'vat-a2', client: 'TEST CLIENT KG', part: 'SLOT', qty: 250, unit: 'NOS', basis: 'register' }] });
const FILES: Record<string, unknown> = {
  production: PROD(),
  plant: { format: 'sep-plant', version: 1, units: [{ id: 'U-T1', name: 'VAT A1 - 9', station: 'vat-a1', kind: 'tank', status: 'run', kgRound: 20 }] },
  stock: { format: 'sep-stock', version: 1, items: [{ id: 'SI-T', name: 'Boric Acid', unit: 'kg' }], entries: [], pastes: [] },
  register: { kind: 'sep-att-register', version: 1, months: [] },
  payroll: { kind: 'sep-payroll-paid', months: [{ month: '2026-08', rows: [{ name: 'Arun', dayPay: 11000, ot: 0 }] }] },
  people: { format: 'sep-people', version: 1, people: [{ name: 'Arun' }] },
  kb: { format: 'sep-kb', version: 1, articles: [{ id: 'K-T1', kind: 'process', title: 'Pickling basics', status: 'draft' }] },
  roster: { staff: [{ name: 'Zubin Testwala', comp: 'hourly', hourRate: 50, area: 'barrel' }] },
};
async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
}

test.describe('P196: a file brought to another screen\'s Import', () => {
  test('a production file brought to Production → Equipment is named and taken to Production → Entries', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageProduction');
    await page.locator('[data-action="invProdTab"][data-tab="equipment"]').click();
    const pick = async () => {
      // Equipment's Import is its toolbar's More (TM4c).
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), toolbarMore(page, 'Import')]);
      await chooser.setFiles({ name: 'sep-production-register.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(PROD())) });
    };
    await pick();
    // It read "Not a plant file" and stopped there. It says what the file is and where it is imported; Cancel imports nothing.
    const said = await answerAsk(page, 'cancel');
    expect(said).toContain('A production file');
    expect(said).toContain('sep-production-register.json is a production file (sep-production), not a plant register file (sep-plant).');
    expect(said).toContain('It is imported on Production → Entries.');
    expect(said).not.toContain('Not a plant file');
    expect(await g(page, '_prodTab')).toBe('equipment');
    expect(((await readStoredState(page)).production || { entries: [] }).entries).toHaveLength(0);
    // Taken there, it is imported as Production → Entries imports it.
    await pick();
    await answerAsk(page, 'ok');
    await expect.poll(() => g(page, '_prodTab')).toBe('entries');
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    await expect(lastToast(page)).toContainText('2 entries added');
    expect((await readStoredState(page)).production.entries.map((e: any) => e.id).sort()).toEqual(['PE-T1', 'PE-T2']);
  });

  test('every other Import names another screen\'s file and where it goes, and imports nothing until it is taken there', async ({ page }) => {
    await load(page);
    const before = await readStoredState(page);
    // [the Import, what it is handed, the file, where it is said to go]
    const cases: [string, 'text' | 'obj' | 'buf', string, string][] = [
      ['stockImportText', 'text', 'production', 'It is imported on Production → Entries.'],
      ['payrollImportText', 'text', 'plant', 'It is imported on Production → Equipment.'],
      ['aregImportText', 'text', 'stock', 'It is imported on Stock.'],
      ['importRosterText', 'text', 'register', 'It is imported on People → Register.'],
      ['importDataText', 'text', 'production', 'It is imported on Production → Entries.'],
      ['kbImportData', 'obj', 'payroll', 'It is imported on People → Pay.'],
      ['powerImportData', 'obj', 'production', 'It is imported on Production → Entries.'],
      ['prodImportText', 'text', 'kb', 'It is imported on Knowledge → Library.'],
      ['pltImportText', 'text', 'people', 'It is imported on People → Roster.'],
      ['bankImportBuf', 'buf', 'roster', 'It is imported on People → Roster.'],
    ];
    for (const [fn, how, kind, where] of cases) {
      await page.evaluate(({ fn, how, file }) => {
        const text = JSON.stringify(file), arg = how === 'obj' ? file : how === 'buf' ? new TextEncoder().encode(text).buffer : text;
        (0, eval)(fn)(arg, 'brought.json');
      }, { fn, how, file: FILES[kind] });
      const said = await answerAsk(page, 'cancel');
      expect(said, fn).toContain('brought.json is ');
      expect(said, fn).toContain(where);
      // Settings → Import never asks to replace the book with a file that is not a backup.
      expect(said, fn).not.toContain('Replace all data?');
    }
    const s = await readStoredState(page);
    expect((s.production || { entries: [] }).entries, 'production').toHaveLength(0);
    expect((s.stock || { items: [] }).items, 'stock').toHaveLength(0);
    expect(((s.plant || { units: [] }).units || []).map((u: any) => u.id), 'plant').not.toContain('U-T1');
    expect(((s.kb || { articles: [] }).articles || []).map((a: any) => a.id), 'knowledge').not.toContain('K-T1');
    expect((s.staff || []).map((w: any) => w.name), 'roster').toEqual((before.staff || []).map((w: any) => w.name));
    expect(s.payrollPaid || [], 'payroll').toHaveLength(0);
    expect(s.clients.map((c: any) => c.name), 'the book is not replaced').toEqual(before.clients.map((c: any) => c.name));

    // Taken there from Stock's Import, the production file lands on Production → Entries.
    await page.evaluate(t => (0, eval)('stockImportText')(t, 'brought.json'), JSON.stringify(PROD()));
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    await expect.poll(() => g(page, '_prodTab')).toBe('entries');
    await expect(lastToast(page)).toContainText('2 entries added');
    expect((await readStoredState(page)).production.entries.map((e: any) => e.id).sort()).toEqual(['PE-T1', 'PE-T2']);
  });

  test('a file no screen imports is still refused where it was brought, as it was', async ({ page }) => {
    await load(page);
    await page.evaluate(() => (0, eval)('pltImportText')('{"hello":1}', 'notes.json'));
    const said = await answerAsk(page, 'ok');
    expect(said).toContain('Not a plant file');
    await page.evaluate(() => (0, eval)('stockImportText')('{"hello":1}', 'notes.json'));
    await expect(lastToast(page)).toContainText('Not a stock file');
  });

  test('Power counts the cuts a production file adds apart from its other entries', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pagePower');
    // A file carrying a cut stays Power's, merged whole as before; it had said "2 cuts added" of one cut and one plated run.
    await page.evaluate(f => (0, eval)('powerImportData')(f, 'mixed.json'), { format: 'sep-production', version: 1, entries: [
      { id: 'PE-C1', kind: 'downtime', date: todayIso(), time: '10:00', to: '10:30', downtime: { cause: 'power', open: false } },
      { id: 'PE-P1', kind: 'plated', date: todayIso(), line: 'vat-a1', client: 'TEST CLIENT KG', part: 'BRKT-1', qty: 100, unit: 'NOS' }] });
    await expect(lastToast(page)).toContainText('1 cut added · 1 other production entry added');
    expect((await readStoredState(page)).production.entries.map((e: any) => e.id).sort()).toEqual(['PE-C1', 'PE-P1']);
  });

  test('Add → File takes a knowledge file to Knowledge → Library, as it takes every other export', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('data-action', 'invAddOpen');
      b.className = 'inv-hidden';
      document.body.appendChild(b);
      b.click();
      b.remove();
    });
    await expect(page.locator('[data-add-sheet]')).toBeVisible();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="file"]').click()]);
    await chooser.setFiles({ name: 'sep-kb.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FILES.kb)) });
    await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
    await expect.poll(async () => ((await readStoredState(page)).kb.articles || []).map((a: any) => a.id)).toContain('K-T1');
  });
});
