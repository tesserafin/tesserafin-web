import {
    type APIRequestContext,
    expect,
    type Page,
    type Request,
    request,
    test
} from '@playwright/test';

import { BASE_URL, PASSWORD, signIn, USER } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard devices page and session cards call the generated
 * Tesserafin SDK (`lib/tesserafin-sdk`) through `useApi().reefinApi` instead of `@jellyfin/sdk`.
 * These cases drive them against a real server and assert that every call the migrated code makes
 * reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

async function expectAuthenticatedOk(
    page: Page,
    pattern: RegExp,
    method: string,
    action: () => Promise<unknown>
) {
    const responsePromise = page.waitForResponse(
        (res) => matches(pattern, method)(res.request()),
        { timeout: 15_000 }
    );
    await action();
    const response = await responsePromise;
    const auth = await response.request().headerValue('authorization');
    expect(auth, `${method} ${pattern} must carry the session token`).toMatch(
        /^MediaBrowser .*Token="[^"]+"/
    );
    expect(
        response.status(),
        `${method} ${response.url()} must succeed`
    ).toBeLessThan(300);
    return response;
}

async function openDashboardRoute(page: Page, route: string) {
    // Same document: a hash-only navigation keeps the authenticated session alive.
    await page.evaluate((hash) => {
        window.location.hash = hash;
    }, `#/dashboard/${route}`);
}

/** Signs in from a separate, API-only device so the browser's own device is never the target. */
async function registerExtraDevice(
    api: APIRequestContext,
    deviceId: string,
    deviceName: string
) {
    const response = await api.post(`${BASE_URL}/Users/AuthenticateByName`, {
        headers: {
            Authorization: `MediaBrowser Client="Tesserafin E2E Extra", Device="${deviceName}", DeviceId="${deviceId}", Version="0.0.0"`
        },
        data: { Username: USER, Pw: PASSWORD }
    });
    expect(response.ok(), 'extra device sign-in').toBeTruthy();
}

const deviceRow = (page: Page, text: string) =>
    page.getByRole('row').filter({ hasText: text });

test.describe('dashboard devices and sessions on the generated SDK', () => {
    let api: APIRequestContext;

    test.beforeAll(async () => {
        api = await request.newContext();
    });

    test.afterAll(async () => {
        await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('devices: list, rename and delete another device', async ({
        page
    }) => {
        const stamp = Date.now();
        const deviceName = `step3-extra-${stamp}`;
        const customName = `step3-renamed-${stamp}`;
        await registerExtraDevice(api, `step3-extra-${stamp}`, deviceName);

        await expectAuthenticatedOk(page, /\/Devices$/i, 'GET', () =>
            openDashboardRoute(page, 'devices')
        );
        const row = deviceRow(page, deviceName);
        await expect(row).toHaveCount(1, { timeout: 15_000 });

        await row.getByRole('button', { name: 'Edit' }).click();
        const editor = page.getByRole('dialog');
        await editor
            .getByRole('textbox', { name: 'Device', exact: true })
            .fill(customName);
        await expectAuthenticatedOk(page, /\/Devices\/Options$/i, 'POST', () =>
            editor.getByRole('button', { name: 'Save' }).click()
        );
        const renamed = deviceRow(page, customName);
        await expect(renamed).toHaveCount(1, { timeout: 15_000 });

        await renamed.getByRole('button', { name: 'Delete' }).click();
        await expectAuthenticatedOk(page, /\/Devices$/i, 'DELETE', () =>
            page
                .getByRole('dialog')
                .getByRole('button', { name: 'Delete' })
                .click()
        );
        await expect(renamed).toHaveCount(0, { timeout: 15_000 });
    });

    test('devices: Delete All removes every other device and keeps this one', async ({
        page
    }) => {
        const stamp = Date.now();
        const names = [`step3-all-a-${stamp}`, `step3-all-b-${stamp}`];
        for (const name of names) {
            await registerExtraDevice(api, name, name);
        }

        const listed = await expectAuthenticatedOk(
            page,
            /\/Devices$/i,
            'GET',
            () => openDashboardRoute(page, 'devices')
        );
        for (const name of names) {
            await expect(deviceRow(page, name)).toHaveCount(1, {
                timeout: 15_000
            });
        }

        const ownDeviceId = decodeURIComponent(
            /DeviceId="([^"]+)"/.exec(
                (await listed.request().headerValue('authorization')) ?? ''
            )?.[1] ?? ''
        );
        expect(ownDeviceId, 'browser device id').not.toBe('');

        await page.getByRole('button', { name: 'Delete All' }).click();
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' })
            .click();

        for (const name of names) {
            await expect(deviceRow(page, name)).toHaveCount(0, {
                timeout: 15_000
            });
        }

        // This browser's device survives: the server still lists it and the session still works.
        const devices = await expectAuthenticatedOk(
            page,
            /\/Devices$/i,
            'GET',
            () => page.reload()
        );
        const body = (await devices.json()) as { Items?: { Id?: string }[] };
        expect(body.Items?.map((d) => d.Id)).toContain(ownDeviceId);
    });

    test('sessions: the dashboard lists active sessions', async ({ page }) => {
        const response = await expectAuthenticatedOk(
            page,
            /\/Sessions$/i,
            'GET',
            () => openDashboardRoute(page, '')
        );
        const sessions = (await response.json()) as { DeviceName?: string }[];
        expect(sessions.length).toBeGreaterThan(0);
    });
});
