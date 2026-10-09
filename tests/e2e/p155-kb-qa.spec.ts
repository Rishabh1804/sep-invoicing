import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';
import { imState } from './im-fixture';

// P155: the knowledge base's QA chain (owner, 5 Oct 2026: "Run QA chain and merge when ready"). Four audits (the guard and
// privacy, the store, the screens and navigation, the first content) and a harness pressing every action. Each test failed
// on the build before its fix. Made-up content throughout.

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function daysAgo(n: number): string { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return isoOf(d); }

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: 'About ' + title, body: 'Text of ' + title + '.', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
function book(articles: any[] = [], extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa Kumar', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true },
    { id: 2, name: 'Bravo Das', comp: 'monthly', area: 'office', dayRate: 500, active: true, onFloor: false }];
  s.clients = [{ id: 7, name: 'ACME FORGINGS', billingMode: 'weight', rates: [], isActive: true }];
  s.kb = { articles, trained: [], paths: [] };
  return Object.assign(s, extra) as SepState;
}
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const field = (page: Page, k: string) => page.locator(`#knowContent [data-kb-f="${k}"]`);
const know = (page: Page, v = 'library') => g(page, `kbSetTab('${v}'); _kbOpen = null; switchTab('pageKnow')`);
const stored = async (page: Page, id: string) => ((await readStoredState(page)) as any).kb.articles.find((a: any) => a.id === id);
const asOwner = async (page: Page) => { await g(page, `grdLockAll('test')`); await unlock(page, 'U-own', PINS.owner); };

test.describe('P155: Knowledge, the steps a move takes', () => {
  test('a view tab is a step: Back returns to the view before', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing')]));
    await know(page, 'start');
    await page.locator('#knowContent [data-action="invKbTab"][data-tab="library"]').click();
    await expect(page).toHaveURL(/v=library/);
    await page.locator('#knowContent [data-action="invKbTab"][data-tab="records"]').click();
    await expect(page).toHaveURL(/v=records/);
    await page.goBack();
    await expect(page).toHaveURL(/v=library/);
    await expect(page.locator('#knowContent [data-action="invKbTab"][data-tab="library"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Edit is a step over the article: Back from the form (nothing typed) returns to the article', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing')]));
    await page.evaluate(() => (window as any).kbOpenArticle('G1'));
    await expect(page.locator('#knowContent [data-kb-article="G1"]')).toBeVisible();
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await expect(field(page, 'title')).toHaveValue('Rinsing');
    // The form is one panel, its Save in the page's action bar (the panel was never closed and held the bar).
    expect(await g(page, `document.querySelector('#knowContent .inv-actionbar').parentElement.id`)).toBe('knowContent');
    await page.goBack();
    await expect(page.locator('#knowContent [data-kb-article="G1"]')).toBeVisible();
    await expect(page.locator('#knowContent [data-action="invKbSave"]')).toHaveCount(0);
  });

  test('written from the Library and saved: Back returns to the Library, not past it', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStats');
    await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click();
    await page.locator('#knowContent [data-action="invKbTab"][data-tab="library"]').click();
    await page.locator('#knowContent .inv-toolbar [data-action="invKbNew"]').first().click();
    await field(page, 'title').fill('Washing the jigs');
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    await expect(page.locator('#knowContent [data-kb-article]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#pageKnow')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#kbLibrary')).toContainText('Washing the jigs');
  });

  test('an article opened by its address has a way back on the phone: Knowledge closes it to its view', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing')]));
    await page.goto('/?tab=pageKnow&v=library&id=G1');
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('#knowContent [data-kb-article="G1"]')).toBeVisible();
    await page.locator('#knowContent [data-action="invKbBack"]').click();
    await expect(page.locator('#knowContent [data-kb-article]')).toHaveCount(0);
    await expect(page.locator('#kbLibrary')).toBeVisible();
  });

  test('a form opened by its address cancels to its article, with no step before it', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing')]));
    await page.goto('/?tab=pageKnow&v=library/edit&id=G1');
    await page.locator('body.inv-booted').waitFor();
    await expect(field(page, 'title')).toHaveValue('Rinsing');
    await page.locator('#knowContent [data-action="invKbFormCancel"]').click();
    await expect(page.locator('#knowContent [data-kb-article="G1"]')).toBeVisible();
  });

  test('an article opened from far down a list starts at its top', async ({ page }) => {
    // A long article, so the page could stay where the list was scrolled (a short one is pulled to the top by its height).
    const long = Array.from({ length: 80 }, (_, i) => 'Step ' + (i + 1) + ': rinse, look, and write down what was seen.').join('\n\n');
    await loadAppWithState(page, book(Array.from({ length: 40 }, (_, i) => art('A' + i, 'guide', 'Article ' + String(i).padStart(2, '0'), i === 39 ? { body: long } : {}))));
    await know(page);
    const last = page.locator('[data-kb-row="A39"] [data-action="invKbOpen"]');
    await last.scrollIntoViewIfNeeded();
    expect(await g(page, 'window.scrollY')).toBeGreaterThan(300);
    await last.click();
    await expect(page.locator('#knowContent [data-kb-article="A39"]')).toBeVisible();
    await expect.poll(() => g(page, 'window.scrollY')).toBe(0);
  });

  test('a kind picked in the Library is not carried to Troubleshoot, which has no chip for it', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing'), art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels' })]));
    await know(page);
    await page.locator('#knowContent [data-action="invKbKind"][data-kind="guide"]').click();
    await page.locator('#knowContent [data-action="invKbTab"][data-tab="troubleshoot"]').click();
    await expect(page.locator('#kbFaults')).toContainText('The deposit peels');
  });

  test('the top bar’s book asks before it leaves a half-typed challan', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await page.locator('#imVehicleNo').fill('JH 05 1234');
    await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
  });

  test('an article listed in a client’s Edit sheet asks before the sheet’s typing is dropped', async ({ page }) => {
    await loadAppWithState(page, book([art('Q1', 'requirement', 'ACME needs a certificate', { links: [{ type: 'client', id: '7', label: 'ACME FORGINGS' }] })]));
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invEditClient"][data-id="7"]').first().click();
    await page.locator('#ceditName').fill('ACME FORGINGS LTD');
    await page.locator('[data-kb-linked="client"] [data-action="invKbOpen"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
    await expect(page.locator('#ceditName')).toHaveValue('ACME FORGINGS LTD');
  });

  test('Leave, then Knowledge’s own door: the form is gone, not shown again with nothing to say it was typed', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing')]));
    await know(page);
    await page.locator('#knowContent .inv-toolbar [data-action="invKbNew"]').first().click();
    await field(page, 'title').fill('Half typed');
    // The top bar's book since the tab map (9 Oct 2026; Office's row had a Knowledge tab before).
    await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click();
    expect(await answerAsk(page, 'ok')).toContain('Leave without saving?');
    await expect(field(page, 'title')).toHaveCount(0);
    expect(await g(page, '_kbEdit')).toBeNull();
  });
});

test.describe('P155: Knowledge, who reads and who edits', () => {
  test('an address is no door around the rules: no form on an article the role does not read, none on a published ruling', async ({ page }) => {
    await loadAppWithState(page, book([art('KSEC', 'process', 'Floor only', { roles: ['floor'], body: 'Hidden body text' }),
      art('KR1', 'ruling', 'Overtime rate', { ruledBy: 'Owner', ruledOn: daysAgo(10) })]));
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `navApply({ tab: 'pageKnow', v: 'library/edit', id: 'KSEC' })`);
    await expect(field(page, 'title')).toHaveCount(0);
    await expect(page.locator('#pageKnow')).not.toContainText('Hidden body text');
    await asOwner(page);
    await g(page, `navApply({ tab: 'pageKnow', v: 'records/edit', id: 'KR1' })`);
    await expect(field(page, 'title')).toHaveCount(0);
    await expect(page.locator('#knowContent [data-kb-article="KR1"]')).toBeVisible();
    expect(page.url()).not.toContain('edit');
  });

  test('every role unticked is the owner alone, never everyone', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await know(page);
    await page.locator('#knowContent .inv-toolbar [data-action="invKbNew"]').first().click();
    await field(page, 'title').fill('Margins by client');
    for (const r of ['office', 'supervisor', 'floor']) await page.locator(`#knowContent [data-kb-role="${r}"]`).uncheck();
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    await expect(page.locator('#knowContent')).toContainText('The owner only');
    const a = ((await readStoredState(page)) as any).kb.articles[0];
    expect(a.roles).toEqual(['owner']);
    await g(page, `grdLockAll('test')`);
    await unlock(page, 'U-sup', PINS.super);
    await know(page);
    await expect(page.locator('#kbLibrary')).not.toContainText('Margins by client');
  });

  test('a change proposed leaves who reads it alone, and the owner sees every field it changes', async ({ page }) => {
    await loadAppWithState(page, book([art('F1', 'fault', 'Peeling', { symptom: 'Peels', roles: ['supervisor'], causes: [{ cause: 'Oil left on', check: 'Wipe test', fix: 'Degrease again' }] })]));
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await g(page, `kbOpenArticle('F1')`);
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await expect(page.locator('#knowContent [data-kb-role]')).toHaveCount(0);
    await field(page, 'f.causes.0.cause').fill('Rust under the oil');
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    await asOwner(page);
    await g(page, `kbOpenArticle('F1')`);
    await page.locator('#knowContent [data-action="invKbProposal"]').click();
    await expect(page.locator('.inv-scrim-dialog')).toContainText('Causes proposed');
    await expect(page.locator('.inv-scrim-dialog')).toContainText('Rust under the oil');
    await page.locator('.inv-scrim-dialog [data-action="invKbApprove"]').click();
    const a = await stored(page, 'F1');
    expect([a.causes[0].cause, a.roles, a.version]).toEqual(['Rust under the oil', ['supervisor'], 2]);
  });

  test('a second person’s change is refused while another’s waits, never put over it', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing', { body: 'Rinse twice.' })]));
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `kbOpenArticle('G1')`);
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await field(page, 'body').fill('Rinse in hot water.');
    // Meanwhile, in another window, the supervisor proposed a change.
    await g(page, `kbOwnFind('G1').pending = { by: 'Birsa Munda', byId: 'U-sup', at: Date.now(), v: 1, title: 'Rinsing', summary: '', body: 'Rinse three times.', fields: {} }`);
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    expect(await answerAsk(page, 'ok')).toContain('A change by Birsa Munda now waits');
    const a = await stored(page, 'G1');
    expect(a.pending ? a.pending.body : null).toBe(null);   // nothing of the office's was saved
    expect(await g(page, `kbOwnFind('G1').pending.body`)).toBe('Rinse three times.');
  });

  test('the owner’s Edit is of the article as it stands; a change written on an earlier version asks before it is approved', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing', { body: 'Rinse twice.', version: 2, versions: [{ v: 1, at: 1, title: 'Rinsing', body: 'Rinse once.' }],
      pending: { by: 'Birsa Munda', byId: 'U-sup', at: 5, v: 1, title: 'Rinsing', summary: '', body: 'Rinse three times.', fields: {} } })]));
    await g(page, `kbOpenArticle('G1')`);
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await expect(field(page, 'body')).toHaveValue('Rinse twice.');
    await page.goBack();
    await page.locator('#knowContent [data-action="invKbApprove"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('written on version 1');
    const a = await stored(page, 'G1');
    expect([a.body, a.version, !!a.pending]).toEqual(['Rinse twice.', 2, true]);
  });

  test('a decision keeps the option picked when a blank option sits before it', async ({ page }) => {
    await loadAppWithState(page, book());
    await know(page, 'records');
    await page.locator('#knowContent [data-action="invKbNew"][data-kind="ruling"]').click();
    await field(page, 'kind').selectOption('decision');
    await field(page, 'title').fill('ACME rate');
    await field(page, 'f.question').fill('Reprice ACME?');
    await field(page, 'f.options.1.label').fill('Exit');
    await page.locator('#knowContent [data-action="invKbRowAdd"][data-list="options"]').click();
    await field(page, 'f.options.2.label').fill('Reprice');
    await field(page, 'f.chosen').selectOption('2');
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    const a = ((await readStoredState(page)) as any).kb.articles[0];
    expect(a.options[a.chosen].label).toBe('Reprice');
  });

  test('a review is the owner’s; a deleted draft, an export, are not another role’s to do', async ({ page }) => {
    await loadAppWithState(page, book([art('KD', 'decision', 'Rate call', { question: 'Reprice?', reviewOn: daysAgo(1), roles: ['office'] }),
      art('DS', 'guide', 'Supervisor draft', { status: 'draft', by: 'Birsa Munda', byId: 'U-sup' })]));
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `kbOpenArticle('KD')`);
    await expect(page.locator('#knowContent [data-kb-article="KD"]')).toBeVisible();
    await expect(page.locator('#knowContent [data-action="invKbReview"]')).toHaveCount(0);
    await g(page, `kbDeleteDraft('DS'); kbReview('KD')`);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    expect(await stored(page, 'DS')).toBeTruthy();
    await g(page, `kbExport()`);
    expect(await answerAsk(page, 'ok')).toContain('export the knowledge base');
    // The owner's To-do still holds the review; the office's does not.
    expect(await g(page, `todoAppAll(['kbReview']).length`)).toBe(1);
    expect(await g(page, `todoApp(['kbReview']).length`)).toBe(0);
  });

  test('a role sees what its screens show: no roster, no crew, no stock line, no worker to link', async ({ page }) => {
    const d = daysAgo(2);
    await loadAppWithState(page, book([art('I1', 'incident', 'Peeling on clamps', { on: d, links: [{ type: 'line', id: 'vat-a1', label: '' }] })], {
      production: { entries: [{ id: 'p1', kind: 'plated', date: d, time: '10:00', slot: 'general', line: 'vat-a1', part: 'CLAMP', qty: 100, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 }], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
      attendance: { [d]: { marks: { 1: { st: 'P', area: 'vat-a1' }, 2: { st: 'H', area: 'office' } }, extra: [] } } }));
    // The owner sees that day: the plating, and two on site (a mark's state is `st`).
    await g(page, `kbOpenArticle('I1')`);
    await expect(page.locator('[data-kb-day]')).toContainText('Plated');
    await expect(page.locator('[data-kb-day]')).toContainText('On site');
    expect(await g(page, `document.querySelector('[data-kb-day]').innerText.match(/On site\\s*(\\d+)/)[1]`)).toBe('2');
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `kbOpenArticle('I1')`);
    await expect(page.locator('[data-kb-day]')).not.toContainText('Plated');
    await expect(page.locator('[data-kb-day]')).not.toContainText('On site');
    await know(page, 'training');
    await expect(page.locator('#kbRoster')).toHaveCount(0);
    await expect(page.locator('#pageKnow')).not.toContainText('Alfa Kumar');
    await page.locator('#knowContent .inv-toolbar [data-action="invKbNew"]').first().click();
    const types = await page.locator('#knowContent [data-kb-f="linkType"] option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
    expect(types).not.toContain('worker');
    expect(types).not.toContain('stock');
  });

  test('approvals waiting are the book’s: worked out whoever is signed in, shown to the owner', async ({ page }) => {
    await loadAppWithState(page, book([art('P1', 'guide', 'Sent for approval', { status: 'pending', by: 'Birsa Munda', byId: 'U-sup' })]));
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    expect(await g(page, `todoAppAll(['kbPending']).length`)).toBe(1);
    expect(await g(page, `todoApp(['kbPending']).length`)).toBe(0);
  });
});

test.describe('P155: Knowledge, records', () => {
  test('two replacements of one ruling: the second replaces the first, and a retired ruling stays retired', async ({ page }) => {
    await loadAppWithState(page, book([art('R1', 'ruling', 'Rate one', { ruledOn: daysAgo(30) }),
      art('R2', 'ruling', 'Rate two', { status: 'draft', supersedes: 'R1', ruledOn: daysAgo(5) }), art('R3', 'ruling', 'Rate three', { status: 'draft', supersedes: 'R1', ruledOn: daysAgo(4) }),
      art('R9', 'ruling', 'Old rule', { status: 'retired', ruledOn: daysAgo(90) }), art('R10', 'ruling', 'New rule', { status: 'draft', supersedes: 'R9', ruledOn: daysAgo(2) })]));
    for (const id of ['R2', 'R3', 'R10']) await g(page, `kbApprove('${id}')`);
    await page.waitForTimeout(200);
    const st: any = await readStoredState(page), by = (id: string) => st.kb.articles.find((a: any) => a.id === id);
    expect([by('R1').status, by('R1').supersededBy, by('R2').status, by('R2').supersededBy, by('R3').status, by('R3').supersedes])
      .toEqual(['superseded', 'R2', 'superseded', 'R3', 'published', 'R2']);
    expect([by('R9').status, by('R10').status]).toEqual(['retired', 'published']);
  });

  test('a decline is shown to the owner and its writer, and gone once the article is published', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Rinsing', { declined: { at: 5, by: 'Asha Rao', reason: 'Too long', change: { by: 'Birsa Munda', byId: 'U-sup', title: 'Rinsing', body: 'x' } } }),
      art('D1', 'guide', 'Draft once declined', { status: 'draft', declined: { at: 5, by: 'Owner', reason: 'Name the bath' } })]));
    await g(page, `kbOpenArticle('D1')`);
    await expect(page.locator('#knowContent')).toContainText('Not approved');
    await page.locator('#knowContent [data-action="invKbPublish"]').click();
    await expect(page.locator('#knowContent [data-kb-article="D1"]')).not.toContainText('Not approved');
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await g(page, `kbOpenArticle('G1')`);
    await expect(page.locator('#knowContent [data-kb-article="G1"]')).toBeVisible();
    await expect(page.locator('#knowContent')).not.toContainText('Too long');
  });

  test('a figure that could not be read when it was put on a decision stays unread; retiring takes the waiting change with it', async ({ page }) => {
    await loadAppWithState(page, book([art('KD', 'decision', 'Rate call', { question: 'Reprice?', figures: [{ key: 'tonnage', args: {}, then: null }], figuresAt: 1000 }),
      art('G1', 'guide', 'Rinsing', { pending: { by: 'Birsa Munda', byId: 'U-sup', at: 5, v: 1, title: 'Rinsing', summary: '', body: 'x', fields: {} } })]));
    await g(page, `kbOpenArticle('KD')`);
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await page.locator('#knowContent [data-action="invKbSave"]').click();
    await expect(page.locator('#knowContent [data-kb-article="KD"]')).toBeVisible();
    const kd = await stored(page, 'KD');
    expect([kd.figures[0].then, kd.figuresAt]).toEqual([null, 1000]);
    await g(page, `kbOpenArticle('G1')`);
    await page.locator('#knowContent [data-action="invKbRetire"]').click();
    await answerAsk(page, 'ok', 'Replaced by the new rinse');
    const g1 = await stored(page, 'G1');
    expect([g1.status, g1.pending]).toEqual(['retired', undefined]);
    await expect(page.locator('#knowContent [data-action="invKbApprove"]')).toHaveCount(0);
  });

  test('a ruling published in another window is not saved over from this one', async ({ page }) => {
    await loadAppWithState(page, book([art('R1', 'ruling', 'Rate', { status: 'draft', ruledOn: daysAgo(3), body: 'As drafted.' })]));
    await g(page, `kbOpenArticle('R1')`);
    await page.locator('#knowContent [data-action="invKbEdit"]').click();
    await field(page, 'body').fill('Changed here.');
    await g(page, `Object.assign(kbOwnFind('R1'), { status: 'published', approvedAt: Date.now(), approvedBy: 'Owner' })`);
    await page.locator('#knowContent [data-action="invKbSaveDraft"]').click();
    expect(await answerAsk(page, 'ok')).toContain('published meanwhile');
    const r = await g(page, `JSON.stringify([kbOwnFind('R1').status, kbOwnFind('R1').version || 1, kbOwnFind('R1').body])`);
    expect(JSON.parse(r as string)).toEqual(['published', 1, 'As drafted.']);
  });
});

test.describe('P155: Knowledge, training', () => {
  test('a check is scored for its own lesson; training on a past day is on that day’s version', async ({ page }) => {
    const now = Date.now(), tenDays = 10 * 864e5;
    await loadAppWithState(page, book([
      art('L2', 'guide', 'Lesson two', { quiz: [{ q: 'Which bath first?', options: ['Degrease', 'Zinc'], answer: 0 }] }),
      art('L3', 'guide', 'Lesson three', { quiz: [{ q: 'How long?', options: ['1 min', '5 min'], answer: 1 }] }),
      art('L4', 'guide', 'Lesson four', { version: 2, approvedAt: now, versions: [{ v: 1, at: now - tenDays, title: 'Lesson four', body: 'old' }] })]));
    await g(page, `kbOpenArticle('L2')`);
    await page.locator('#knowContent [data-action="invKbTrain"]').click();
    const dlg = page.locator('.inv-scrim-dialog');
    await dlg.locator('#kbTrainWho').selectOption('1');
    await dlg.locator('[data-kb-quiz="0"][value="0"]').check();
    await dlg.locator('[data-kb-train-a="L2"]').uncheck();
    await dlg.locator('[data-kb-train-a="L3"]').check();
    await dlg.locator('[data-action="invKbTrainSave"]').click();
    let st: any = await readStoredState(page);
    expect(st.kb.trained.find((t: any) => t.articleId === 'L3').score).toBe(null);
    await g(page, `kbOpenArticle('L4')`);
    await page.locator('#knowContent [data-action="invKbTrain"]').click();
    await dlg.locator('#kbTrainWho').selectOption('1');
    await dlg.locator('#kbTrainOn').fill(daysAgo(5));
    await dlg.locator('[data-action="invKbTrainSave"]').click();
    st = await readStoredState(page);
    expect(st.kb.trained.find((t: any) => t.articleId === 'L4').v).toBe(1);
    expect(await g(page, `kbTrainState(1, kbFind('L4')).state`)).toBe('due');
  });

  test('a path counts the hands it is for; a book’s path for a role replaces the app’s', async ({ page }) => {
    await loadAppWithState(page, book([], { kb: { articles: [], trained: [], paths: [{ id: 'kbp-floor', title: 'On the floor: the shop', role: 'floor', articles: ['app-today'] }] } }));
    await know(page, 'training');
    const office = page.locator('[data-kb-path="app-path-office"]');
    await expect(office).toContainText('trained 0 of 1');
    await expect(page.locator('[data-kb-path="app-path-floor"]')).toHaveCount(0);
    await expect(page.locator('[data-kb-path="kbp-floor"]')).toContainText('trained 0 of 1');
  });
});

test.describe('P155: Knowledge, a file from outside', () => {
  test('an import with malformed lists is cleaned, never drawn into a crash; the app guides’ ids are refused', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', e => errs.push(String(e)));
    await loadAppWithState(page, book());
    const res: any = await page.evaluate(() => (window as any).kbImportData({ format: 'sep-kb', version: 1, articles: [
      { id: 'kb-bad1', kind: 'fault', title: 'Bad causes', causes: 'not a list', links: 'nope', tags: 'x', roles: 'office', status: 'published', version: '2' },
      { id: 'kb-bad2', kind: 'decision', title: 'Bad options', options: { a: 1 }, figures: 7, reviewed: 'x', ruledOn: 12, status: 'published' },
      { id: 'kb-bad3', kind: 'guide', title: 'Bad quiz', quiz: [{ q: 'x', options: 'a/b', answer: 9 }], links: [{ type: 'evil', id: 1 }, null, 5], status: 'published' },
      { id: 'kb-bad4', kind: 'guide', title: 'Bad versions', version: 3, versions: [null, { v: '<img src=x onerror="window.__xss=1">', title: 'x' }], status: 'published' },
      { id: 'app-today', kind: 'guide', title: 'Shadowing an app guide', status: 'published' }
    ] }, 'bad.json'));
    expect([res.added, res.refused]).toEqual([4, 1]);
    for (const id of ['kb-bad1', 'kb-bad2', 'kb-bad3', 'kb-bad4']) {
      await page.evaluate(x => (window as any).kbOpenArticle(x), id);
      await expect(page.locator(`#knowContent [data-kb-article="${id}"]`)).toBeVisible();
    }
    await g(page, `_kbOpen = null; kbSetTab('library'); renderKnow()`);
    await expect(page.locator('#kbLibrary')).toContainText('Bad quiz');
    await switchTab(page, 'pageClients');   // every client screen reads the links
    const st: any = await readStoredState(page);
    const bad1 = st.kb.articles.find((a: any) => a.id === 'kb-bad1');
    // A role written as text is that role (never everyone): failing closed.
    expect([Array.isArray(bad1.causes), Array.isArray(bad1.links), Array.isArray(bad1.tags), bad1.roles, bad1.version]).toEqual([true, true, true, ['office'], 2]);
    expect(st.kb.articles.find((a: any) => a.id === 'kb-bad3').links).toEqual([]);
    expect(st.kb.articles.find((a: any) => a.id === 'kb-bad4').versions).toEqual([]);
    expect(await g(page, '(window).__xss')).toBeUndefined();
    expect(errs).toEqual([]);
  });

  test('an import moves a status on, never brings back what was retired, edited or deleted here, and matches training by name', async ({ page }) => {
    const now = Date.now();
    await loadAppWithState(page, book([art('P1', 'guide', 'Pickling'), art('R1', 'ruling', 'Rate one', { ruledOn: daysAgo(20) }),
      art('T1', 'guide', 'Retired here', { status: 'retired', retireReason: 'Gone' }),
      art('D1', 'guide', 'Draft', { status: 'draft', src: 'import', body: 'Edited here.', importedAt: now - 5000, editedAt: now - 1000 })], { }));
    await g(page, `kbData().deleted.push({ id: 'X1', at: Date.now(), by: 'Owner' }); saveState()`);
    const res: any = await page.evaluate(() => (window as any).kbImportData({ format: 'sep-kb', version: 1, articles: [
      { id: 'P1', kind: 'guide', title: 'Pickling', status: 'retired', version: 1, retireReason: 'Moved to a process' },
      { id: 'R2', kind: 'ruling', title: 'Rate two', status: 'published', version: 1, supersedes: 'R1', ruledOn: '2026-09-01' },
      { id: 'T1', kind: 'guide', title: 'Retired here', status: 'published', version: 2, body: 'Back again' },
      { id: 'D1', kind: 'guide', title: 'Draft', status: 'draft', version: 2, body: 'From the file.' },
      { id: 'X1', kind: 'guide', title: 'Deleted here', status: 'draft' }
    ], trained: [{ id: 't1', staffId: 99, name: 'ALFA KUMAR', articleId: 'P1', v: 1, at: 5 }, { id: 't2', staffId: 1, name: 'Nobody Here', articleId: 'P1', v: 1, at: 5 }] }, 'merge.json'));
    const st: any = await readStoredState(page), by = (id: string) => st.kb.articles.find((a: any) => a.id === id);
    expect([by('P1').status, by('P1').retireReason]).toEqual(['retired', 'Moved to a process']);
    expect([by('R1').status, by('R1').supersededBy]).toEqual(['superseded', 'R2']);
    expect([by('T1').status, by('T1').version]).toEqual(['retired', 1]);
    expect(by('D1').body).toBe('Edited here.');
    expect(by('X1')).toBeUndefined();
    expect(st.kb.trained.map((t: any) => [t.id, t.staffId])).toEqual([['t1', 1]]);
    expect([res.kept, res.deleted, res.notOnRoster]).toEqual([2, 1, 1]);
  });
});

test.describe('P155: Knowledge, what the first content needs', () => {
  test('an area named only as written reads as written; a client spelled with spaces finds its client; numbered steps are a list; a fault is a lesson', async ({ page }) => {
    await loadAppWithState(page, book([art('F1', 'fault', 'Peeling', { symptom: 'Peels', body: '1. Wipe it\n2. Look at it', links: [{ type: 'area', id: '', label: 'VAT A1' }] }),
      art('Q1', 'requirement', 'A certificate', { links: [{ type: 'client', id: 'kb-c-9', label: 'ACME  FORGINGS.' }] })]));
    await g(page, `kbOpenArticle('F1')`);
    const a = page.locator('#knowContent [data-kb-article="F1"]');
    await expect(page.locator('#knowContent [data-kb-links]')).toContainText('Area: VAT A1');
    await expect(page.locator('#knowContent .inv-kb-body ol li')).toHaveCount(2);
    await expect(page.locator('#knowContent [data-action="invKbTrain"]')).toHaveCount(1);
    await expect(a).toBeVisible();
    expect(await g(page, `kbLinkedTo('client', 7, 'ACME FORGINGS').map(x => x.id).join()`)).toBe('Q1');
  });
});
