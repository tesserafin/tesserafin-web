import { expect, type Page, type Request, test } from '@playwright/test';

import { signIn } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard configuration pages (general settings, networking,
 * branding and splash screen, backups) and the dashboard home's item counts call the generated
 * Tesserafin SDK (`lib/tesserafin-sdk`) instead of `@jellyfin/sdk`. These cases drive them against
 * a real server and assert that every call the migrated code makes reaches the server
 * authenticated and succeeds.
 *
 * Restart, shutdown and backup restore are not driven: they would take the server down mid-run.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

const waitAuthenticatedOk = (page: Page, pattern: RegExp, method: string) =>
    page
        .waitForResponse((res) => matches(pattern, method)(res.request()), {
            timeout: 30_000
        })
        .then(async (response) => {
            const auth = await response.request().headerValue('authorization');
            expect(
                auth,
                `${method} ${pattern} must carry the session token`
            ).toMatch(/^MediaBrowser .*Token="[^"]+"/);
            expect(
                response.status(),
                `${method} ${response.url()} must succeed`
            ).toBeLessThan(300);
            return response;
        });

async function openDashboardRoute(page: Page, route: string) {
    // Same document: a hash-only navigation keeps the authenticated session alive.
    await page.evaluate((hash) => {
        window.location.hash = hash;
    }, `#/dashboard/${route}`);
}

/** A 1x1 PNG. */
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

test.describe('dashboard configuration pages on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('dashboard home: item counts load', async ({ page }) => {
        const counts = waitAuthenticatedOk(page, /\/Items\/Counts$/i, 'GET');
        await openDashboardRoute(page, '');
        await counts;
    });

    test('general settings: localization options load, Save writes the configuration', async ({
        page
    }) => {
        const options = waitAuthenticatedOk(
            page,
            /\/Localization\/Options$/i,
            'GET'
        );
        await openDashboardRoute(page, 'settings');
        await options;
        const save = page
            .locator('#dashboardGeneralPage')
            .getByRole('button', { name: 'Save' });
        await expect(save).toBeVisible({ timeout: 15_000 });
        const saved = waitAuthenticatedOk(
            page,
            /\/System\/Configuration$/i,
            'POST'
        );
        await save.click();
        await saved;
    });

    test('networking: Save writes the network configuration', async ({
        page
    }) => {
        await openDashboardRoute(page, 'networking');
        const save = page
            .locator('#networkingPage')
            .getByRole('button', { name: 'Save' });
        await expect(save).toBeVisible({ timeout: 15_000 });
        const saved = waitAuthenticatedOk(
            page,
            /\/System\/Configuration\/network$/i,
            'POST'
        );
        await save.click();
        await saved;
    });

    test('branding: splash screen upload, delete and Save', async ({
        page
    }) => {
        // The branding options are already cached: CustomCss loads them (same query key) at startup.
        await openDashboardRoute(page, 'branding');
        const brandingPage = page.locator('#brandingPage');
        const enable = brandingPage.getByRole('checkbox', {
            name: 'Enable the splash screen image'
        });
        await expect(enable).toBeVisible({ timeout: 15_000 });
        if (!(await enable.isChecked())) {
            const enabled = waitAuthenticatedOk(
                page,
                /\/System\/Configuration\/branding$/i,
                'POST'
            );
            await enable.check();
            await enabled;
        }

        const uploaded = waitAuthenticatedOk(
            page,
            /\/Branding\/Splashscreen$/i,
            'POST'
        );
        await brandingPage.locator('input[type="file"]').setInputFiles({
            name: 'splash.png',
            mimeType: 'image/png',
            buffer: PNG
        });
        await uploaded;

        // After a delete the page points the preview back at the server's splash screen URL.
        const deleted = waitAuthenticatedOk(
            page,
            /\/Branding\/Splashscreen$/i,
            'DELETE'
        );
        const preview = page.waitForRequest(
            (req) =>
                /\/Branding\/Splashscreen$/i.test(
                    new URL(req.url()).pathname
                ) &&
                req.method() === 'GET' &&
                new URL(req.url()).searchParams.has('t'),
            { timeout: 15_000 }
        );
        await brandingPage
            .getByRole('button', { name: 'Delete Custom Image' })
            .click();
        await deleted;
        const previewUrl = new URL((await preview).url());
        expect(previewUrl.searchParams.has('api_key')).toBe(false);

        const saved = waitAuthenticatedOk(
            page,
            /\/System\/Configuration\/branding$/i,
            'POST'
        );
        await brandingPage.getByRole('button', { name: 'Save' }).click();
        await saved;
    });

    test('backups: list and create a backup', async ({ page }) => {
        test.setTimeout(120_000);
        const listed = waitAuthenticatedOk(page, /\/Backup$/i, 'GET');
        await openDashboardRoute(page, 'backups');
        await listed;

        await page.getByRole('button', { name: 'Create Backup' }).click();
        const created = waitAuthenticatedOk(page, /\/Backup\/Create$/i, 'POST');
        // The options form, then the warning about running tasks.
        for (let i = 0; i < 2; i++) {
            const create = page
                .getByRole('dialog')
                .getByRole('button', { name: 'Create', exact: true });
            if (await create.isVisible().catch(() => false)) {
                await create.click();
            }
            await page.waitForTimeout(500);
        }
        await created;
    });
});
