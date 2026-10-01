import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, openSettingsAt, switchTab, todayIso, waitForBoot } from './fixtures';
import { CHALLAN_DAYS, STATE_CHECK, lastMonth10, pipeState, pipeStateCalm, sweepStages } from './p137-pipeline.fixture';
import { bigSweepState, problems, sweepState, type Stop } from './sweep-fixture';

// P137: Office → Pipeline (Direction B, step 5; owner, 1 Oct 2026). Where the billing is, as one line of stages:
// awaiting invoice → created → printed → dispatched → delivered → owed to us. Each stage is a count, an amount and a dot
// and a word for how long its oldest has waited, every figure read off the function its own screen uses, so a stage reads
// exactly what IM, the Register and Receivables say. A stage opens its list, drawn with its own screen's rows, and its
// action goes through the screen that owns it. The shell puts the page in Office; until then it opens in the page.

const STAGES = ['awaiting', 'created', 'printed', 'dispatched', 'delivered', 'owed'];
const stage = (page: Page, k: string) => page.locator(`#pagePipeline [data-pipe-stage="${k}"]`);
const list = (page: Page, k: string) => page.locator(`#pipeList [data-pipe-list="${k}"]`);
/* A stage's row as read: its count, its amount, its words, and the tone of its node. */
async function readStage(page: Page, k: string) {
  return stage(page, k).evaluate(el => ({
    n: (el.querySelector('.inv-panel-count')?.textContent || '').trim(),
    amount: (el.querySelector('.inv-row-end .inv-num')?.textContent || '').trim(),
    of: (el.querySelector('.inv-row-end .inv-row-meta')?.textContent || '').trim(),
    word: (el.querySelector('.inv-row-main > .inv-row-meta')?.textContent || '').trim(),
    tone: ((el.querySelector('.inv-pipe-node .inv-dot')?.className || '').match(/inv-dot-(\w+)/) || [])[1] || '',
    pressed: el.getAttribute('aria-pressed'),
    button: el.tagName === 'BUTTON',
  }));
}
const openPipeline = (page: Page) => switchTab(page, 'pagePipeline');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

test.describe('P137: Office → Pipeline', () => {
  test('six stages in order, each counted and summed exactly as its own screen counts and sums it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    expect(await page.locator('#pagePipeline [data-pipe-stage]').evaluateAll(els => els.map(e => e.getAttribute('data-pipe-stage')))).toEqual(STAGES);
    const seen: Record<string, Awaited<ReturnType<typeof readStage>>> = {};
    for (const k of STAGES) seen[k] = await readStage(page, k);
    // The book's own figures: three challans with ₹3,400.00 left to bill (one of them part-invoiced), and the invoices.
    expect([seen.awaiting.n, seen.awaiting.amount, seen.awaiting.of]).toEqual(['3', '₹3,400.00', 'to bill']);
    expect([seen.created.n, seen.created.amount, seen.created.of]).toEqual(['3', '₹890.00', 'taxable']);
    expect([seen.printed.n, seen.printed.amount]).toEqual(['1', '₹400.00']);
    expect([seen.dispatched.n, seen.dispatched.amount]).toEqual(['2', '₹540.00']);
    expect([seen.delivered.n, seen.delivered.amount]).toEqual(['2', '₹870.00']);
    expect([seen.owed.n, seen.owed.amount, seen.owed.of]).toEqual(['3', '₹10,620.00', 'owed']);

    // IM's Awaiting invoice says the same.
    await switchTab(page, 'pageIM');
    await expect(page.locator('#imList [data-im-summary]')).toHaveText(`${seen.awaiting.n} challans awaiting invoice · ${seen.awaiting.amount} to bill`);
    // The Register, on each state, says the same.
    for (const st of ['created', 'printed', 'dispatched', 'delivered']) {
      await page.evaluate(s => (window as any).regJump({ state: s }), st);
      const n = seen[st].n;
      await expect(page.locator('#regList [data-reg-summary]')).toHaveText(`${n} active invoice${n === '1' ? '' : 's'} · ${seen[st].amount} taxable`);
    }
    // Receivables (Money's overview) say the same: what is owed and how many clients owe it.
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="overview"]').click();
    await expect(page.locator('[data-fin-tile="owed"] .inv-tile-value')).toHaveText(seen.owed.amount);
    await expect(page.locator('[data-fin-tile="owed"] .inv-tile-sub')).toContainText(`${seen.owed.n} clients`);
    // Filed and cancelled are in no stage, and the pipeline says so.
    await openPipeline(page);
    await expect(page.locator('#pagePipeline [data-pipe-note]')).toContainText('Filed and cancelled invoices are not stages');

    // A challan saved with no lines is on IM's Awaiting list, so it is in the stage too: the two counts never differ.
    const odd = pipeState() as any;
    odd.incomingMaterial.push({ id: 'IM-9', challanNo: '709', challanDate: todayIso(), clientId: 2, clientName: 'LAMBDA TOOLS', vehicleNo: '',
      items: [], receivedDate: todayIso(), notes: '', createdAt: 1 });
    await loadAppWithState(page, odd);
    await openPipeline(page);
    expect(await readStage(page, 'awaiting')).toMatchObject({ n: '4', amount: '₹3,400.00' });
    await switchTab(page, 'pageIM');
    await expect(page.locator('#imList [data-im-summary]')).toHaveText('4 challans awaiting invoice · ₹3,400.00 to bill');
    expect(errors).toEqual([]);
  });

  test('each stage’s dot and words follow the days set in Settings, read as they change', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    // Challans: amber at the To-do's unbilled days (set to 4 here), red at twice them. Two are 5 and 6 days old.
    expect(await readStage(page, 'awaiting')).toMatchObject({ tone: 'warning', word: `2 over ${CHALLAN_DAYS} days` });
    // Invoice states at the book's days (Created 2/4, Printed 1/3, Dispatched 3/6), each invoice's own tone.
    expect(await readStage(page, 'created')).toMatchObject({ tone: 'danger', word: `1 over ${STATE_CHECK.createdRed} days` });
    expect(await readStage(page, 'printed')).toMatchObject({ tone: 'warning', word: `1 over ${STATE_CHECK.printedAmber} day` });
    expect(await readStage(page, 'dispatched')).toMatchObject({ tone: 'neutral', word: 'oldest 2 days' });
    // Delivered waits on its return: last month's GSTR-1 falls due on the 11th of this one, amber that many days before.
    const t = new Date(todayIso() + 'T00:00:00'), left = 11 - t.getDate();
    const dueTone = left < 0 ? 'danger' : left <= STATE_CHECK.fileWarnDays ? 'warning' : 'neutral';
    expect(await readStage(page, 'delivered')).toMatchObject({ tone: dueTone, word: `GSTR-1 due 11 ${months[t.getMonth()]} ${t.getFullYear()}` });
    // Owed: the debt over 90 days, in the words Home's Money tile uses for it.
    const owed = await readStage(page, 'owed');
    expect(owed).toMatchObject({ tone: 'danger', word: '₹6,608 over 90 days' });
    await switchTab(page, 'pageHome');
    await expect(page.locator('[data-home-fin="Owed to us"] .inv-tile-sub')).toHaveText(owed.word);

    // Settings move them: Created red at 6 days (the 5-day-old one is amber now), challans amber at 6 days.
    await openSettingsAt(page, 'invStates');
    await page.locator('#setIscreatedR').fill('6');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="invStates"]').click();
    await openSettingsAt(page, 'todo');
    await page.locator('#setTodoChallan').fill('6');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="todo"]').click();
    await page.locator('[data-action="invCloseSettings"]').first().click();
    await openPipeline(page);
    expect(await readStage(page, 'created')).toMatchObject({ tone: 'warning', word: `2 over ${STATE_CHECK.createdAmber} days` });
    expect(await readStage(page, 'awaiting')).toMatchObject({ tone: 'warning', word: '1 over 6 days' });
  });

  test('the stage that opens first holds a red, else anything; a stage holding nothing says None and does not open', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    // Awaiting is amber; Created is the first with a red.
    expect((await readStage(page, 'created')).pressed).toBe('true');
    expect((await readStage(page, 'awaiting')).pressed).toBe('false');
    await expect(list(page, 'created')).toBeVisible();
    await expect(page.locator('#pagePipeline button[data-pipe-stage][aria-pressed="true"]')).toHaveCount(1);

    // A calm book: nothing red, nothing printed, no statement.
    await loadAppWithState(page, pipeStateCalm());
    await openPipeline(page);
    expect((await readStage(page, 'awaiting')).pressed).toBe('true');
    await expect(list(page, 'awaiting')).toBeVisible();
    const printed = await readStage(page, 'printed');
    expect(printed).toMatchObject({ button: false, word: 'None', n: '', amount: '' });
    await expect(stage(page, 'printed')).not.toHaveAttribute('data-action', /./);
  });

  test('a stage is a place: tapping one keeps the page where it is, back walks the stages, and a reload reopens it', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    // Room to scroll, then a tap on a stage: the page stays put (a pressed row is a choice inside the view).
    await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('style', 'height:1600px'); document.getElementById('pagePipeline')!.appendChild(d); window.scrollTo(0, 120); });
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(100);
    // Tapped where it stands (a locator's click would first scroll it to suit itself).
    await stage(page, 'printed').evaluate(el => (el as HTMLElement).click());
    await expect(list(page, 'printed')).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await expect.poll(() => new URL(page.url()).searchParams.get('v')).toBe('printed');
    expect(new URL(page.url()).searchParams.get('tab')).toBe('pagePipeline');
    await stage(page, 'owed').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('v')).toBe('owed');
    await page.goBack();
    await expect(stage(page, 'printed')).toHaveAttribute('aria-pressed', 'true');
    await expect(list(page, 'printed')).toBeVisible();
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    await expect(stage(page, 'printed')).toHaveAttribute('aria-pressed', 'true');
    await expect(list(page, 'printed')).toBeVisible();
    // An address opens its stage too.
    await page.goto('/?tab=pagePipeline&v=delivered');
    await waitForBoot(page);
    await expect(stage(page, 'delivered')).toHaveAttribute('aria-pressed', 'true');
    await expect(list(page, 'delivered')).toBeVisible();
  });

  test('every invoice action goes through the Register’s own selection and bulk bar', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    // Created: Open 3 in the Register lands on Created with the three selected; its bulk bar marks them.
    const ids = await list(page, 'created').locator('[data-action="invViewInvoiceDetail"]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id));
    expect(ids).toEqual(['INV-C1', 'INV-C2', 'INV-C3']);
    await list(page, 'created').locator('[data-action="invPipeBulk"]').click();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#regStateFilter')).toHaveValue('created');
    await expect(page.locator('#regList [data-reg-summary]')).toHaveText('3 active invoices · ₹890.00 taxable');
    await expect(page.locator('#regSelBar .inv-selbar-count')).toHaveText('3 selected');
    expect(await page.locator('#regList input[data-action="invRegToggleInv"]:checked').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id).sort())).toEqual(ids);
    await page.locator('#regSelBar [data-action="invRegBulkState"][data-state="dispatched"]').click();
    await openPipeline(page);
    expect(await readStage(page, 'created')).toMatchObject({ button: false, word: 'None' });
    expect((await readStage(page, 'dispatched')).n).toBe('5');

    // Printed: Mark dispatched opens the Register with the printed one selected, Dispatch on its bar.
    await stage(page, 'printed').click();
    await list(page, 'printed').locator('[data-action="invPipeBulk"]').click();
    await expect(page.locator('#regStateFilter')).toHaveValue('printed');
    await expect(page.locator('#regSelBar [data-action="invRegBulkState"][data-state="dispatched"]')).toHaveText('Dispatch (1)');

    // Dispatched: Mark delivered, Deliver on the bar for all five.
    await openPipeline(page);
    await stage(page, 'dispatched').click();
    await list(page, 'dispatched').locator('[data-action="invPipeBulk"]').click();
    await expect(page.locator('#regSelBar [data-action="invRegBulkState"][data-state="delivered"]')).toHaveText('Deliver (5)');

    // Delivered: filed a month at a time, the month its GSTR-1 is for.
    await openPipeline(page);
    await stage(page, 'delivered').click();
    const ym = lastMonth10().slice(0, 7);
    await list(page, 'delivered').locator(`[data-action="invPipeFile"][data-month="${ym}"]`).click();
    await expect(page.locator('#regStateFilter')).toHaveValue('delivered');
    await expect(page.locator('#regMonthFilter')).toHaveValue(ym);
    await expect(page.locator('#regSelBar [data-action="invRegBulkState"][data-state="filed"]')).toHaveText('File (1)');
  });

  test('awaiting invoice: a client’s Create invoice is IM’s own route, and a challan opens where IM keeps it', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    await stage(page, 'awaiting').click();
    // Clients oldest challan first, each with its challans under it.
    expect(await list(page, 'awaiting').locator('[data-pipe-client]').evaluateAll(els => els.map(e => e.getAttribute('data-pipe-client')))).toEqual(['2', '1']);
    expect(await list(page, 'awaiting').locator('[data-pipe-im]').evaluateAll(els => els.map(e => e.getAttribute('data-pipe-im')))).toEqual(['IM-3', 'IM-2', 'IM-1']);
    // The part-invoiced challan shows what is left of it, as IM's Awaiting list does.
    await expect(list(page, 'awaiting').locator('[data-pipe-im="IM-2"]')).toContainText('left of ₹1,200.00');
    await expect(list(page, 'awaiting').locator('[data-pipe-client="1"]')).toContainText('2 challans · ₹2,600.00 to bill');

    // KAPPA's Create invoice: the same invoice form IM's Create invoice makes from the same challans.
    await list(page, 'awaiting').locator('[data-action="invPipeInvoice"][data-client="1"]').click();
    await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/);
    const lines = () => page.evaluate(() => { const f = (0, eval)('invoiceForm'); return { client: f.clientId, items: f.items.map((i: any) => [i.partNumber, i.qty, i.amount, i._imItemId]) }; });
    const fromPipeline = await lines();
    expect(fromPipeline.client).toBe(1);
    expect(fromPipeline.items).toEqual(expect.arrayContaining([['PART 702-0', 400, 800, 'IM-2-0'], ['PART 701-0', 100, 1200, 'IM-1-0'], ['PART 701-1', 50, 600, 'IM-1-1']]));
    await loadAppWithState(page, pipeState());
    await switchTab(page, 'pageIM');
    for (const id of ['IM-1', 'IM-2']) await page.locator(`#imList [data-action="invCheckIMChallan"][data-id="${id}"]`).click();
    await page.locator('#imSelBar [data-action="invCreateFromIM"]').click();
    await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/);
    const fromIM = await lines();
    expect(fromIM.client).toBe(fromPipeline.client);
    expect([...fromIM.items].sort()).toEqual([...fromPipeline.items].sort());

    // A challan opens on IM: its tab, its client, the row open.
    await openPipeline(page);
    await stage(page, 'awaiting').click();
    await list(page, 'awaiting').locator('[data-pipe-im="IM-3"]').click();
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imClientFilter')).toHaveValue('2');
    await expect(page.locator('#imList [data-im="IM-3"] [data-action="invToggleIM"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('an invoice row opens the invoice; owed opens Receivables on the client; with no statement it offers the import', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    await list(page, 'created').locator('[data-action="invViewInvoiceDetail"][data-id="INV-C1"]').click();
    await expect(page.locator('.inv-scrim-dialog [data-inv-detail="INV-C1"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    // Owed: the clients largest first, each opening Receivables on itself.
    await stage(page, 'owed').click();
    expect(await list(page, 'owed').locator('[data-pipe-owed]').evaluateAll(els => els.map(e => e.getAttribute('data-pipe-owed')))).toEqual(['3', '1', '2']);
    await list(page, 'owed').locator('[data-pipe-owed="3"]').click();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invFinTab"][data-tab="receipts"]')).toHaveAttribute('aria-selected', 'true');

    // No statement: Owed to us reads Needs a bank statement, and Import statement opens the bank's file there.
    await loadAppWithState(page, pipeStateCalm());
    await openPipeline(page);
    expect(await readStage(page, 'owed')).toMatchObject({ button: false, word: 'Needs a bank statement' });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), stage(page, 'owed').locator('[data-action="invHomeImportBank"]').click()]);
    expect(chooser).toBeTruthy();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invFinTab"][data-tab="bank"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Create invoice is the view’s one primary, and starts a new invoice', async ({ page }) => {
    await loadAppWithState(page, pipeState());
    await openPipeline(page);
    for (const k of STAGES) {
      await stage(page, k).click();
      await expect(page.locator('#pagePipeline .inv-btn-primary')).toHaveText(['Create invoice']);
    }
    await page.locator('#pagePipeline .inv-btn-primary').click();
    await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/);
    expect(await page.evaluate(() => (0, eval)('invoiceForm.items.length'))).toBeLessThanOrEqual(1);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the pipeline and every stage's list are v2.0 only on the phone (${scheme})`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.emulateMedia({ colorScheme: scheme });
      const stops: Stop[] = [];
      for (const [tag, book] of [['this book', pipeState()], ['no statement', pipeStateCalm()], ['the sweep book', sweepState()]] as const) {
        await loadAppWithState(page, book);
        await sweepStages(page, tag, stops);
      }
      // A crore and an 80-character client name: what an ellipsis cuts carries its title, nothing runs off the screen.
      await loadAppWithState(page, bigSweepState());
      const big: Stop[] = [];
      await sweepStages(page, 'the crore book', big);
      expect(stops.length).toBeGreaterThan(12);
      expect(problems(stops)).toEqual([]);
      expect(problems(big, { cutMeta: false })).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
