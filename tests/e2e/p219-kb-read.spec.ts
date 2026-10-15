import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, todayIso, answerAsk, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P219: the knowledge base's second edition, KB2-1 (owner, 14–15 Oct 2026; docs/KNOWLEDGE_BASE_2.md): one body drawn three ways
// (Quick reference, Reader with no tick boxes, Guided), At a glance written or worked out, a landing by role, the context in a
// sheet on the phone, the Library's shelves with Ask, and notes public or the owner's own. Made-up names and content.

function art(id: string, kind: string, title: string, extra: any = {}) {
  return { id, kind, title, summary: '', body: '', tags: [], links: [], roles: [], status: 'published', version: 1, versions: [], src: 'app', by: 'Owner', at: 1, ...extra };
}
const BODY = 'WARNING: Switch off the rectifier before you lift a rack.\n\n1. Open the tank cover.\n2. Lift the rack with both hands.\n3. Hang it on the rail.\n\n' +
  '# Good to know\n- A rack is *Wanted* back by noon.\n- Go to Office → Challans to see the challan.';
function book(articles: any[], more: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa Kumar', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true }];
  s.kb = { articles, trained: [], paths: [], ...more };
  return s as SepState;
}
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const open = (p: Page, id: string) => g(p, `kbOpenArticle('${id}')`);
const mode = (p: Page) => p.locator('#knowContent [data-kb-mode]').first().getAttribute('data-kb-mode');

test.describe('P219: three ways to read one article', () => {
  test('one body drawn three ways; a WARNING is a filled block on Quick reference and in Reader; *Wanted* is italic with no stars', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack', { summary: 'Load VAT A1 safely', body: BODY })]));
    await open(page, 'G1');
    expect(await mode(page)).toBe('quick');
    const quick = page.locator('#knowContent [data-kb-mode="quick"]');
    await expect(quick.locator('[data-kb-notice="warning"]')).toContainText('Switch off the rectifier');
    // Quick reference: the sections as lines, nothing of the text unfolded.
    await expect(quick.locator('[data-kb-toc] .inv-row-title')).toHaveText(['The steps', 'Good to know']);
    await expect(quick.locator('[data-kb-toc] .inv-row-meta')).toHaveText(['3 steps', '2 points']);
    await expect(quick).not.toContainText('Lift the rack with both hands');
    // Reader: the whole text; the steps a numbered list, no tick box anywhere.
    await quick.locator('[data-action="invKbMode"][data-mode="read"]').first().click();
    const read = page.locator('#knowContent [data-kb-mode="read"]');
    await expect(read.locator('ol.inv-kb-steps > li')).toHaveCount(3);
    await expect(read.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(read.locator('[data-kb-notice="warning"]')).toHaveClass(/inv-kb-notice-danger/);
    await expect(read.locator('em')).toHaveText('Wanted');
    await expect(read).not.toContainText('*Wanted*');
    // Guided: one step a screen, with a bar of segments.
    await read.locator('[data-action="invKbMode"][data-mode="guide"]').click();
    const guide = page.locator('#knowContent [data-kb-mode="guide"]');
    await expect(guide.locator('.inv-kb-prog-seg')).toHaveCount(3);
    await guide.locator('[data-action="invKbStep"][data-d="1"]').click();
    await expect(page.locator('#knowContent .inv-kb-step')).toHaveText('Open the tank cover.');
    await page.locator('#knowContent [data-action="invKbStep"][data-d="1"]').click();
    await expect(page.locator('#knowContent .inv-kb-step')).toHaveText('Lift the rack with both hands.');
    await page.locator('#knowContent [data-action="invKbStep"][data-d="1"]').click();
    await page.locator('#knowContent [data-action="invKbStep"][data-d="1"]').click();
    // After the last step: what is not a step, and Record training for a lesson.
    await expect(page.locator('#knowContent .inv-kb-more')).toContainText('Good to know');
    await expect(page.locator('#knowContent .inv-kb-guidebar [data-action="invKbTrain"]')).toBeVisible();
    // Back walks Guided → Reader → Quick reference.
    await page.goBack();
    expect(await mode(page)).toBe('read');
    await page.goBack();
    expect(await mode(page)).toBe('quick');
  });

  test('a section’s line opens Reader at that section, and Back returns to Quick reference', async ({ page }) => {
    const long = Array.from({ length: 40 }, (_, i) => (i + 1) + '. Step number ' + (i + 1) + ' of the long part.').join('\n');
    await loadAppWithState(page, book([art('G2', 'guide', 'A long how-to', { body: long + '\n\n# The end part\nThe last words.' })]));
    await open(page, 'G2');
    await page.locator('#knowContent [data-kb-toc] [data-action="invKbReadAt"][data-s="2"]').click();
    expect(await mode(page)).toBe('read');
    await expect(page).toHaveURL(/v=library%2Fread%2F2|v=library\/read\/2/);
    const top = await page.locator('#knowContent [data-kb-sec="2"]').evaluate(el => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(400);
    expect(await g(page, 'window.scrollY')).toBeGreaterThan(300);
    await page.goBack();
    expect(await mode(page)).toBe('quick');
  });

  test('At a glance is written where it is, and worked out by kind where it is not', async ({ page }) => {
    await loadAppWithState(page, book([
      art('G1', 'guide', 'Hanging a rack', { body: BODY.replace('Go to Office', 'Tap **Lift** and go to Office') }),
      art('G3', 'guide', 'Written glance', { body: BODY, glance: 'Who: the VAT A1 hand\nWhen: before each rack' }),
      art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels', causes: [{ cause: 'Oil left on', check: 'Water break', fix: 'Degrease' }] })]));
    await open(page, 'G1');
    const worked = page.locator('#knowContent [data-kb-glance="worked"]');
    await expect(worked.locator('dt')).toHaveText(['Where', 'You tap', 'Watch out']);
    await expect(worked).toContainText('Office → Challans');
    await expect(worked).toContainText('Switch off the rectifier before you lift a rack.');
    await open(page, 'G3');
    await expect(page.locator('#knowContent [data-kb-glance="written"] dt')).toHaveText(['Who', 'When']);
    await open(page, 'F1');
    await expect(page.locator('#knowContent [data-kb-glance] dt')).toHaveText(['You see', 'Most likely', 'Last seen']);
    await expect(page.locator('#knowContent [data-kb-glance]')).toContainText('never logged');
  });

  test('a screen’s path in the text is one link that opens that screen', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack', { body: BODY })]));
    await open(page, 'G1');
    await page.locator('#knowContent [data-kb-mode="quick"] [data-action="invKbMode"][data-mode="read"]').first().click();
    const link = page.locator('#knowContent [data-kb-mode="read"] .inv-kb-path');
    await expect(link).toHaveText('Office → Challans');
    await link.click();
    await expect(page.locator('#pageIM.inv-page-active')).toBeVisible();
  });

  test('a fault followed step by step: its causes in order, Found it ends on the fix and logs an incident with it', async ({ page }) => {
    await loadAppWithState(page, book([art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels',
      causes: [{ cause: 'Oil left on', check: 'Water break test', fix: 'Degrease again' }, { cause: 'Bath too cold', check: 'Read the thermometer', fix: 'Heat it to 25 °C' }] })]));
    await open(page, 'F1');
    await page.locator('#knowContent [data-kb-mode="quick"] [data-action="invKbMode"][data-mode="guide"]').first().click();
    await page.locator('#knowContent [data-action="invKbStep"][data-d="1"]').click();
    await expect(page.locator('#knowContent .inv-kb-step')).toHaveText('Oil left on');
    await page.locator('#knowContent [data-action="invKbStep"][data-d="1"]').click();   // Not this
    await expect(page.locator('#knowContent .inv-kb-step')).toHaveText('Bath too cold');
    await page.locator('#knowContent [data-action="invKbFound"]').click();
    await expect(page.locator('#knowContent .inv-kb-step-sub')).toContainText('Heat it to 25 °C');
    await page.locator('#knowContent [data-action="invKbFoundLog"]').click();
    await expect(page.locator('#knowContent [data-kb-f="f.cause"]')).toHaveValue('Bath too cold');
    await expect(page.locator('#knowContent [data-kb-f="f.fix"]')).toHaveValue('Heat it to 25 °C');
  });
});

test.describe('P219: where each role lands', () => {
  test('the owner lands on Quick reference; a supervisor on a lesson of their path, not yet trained on it, lands on Guided', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack', { body: BODY })], { paths: [{ id: 'P1', title: 'Supervisor', role: 'supervisor', articles: ['G1'] }] }));
    await withUsers(page);
    await g(page, `S.users.find(u => u.id === 'U-sup').staffId = 1; saveState()`);
    await unlock(page, 'U-own', PINS.owner);
    await open(page, 'G1');
    expect(await mode(page)).toBe('quick');
    await g(page, `grdLockAll('test')`);
    await unlock(page, 'U-sup', PINS.super);
    await open(page, 'G1');
    expect(await mode(page)).toBe('guide');
    // Trained on this version: Quick reference again.
    await g(page, `kbData().trained.push({ id: 't1', staffId: 1, name: 'Alfa Kumar', articleId: 'G1', v: 1, on: '${todayIso()}', at: Date.now() }); saveState()`);
    await g(page, `_kbOpen = null; renderKnow()`);
    await open(page, 'G1');
    expect(await mode(page)).toBe('quick');
  });

  test('a link that names a mode wins over the landing', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack', { body: BODY })]));
    await page.goto('/?tab=pageKnow&v=library/guide&id=G1');
    await page.locator('body.inv-booted').waitFor();
    expect(await mode(page)).toBe('guide');
  });
});

test.describe('P219: the Library', () => {
  test('nothing typed: Recently opened and the shelves; See all is a step Back returns from; Ask ranks the title first and says the line that matched', async ({ page }) => {
    await loadAppWithState(page, book([art('F1', 'fault', 'Peeling', { symptom: 'The deposit peels' }), art('F2', 'fault', 'White rust', { symptom: 'White powder' }),
      art('R1', 'ruling', 'Overtime rate', { ruledOn: todayIso(), body: 'A rack hand gets the rate.' }), art('G1', 'guide', 'Rack loading', { body: 'Hang it.' })]));
    await open(page, 'R1');
    await g(page, `kbGo({ tab: 'pageKnow', v: 'library', id: '' })`);
    await expect(page.locator('#kbShelves [data-kb-shelf="recent"] [data-kb-card="R1"]')).toBeVisible();
    await expect(page.locator('#kbShelves [data-kb-shelf="wrong"] [data-kb-card]')).toHaveCount(2);
    await expect(page.locator('#kbShelves [data-kb-shelf="wrong"] .inv-kb-ico svg')).toHaveCount(2);
    await page.locator('#kbShelves [data-action="invKbShelf"][data-key="wrong"]').click();
    await expect(page.locator('#kbLibrary [data-kb-row]')).toHaveCount(2);
    await expect(page.locator('#kbShelfToken')).toContainText('When something goes wrong');
    await page.goBack();
    await expect(page.locator('#kbShelves')).toBeVisible();
    await page.locator('#kbSearch').fill('rack');
    await expect(page.locator('#kbLibrary .inv-panel-title')).toContainText('Best matches');
    await expect(page.locator('#kbLibrary [data-kb-row]').first()).toHaveAttribute('data-kb-row', 'G1');
    await expect(page.locator('#kbLibrary [data-kb-row="R1"] .inv-row-meta')).toContainText('A rack hand gets the rate.');
  });
});

test.describe('P219: notes', () => {
  test('a public note is every reader’s; a private one is the owner’s alone: not drawn, not searched, not in the log’s words', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack', { body: BODY })]));
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await open(page, 'G1');
    const sheet = async () => { await page.locator('#knowContent .inv-kb-ctxbar-btn').click(); await page.locator('[data-kb-sheet] [data-action="invKbSheet"][data-tab="notes"]').click(); };
    await sheet();
    await page.locator('[data-kb-sheet] [data-kb-note-text]').fill('Wear the long gloves.');
    await page.locator('[data-kb-sheet] [data-action="invKbNoteAdd"]').click();
    await expect(page.locator('[data-kb-sheet] [data-kb-note]')).toHaveCount(1);
    await page.locator('[data-kb-sheet] [data-kb-note-text]').fill('Ask BM about the new rails.');
    await page.locator('[data-kb-sheet] #kbNotePrivate').check();
    await page.locator('[data-kb-sheet] [data-action="invKbNoteAdd"]').click();
    await expect(page.locator('[data-kb-sheet] [data-kb-note-private]')).toContainText('Ask BM about the new rails.');
    const st: any = await readStoredState(page);
    expect(st.kb.notes.map((n: any) => n.private)).toEqual([false, true]);
    expect(JSON.stringify(st.changeLog || [])).not.toContain('new rails');
    expect(JSON.stringify(st.changeLog || [])).not.toContain('long gloves');
    await g(page, `closeOverlay(); grdLockAll('test')`);
    await unlock(page, 'U-sup', PINS.super);
    await open(page, 'G1');
    await sheet();
    await expect(page.locator('[data-kb-sheet] [data-kb-note]')).toHaveCount(1);
    await expect(page.locator('[data-kb-sheet]')).toContainText('Wear the long gloves.');
    expect(await g(page, `document.body.innerHTML.indexOf('new rails')`)).toBe(-1);
    expect(await g(page, `JSON.stringify(srchIndex()).indexOf('new rails')`)).toBe(-1);
    // Not the owner: no private box.
    await expect(page.locator('[data-kb-sheet] #kbNotePrivate')).toHaveCount(0);
  });

  test('the export carries the private notes only when the owner says so', async ({ page }) => {
    await loadAppWithState(page, book([art('G1', 'guide', 'Hanging a rack')], { notes: [
      { id: 'n1', articleId: 'G1', text: 'Public one', private: false, by: 'Owner', at: 1 }, { id: 'n2', articleId: 'G1', text: 'Mine only', private: true, by: 'Owner', at: 2 }] }));
    await g(page, `window.__blobs = []; const C = URL.createObjectURL; URL.createObjectURL = function(b) { window.__blobs.push(b); return C.call(URL, b); }`);
    const take = async () => JSON.parse(await page.evaluate(() => (window as any).__blobs.pop().text()));
    await g(page, `kbExport(); 0`);
    await answerAsk(page, 'cancel');
    let out = await take();
    expect([out.version, out.notes.map((n: any) => n.id)]).toEqual([2, ['n1']]);
    await g(page, `kbExport(); 0`);
    await answerAsk(page, 'ok');
    out = await take();
    expect(out.notes.map((n: any) => n.id)).toEqual(['n1', 'n2']);
  });
});

test.describe('P219: the context', () => {
  test('the context draws only what the role’s screens show: a client’s owed and challans to a role that opens Clients', async ({ page }) => {
    const s: any = book([art('Q1', 'requirement', 'A certificate', { links: [{ type: 'client', id: 'kc7', label: 'ACME FORGINGS' }, { type: 'stock', id: 'N', label: 'Nitric acid' }] })]);
    s.clients = [{ id: 'kc7', name: 'ACME FORGINGS', billingMode: 'weight', rates: [] }];
    s.incomingMaterial = [{ id: 'IM1', clientId: 'kc7', challanNo: '11', challanDate: todayIso(), items: [{ id: 'L1', partNumber: 'P1', qty: 10, unit: 'KG', invoiced: false }] }];
    s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }], entries: [{ id: 'c1', itemId: 'N', kind: 'count', qty: 12, date: todayIso(), at: 1 }], pastes: [] };
    await loadAppWithState(page, s);
    await open(page, 'Q1');
    await page.locator('#knowContent .inv-kb-ctxbar-btn').click();
    const now = page.locator('[data-kb-sheet] [data-kb-ctx="now"]');
    await expect(now).toContainText('ACME FORGINGS: challans waiting');
    await expect(now).toContainText('Nitric acid');
    await g(page, `closeOverlay()`);
    // A floor ID opens neither Clients nor Stock's figures of a client: the client's rows go.
    await withUsers(page, { roles: { supervisor: { pages: ['pageKnow', 'pageStock'] } } });
    await unlock(page, 'U-sup', PINS.super);
    await open(page, 'Q1');
    await page.locator('#knowContent .inv-kb-ctxbar-btn').click();
    await expect(page.locator('[data-kb-sheet]')).not.toContainText('challans waiting');
  });
});
