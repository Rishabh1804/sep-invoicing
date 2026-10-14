import { test, expect, Page, Route } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, todayIso } from './fixtures';

/*
 * P217: the owner's answers of 14 Oct 2026, and remote print.
 * - Remote print (owner: "a remote print option for invoices and anything else that is printed"): a device sends the preview as a
 *   job to the sync repository; the print station prints it and takes it off the queue; the sender learns it printed. GitHub is
 *   a fake held in this file, at the route layer.
 * - Turnaround: the national and state holidays are not working days (owner: "Yes").
 * (The Office role sees no revenue on Performance: P215, updated.)
 */

const SYNC_KEY = 'sep_inv_github_sync';
const TOKEN_KEY = 'sep_inv_github_token';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';

type Store = Map<string, { sha: string; text: string }>;
let shaN = 0;

/** A fake of the Contents API over one folder: list, read raw, put, delete. */
async function fakeGitHub(page: Page, store: Store, log: { method: string; path: string; message?: string }[]) {
  await page.route(CONTENTS, async (route: Route) => {
    const req = route.request(), url = new URL(req.url());
    const path = decodeURIComponent(url.pathname.replace(/^\/repos\/testowner\/testrepo\/contents\//, ''));
    const m = req.method();
    if (m === 'GET') {
      if (store.has(path)) {
        const f = store.get(path)!;
        if ((req.headers()['accept'] || '').includes('raw')) { await route.fulfill({ status: 200, contentType: 'text/plain', body: f.text }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'file', name: path.split('/').pop(), sha: f.sha, content: Buffer.from(f.text).toString('base64') }) });
        return;
      }
      const rows = [...store.keys()].filter(k => k.startsWith(path + '/')).map(k => ({ type: 'file', name: k.slice(path.length + 1), path: k, sha: store.get(k)!.sha }));
      if (rows.length) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); return; }
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
      return;
    }
    const body = JSON.parse(req.postData() || '{}');
    log.push({ method: m, path, message: body.message });
    if (m === 'PUT') {
      const sha = 'sha' + (++shaN);
      store.set(path, { sha, text: Buffer.from(body.content, 'base64').toString('utf8') });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha } }) });
      return;
    }
    if (m === 'DELETE') {
      const f = store.get(path);
      if (!f || f.sha !== body.sha) { await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'sha' }) }); return; }
      store.delete(path);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commit: {} }) });
      return;
    }
    await route.fulfill({ status: 405, body: '' });
  });
}

async function seedSync(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(([syncKey, tokenKey, cfgJson, extraJson]) => {
    localStorage.setItem(syncKey as string, cfgJson as string);
    localStorage.setItem(tokenKey as string, 'github_pat_TESTTOKEN');
    const x = JSON.parse(extraJson as string);
    Object.keys(x).forEach(k => localStorage.setItem(k, JSON.stringify(x[k])));
  }, [SYNC_KEY, TOKEN_KEY, JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Office desk' }), JSON.stringify(extra)] as const);
}

function book(on = true): any {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 1, name: 'NOVA FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, address: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' } }];
  const d = todayIso();
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: d, status: 'active', invoiceState: 'created', clientId: 1, clientName: 'NOVA FORGE',
    clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'BRACKET A', desc: 'BRACKET A', hsn: '998873', unit: 'KG', qty: 100, rate: 12, amount: 1200, nosQty: null }],
    taxableValue: 1200, cgstPer: 9, cgstAmt: 108, sgstPer: 9, sgstAmt: 108, igstPer: 0, igstAmt: 0, grandTotal: 1416, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: d, transport: '', remarks: '', linkedIMIds: [], createdAt: Date.now() }];
  s.printer = { on, name: 'Office laser', address: '10.0.0.9', cartridge: 'TONER-1' };
  return s;
}

test.describe('P217: remote print and the turnaround’s holidays', () => {
  test('Settings → Office printer: switched on, the preview carries Send to office; the station is this device’s alone', async ({ page }) => {
    await loadAppWithState(page, book(false));
    await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
    await expect(page.locator('#invPrintRemote')).toBeHidden();
    await page.evaluate(() => (window as any).closePrintPreview());
    await openSettingsAt(page, 'printer');
    await page.locator('#setPrtOn').check();
    await page.locator('#setPrtName').fill('Brother laser');
    await page.locator('#setPrtStation').check();
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="printer"]').click();
    const st = await readStoredState(page);
    expect(st.printer).toMatchObject({ on: true, name: 'Brother laser' });
    expect(JSON.stringify(st)).not.toContain('print_station');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_print_station') || '{}').on)).toBe(true);
    await page.evaluate(() => { (window as any).closeSettings && (window as any).closeSettings(); });
    await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
    await expect(page.locator('#invPrintRemote')).toBeVisible();
  });

  test('Send to office writes the preview as a job; once the station takes it the sender says printed and marks the invoice Printed', async ({ page }) => {
    const store: Store = new Map(), log: any[] = [];
    await seedSync(page);
    await fakeGitHub(page, store, log);
    await loadAppWithState(page, book());
    await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
    await page.locator('#invPrintRemote').click();
    await expect(page.locator('.inv-toast')).toContainText('Sent to Office laser');
    const keys = [...store.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^print-queue\/\d{14}-[a-z0-9]+\.json$/);
    const job = JSON.parse(store.get(keys[0])!.text);
    expect(job).toMatchObject({ kind: 'sep-print', v: 1, sentBy: expect.stringContaining('Office desk') });
    expect(job.title).toContain('SEP/TEST-00001');
    expect(job.html).toContain('ORIGINAL FOR RECIPIENT');
    // Still on the queue: waiting, and the invoice is still Created.
    await page.evaluate(() => (window as any).prtSentCheck());
    expect((await readStoredState(page)).invoices[0].invoiceState).toBe('created');
    // The station takes it: gone from the queue.
    store.clear();
    await page.evaluate(() => (window as any).prtSentCheck());
    await expect(page.locator('.inv-toast').last()).toContainText('Printed at the office');
    expect((await readStoredState(page)).invoices[0].invoiceState).toBe('printed');
    const sent = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_print_sent') || '[]'));
    expect(sent[0].state).toBe('printed');
  });

  test('A waiting job can be cancelled from Settings; it is taken off the queue and never prints', async ({ page }) => {
    const store: Store = new Map(), log: any[] = [];
    await seedSync(page);
    await fakeGitHub(page, store, log);
    await loadAppWithState(page, book());
    await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
    await page.locator('#invPrintRemote').click();
    await expect(page.locator('.inv-toast')).toContainText('Sent to');
    await page.evaluate(() => (window as any).closePrintPreview());
    await openSettingsAt(page, 'printer');
    await page.locator('[data-action="invPrtCancel"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Cancelled');
    expect(store.size).toBe(0);
    expect(log.some(l => l.method === 'DELETE' && /cancelled/i.test(l.message))).toBe(true);
    await expect(page.locator('[data-prt-sent]').first()).toContainText('cancelled');
    expect((await readStoredState(page)).invoices[0].invoiceState).toBe('created');
  });

  test('The print station prints the oldest job, cleaned of anything that runs, then deletes it', async ({ page }) => {
    const store: Store = new Map(), log: any[] = [];
    const job = (id: string, title: string, html: string) => JSON.stringify({ kind: 'sep-print', v: 1, id, title, html, sentAt: Date.now(), sentBy: 'Owner · Phone' });
    store.set('print-queue/20261014100000-bbbbb.json', { sha: 's2', text: job('b', 'Second', '<div class="inv-print-invoice">SECOND</div>') });
    store.set('print-queue/20261014090000-aaaaa.json', { sha: 's1', text: job('a', 'First', '<div class="inv-print-invoice" onclick="x()">FIRST<img src="x" onerror="window.__hit=1"><script>window.__hit=2</script><a href="javascript:alert(1)">l</a></div>') });
    await seedSync(page, { sep_inv_print_station: { on: true } });
    await fakeGitHub(page, store, log);
    await page.addInitScript(() => { (window as any).__printed = []; window.print = () => { (window as any).__printed.push(document.getElementById('invPrintBody')!.innerHTML); }; });
    await loadAppWithState(page, book());
    await page.evaluate(() => (window as any).prtStationTick());
    const printed: string[] = await page.evaluate(() => (window as any).__printed);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain('FIRST');
    expect(printed[0]).not.toMatch(/onerror|onclick|<script|javascript:/i);
    expect(await page.evaluate(() => (window as any).__hit)).toBeUndefined();
    expect([...store.keys()]).toEqual(['print-queue/20261014100000-bbbbb.json']);
    expect(log.find(l => l.method === 'DELETE')!.message).toContain('Printed at the office: First');
    await expect(page.locator('#invPrintView')).not.toHaveClass(/inv-print-view-active/);
    await expect(page.locator('.inv-toast').last()).toContainText('sent from Owner · Phone');
    // The next look takes the next.
    await page.evaluate(() => (window as any).prtStationTick());
    expect(await page.evaluate(() => (window as any).__printed.length)).toBe(2);
    expect(store.size).toBe(0);
    const plog = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_print_log') || '[]'));
    expect(plog.map((r: any) => r.title)).toEqual(['Second', 'First']);
  });

  test('A job the station already printed, whose file was not deleted, is taken off and never printed twice', async ({ page }) => {
    const store: Store = new Map(), log: any[] = [];
    store.set('print-queue/20261014090000-aaaaa.json', { sha: 's1', text: JSON.stringify({ kind: 'sep-print', v: 1, id: 'x', title: 'Once', html: '<div>ONCE</div>' }) });
    await seedSync(page, { sep_inv_print_station: { on: true }, sep_inv_print_log: [{ id: '20261014090000-aaaaa', title: 'Once', at: Date.now(), state: 'printed' }] });
    await fakeGitHub(page, store, log);
    await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
    await loadAppWithState(page, book());
    await page.evaluate(() => (window as any).prtStationTick());
    expect(await page.evaluate(() => (window as any).__printed)).toBe(0);
    expect(store.size).toBe(0);
  });

  test('A device with no sync cannot send, and is told why, in the app', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate(() => (window as any).showPrintPreview('INV-1'));
    await page.locator('#invPrintRemote').click();
    const toast = page.locator('.inv-toast');
    await expect(toast).toContainText('GitHub sync');
    // Shown over the preview it was asked from.
    expect(await toast.evaluate(t => document.elementFromPoint(t.getBoundingClientRect().x + 5, t.getBoundingClientRect().y + 5) === t || t.contains(document.elementFromPoint(t.getBoundingClientRect().x + 5, t.getBoundingClientRect().y + 5)))).toBe(true);
  });

  test('Turnaround: Sundays, the paid (national) holidays and the days the plant is shut set on the turnaround are not working days', async ({ page }) => {
    const s = book(false);
    await loadAppWithState(page, s);
    // Thu 1 Oct to Mon 5 Oct 2026: 2 Oct is Gandhi Jayanti (a paid holiday), 4 Oct a Sunday.
    expect(await page.evaluate(() => (window as any).flowWd('2026-10-01', '2026-10-05'))).toBe(2);
    expect(await page.evaluate(() => (window as any).flowAddWd('2026-10-01', 1))).toBe('2026-10-03');
    // A state holiday typed in Settings → Checks & alerts → Turnaround and terms.
    await openSettingsAt(page, 'flow');
    await page.locator('#setFlowHolidays').fill('10-03');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="flow"]').click();
    expect((await readStoredState(page)).flowCfg.holidays).toEqual(['10-03']);
    expect(await page.evaluate(() => (window as any).flowWd('2026-10-01', '2026-10-05'))).toBe(1);
    expect(await page.evaluate(() => (window as any).flowAddWd('2026-10-01', 1))).toBe('2026-10-05');
  });
});
