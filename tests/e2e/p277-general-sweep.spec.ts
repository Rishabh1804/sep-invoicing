import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P277: the general sweep of 17 Nov 2026 (bugs found by driving the built app and reading its code). Each test fails on the
// build before its fix. Every name and figure is made up.

const dmyOf = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

test.describe('P277: the general sweep', () => {
  // A plant in India: the device's clock is IST, which is where a UTC date is a day behind before 5:30 in the morning.
  test.use({ timezoneId: 'Asia/Kolkata' });

  test('a line taught before 5:30 AM says the day it was taught on this device, not UTC’s day before', async ({ page }) => {
    // prodTaughtRead said "entered by hand on" + the UTC date of the lesson, as ISO: a lesson taught at 1 AM in IST read as the day
    // before. It is the device's day now, written as every date on screen is.
    await loadAppWithState(page, { ...emptyState(), clients: [{ id: 21, name: 'DELTA AUTO', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }],
      incomingMaterial: noSeedIM() } as SepState);
    const today = todayIso();
    const out = await page.evaluate(({ today, dmy }) => {
      const w = window as any;
      const at = new Date(today + 'T01:00:00').getTime();   // 1 AM on the device's clock, 7:30 PM the day before in UTC
      w.prodData().learn.lines = { 'LINEAR # NOS': { kind: 'plated', clientId: 21, part: 'QX1', unit: 'NOS', line: 'vat-a1', slot: null, at, by: '' } };
      const msgs = w.parseProdPaste(`${dmy}\n----VAT A 1----\nLINEAR 120 NOS`, w.prodCtx());
      const it = msgs[0].read.items[0];
      return { kind: msgs[0].kind, text: (it.issues.find((x: any) => x.code === 'taught') || {}).text };
    }, { today, dmy: dmyOf(today) });
    expect(out.kind).toBe('taught');
    expect(out.text).toBe(`Read as this line was entered by hand on ${longDate(today)}: DELTA AUTO · QX1.`);
  });
});

