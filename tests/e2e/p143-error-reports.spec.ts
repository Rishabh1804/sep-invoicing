import { test, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSettingsAt, switchTab, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P143: error reports (owner, 1 Oct 2026: "Yes, add Sentry error reporting"). What goes is the kind of error, where in the
// code, the build, the screen and the browser; never a record, a name or a figure, and since 21 Nov 2026 not the error's own
// message (the masking missed some names): only where a report has no place in the code is the owner asked for it. One POST to Sentry's envelope endpoint
// from the live site only, each kind once, at most ten a session, held while offline, off per device in Settings.

const DSN = 'https://abc123@o1.ingest.sentry.io/42';
const ENDPOINT = 'https://o1.ingest.sentry.io/api/42/envelope/**';
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 1, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', address: 'Plot 9, Test Estate', phone: '9876543210' }];
  return s as SepState;
}

/** The app as the live site sees it: a browser that is not a test browser, the project named, this host allowed. */
async function live(page: Page): Promise<Request[]> {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  const sent: Request[] = [];
  await page.route(ENDPOINT, async route => { sent.push(route.request()); await route.fulfill({ status: 200, body: '{}' }); });
  await loadAppWithState(page, book());
  await g(page, `ERR_DSN = '${DSN}'; ERR_HOSTS = [location.hostname];`);
  return sent;
}
const throwLater = (p: Page, msg: string, name = 'Error') =>
  p.evaluate(([m, n]) => { setTimeout(() => { const e = new Error(m); e.name = n; throw e; }, 0); }, [msg, name]);
const envelope = (r: Request) => (r.postData() || '').split('\n').map(l => JSON.parse(l));

test.describe('P143: error reports', () => {
  test('a test browser or a copy not on the live site sends nothing, and Settings says nothing is connected', async ({ page }) => {
    const sent: Request[] = [];
    await page.route('**/envelope/**', async route => { sent.push(route.request()); await route.fulfill({ status: 200, body: '{}' }); });
    await loadAppWithState(page, book());
    await throwLater(page, 'nobody hears this');
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(0);
    // The project named, but the browser is a test browser: still nothing.
    await g(page, `ERR_DSN = '${DSN}'; ERR_HOSTS = [location.hostname];`);
    await throwLater(page, 'nor this');
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(0);
    await g(page, `ERR_DSN = ''`);
    await openSettingsAt(page, 'data');
    await expect(page.locator('#setErrReports')).toBeDisabled();
    await expect(page.locator('details[data-sec="data"]')).toContainText('Not connected to an error service yet');
  });

  test('an uncaught error goes once, as an envelope, with the build, the screen and the code, and nothing of the book', async ({ page }) => {
    const sent = await live(page);
    await page.goto(page.url().split('?')[0] + '?tab=pageClients&id=1');
    await page.locator('body.inv-booted').waitFor();
    await g(page, `ERR_DSN = '${DSN}'; ERR_HOSTS = [location.hostname];`);
    await throwLater(page, 'Kaboom for NOVA CLAMPS PVT. LTD. ₹12,345.00 on 2026-09-30 "Plot 9" call 9876543210 or a@b.com');
    await expect.poll(() => sent.length).toBe(1);
    const r = sent[0];
    expect(r.method()).toBe('POST');
    expect(r.url()).toContain('sentry_key=abc123');
    expect(r.url()).toContain('sentry_version=7');
    const [head, item, ev] = envelope(r);
    expect(head.event_id).toBe(ev.event_id);
    expect(item.type).toBe('event');
    const ex = ev.exception.values[0];
    expect(ex.type).toBe('Error');
    expect(ex.value).toBe('(message not sent)');   // the error's own words stay on the device
    expect(JSON.stringify(ev)).not.toContain('Kaboom');
    expect(ex.stacktrace.frames.length).toBeGreaterThan(0);
    expect(typeof ex.stacktrace.frames[0].lineno).toBe('number');
    expect(ev.release).toMatch(/^sep-invoicing@/);
    expect(ev.tags.where).toBe('uncaught');
    expect(ev.tags.screen).toBe('pageClients');
    expect(ev.request.url).not.toContain('?');
    expect(ev.user).toBeUndefined();
    // Nothing of the book: the client's name, GSTIN, address and phone appear nowhere in what was sent.
    const body = r.postData() || '';
    for (const bit of ['NOVA', '20ABCDE1234F1Z5', 'Plot 9', '9876543210', 'Test Estate']) expect(body).not.toContain(bit);
    // The same error again is not sent again.
    await throwLater(page, 'Kaboom for NOVA CLAMPS PVT. LTD. ₹12,345.00 on 2026-09-30 "Plot 9" call 9876543210 or a@b.com');
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(1);
  });

  test('a promise nobody caught and a screen that could not be drawn are reported with where they happened', async ({ page }) => {
    const sent = await live(page);
    await page.evaluate(() => { Promise.reject(new TypeError('a promise failed')); });
    await expect.poll(() => sent.length).toBe(1);
    expect(envelope(sent[0])[2].tags.where).toBe('promise');
    expect(envelope(sent[0])[2].exception.values[0].type).toBe('TypeError');
    await g(page, `renderStats = function() { throw new RangeError('the stats would not draw'); }`);
    await switchTab(page, 'pageStats');
    await expect.poll(() => sent.length).toBe(2);
    const ev = envelope(sent[1])[2];
    expect(ev.tags.where).toBe('render: pageStats');
    expect(ev.exception.values[0].type).toBe('RangeError');
    expect(ev.exception.values[0].value).toBe('(message not sent)');
  });

  test('offline, a report waits on the device and goes when the device is back online', async ({ page, context }) => {
    const sent = await live(page);
    await context.setOffline(true);
    await throwLater(page, 'broke while offline');
    await expect.poll(() => g(page, `JSON.parse(localStorage.getItem('sep_inv_err_queue') || '[]').length`)).toBe(1);
    expect(sent).toHaveLength(0);
    await context.setOffline(false);
    await expect.poll(() => sent.length).toBe(1);
    expect(envelope(sent[0])[2].exception.values[0].value).toBe('(message not sent)');
    expect(envelope(sent[0])[2].exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(envelope(sent[0])[2].tags.online).toBe('no');
    await expect.poll(() => g(page, `localStorage.getItem('sep_inv_err_queue')`)).toBeNull();
  });

  test('a report with no place in the code: the owner is shown the masked message and asked; anybody else is not', async ({ page }) => {
    const sent = await live(page);
    // The words the old masking let through: a name in single quotes, one word in capitals, a name in title case.
    const words = `Could not place 'Ravi Kumar' of DELTA for Sunita Devi`;
    // With the guard off whoever is using the app is its owner. Yes: the message goes, masked as it was shown.
    await g(page, `errReport({ name: 'Error', message: ${JSON.stringify(words + ' at 9876543210')} }, 'uncaught')`);
    const said = await answerAsk(page, 'ok');
    expect(said).toContain('Send this error’s message?');
    expect(said).toContain(words + ' at [n]');
    await expect.poll(() => sent.length).toBe(1);
    expect(envelope(sent[0])[2].exception.values[0].value).toBe(words + ' at [n]');
    expect(envelope(sent[0])[2].exception.values[0].stacktrace).toBeUndefined();
    // No: the report goes without it.
    await g(page, `errReport({ name: 'Error', message: ${JSON.stringify(words + ' again')} }, 'uncaught')`);
    await answerAsk(page, 'cancel');
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1].postData() || '').not.toContain('Ravi');
    expect(envelope(sent[1])[2].exception.values[0].value).toBe('(message not sent)');
    // Another role signed in: not asked, and the message stays.
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await g(page, `ERR_DSN = '${DSN}'; ERR_HOSTS = [location.hostname];`);
    await g(page, `errReport({ name: 'Error', message: ${JSON.stringify(words)} }, 'uncaught')`);
    await expect.poll(() => sent.length).toBe(3);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    expect(sent[2].postData() || '').not.toContain('Ravi');
    expect(envelope(sent[2])[2].exception.values[0].value).toBe('(message not sent)');
  });

  test('at most ten a session; and the owner can turn reports off on a device', async ({ page }) => {
    const sent = await live(page);
    for (let i = 0; i < 12; i++) await throwLater(page, 'distinct error ' + 'abcdefghijkl'[i]);
    await expect.poll(() => sent.length).toBe(10);
    await page.waitForTimeout(300);
    expect(sent).toHaveLength(10);

    await g(page, `_errSent = 0; _errSeen = {};`);
    await openSettingsAt(page, 'data');
    const box = page.locator('#setErrReports');
    await expect(box).toBeEnabled();
    await expect(box).toBeChecked();
    await box.uncheck();
    expect(await g(page, `localStorage.getItem('sep_inv_err_off')`)).toBe('1');
    await throwLater(page, 'after the switch was turned off');
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(10);
    await box.check();
    expect(await g(page, `localStorage.getItem('sep_inv_err_off')`)).toBeNull();
  });
});
