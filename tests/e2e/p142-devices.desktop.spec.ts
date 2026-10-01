import { test, expect } from '@playwright/test';
import { openSettingsAt } from './fixtures';
import { problems, sweep } from './sweep-fixture';
import { FakeGitHub, OWNER, SUPER, TOKEN, book, g, listedDevices, open, seedDevice } from './p142-devices.fixture';

// P142 (desktop): devices in Settings' two panes. Access is a group down the left, its Devices section shows this device,
// the list with its Remove buttons, and GitHub sync held while the device is not registered; the same sweep P76 runs.

test.describe('P142 desktop: devices', () => {
  test.describe.configure({ timeout: 90_000 });

  test('Access is a group of its own; Devices, its list and GitHub sync held pass the sweep, and registering lists the device', async ({ page }) => {
    const gh = new FakeGitHub();
    await gh.on(page);
    await seedDevice(page, { token: TOKEN, session: 'u-own', devId: 'dev-desk' });
    await open(page, book({ users: [OWNER, SUPER], devices: listedDevices() }));
    await page.evaluate(() => localStorage.removeItem('sep_inv_settings_ui'));
    await expect(page.locator('#homeSyncCard')).toContainText("Paused: this device isn't registered");
    const stops = [await sweep(page, 'home · sync paused')];

    await openSettingsAt(page, 'devices');
    const access = page.locator('.inv-dialog-nav button.inv-side-item').filter({ hasText: 'Access' });
    await expect(access).toHaveAttribute('aria-current', 'true');
    const list = page.locator('details[data-sec="devices"] [data-card="devices"]');
    await expect(list.locator('[data-dev="dev-floor"] [data-action="invDevRemove"]')).toBeVisible();
    await expect(list.locator('[data-dev="dev-old"]')).toContainText('Sold, and its token deleted on GitHub the same day');
    stops.push(await sweep(page, 'settings › devices · not registered'));

    await g(page, `document.querySelector('details[data-sec="devices"]').open = false`);
    await openSettingsAt(page, 'sync');
    await expect(page.locator('#ghPushBtn')).toBeDisabled();
    stops.push(await sweep(page, 'settings › sync · held'));

    await g(page, `document.querySelector('details[data-sec="sync"]').open = false`);
    await openSettingsAt(page, 'devices');
    await page.locator('#devNameIn').fill('Office desktop');
    await page.locator('[data-action="invDevRegister"]').click();
    await expect(page.locator('.inv-toast')).toContainText('This device is registered, and a copy went to GitHub');
    await openSettingsAt(page, 'devices');
    await expect(list.locator('[data-dev="dev-desk"]')).toContainText('Office desktop');
    await expect(list.locator('[data-dev="dev-desk"] .inv-badge')).toHaveText('This device');
    await expect(page.locator('[data-action="invDevSave"]')).toBeVisible();
    stops.push(await sweep(page, 'settings › devices · registered'));
    expect(gh.envelope()._device).toMatchObject({ id: 'dev-desk', name: 'Office desktop', user: 'u-own' });
    expect(problems(stops, { cutMeta: false })).toEqual([]);
  });
});
