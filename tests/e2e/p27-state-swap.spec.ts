import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso } from './fixtures';

/*
 * Replacing the whole state.
 *
 * Three paths swap S wholesale — the loader, a GitHub pull, and Settings →
 * Import — and only the loader ran the migrations. A copy that arrives over
 * the wire is exactly as old as one read off disk, so it needs the same two
 * passes: fill the shape a backup might predate, then migrate the records
 * inside it.
 *
 * The failure this exists to stop was silent. A pulled state carrying the
 * retired `pickling` / `colour` area ids kept them; areaStats drops an
 * unknown area on the floor (`if (!a) return;`), so heads under-counted and
 * every shortfall inflated to match, and nothing on the card said so.
 *
 * The other half of the rule is what must NOT re-run. A seed writes new
 * business records and a cleanup deletes them, and the flags on an imported
 * backup describe the device that wrote it — not the records in it.
 */

const SYNC_KEY = 'sep_inv_github_sync';
const TOKEN_KEY = 'sep_inv_github_token';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';

const LABOUR = {
  otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5,
  modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8,
};

async function seedSync(page: Page) {
  await page.addInitScript(
    ([syncKey, tokenKey, cfgJson]) => {
      localStorage.setItem(syncKey as string, cfgJson as string);
      localStorage.setItem(tokenKey as string, 'github_pat_TESTTOKEN');
    },
    [SYNC_KEY, TOKEN_KEY, JSON.stringify({
      owner: 'testowner', repo: 'testrepo', branch: 'main',
      path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Test Bench',
    })] as const,
  );
}

/** Serve one envelope wrapping `state`, then pull it through the UI. */
async function pull(page: Page, state: Record<string, unknown>) {
  await seedSync(page);
  await page.route(CONTENTS, async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        sha: 'remotesha1',
        content: Buffer.from(JSON.stringify({
          app: 'sep-invoicing', schema: 1, savedAt: Date.now() - 60000,
          device: 'Old Device', deviceId: 'dev-old',
          counts: { invoices: 0, challans: 0, clients: 1, items: 0 },
          state,
        })).toString('base64'),
      }),
    });
  });
  await loadAppWithState(page, emptyState());
  await page.locator('[data-action="invOpenSettings"]').first().click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#ghPullBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Pulled from GitHub');
}

function readState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!));
}

/* A state as a device that never ran the area realignment would have written
   it: retired ids on every surface that carries one, and no `_staffAreas2`. */
function unmigratedAreaState() {
  const iso = todayIso();
  return {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    labour: LABOUR,
    staff: [
      { id: 1, name: 'PICKLER', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'pickling', onFloor: true, active: true },
      { id: 2, name: 'COLOURIST', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'colour', onFloor: true, active: true },
    ],
    attendance: {
      [iso]: {
        marks: {
          1: { st: 'P', hours: 8, ot: 0, area: 'pickling' },
          2: { st: 'P', hours: 8, ot: 0, area: 'colour' },
        },
        extra: [{ area: 'pickling', hours: 8 }],
        note: '',
      },
    },
    areaTargets: { pickling: 3 },
  };
}

/* ===== THE REPORTED BUG ===== */

test('a pulled state is migrated, not just adopted', async ({ page }) => {
  await pull(page, unmigratedAreaState());
  const s = await readState(page);
  const iso = todayIso();

  // Every surface that carries an area id is re-pointed, in place, at pull
  // time — not on some later reload the operator has no reason to perform.
  expect(s._staffAreas2).toBe(true);
  expect(s.staff.map((w: { area: string }) => w.area).sort()).toEqual(['pickling-vat', 'vat-a1']);
  expect(s.attendance[iso].marks['1'].area).toBe('pickling-vat');
  expect(s.attendance[iso].marks['2'].area).toBe('vat-a1');
  expect(s.attendance[iso].extra[0].area).toBe('pickling-vat');
  expect(s.areaTargets['pickling-vat']).toBe(3);
  expect(s.areaTargets.pickling).toBeUndefined();
});

test('the heads a pulled state carries are counted, not dropped on the floor', async ({ page }) => {
  await pull(page, unmigratedAreaState());
  // The visible consequence, which is what made the bug worth a spec: an
  // unknown area id is skipped by areaStats, so before this both hands went
  // missing — Pickling A1+A2 read 0 of 3 and the card predicted 24 h of
  // coverage against the 8 the state actually books.
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();

  await expect(page.locator('.inv-area-row', { hasText: 'Pickling A1+A2' })).toContainText('1');
  const card = page.locator('.inv-lab-card', { hasText: 'The extra, checked' });
  // 1 of 3 present, so short 2 → 16 h expected against 8 booked. The point is
  // that the hand is SEEN; unmigrated it was short 3 and expected 24.
  await expect(card).toContainText('16.0');
  await expect(card).not.toContainText('24.0');
});

/* ===== THE SHARPER HALF: SETTINGS IMPORT HAD NO REPAIRS AT ALL ===== */

test('importing a backup written before the roster existed does not break the Staff tab', async ({ page }) => {
  await loadAppWithState(page, emptyState());

  // A backup from before the Staff tab shipped: no staff, attendance,
  // areaTargets or labour keys at all. This path applied no shape repairs, so
  // the tab threw the moment it was opened.
  const older = emptyState() as Record<string, unknown>;
  delete older.staff;
  delete older.attendance;
  delete older.areaTargets;
  delete older.labour;
  older.clients = [{ id: 9, name: 'OLD BACKUP CLIENT', billingMode: 'kg', gstType: 'intra', isActive: true }];

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // The file input is rendered by the Settings overlay, and Import is reached
  // through it — so the test walks the same path the operator does.
  await page.locator('[data-action="invOpenSettings"]').first().click();
  page.once('dialog', (d) => d.accept());
  await page.evaluate((data) => {
    // Arm importData's own onchange handler, then hand it a real File, so what
    // is exercised is the handler rather than a re-implementation of it.
    (window as unknown as { importData: () => void }).importData();
    const inp = document.getElementById('importFileInput') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  }, older);

  await expect(page.locator('.inv-toast')).toContainText('Data imported');
  const s = await readState(page);
  expect(s.clients[0].name).toBe('OLD BACKUP CLIENT');
  expect(Array.isArray(s.staff)).toBe(true);
  expect(s.attendance).toEqual({});
  expect(s.areaTargets).toEqual({});

  await switchTab(page, 'pageStaff');
  await expect(page.locator('[data-action="invAttView"][data-view="areas"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a partial labour config is completed, not left to price the extra at zero', async ({ page }) => {
  // `labourCfg()` reads `extraRate || 0`, so a backup predating a constant
  // gives a WRONG number rather than a visible gap — the extra silently costs
  // nothing. The shape pass fills missing keys inside a config object.
  const partial = { ...unmigratedAreaState(), labour: { otMult: 1.1, modelPerKg: 3.55 } };
  await pull(page, partial);

  const s = await readState(page);
  expect(s.labour.extraRate).toBe(47.5);
  expect(s.labour.extraHoursPerHead).toBe(8);
  expect(s.labour.gateFull).toBe(0.9);
  // A value the backup DID carry is never overwritten.
  expect(s.labour.otMult).toBe(1.1);
});

test('a migration that throws leaves storage as it was, not half-migrated', async ({ page }) => {
  // The rollback has to cover STORAGE, not just memory. `migrateState()`
  // persists as it runs — seven saveJSON calls — and every one fires while S
  // is already the incoming state. So a throw partway through wrote a
  // half-migrated FOREIGN state to disk while memory was restored: the toast
  // said "Invalid file", the operator carried on, and the next reload opened
  // someone else's books. Claimed all-or-nothing in three comments and tested
  // in none of them until Cipher said so.
  await loadAppWithState(page, emptyState());
  const before = await readState(page);

  // `_staffAreas2` reads `rec.marks[id].area` with no null guard, so a null
  // mark throws inside the migration — the code's own threat model, not a
  // contrived one.
  const poisoned = emptyState() as Record<string, unknown>;
  poisoned.clients = [{ id: 9, name: 'FOREIGN', billingMode: 'kg', gstType: 'intra', isActive: true }];
  poisoned.attendance = { [todayIso()]: { marks: { 3: null }, extra: [], note: '' } };
  delete poisoned._staffAreas2;

  await page.locator('[data-action="invOpenSettings"]').first().click();
  page.once('dialog', (d) => d.accept());
  await page.evaluate((data) => {
    (window as unknown as { importData: () => void }).importData();
    const inp = document.getElementById('importFileInput') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(data)], 'bad.json', { type: 'application/json' }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  }, poisoned);

  // Whatever the app reports, what is ON DISK must be what was there before —
  // the foreign client must not survive in storage to be loaded next time.
  const after = await readState(page);
  expect(JSON.stringify(after.clients)).toBe(JSON.stringify(before.clients));
  expect(JSON.stringify(after.clients)).not.toContain('FOREIGN');
});

/* ===== WHAT MUST NOT RE-RUN ===== */

test('a pull does not re-fire the seeds against someone else’s records', async ({ page }) => {
  // The incoming flags describe the device that WROTE the backup, not the
  // records in it. Re-running the challan seed on a pull would push seven
  // challans a second time — into the one app in this repo with a whole
  // module devoted to duplicate receipts.
  const noFlags = unmigratedAreaState() as Record<string, unknown>;
  delete noFlags._scanSeed1;
  delete noFlags._nosQtySeeded;
  noFlags.incomingMaterial = [];

  await pull(page, noFlags);
  const s = await readState(page);
  expect(s.incomingMaterial).toEqual([]);
  expect(s._scanSeed1).toBeUndefined();
});

test('a pull does not re-fire the one-time catalogue cleanup', async ({ page }) => {
  // Same rule, sharper stakes: _rateCleanup1 DELETES rows. Running it on a
  // state whose flag was never about those rows would destroy data.
  const noFlags = unmigratedAreaState() as Record<string, unknown>;
  delete noFlags._rateCleanup1;
  noFlags.items = [
    { id: 1, partNumber: 'CHEAP', desc: '', gauge: '', hsn: '998873', unit: 'KG', rate: 13, stdWeightKg: null },
    { id: 2, partNumber: 'DEAR', desc: '', gauge: '', hsn: '998873', unit: 'KG', rate: 99, stdWeightKg: null },
  ];

  await pull(page, noFlags);
  const s = await readState(page);
  expect(s.items.map((i: { partNumber: string }) => i.partNumber).sort()).toEqual(['CHEAP', 'DEAR']);
  expect(s._rateCleanup1).toBeUndefined();
});

/* ===== IDEMPOTENCE ===== */

test('migrating an already-migrated state changes nothing', async ({ page }) => {
  await pull(page, unmigratedAreaState());
  const first = await readState(page);

  // The migrations are guarded by flags the first pass set, so a second run
  // over the same state must be a no-op. Run it directly rather than pulling
  // twice, so what is under test is the function and not the sync plumbing.
  await page.evaluate(() => (window as unknown as { migrateState: () => void }).migrateState());
  const second = await readState(page);
  expect(second).toEqual(first);
});
