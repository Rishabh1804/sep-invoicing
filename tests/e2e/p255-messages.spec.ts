import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, setFilter, type SepState } from './fixtures';

// P255: the Messages screen (msgview.js; owner, 31 Oct 2026: "We need the pasted whatsapp message to be stored in the app, so that we
// can read the message in the app and make changes and the app can learn what it got wrong"; "Both" to editing a message's text and
// correcting its reading). Every paste is kept and marked saved when its reader saves it; the screen lists them by day with a verdict,
// filters and a search; a message shows each line beside what its reader read it as; its text is edited and read again, the change
// shown before it is saved; its kind is corrected and kept as a lesson; an address opens it; Back walks out. Made-up names and figures.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const DAY = (() => { let d = shift(todayIso(), -3); while ([0, 6].includes(new Date(d + 'T00:00:00').getDay())) d = shift(d, -1); return d; })();
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const wa = (d: string, t: string, who: string) => { const [y, m, dd] = d.split('-'); return `[${+m}/${+dd}/${y.slice(2)}, ${t}] ${who}: `; };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true }];
const ROLL = `${dmy(DAY)}/ IN TIME
------8:30 AM------
----VAT A 1----
01) ALFA
----VAT A 2----
02) BRAVO`;
function rec(id: string, kind: string, text: string, over: any = {}) {
  return { id, key: 'k-' + id, sentBy: 'Kilo Romeo', sentAt: 540, sentOn: DAY, text, edited: false, src: 'paste', importId: null, kind, conf: 0.8,
    why: 'a test', status: 'new', saved: [], textWas: [], fix: null, at: Date.now(), by: null, ...over };
}
function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...(extra || {}) } as unknown as SepState;
}
function bookWithMessages(): SepState {
  return book({ messages: [
    rec('MSG-A', 'in', ROLL),
    rec('MSG-B', 'other', 'Tea at four', { status: 'notread', conf: 0, sentAt: 600, sentBy: 'Lima Tudu', like: 'pickling' }),
    rec('MSG-C', 'other', 'Good morning all', { status: 'skipped', conf: 0, sentOn: shift(DAY, -1) }),
  ] });
}
async function openMessages(page: Page) {
  await switchTab(page, 'pageMessages');
  await expect(page.locator('#pageMessages.inv-page-active')).toBeVisible();
}

test.describe('P255: the Messages screen (phone)', () => {
  test('every paste is kept, and marked saved once its reader saves it', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(wa(DAY, '9:02 AM', 'Kilo Romeo') + ROLL);
    await page.locator('[data-action="invRelayRead"]').click();
    let s = await readStoredState(page);
    expect(s.messages.length).toBe(1);
    expect(s.messages[0]).toMatchObject({ src: 'paste', sentBy: 'Kilo Romeo', sentOn: DAY, kind: 'in', status: 'new' });
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    s = await readStoredState(page);
    expect(s.messages.length).toBe(1);
    expect(s.messages[0].status).toBe('saved');
    expect(s.messages[0].saved[0].store).toBe('relayPastes');
    expect(s.relayPastes.map((p: any) => p.id)).toContain(s.messages[0].saved[0].id);
    // The same paste again is the same message, kept once.
    await ev(page, `mvKeepPaste(${JSON.stringify(wa(DAY, '9:02 AM', 'Kilo Romeo') + ROLL)})`);
    expect((await readStoredState(page)).messages.length).toBe(1);
    // A message no reader takes is kept too, as Not read; the same words on another day are another message.
    await ev(page, `mvKeepPaste(${JSON.stringify(wa(DAY, '10:00 AM', 'Lima Tudu') + 'Tea at four')})`);
    await ev(page, `mvKeepPaste(${JSON.stringify(wa(shift(DAY, -1), '10:00 AM', 'Lima Tudu') + 'Tea at four')})`);
    s = await readStoredState(page);
    expect(s.messages.filter((m: any) => m.text === 'Tea at four').map((m: any) => m.status)).toEqual(['notread', 'notread']);
  });

  test('cash paid out pasted is marked saved by its own save', async ({ page }) => {
    await loadAppWithState(page, book());
    const cash = `${dmy(DAY)}/ JAR 150\nSABUN 320\n------\nONLY 470`;
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(wa(DAY, '6:15 PM', 'Kilo Romeo') + cash);
    await page.locator('[data-action="invRelayRead"]').click();
    await page.locator('[data-action="invPayCashSave"]').click();
    const s = await readStoredState(page);
    expect(s.messages.length).toBe(1);
    expect(s.messages[0]).toMatchObject({ kind: 'cash', status: 'saved' });
    expect(s.messages[0].saved[0]).toMatchObject({ store: 'cashPastes', id: s.cashPastes[0].id });
  });

  test('the list leads with its verdict, by day, filtered and searched', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await openMessages(page);
    const verdict = page.locator('#pageMessages [data-mv-verdict]');
    await expect(verdict).toContainText('1 message no reader takes');
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(3);
    await expect(page.locator('#pageMessages .inv-row-group')).toHaveCount(2);
    await expect(page.locator('[data-mv-row="MSG-B"]')).toContainText('Not read');
    // A Not read row says the kind it looks like (msgSort's `like`).
    await expect(page.locator('[data-mv-row="MSG-B"]')).toContainText('Looks like pickling loads');
    await expect(page.locator('[data-mv-row="MSG-C"]')).toContainText('Not a report');
    // Filter by status.
    await setFilter(page, '#mvStatus', 'notread');
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(1);
    await expect(page.locator('#pageMessages .inv-token')).toContainText('Not read');
    await page.locator('#pageMessages .inv-token').click();
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(3);
    // The sender, and the search over the words.
    await setFilter(page, '#mvSender', 'Lima Tudu');
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(1);
    await page.locator('#pageMessages .inv-token').click();
    await page.locator('#mvSearch').fill('morning');
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(1);
    await expect(page.locator('[data-mv-row="MSG-C"]')).toBeVisible();
  });

  test('a message shows each line beside what its reader read it as, and its kind with why', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await openMessages(page);
    // The sender's card is msgprofile.js's: its button stands beside the sender where the profile is loaded.
    await ev(page, `window.mpAction = window.mpAction || function() { return false; }`);
    await page.locator('[data-mv-row="MSG-A"]').click();
    const msg = page.locator('[data-mv-message="MSG-A"]');
    await expect(msg.locator('[data-action="invMsgProfile"][data-sender="Kilo Romeo"]')).toBeVisible();
    await expect(msg).toBeVisible();
    await expect(page.locator('[data-mv-kind-now="in"]')).toContainText('In-time roll');
    const lines = page.locator('[data-mv-lines] [data-mv-line]');
    await expect(lines.first()).toContainText('IN TIME');
    await expect(page.locator('[data-mv-lines]')).toContainText('01) ALFA');
    // The roll reader's own reading of the line: the hand it placed.
    await expect(page.locator('[data-mv-lines] [data-mv-line]', { hasText: '01) ALFA' })).toContainText('Alfa Oraon');
    // Its reader's own check is one tap away.
    await expect(page.locator('[data-action="invMsgHandoff"]')).toContainText('Read in People');
  });

  test('its text edited and read again shows what changes before it is saved, and keeps the text it had', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await openMessages(page);
    await page.locator('[data-mv-row="MSG-A"]').click();
    await page.locator('[data-action="invMsgEdit"]').click();
    await expect(page.locator('[data-action="invMsgEditSave"]')).toBeDisabled();
    await page.locator('#mvEditText').fill(ROLL.replace('02) BRAVO', '02) BRAVO\n03) ALFA'));
    await page.locator('[data-action="invMsgReadAgain"]').click();
    const diff = page.locator('[data-mv-diffpanel]');
    await expect(diff).toBeVisible();
    await expect(diff.locator('[data-mv-diff="added"]').first()).toContainText('03) ALFA');
    // Nothing saved yet.
    expect((await readStoredState(page)).messages[0].text).toBe(ROLL);
    await page.locator('[data-action="invMsgEditSave"]').click();
    const s = await readStoredState(page);
    const m = s.messages.find((x: any) => x.id === 'MSG-A');
    expect(m.text).toContain('03) ALFA');
    expect(m.textWas.length).toBe(1);
    expect(m.textWas[0].text).toBe(ROLL);
    await expect(page.locator('[data-mv-edits]')).toContainText('Was:');
    // Its kind is read again with the new text: still a roll.
    expect(m.kind).toBe('in');
  });

  test('a kind corrected sticks, wins over the sorter, shows as a lesson and is forgotten on Forget', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await openMessages(page);
    await page.locator('[data-mv-row="MSG-B"]').click();
    await page.locator('#mvFixKind').selectOption('power');
    let s = await readStoredState(page);
    let m = s.messages.find((x: any) => x.id === 'MSG-B');
    expect(m.fix).toMatchObject({ kind: 'power', was: 'other' });
    expect(m.kind).toBe('power');
    expect(m.status).toBe('new');
    // Read every message again: the hand's word stands.
    await page.locator('[data-action="invMsgClose"]').click();
    await ev(page, `mvRereadAll()`);
    await expect(page.locator('[data-mv-reread]')).toContainText('Nothing moved');
    await page.locator('[data-mv-reread] .inv-dialog-foot [data-action="invCloseOverlay"]').click();
    expect((await readStoredState(page)).messages.find((x: any) => x.id === 'MSG-B').kind).toBe('power');
    // A reload keeps it, and the lesson is listed.
    await page.reload();
    await page.locator('body.inv-booted').waitFor();
    await openMessages(page);
    const lessons = page.locator('#mvLessons');
    if (!(await lessons.evaluate(el => (el as HTMLDetailsElement).open))) await lessons.locator('summary').click();
    await expect(lessons.locator('[data-mv-lesson="kind"]')).toContainText('Power cut');
    await lessons.locator('[data-action="invMsgForgetKind"]').click();
    s = await readStoredState(page);
    m = s.messages.find((x: any) => x.id === 'MSG-B');
    expect(m.fix).toBeNull();
    expect(m.kind).toBe('other');
  });

  test('confidence by kind moves as corrections come in', async ({ page }) => {
    await loadAppWithState(page, book({ messages: [
      rec('MSG-1', 'in', ROLL, { status: 'saved' }), rec('MSG-2', 'in', ROLL + '\n', { status: 'saved', key: 'k2' }),
      rec('MSG-3', 'other', 'Pickling later', { status: 'notread' })] }));
    expect(await ev(page, `mvConf('in').conf`)).toBe(1);
    await ev(page, `mvSetKind('MSG-1', 'out')`);
    expect(await ev(page, `mvConf('in').conf`)).toBeCloseTo(0.5, 5);
  });

  test('an address opens the message, and Back walks out to the list and then away', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await page.goto('/sep-invoicing.html?tab=pageMessages&id=MSG-B');
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('[data-mv-message="MSG-B"]')).toBeVisible();
    await expect(page.locator('#pageMessages')).toHaveAttribute('data-screen', 'form');
    await page.locator('[data-action="invMsgClose"]').click();
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(3);

    // From Home: the tool, a message, Back to the list, Back to Home.
    await switchTab(page, 'pageHome');
    await openMessages(page);
    await page.locator('[data-mv-row="MSG-A"]').click();
    await expect(page).toHaveURL(/tab=pageMessages&id=MSG-A/);
    await page.goBack();
    await expect(page.locator('[data-mv-message]')).toHaveCount(0);
    await expect(page.locator('#pageMessages [data-mv-row]')).toHaveCount(3);
    await page.goBack();
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();
  });

  test('a message handed to its reader is not kept twice, and its reader’s save marks it saved', async ({ page }) => {
    await loadAppWithState(page, bookWithMessages());
    await openMessages(page);
    await page.locator('[data-mv-row="MSG-A"]').click();
    await page.locator('[data-action="invMsgHandoff"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toBeVisible();
    await page.locator('[data-action="invRelaySave"]').click();
    const s = await readStoredState(page);
    expect(s.messages.length).toBe(3);
    expect(s.messages.find((x: any) => x.id === 'MSG-A').status).toBe('saved');
  });
});
