import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { emptyState, loadAppWithState, openSettingsAt, readStoredState, todayIso, waitForBoot, type SepState } from './fixtures';

// P279: nothing about the shop and no client's data is in the build (owner, 17 Nov 2026: "4 and 5. Let's change that."; CLAUDE.md,
// HR-10 and "Nothing about the shop is in the build"). The page is public. Until that day the build carried six once-only
// migrations that found a client by a name written into them and wrote its rules, part times, terms and kg a piece; one that wrote
// the plant's own connection load; and a default company holding the firm's name, address, phones, e-mail, GSTIN and bank account.
// A device's company is now its book's (Settings → Business → Company), blank on a new book, and every screen and document copes
// with the blank. Every name and number here is made up.

const FILES = ['sep-invoicing.html', 'index.html'];
// The removed migrations' flags. The sixth's name holds a client's, so it is matched by its shape.
const FLAGS = ['_prodGaugeRules1', '_partTimes1', '_prodPartRules1', '_clientKgPcDefault1', '_clientTerms1', '_powerLoad1'];
const SIXTH = /_prod[A-Z][a-z]+Rounds2/;
const GSTIN = /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/;
const IFSC = /\b[A-Z]{4}0[A-Z0-9]{6}\b/;
const MOBILE = /(^|\D)[6-9]\d{9}(\D|$)/;

const ev = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);

test('the built page carries no client migration, and no GSTIN or IFSC anywhere', () => {
  for (const file of FILES) {
    const html = readFileSync(file, 'utf8');
    for (const f of FLAGS) expect(html, `${file}: ${f}`).not.toContain(f);
    expect(html, file).not.toMatch(SIXTH);
    // No code finds a client by a name written into the build.
    expect(html, file).not.toMatch(/\.find\(function\(\w+\)\s*\{\s*return\s*\/[A-Z]{3,}\/i\.test\(String\(\w+\.name/);
    expect(html, file).not.toMatch(GSTIN);
    expect(html, file).not.toMatch(IFSC);
  }
});

test('the default state holds an empty company and no bank details: same shape, every field blank', async ({ page }) => {
  await page.goto('/');
  await waitForBoot(page);
  const d: any = await ev(page, 'getDefaultState()');
  expect(Object.keys(d.company).sort()).toEqual(['add1', 'add2', 'add3', 'email', 'gstin', 'mobile', 'name', 'phone', 'state', 'stateCode']);
  for (const [k, v] of Object.entries(d.company)) expect(v, `company.${k}`).toBe('');
  expect(d.bankDetails).toBe('');
  const text = JSON.stringify({ company: d.company, bankDetails: d.bankDetails, power: d.power });
  expect(text).not.toMatch(GSTIN);
  expect(text).not.toMatch(IFSC);
  expect(text).not.toMatch(MOBILE);
  expect(d.power.load).toEqual({});
});

test('a new book boots, draws Home and Settings → Company, and previews an invoice with no "undefined" and no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  // A test's browser context starts with no storage: a device that has never held a book.
  await page.goto('/');
  await waitForBoot(page);
  const home = page.locator('#pageHome');
  await expect(home).toHaveClass(/inv-page-active/);
  expect(await home.innerText()).not.toMatch(/undefined|NaN/);
  expect(await ev(page, 'JSON.stringify(S.company)')).toBe(JSON.stringify({ name: '', add1: '', add2: '', add3: '', phone: '', mobile: '', email: '', gstin: '', state: '', stateCode: '' }));

  // Settings → Business → Company: not set, and every field the documents print can be typed.
  await openSettingsAt(page, 'company');
  await expect(page.locator('[data-sum="company"]')).toHaveText('Not set');
  await expect(page.locator('[data-sum="bank"]')).toHaveText('Not set');
  for (const id of ['setCompName', 'setCompGstin', 'setCompAdd1', 'setCompAdd2', 'setCompAdd3', 'setCompState', 'setCompStateCode', 'setCompPhone', 'setCompMobile', 'setCompEmail'])
    await expect(page.locator('#' + id), id).toHaveValue('');
  await page.keyboard.press('Escape');

  // An invoice on the new book, previewed: the company prints blank, never "undefined", and the preview says what is not set.
  await ev(page, `(function(){ S.invoices.push({ id: 'INV-P279', invoiceNumber: '00001', displayNumber: 'T/00001', date: '${todayIso()}', status: 'active',
    invoiceState: 'created', clientId: 1, clientName: 'DELTA AUTO', clientGSTIN: '', gstType: 'intra', clientAddress: { add1: 'Plot 9', add2: '', add3: '', state: '', stateCode: '' },
    items: [{ partNumber: '9101 0000 0001', desc: 'BRACKET', hsn: '998873', unit: 'KG', qty: 10, rate: 5, amount: 50, nosQty: null }],
    taxableValue: 50, cgstPer: 9, cgstAmt: 4.5, sgstPer: 9, sgstAmt: 4.5, igstPer: 0, igstAmt: 0, grandTotal: 59, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: 'QX1-01', despatchDate: '', transport: '', remarks: '', createdAt: Date.now() }); showPrintPreview('INV-P279'); })()`);
  const body = page.locator('#invPrintBody');
  await expect(page.locator('.inv-print-view-active')).toHaveCount(1);
  await expect(body.locator('.inv-pi-company').first()).toHaveText('');
  const printed = await body.innerText();
  expect(printed).toContain('TAX INVOICE');
  expect(printed).toContain('DELTA AUTO');
  expect(printed).not.toMatch(/undefined|NaN|\bnull\b/);
  await expect(page.locator('.inv-toast').last()).toContainText('company’s name and GSTIN are not set');

  // The other documents that name their issuer draw a blank company the same way.
  const others = await ev(page, `[_qcHeaderHtml(), _qcFooterHtml(), powerCaseHtml(), _csvMetaRow('x').join(' ')].join(' ')`) as string;
  expect(others).not.toMatch(/undefined|NaN/);
  expect(errors).toEqual([]);
});

test('a book carrying its company keeps it through load, adoption and save; a book with none gets the blank shape', async ({ page }) => {
  const company = { name: 'DELTA PLATING WORKS', add1: 'Plot 9, Phase 4', add2: 'Testtown', add3: '', phone: '0000 000000', mobile: '9000000001',
    email: 'office@example.test', gstin: '99ZZZZZ9999Z9Z9', state: 'TESTSTATE', stateCode: '99' };
  const s: SepState = { ...emptyState(), company: { ...company }, bankDetails: 'Bank - Test Bank\nA/c No - 0000000000' };
  await loadAppWithState(page, s);
  expect(await ev(page, 'JSON.stringify(S.company)')).toBe(JSON.stringify(company));
  // Adopted whole, as a pull or an import is (ensureStateShape, then migrateState): nothing in it is touched.
  await ev(page, `(function(){ adoptState(JSON.parse(JSON.stringify(S))); saveState(); })()`);
  await page.reload();
  await waitForBoot(page);
  const st = await readStoredState(page);
  expect(st.company).toEqual(company);
  expect(st.bankDetails).toBe('Bank - Test Bank\nA/c No - 0000000000');
  await openSettingsAt(page, 'company');
  await expect(page.locator('[data-sum="company"]')).toContainText('DELTA PLATING WORKS');
  await page.keyboard.press('Escape');

  // A book that holds no company at all is given the empty shape, never a name from the build.
  const bare: any = { ...emptyState() };
  delete bare.company;
  await loadAppWithState(page, bare);
  expect(await ev(page, 'JSON.stringify(S.company)')).toBe(JSON.stringify({ name: '', add1: '', add2: '', add3: '', phone: '', mobile: '', email: '', gstin: '', state: '', stateCode: '' }));
});
