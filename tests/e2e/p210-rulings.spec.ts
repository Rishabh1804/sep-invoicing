import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, openSettingsAt, openStatsTab, readStoredState, switchTab, todayIso, toolbarMoreLabels } from './fixtures';
import { sweepState } from './sweep-fixture';

// P210: the owner's rulings of 13 Oct 2026. Made-up names; dates from today.
// - Challans waiting to be invoiced are amber at 3 days and red at 6 (*"B"*); a book still on 5 moves to 3 once.
// - The challan Scan and every photo read by Gemini come out (*"it simply never works, so it's better we take that off"*):
//   no Scan on Challans, no Photo on Add, no register photo on Production, Floor or Today, no page photo on the monthly
//   register, no Gemini key in Settings, and the key, its model and the last read kept as a draft are forgotten on the device.
// - The three cards that made their screens longer (Challans → Invoiced, Knowledge → Training and Troubleshoot) fold shut
//   on the phone (*"B"*), their facts under the line.
// - Contract labour is fixed (*"Fixed"*): the contribution counts all labour as fixed, and no move asks the question.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

async function sweepBook(page: Page) {
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, sweepState() as any);
}

test.describe('P210: the photo reading came out (phone)', () => {
  test('no Scan on either Challans list, and nothing left to scan with', async ({ page }) => {
    await sweepBook(page);
    await switchTab(page, 'pageIM');
    await expect(page.locator('#pageIM [data-action="invShowAddChallan"]')).toBeVisible();
    await expect(page.locator('[data-action="invScanChallan"]')).toHaveCount(0);
    expect(await toolbarMoreLabels(page)).not.toContain('Scan a challan');
    await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
    expect(await toolbarMoreLabels(page)).toEqual(['Add challan', 'Duplicate check']);
    expect(await g(page, 'typeof scanChallan + "," + typeof geminiReadImage + "," + typeof getApiKey')).toBe('undefined,undefined,undefined');
  });

  test('Production, Floor and Today take the register page by hand, on the line and the day', async ({ page }) => {
    await sweepBook(page);
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#pageProduction [data-action="invProdPaste"]')).toBeVisible();
    await expect(page.locator('[data-action="invProdPhoto"], #prodPhotoInput')).toHaveCount(0);
    expect(await toolbarMoreLabels(page)).toContain('Enter by hand');
    // Today's day's inputs: the production records' step opens the hand form on the first VAT line with no record.
    await g(page, `navOpen({ tab: 'pageHome', v: 'needs', id: '' })`);
    const step = page.locator('[data-tdy-input="production"]');
    await step.evaluate(el => { let d = el.closest('details'); while (d) { d.setAttribute('open', ''); d = d.parentElement && d.parentElement.closest('details'); } });
    await expect(step.locator('[data-action="invTdyPhoto"]')).toHaveCount(0);
    await expect(step.locator('[data-action="invTdyHand"]')).toHaveText('By hand');
    await step.locator('[data-action="invTdyHand"]').click();
    await expect(page.locator('#pageProduction.inv-page-active')).toBeVisible();
    await expect(page.locator('#prodHandDate')).toHaveValue(todayIso());
    await expect(page.locator('#prodHandLine')).toHaveValue(/^vat-a[12]$/);
  });

  test('the monthly register has no page photo: Import and Start this month are its doors', async ({ page }) => {
    await sweepBook(page);
    await g(page, `navOpen({ tab: 'pageStaff', v: 'register/${todayIso().slice(0, 7)}', id: '' })`);
    await expect(page.locator('[data-att-toolbar="register"]')).toBeVisible();
    await expect(page.locator('[data-action="invAregPhoto"], #aregPhotoFile')).toHaveCount(0);
    const more = await toolbarMoreLabels(page);
    expect(more).toContain('Import a register file');
    expect(more.join('|')).not.toMatch(/photo/i);
  });

  test('Settings has no Gemini key, and the key, its model and the kept read are forgotten on the device', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('p210-seeded')) {
          localStorage.setItem('sep_inv_gemini_key', 'AIza-made-up');
          localStorage.setItem('sep_inv_gemini_model', 'gemini-made-up');
          localStorage.setItem('sep_inv_prod_photo_draft', '{"x":1}');
          sessionStorage.setItem('p210-seeded', '1');
        }
      } catch (e) { /* none */ }
    });
    await sweepBook(page);
    expect(await g(page, `[localStorage.getItem('sep_inv_gemini_key'), localStorage.getItem('sep_inv_gemini_model'), localStorage.getItem('sep_inv_prod_photo_draft')]`))
      .toEqual([null, null, null]);
    await openSettingsAt(page, 'metalsKey');
    await expect(page.locator('#settingsScrim details[data-sec="metalsKey"]')).toBeVisible();
    await expect(page.locator('#settingsScrim [data-sec="geminiKey"]')).toHaveCount(0);
    await expect(page.locator('#settingsScrim')).not.toContainText('Gemini');
  });
});

const daysAgo = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); const p = (x: number) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const challan = (id: string, clientId: number, clientName: string, no: string, date: string) => ({ id, clientId, clientName, challanNo: no, challanDate: date,
  items: [{ id: id + '-1', part: 'PLATE 40', desc: '', qty: 50, unit: 'KG', rate: 10, amount: 500, invoiced: false }] });
const clientsAB = [
  { id: 71, name: 'ALPHA WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] },
  { id: 72, name: 'BETA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] },
];

test.describe('P210: challans waiting, 3 days and 6', () => {
  test('a challan is amber from 3 days and red from 6; a book still on 5 moves to 3 once, any other figure stays', async ({ page }) => {
    const s: any = { ...emptyState(), clients: clientsAB, todoCheck: { challanDays: 5 },
      incomingMaterial: [challan('IM-A', 71, 'ALPHA WORKS', '101', daysAgo(4)), challan('IM-B', 72, 'BETA CLAMPS', '202', daysAgo(6)), ...noSeedIM()] };
    await loadAppWithState(page, s);
    expect(await g(page, `[S.todoCheck.challanDays, S._challanDays3]`)).toEqual([3, true]);
    const tones = await g(page, `todoAppAll(['challan']).map(function(t){ return [t.clientId, t.tone]; })`) as [string, string][];
    expect(Object.fromEntries(tones.map(([c, t]) => [String(c), t]))).toEqual({ '71': 'amber', '72': 'red' });
    // The challan's own dot reads the same days.
    expect(await g(page, `[imWaitTone(2), imWaitTone(3), imWaitTone(6)]`)).toEqual(['neutral', 'warning', 'danger']);
    const st = await readStoredState(page);
    expect([st.todoCheck.challanDays, st._challanDays3]).toEqual([3, true]);

    // A figure the owner chose is kept: 7 stays 7.
    await loadAppWithState(page, { ...s, todoCheck: { challanDays: 7 } });
    expect(await g(page, `[S.todoCheck.challanDays, S._challanDays3]`)).toEqual([7, true]);
  });
});

test.describe('P210: the three cards fold shut on the phone', () => {
  test('Challans → Invoiced, Knowledge → Troubleshoot and Training open on their line; their facts are under it', async ({ page }) => {
    // A challan invoiced whole this month, so Invoiced has its month's card (the sweep book's challans each keep a line open).
    const day = todayIso();
    await loadAppWithState(page, { ...emptyState(), clients: clientsAB, invNextNum: 2,
      incomingMaterial: [{ id: 'IM-A', clientId: 71, clientName: 'ALPHA WORKS', challanNo: '101', challanDate: day, createdAt: Date.now(),
        items: [{ id: 'IM-A-0', partNumber: 'PLATE 40', desc: '', unit: 'KG', qty: 50, rate: 10, amount: 500, invoiced: false }] }, ...noSeedIM()],
      invoices: [{ id: 'INV-1', displayNumber: 'SEP/26-27/00001', date: day, clientId: 71, clientName: 'ALPHA WORKS', status: 'active',
        invoiceState: 'created', createdAt: Date.now(), challanNo: '101',
        items: [{ partNumber: 'PLATE 40', desc: '', unit: 'KG', qty: 50, rate: 10, amount: 500, imItemId: 'IM-A-0' }],
        taxableValue: 500, cgstAmt: 45, sgstAmt: 45, igstAmt: 0, grandTotal: 590 }] } as any);
    const cards: [string, string][] = [
      [`navOpen({ tab: 'pageIM', v: 'invoiced/${todayIso().slice(0, 7)}', id: '' })`, '#pageIM [data-im-invoiced]'],
      [`navOpen({ tab: 'pageKnow', v: 'troubleshoot', id: '' })`, '#pageKnow [data-kb-verdict="troubleshoot"]'],
      [`navOpen({ tab: 'pageKnow', v: 'training', id: '' })`, '#pageKnow [data-verdict][data-fold="v-pageKnow-training"]'],
    ];
    for (const [go, sel] of cards) {
      await g(page, go);
      const card = page.locator(sel);
      await expect(card, sel).toHaveCount(1);
      expect(await card.evaluate(el => el.tagName + ':' + (el as HTMLDetailsElement).open), sel).toBe('DETAILS:false');
      // Shut, the head is the line alone; the facts are in the body, shown once it is opened.
      await expect(card.locator(':scope > summary .inv-hero-fact'), sel).toHaveCount(0);
      await expect(card.locator(':scope > .inv-hero-body .inv-hero-fact').first(), sel).toBeHidden();
      await card.locator(':scope > summary').click();
      await expect(card.locator(':scope > .inv-hero-body .inv-hero-fact').first(), sel).toBeVisible();
    }
  });
});

test.describe('P210: contract labour is fixed', () => {
  test('the account between the variable and the full cost contributes, and no move asks the labour question', async ({ page }) => {
    const inv = (no: string, c: { id: number; name: string }, kg: number, rate: number) => ({ id: 'INV-' + no, number: no, displayNumber: 'SEP/26-27/' + no,
      date: todayIso(), clientId: c.id, clientName: c.name, status: 'active', state: 'created', createdAt: Date.now(),
      items: [{ partNumber: 'PLATE 40', desc: '', qty: kg, unit: 'KG', rate, amount: kg * rate }], taxableValue: kg * rate, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, grandTotal: kg * rate });
    await loadAppWithState(page, { ...emptyState(), clients: clientsAB, incomingMaterial: noSeedIM(),
      invoices: [inv('00001', clientsAB[0], 1000, 13), inv('00002', clientsAB[1], 3000, 7)], invNextNum: 3 } as any);
    const m: any = await g(page, `(function(){ var a = statsInvoices(), r = statsClientMargins('mtd', a, weighLines(a)), lab = r.c.rows.find(function(x){ return x.key === 'labour'; });
      var b = r.ranked.find(function(x){ return x.id === 72; });
      return { full: r.fullKg, v: r.varKg, lab: lab.amount / r.kg, net: b.net, vsVar: b.vsVar, text: formatCurrency(b.vsVar) }; })()`);
    // The variable cost is the live cost less all of labour: BETA's ₹7 sits between it and the full cost.
    expect(m.v).toBeCloseTo(m.full - m.lab, 6);
    expect(m.net).toBeCloseTo(7, 6);
    expect(m.v).toBeLessThan(7);
    expect(m.full).toBeGreaterThan(7);

    await openStatsTab(page, 'clients');
    const worst = page.locator('#statsWorst');
    await expect(worst).toContainText('BETA CLAMPS');
    await expect(worst.locator('[data-tile="contrib"]')).toContainText('Contributes');
    await expect(worst.locator('[data-tile="contrib"]')).toContainText('+' + m.text);
    await expect(worst.locator('[data-tile="full"]')).toContainText('Against the full cost');
    await expect(worst).toContainText('Labour is fixed, so it contributes');
    await expect(worst).not.toContainText('If labour scales');
    await expect(page.locator('#statsMargin [data-margin-split]')).toHaveText('labour fixed');

    // Pulse's "Who is driving it?" asks BETA for the full cost, and asks no labour question.
    await openPulse(page);
    const q = page.locator('[data-tdy-q="clients"]');
    if (!(await q.evaluate(el => (el as HTMLDetailsElement).open))) await q.locator(':scope > summary').click();
    await expect(q.locator('[data-adv-move="reprice:72"]')).toHaveCount(1);
    await expect(q.locator('[data-adv-move^="labour:"]')).toHaveCount(0);
    await expect(q).not.toContainText('Settle the labour question');
  });
});
