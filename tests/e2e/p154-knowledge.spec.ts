import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';
import { openSearch } from './p139-search.fixture';

// P154: the knowledge base (owner, 2–5 Oct 2026; docs/KNOWLEDGE_BASE.md): "a training ground, a troubleshooting area, a
// record keeper, a tool used to make decisions". Articles in the book, read by role, written by anyone and approved by the
// owner, kept in versions; rulings superseded, never edited; photos on the device; training against the roster; decisions
// with figures then and now. Made-up names and content throughout.

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function daysAgo(n: number): string { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return isoOf(d); }

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: '', body: '', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
function book(extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa Kumar', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true },
    { id: 2, name: 'Bravo Das', comp: 'hourly', area: 'barrel', hourRate: 60, active: true, onFloor: true }];
  return Object.assign(s, extra) as SepState;
}
const kb = (articles: any[], more: any = {}) => ({ kb: { articles, trained: [], paths: [], ...more } });
const openKnow = async (page: Page) => { await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click(); await page.locator('#pageKnow.inv-page-active').waitFor(); };
const tab = (page: Page, t: string) => page.locator(`#knowContent [data-action="invKbTab"][data-tab="${t}"]`).click();
const field = (page: Page, k: string) => page.locator(`#knowContent [data-kb-f="${k}"]`);

test('the top bar’s book opens the guides for the screen on show; Start says how to begin when nothing is written', async ({ page }) => {
  await loadAppWithState(page, book());
  await openKnow(page);
  await expect(page.locator('#knowContent [data-action="invKbTab"]')).toHaveText(['Start', 'Library', 'Troubleshoot', 'Records', 'Training']);
  // From Today: the Library, linked to Today, holding the app's own guide to it.
  await expect(page.locator('#kbLinkFilter')).toContainText('Linked to');
  await expect(page.locator('#kbLibrary')).toContainText('Using the app: Today');
  await tab(page, 'start');
  await expect(page.locator('#kbRecent')).toContainText('Nothing written yet');
  await expect(page).toHaveURL(/tab=pageKnow/);
});

test('the owner writes a how-to: published at once, its text drawn as text, an edit keeps the version before', async ({ page }) => {
  await loadAppWithState(page, book());
  await openKnow(page);
  await page.locator('#knowContent [data-action="invKbNew"]').first().click();
  await field(page, 'title').fill('Loading a rack');
  await field(page, 'summary').fill('Hang the parts so none touch');
  await field(page, 'body').fill('Check the hooks first.\n\n- **Never** overlap two parts\n- Count the parts as you hang them\n\n# After\nTell the supervisor <b>the count</b>.');
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  const body = page.locator('#knowContent .inv-kb-body');
  await expect(body.locator('li')).toHaveCount(2);
  await expect(body.locator('strong')).toHaveText('Never');
  await expect(body).toContainText('<b>the count</b>');   // typed markup stays text
  await expect(body.locator('b')).toHaveCount(0);
  let st: any = await readStoredState(page);
  const a = st.kb.articles[0];
  expect([a.status, a.version, a.kind]).toEqual(['published', 1, 'guide']);
  // An edit is the next version; the one before is kept and readable.
  await page.locator('#knowContent [data-action="invKbEdit"]').click();
  await field(page, 'summary').fill('Hang the parts so none touch, hooks checked');
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  await expect(page.locator('#knowContent [data-action="invKbVersion"]')).toHaveCount(1);
  st = await readStoredState(page);
  expect(st.kb.articles[0].version).toBe(2);
  expect(st.kb.articles[0].versions[0].summary).toBe('Hang the parts so none touch');
  // Back from the article does not reopen the form that was saved.
  await page.goBack();
  await expect(page.locator('#knowContent [data-action="invKbSave"]')).toHaveCount(0);
});

test('a ruling is never edited: a new ruling replaces it, and both stay', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('R1', 'ruling', 'Overtime rate', { ruledBy: 'Owner', ruledOn: daysAgo(40), body: 'Old rate.' })])));
  await openKnow(page);
  await tab(page, 'records');
  await page.locator('[data-kb-row="R1"] [data-action="invKbOpen"]').click();
  await expect(page.locator('#knowContent [data-action="invKbEdit"]')).toHaveCount(0);
  await page.locator('#knowContent [data-action="invKbReplace"]').click();
  await field(page, 'body').fill('New rate from this month.');
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  const st: any = await readStoredState(page);
  const old = st.kb.articles.find((x: any) => x.id === 'R1'), nu = st.kb.articles.find((x: any) => x.id !== 'R1');
  expect(old.status).toBe('superseded');
  expect(old.supersededBy).toBe(nu.id);
  expect(nu.supersedes).toBe('R1');
  await expect(page.locator('#knowContent')).toContainText('Replaces: Overtime rate');
});

test('with the guard on, a supervisor writes and it waits; the owner sees it on Start and the To-do, and approves it', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await openKnow(page);
  await page.locator('#knowContent [data-action="invKbNew"]').first().click();
  await field(page, 'title').fill('Washing the jigs');
  await expect(page.locator('#knowContent [data-action="invKbSave"]')).toHaveText('Send for approval');
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  await expect(page.locator('#knowContent')).toContainText('Waiting for approval');
  let st: any = await readStoredState(page);
  expect(st.kb.articles[0].status).toBe('pending');
  expect(st.kb.articles[0].by).toBe('Birsa Munda');
  // The owner.
  await page.evaluate(() => (window as any).grdLockAll('test'));
  await unlock(page, 'U-own', PINS.owner);
  const tasks = await page.evaluate(() => (window as any).todoRanked().map((t: any) => t.app && t.app.rule).filter(Boolean));
  expect(tasks).toContain('kbPending');
  await openKnow(page);
  await expect(page.locator('#kbWaiting')).toContainText('Washing the jigs');
  await page.locator('#kbWaiting [data-action="invKbOpen"]').click();
  await page.locator('#knowContent [data-action="invKbApprove"]').click();
  st = await readStoredState(page);
  expect(st.kb.articles[0].status).toBe('published');
  expect(st.kb.articles[0].approvedBy).toBe('Asha Rao');
});

test('a change proposed on a published article waits beside it, and approving it makes the next version', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('G1', 'guide', 'Rinsing', { body: 'Rinse twice.' })])));
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await page.evaluate(() => (window as any).kbOpenArticle('G1'));
  await page.locator('#knowContent [data-action="invKbEdit"]').click();
  await field(page, 'body').fill('Rinse three times.');
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  let st: any = await readStoredState(page);
  expect(st.kb.articles[0].body).toBe('Rinse twice.');
  expect(st.kb.articles[0].pending.body).toBe('Rinse three times.');
  await page.evaluate(() => (window as any).grdLockAll('test'));
  await unlock(page, 'U-own', PINS.owner);
  await page.evaluate(() => (window as any).kbOpenArticle('G1'));
  await page.locator('#knowContent [data-action="invKbApprove"]').click();
  st = await readStoredState(page);
  expect([st.kb.articles[0].body, st.kb.articles[0].version, st.kb.articles[0].versions[0].body]).toEqual(['Rinse three times.', 2, 'Rinse twice.']);
});

test('an article names who reads it: a role it does not name finds it neither in the library nor in search', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('M1', 'requirement', 'Client margins', { roles: ['office'] }), art('M2', 'guide', 'Sweeping the floor')])));
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await openKnow(page);
  await tab(page, 'library');
  await expect(page.locator('#kbLibrary')).toContainText('Sweeping the floor');
  await expect(page.locator('#kbLibrary')).not.toContainText('Client margins');
  const found: string[] = await page.evaluate(() => (window as any).srchIndex().filter((e: any) => e.kind === 'kb').map((e: any) => e.id));
  expect(found.filter(id => !id.startsWith('app-'))).toEqual(['M2']);
  // The app's own guides follow the same rule: Pay is the owner's.
  expect(found).toContain('app-rolls');
  expect(found).not.toContain('app-pay');
});

test('sep-kb import adds drafts, skips the same version, and a newer version replaces with the older kept', async ({ page }) => {
  await loadAppWithState(page, book());
  const file = { format: 'sep-kb', version: 1, articles: [art('K1', 'process', 'Pickling basics', { status: 'draft', src: 'import', body: 'Acid first.', images: [{ id: 'img-x' }] })] };
  let res: any = await page.evaluate(f => (window as any).kbImportData(f, 'a.json'), file);
  expect(res.added).toBe(1);
  res = await page.evaluate(f => (window as any).kbImportData(f, 'a.json'), file);
  await answerAsk(page, 'ok');
  expect(res.added + res.updated).toBe(0);
  await page.evaluate(() => (window as any).kbApprove('K1'));
  const v2 = { format: 'sep-kb', articles: [{ ...file.articles[0], status: 'published', version: 2, body: 'Degrease, then acid.' }] };
  res = await page.evaluate(f => (window as any).kbImportData(f, 'b.json'), v2);
  expect(res.updated).toBe(1);
  // The import's save is coalesced and lands a moment later: wait for it on disk (a busy run read the copy before it).
  await expect.poll(async () => ((await readStoredState(page)).kb?.articles?.[0] || {}).version).toBe(2);
  const st: any = await readStoredState(page);
  const k = st.kb.articles[0];
  expect([k.version, k.body, k.versions.length, k.versions[0].body, k.images.length]).toEqual([2, 'Degrease, then acid.', 1, 'Acid first.', 0]);
});

test('a lesson’s check is asked when training is recorded from it, and its score kept', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('L2', 'guide', 'Gloves', { quiz: [{ q: 'Gloves at the acid tank?', options: ['Sometimes', 'Always'], answer: 1 }, { q: 'Rinse a splash with?', options: ['Water', 'Acid'], answer: 0 }] })])));
  await page.evaluate(() => (window as any).kbOpenArticle('L2'));
  await page.locator('#knowContent [data-action="invKbTrain"]').click();
  await page.locator('#kbTrainWho').selectOption('2');
  await page.locator('[data-kb-quiz="0"][value="1"]').check();
  await page.locator('[data-kb-quiz="1"][value="1"]').check();
  await page.locator('[data-action="invKbTrainSave"]').click();
  const st: any = await readStoredState(page);
  expect(st.kb.trained[0]).toMatchObject({ staffId: 2, articleId: 'L2', score: '1 of 2' });
});

test('training is recorded against the roster, and a lesson changed since makes it due again', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('L1', 'guide', 'Safety at the acid tank')])));
  await openKnow(page);
  await tab(page, 'training');
  await page.locator('#knowContent .inv-toolbar [data-action="invKbTrain"]').click();
  await page.locator('#kbTrainWho').selectOption('1');
  await page.locator('[data-kb-train-a="L1"]').check();
  await page.locator('[data-action="invKbTrainSave"]').click();
  await expect(page.locator('#kbRoster')).toContainText('trained on 1 of 1');
  let st: any = await readStoredState(page);
  expect(st.kb.trained[0]).toMatchObject({ staffId: 1, articleId: 'L1', v: 1, name: 'Alfa Kumar' });
  // The lesson changes: the training is due again, and the To-do says so.
  await page.evaluate(() => { const a = (window as any).kbOwnFind('L1'); a.versions = [(window as any).kbSnapshot(a)]; a.version = 2; (window as any).saveState(); (window as any).renderKnow(); });
  await expect(page.locator('#kbRoster')).toContainText('1 due again');
  const rules = await page.evaluate(() => (window as any).todoRanked().map((t: any) => t.app && t.app.rule).filter(Boolean));
  expect(rules).toContain('kbTrainDue');
});

test('a decision keeps its figures as they were and asks for its review on its day', async ({ page }) => {
  await loadAppWithState(page, book());
  await openKnow(page);
  await tab(page, 'records');
  await page.locator('#knowContent [data-action="invKbNew"]').click();
  await field(page, 'kind').selectOption('decision');
  await field(page, 'title').fill('Second shift');
  await field(page, 'f.question').fill('Run a second shift on VAT A2?');
  await field(page, 'f.options.0.label').fill('Yes');
  await field(page, 'f.reviewOn').fill(todayIso());
  await field(page, 'figKey').selectOption('tonnage');
  await page.locator('#knowContent [data-action="invKbFigAdd"]').click();
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  await expect(page.locator('[data-kb-figures]')).toContainText('Tonnage, last 90 days');
  let st: any = await readStoredState(page);
  expect(st.kb.articles[0].figures[0].then.text).toBe('0.00 t');
  const rules = await page.evaluate(() => (window as any).todoRanked().map((t: any) => t.app && t.app.rule).filter(Boolean));
  expect(rules).toContain('kbReview');
  await page.locator('#knowContent [data-action="invKbReview"]').click();
  await answerAsk(page, 'ok', 'It paid off.');
  st = await readStoredState(page);
  expect(st.kb.articles[0].reviewed[0].note).toBe('It paid off.');
  const after = await page.evaluate(() => (window as any).todoRanked().map((t: any) => t.app && t.app.rule).filter(Boolean));
  expect(after).not.toContain('kbReview');
});

test('an incident under a fault shows that day as the book has it: what was plated, by whom, and the power cuts', async ({ page }) => {
  const d = daysAgo(2);
  await loadAppWithState(page, book({
    ...kb([art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels', causes: [{ cause: 'Oil left on', check: 'Water break test', fix: 'Degrease again' }] }),
      art('I1', 'incident', 'Peeling on brackets', { on: d, faultId: 'F1', links: [{ type: 'part', id: '', label: 'BRK-9' }] })]),
    production: { entries: [
      { id: 'P1', kind: 'plated', date: d, time: '10:00', line: 'vat-a1', slot: 'general', client: 'ACME', part: 'BRK-9', qty: 200, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 },
      { id: 'P2', kind: 'plated', date: d, time: '11:00', line: 'vat-a2', slot: 'general', client: 'ACME', part: 'OTHER-1', qty: 50, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 },
      { id: 'C1', kind: 'downtime', date: d, time: '12:10', to: '12:40', downtime: { cause: 'power' }, basis: 'relay', src: 'paste', at: 1 }],
      pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } }
  }));
  await page.evaluate(() => (window as any).kbOpenArticle('F1'));
  await expect(page.locator('[data-kb-causes]')).toContainText('Water break test');
  await expect(page.locator('[data-kb-fault-incidents]')).toContainText('Peeling on brackets');
  await page.locator('[data-kb-fault-incidents] [data-action="invKbOpen"]').click();
  const day = page.locator('[data-kb-day]');
  await expect(day).toContainText('BRK-9');
  await expect(day).not.toContainText('OTHER-1');
  await expect(day).toContainText('Power cut');
});

test('a photo stays on the device: the article holds its id, the book never holds the picture', async ({ page }) => {
  await loadAppWithState(page, book());
  await openKnow(page);
  await page.locator('#knowContent [data-action="invKbNew"]').first().click();
  await field(page, 'title').fill('A good deposit');
  // A 4×4 PNG made in the page.
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; c.getContext('2d')!.fillRect(0, 0, 4, 4); return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('#kbPhotoInput').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('[data-kb-form-images] img[data-kb-img]')).toHaveCount(1);
  await page.locator('#knowContent [data-action="invKbSave"]').click();
  await expect(page.locator('#knowContent img.inv-kb-img[src^="blob:"]')).toHaveCount(1);
  const st: any = await readStoredState(page);
  expect(st.kb.articles[0].images[0].id).toMatch(/^img-[0-9a-f]{24}$/);
  expect(JSON.stringify(st)).not.toContain('data:image');
  const inDb = await page.evaluate(id => (window as any).kbMediaGet(id).then((b: Blob | null) => !!b && b.size > 0), st.kb.articles[0].images[0].id);
  expect(inDb).toBe(true);
});

test('search finds an article by its words and opens it', async ({ page }) => {
  await loadAppWithState(page, book(kb([art('S1', 'process', 'The nitric dip', { body: 'Passivation needs a clean nitric dip.' })])));
  await openSearch(page);
  await page.locator('#srchInput').fill('passivation');
  const hit = page.locator('#srchList [aria-labelledby="srchG-kb"] [role="option"]');
  await expect(hit).toHaveCount(1);
  await expect(hit).toContainText('The nitric dip');
  await hit.click();
  await expect(page.locator('#pageKnow.inv-page-active')).toBeVisible();
  await expect(page.locator('#knowContent')).toContainText('Passivation needs a clean nitric dip.');
});
