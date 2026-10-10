import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { closeFilter, emptyState, loadAppWithState, noSeedIM, openSales, phoneFilter, readStoredState, switchTab, todayIso, toolbarMoreLabels,
  type SepState } from './fixtures';
import { longBook } from './load-fixture';
import { pipeState } from './p137-pipeline.fixture';
import { clientsState } from './clients-fixture';

// P193: Office in one look (docs/TAB_MAP.md TM5). Pipeline, Challans and Invoices lead with a verdict and are coloured by age;
// each client carries a dot and a word for its worst flag; Parts says its parts with no weight in its card; Performance leads
// with the client's card and folds its long cards; Quotations shows Pulse's reprice moves; the spare is one figure; Create
// shows an error only once its field is left or a save is tried. Names and figures are made up; dates are built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const toneOf = (cls: string, kind: string) => (new RegExp('inv-' + kind + '-(danger|warning|ok|info|neutral)').exec(cls) || [])[1] || 'neutral';
const heroTone = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => el.className).then(c => toneOf(c, 'hero'));
const dotTone = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => el.className).then(c => toneOf(c, 'dot'));
/* A toolbar is one row: no control stands below another (their boxes overlap in height). */
const oneRow = (page: Page, sel: string) => page.locator(sel).evaluate(el => {
  const kids = Array.from(el.children).filter(k => (k as HTMLElement).offsetParent !== null && !(k as HTMLElement).hidden);
  const boxes = kids.map(k => k.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  return boxes.every(b => boxes.every(o => b.top < o.bottom && o.top < b.bottom));
});

const pad = (n: number) => String(n).padStart(2, '0');
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/* Three clients, a challan each, at 4, 5 and 10 days: either side of the To-do's challan days (5, the default) and at twice them. */
function waitBook(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const names = ['OMEGA PRESSINGS', 'SIGMA TOOLS', 'TAU FORGE'];
  s.clients = names.map((name, i) => ({ id: i + 1, name, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND',
    stateCode: '20', add1: 'Plot 9', add2: '', add3: '', address: '', isActive: true, notes: '', rates: [{ ratePerKg: 12, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }));
  s.incomingMaterial = [4, 5, 10].map((age, i) => ({ id: 'IM-' + age, challanNo: String(800 + age), challanDate: dayOff(-age), clientId: i + 1, clientName: names[i],
    vehicleNo: '', receivedDate: dayOff(-age), notes: '', createdAt: 1,
    items: [{ id: 'IM-' + age + '-0', partNumber: 'PART ' + age, desc: 'PART ' + age, hsn: '998873', unit: 'KG', qty: 100, rate: 12, amount: 1200, nosQty: null, invoiced: false, invoiceId: null }] }));
  return s;
}

test.describe('P193: Office in one look (phone)', () => {
  test('TM5a: Pipeline leads with its verdict on the stage that needs the owner; each stage is a coded box in its own tone', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await switchTab(page, 'pagePipeline');
    const first = page.locator('#pipelineContent > :first-child');
    await expect(first).toHaveAttribute('data-verdict', '');
    // Created holds a red (an invoice created five days ago against four), so it leads, in danger.
    expect(await heroTone(page, '#pipelineContent [data-verdict]')).toBe('danger');
    await expect(first.locator('.inv-hero-title')).toContainText('created, not printed');
    // The worst other stage running late is its one fact, in its own words: owed past 90 days, red, which outranks the amber
    // challans and printed invoices. The card has no figure (the stage's tile has its amount).
    const fact = first.locator('.inv-hero-fact');
    await expect(fact).toHaveCount(1);
    await expect(fact).toHaveText(/^owed: ₹[\d,]+ over 90 days$/);
    expect(await fact.evaluate(el => el.className)).toContain('inv-fig-danger');
    await expect(first.locator('.inv-hero-fig')).toHaveCount(0);
    // The stages are tiles of one coded block, each in its stage's tone (plain where nothing is judged).
    const tiles = page.locator('#pagePipeline .inv-coded[data-card="pipeline"] [data-pipe-stage]');
    await expect(tiles).toHaveCount(6);
    const stages: any[] = await g(page, 'pipeStages().map(function(s) { return { key: s.key, tone: s.open ? uiTone(s.tone) : "neutral" }; })');
    for (const s of stages) {
      const cls = await page.locator(`#pagePipeline [data-pipe-stage="${s.key}"]`).evaluate(el => el.className);
      expect(toneOf(cls, 'tile'), s.key).toBe(s.tone);
    }
    expect(stages.find(s => s.key === 'created').tone).toBe('danger');
    expect(stages.find(s => s.key === 'awaiting').tone).toBe('warning');
  });

  test('TM5b: Awaiting invoice says how many wait, what they bill and the oldest’s days; a row and its task agree in tone at 4, 5 and 10 days', async ({ page }) => {
    await loadAppWithState(page, waitBook());
    await switchTab(page, 'pageIM');
    const v = page.locator('#pageIM [data-verdict]');
    await expect(v.locator('.inv-hero-title')).toHaveText('3 challans waiting · ₹3,600 to bill');
    await expect(v.locator('.inv-hero-fig')).toHaveText('10d');
    expect(await heroTone(page, '#pageIM [data-verdict]')).toBe('danger');
    await expect(v.locator('.inv-hero-fact')).toHaveText(['days the oldest has waited', '2 over 5 days']);
    // Each challan's dot is its days' tone, the days in its meta and its title.
    const want: Record<string, string> = { 'IM-4': 'neutral', 'IM-5': 'warning', 'IM-10': 'danger' };
    for (const [id, tone] of Object.entries(want)) {
      const row = page.locator(`#imList [data-im="${id}"]`);
      await expect(row).toContainText(id.slice(3) + ' days waiting');
      expect(await dotTone(page, `#imList [data-im="${id}"] .inv-row-end .inv-dot`), id).toBe(tone);
      await expect(row.locator('.inv-row-end .inv-dot')).toHaveAttribute('title', id.slice(3) + ' days waiting');
    }
    // The To-do's challan task is toned by the same days: none at 4, amber at 5, red at 10.
    const tasks: Record<string, string> = await g(page, 'TODO_RULE_FNS.challan().reduce(function(o, t) { o[t.imIds.join(",")] = t.tone; return o; }, {})');
    expect(tasks).toEqual({ 'IM-5': 'amber', 'IM-10': 'red' });
    // Pipeline's awaiting stage is the oldest's tone too.
    await switchTab(page, 'pagePipeline');
    expect(toneOf(await page.locator('#pagePipeline [data-pipe-stage="awaiting"]').evaluate(el => el.className), 'tile')).toBe('danger');
  });

  test('TM5c: Invoices is one toolbar row (search, Filter, Select, More), its filters under it as tokens, every control reachable', async ({ page }) => {
    const s: any = pipeState();
    // A number never accounted for (00005), so the audit has something to say.
    s.invoices = s.invoices.filter((i: any) => i.invoiceNumber !== '00005');
    s.creditNotes = [];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageRegister');
    const bar = '#pageRegister [data-reg-toolbar]';
    expect(await oneRow(page, bar)).toBe(true);
    await expect(page.locator(bar + ' > *:visible')).toHaveCount(4);
    await expect(page.locator(bar + ' .inv-search input')).toHaveAttribute('id', 'regSearch');
    await expect(page.locator(bar + ' [data-action="invRegToggleSelect"]')).toHaveText('Select');
    // The audit's count is on More (warning); the credit notes' (a count that waits on nothing) stays on its row.
    await expect(page.locator(bar + ' [data-action="invTbMore"] .inv-badge-warning')).toHaveText('1');
    expect(await toolbarMoreLabels(page)).toEqual(['Credit notes', 'Number audit', 'Sales register CSV', 'Sales register PDF', 'GSTR-1 CSV', 'Bulk mark filed']);
    // The verdict leads: the invoices waiting on a step, by state and age, in the worst tone.
    expect(await heroTone(page, '#regVerdict [data-verdict]')).toBe('danger');
    await expect(page.locator('#regVerdict .inv-hero-title')).toContainText('created over');
    // The month on show is a token; tapped, it clears.
    const tokens = page.locator('#pageRegister .inv-tokens .inv-token');
    await expect(tokens).toHaveCount(1);
    await expect(tokens.first()).toContainText('Month');
    await tokens.first().click();
    await expect(tokens).toHaveCount(0);
    // Every filter, the range and the sort are behind Filter.
    await phoneFilter(page);
    for (const id of ['regClientFilter', 'regMonthFilter', 'regStateFilter', 'regDateFrom', 'regDateTo', 'regSort'])
      await expect(page.locator('[data-tb-filter-dialog] #' + id), id).toHaveCount(1);
    await page.locator('[data-tb-filter-dialog] #regStateFilter').selectOption('created');
    await page.locator('[data-tb-filter-dialog] #regSort').selectOption('number-asc');
    await closeFilter(page);
    await expect(tokens).toHaveText([/State\s*Created/, /Sort\s*Lowest number first/]);
    expect(await oneRow(page, bar)).toBe(true);
    await expect(page.locator('#regVerdict [data-reg-summary]')).toHaveAttribute('data-reg-summary', '2');
    // Select, then its own select-all.
    await page.locator(bar + ' [data-action="invRegToggleSelect"]').click();
    await expect(page.locator(bar + ' [data-action="invRegToggleSelect"]')).toHaveAttribute('aria-pressed', 'true');
    // The number audit opens from More.
    await page.locator(bar + ' [data-action="invTbMore"]').click();
    await page.locator('[data-tb-more-dialog] [data-tb-pick]', { hasText: 'Number audit' }).click();
    await expect(page.locator('.inv-scrim-dialog .inv-dialog-title')).toContainText('Number audit');
  });

  test('TM5d: each client carries a dot and a word for its worst flag; the card counts the clients flagged', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await switchTab(page, 'pageClients');
    // Owed past its terms with no receipt to place (MU AUTO PARTS' 100-day invoice): red, in the rule's word.
    const mu = page.locator('#clientList .inv-row', { hasText: 'MU AUTO PARTS' }).locator('[data-client-flag]');
    await expect(mu).toHaveText('past terms');
    expect(await mu.evaluate(el => el.className)).toContain('inv-dot-danger');
    // Every flagged client says so on its row, its worst first; the card counts them.
    const flagged: number = await g(page, 'Object.keys(clientFlagsRead()).length');
    await expect(page.locator('#clientList [data-client-flag]')).toHaveCount(flagged);
    await expect(page.locator('#clientsVerdict')).toHaveAttribute('data-clients-flagged', String(flagged));
    expect(await heroTone(page, '#clientsVerdict')).toBe('danger');
    await expect(page.locator('#clientsVerdict .inv-hero-title')).toContainText('3 clients');
  });

  test('TM5e: Parts is one toolbar row; its card says the parts with no weight, with the move in its foot; a part says two things', async ({ page }) => {
    await loadAppWithState(page, clientsState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').click();
    const v = page.locator('#itemsVerdict');
    await expect(v).toHaveAttribute('data-items-noweight', '2');
    await expect(v.locator('.inv-hero-title')).toHaveText('3 parts · 2 with no weight');
    expect(await heroTone(page, '#itemsVerdict')).toBe('warning');
    await expect(v.locator('[data-action="invOpenWeightEntry"]')).toHaveText('Enter weights');
    const bar = '#pageClients [data-items-toolbar]';
    expect(await oneRow(page, bar)).toBe(true);
    await expect(page.locator(bar + ' .inv-btn-primary')).toHaveText('Add part');
    expect(await toolbarMoreLabels(page)).toEqual(['Part weights', 'Enter weights', 'Derive weights', 'Merge', 'Select unused']);
    // No weight is a choice in Filter: picked, the dialog shuts and says it under the row; the token clears it.
    await phoneFilter(page);
    await page.locator('[data-tb-filter-dialog] [data-action="invFilterNoWeight"]').click();
    await expect(page.locator('[data-tb-filter-dialog]')).toHaveCount(0);
    const tok = page.locator('#pageClients .inv-tokens .inv-token');
    await expect(tok).toHaveText([/Show\s*No weight/]);
    await expect(page.locator('#pageClients [data-action="invEditItem"]')).toHaveCount(2);
    // A part's line says two things at most: no chain of three.
    const metas = await page.locator('#pageClients .inv-row-meta').allInnerTexts();
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) expect(m.split('·').filter(x => x.trim()).length, m).toBeLessThanOrEqual(2);
    await tok.first().click();
    await expect(tok).toHaveCount(0);
  });

  test('TM5f: Performance leads with the client’s card, its flags as its factors; the long cards fold shut; under four screens', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
    const v = page.locator('#cpVerdict');
    await expect(v).toHaveAttribute('data-verdict', '');
    // Shut on the phone, its line names the worst flag; opened, each flag is a coded tile that opens its task.
    await expect(v).toHaveJSProperty('open', false);
    const n = Number(await v.getAttribute('data-cp-flags'));
    expect(n).toBeGreaterThan(0);
    if (n > 1) await expect(v.locator('.inv-hero-fact').first()).toContainText(`and ${n - 1} more`);
    await expect(v.locator('.inv-hero-title')).toContainText('/kg');
    await v.locator(':scope > summary').click();
    await expect(v.locator('[data-action="invTodoOpenApp"]')).toHaveCount(Math.min(n, 4));
    for (const k of ['cp-worked', 'cp-stopped', 'cp-new', 'cp-steady', 'cp-flow'])
      if (await page.locator(`#pageClients details[data-fold="${k}"]`).count()) await expect(page.locator(`#pageClients details[data-fold="${k}"]`), k).toHaveJSProperty('open', false);
    await v.locator(':scope > summary').click();
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
    expect(screens).toBeLessThan(4);
  });

  test('TM5g: the spare is one figure on Prospects and Pulse; Quotations’ card holds Pulse’s reprice moves, each opening its draft', async ({ page }) => {
    await loadAppWithState(page, longBook());
    // One spare: the last 90 days a month, the same on Prospects' card and Pulse's Is the plant full?
    const spare: string = await g(page, 'formatNum(prsSpare().spareMonth / 1000, 1) + " t"');
    await openSales(page, 'prospects');
    await page.locator('#prsVerdict > summary').click();
    await expect(page.locator('#prsVerdict [data-prs-tile="spare"] .inv-tile-value')).toHaveText(spare);
    await expect(page.locator('#prsVerdict .inv-hero-fact')).toContainText(['the spare: the last 90 days']);
    expect(await g(page, `(function() { var c = statsStoryCards(statsPulseArgs(_statsPeriod)); return /data-tile="spare90"/.test(c.plant.html) && c.plant.html.indexOf(${JSON.stringify(spare)}) >= 0; })()`)).toBe(true);
    // Quotations: its card leads and holds the moves (I10: under it, they put the owner's book past one screen); shut on the phone,
    // its line says how many clients are to reprice; opened, one move shows, the rest a tap away; a move opens its draft.
    await openSales(page, 'quotes');
    const order = await page.locator('#pageClients').evaluate(root => {
      const all = Array.from(root.querySelectorAll('*'));
      return ['#qtVerdict', '#qtList'].map(sel => { const el = root.querySelector(sel); return el ? all.indexOf(el) : -1; });
    });
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[1]).toBeGreaterThan(order[0]);
    const card = page.locator('#qtVerdict');
    await expect(card).toHaveJSProperty('open', false);
    await expect(card.locator('.inv-hero-fact').filter({ hasText: 'to reprice' })).toHaveCount(1);
    await card.locator(':scope > summary').click();
    const moves = card.locator('[data-qt-reprice] [data-adv-move]');
    await expect(moves.first()).toBeVisible();
    await expect(page.locator('[data-qt-reprice] [data-adv-move]:visible')).toHaveCount(1);
    await moves.first().locator('[data-action="invAdvGo"]').click();
    await expect(page.locator('#pageClients .inv-pagehead-title')).toHaveText('New quotation');
    await expect(page.locator('#qtClient')).not.toHaveValue('');
  });

  test('TM5h: Create shows no error on a form nobody has touched; a field left shows its own; a save tried shows them all', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [{ id: 7, name: 'PHI COMPONENTS', billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
      add1: 'Plot 9', add2: '', add3: '', address: '', isActive: true, notes: '', rates: [{ ratePerKg: 12, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageCreate');
    const errs = page.locator('#invErrorsArea .inv-field-error'), save = page.locator('#invSaveBtn');
    // Nobody has touched it: no client, no line, and still not a word in red.
    await expect(errs).toHaveCount(0);
    await expect(save).toBeEnabled();
    await g(page, 'createForClient(7)');
    await page.locator('[data-action="invAddLineItem"]').click();
    await expect(errs).toHaveCount(0);
    // A quantity typed and left is fine; cleared and left, its own error shows, and the part's (never left) does not.
    const qty = page.locator('input[data-field="qty"][data-idx="0"]');
    await qty.fill('5');
    await qty.press('Tab');
    await expect(errs).toHaveCount(0);
    await qty.fill('');
    await qty.press('Tab');
    await expect(errs).toHaveText(['Line 1: enter the quantity']);
    await expect(save).toBeDisabled();
    // Typed again, Save is open with the part still unnamed and unseen; tried, every error shows and the first is said.
    await qty.fill('5');
    await qty.press('Tab');
    await expect(errs).toHaveCount(0);
    await save.click();
    await expect(errs).toHaveText(['Line 1: name the part']);
    await expect(page.locator('.inv-toast')).toContainText('Line 1: name the part');
    await expect(save).toBeDisabled();
    expect((await readStoredState(page)).invoices).toHaveLength(0);
    // A line removed takes what was left on it with it, and the line under it moves up with its own.
    await page.locator('[data-action="invAddLineItem"]').click();
    expect(await g(page, 'createErrorsShown().map(function(e) { return e.key; })')).toEqual(['line:0:part', 'line:1:part', 'line:1:qty']);
    const qty2 = page.locator('input[data-field="qty"][data-idx="1"]');
    await qty2.fill('3');
    await qty2.press('Tab');
    expect(await g(page, 'Object.keys(invoiceForm._left).sort()')).toEqual(['client', 'line:0:qty', 'line:1:qty']);
    await page.locator('[data-action="invRemoveLineItem"][data-idx="0"]').click();
    expect(await g(page, 'Object.keys(invoiceForm._left).sort()')).toEqual(['client', 'line:0:qty']);
    expect(await g(page, 'invoiceForm.items[0].qty')).toBe(3);
  });
});
