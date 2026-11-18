import { expect, type Page, type Request, test } from '@playwright/test';

import { signIn } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard API keys, server logs and activity pages call the
 * generated Tesserafin SDK (`lib/tesserafin-sdk`) through `useApi().reefinApi` instead of
 * `@jellyfin/sdk`. These cases drive each page against a real server and assert that every call the
 * migrated code makes reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const authenticatedCall = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

async function expectAuthenticatedOk(
    page: Page,
    pattern: RegExp,
    method: string,
    action: () => Promise<unknown>
) {
    const responsePromise = page.waitForResponse(
        (res) => authenticatedCall(pattern, method)(res.request()),
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

test.describe('dashboard pages on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('API keys: list, create and revoke', async ({ page }) => {
        const appName = `step3-e2e-${Date.now()}`;

        await expectAuthenticatedOk(page, /\/Auth\/Keys$/i, 'GET', () =>
            openDashboardRoute(page, 'keys')
        );

        await page.getByRole('button', { name: 'New API Key' }).click();
        const prompt = page.getByRole('dialog');
        await prompt.getByRole('textbox').fill(appName);
        await expectAuthenticatedOk(page, /\/Auth\/Keys$/i, 'POST', () =>
            prompt.getByRole('button', { name: 'Create' }).click()
        );

        const row = page.getByRole('row').filter({ hasText: appName });
        await expect(row).toHaveCount(1, { timeout: 15_000 });

        await row.getByRole('button').click();
        const confirm = page.getByRole('dialog');
        await expectAuthenticatedOk(
            page,
            /\/Auth\/Keys\/[^/]+$/i,
            'DELETE',
            () => confirm.getByRole('button', { name: 'Delete' }).click()
        );
        await expect(row).toHaveCount(0, { timeout: 15_000 });
    });

    test('server logs: list, open one, save the slow-response setting', async ({
        page
    }) => {
        await expectAuthenticatedOk(page, /\/System\/Logs$/i, 'GET', () =>
            openDashboardRoute(page, 'logs')
        );

        const firstLog = page
            .getByRole('link', { name: /\.(log|txt)/i })
            .first();
        await expect(firstLog).toBeVisible({ timeout: 15_000 });

        const logResponse = await expectAuthenticatedOk(
            page,
            /\/System\/Logs\/Log$/i,
            'GET',
            () => firstLog.click()
        );
        expect((await logResponse.text()).length).toBeGreaterThan(0);

        await expectAuthenticatedOk(page, /\/System\/Logs$/i, 'GET', () =>
            openDashboardRoute(page, 'logs')
        );
        await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({
            timeout: 15_000
        });
        await expectAuthenticatedOk(
            page,
            /\/System\/Configuration$/i,
            'POST',
            () => page.getByRole('button', { name: 'Save' }).click()
        );
    });

    test('activity: entries load and render', async ({ page }) => {
        const response = await expectAuthenticatedOk(
            page,
            /\/System\/ActivityLog\/Entries$/i,
            'GET',
            () => openDashboardRoute(page, 'activity')
        );
        const body = (await response.json()) as { TotalRecordCount?: number };
        expect(
            body.TotalRecordCount ?? 0,
            'sign-in itself writes an activity entry'
        ).toBeGreaterThan(0);
        // At least one data row beyond the header row.
        await expect(page.getByRole('row').nth(1)).toBeVisible({
            timeout: 15_000
        });
    });
});
