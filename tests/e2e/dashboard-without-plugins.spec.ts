import { expect, type Page, test } from '@playwright/test';

import { signIn } from './support/b2';

/**
 * The server plugin administration UI was removed from the dashboard (plugin list, catalog,
 * repositories, configuration pages hosted from the server, the drawer section and the
 * `window.Dashboard` global they relied on). A sturdier plugin model will replace it later.
 *
 * These cases check that the dashboard no longer offers it, and that the legacy view container
 * (whose plugin-only branches were removed) still renders legacy dashboard views.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

async function openDashboardRoute(page: Page, route: string) {
    // Same document: a hash-only navigation keeps the authenticated session alive.
    await page.evaluate((hash) => {
        window.location.hash = hash;
    }, `#/dashboard/${route}`);
}

test.describe('dashboard without the plugin administration UI', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('the drawer offers no plugin entry and no plugin request is made', async ({
        page
    }) => {
        const pluginRequests: string[] = [];
        page.on('request', (req) => {
            const path = new URL(req.url()).pathname;
            if (/\/(Plugins|Packages|Repositories)(\/|$)/i.test(path)) {
                pluginRequests.push(path);
            }
        });

        await openDashboardRoute(page, '');
        await expect(
            page.getByRole('link', { name: 'Dashboard', exact: true })
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
        await expect(page.getByRole('link', { name: /plugin/i })).toHaveCount(
            0
        );
        await expect(page.getByRole('link', { name: 'Catalog' })).toHaveCount(
            0
        );
        expect(pluginRequests).toEqual([]);
    });

    test('former plugin routes no longer render a plugin page', async ({
        page
    }) => {
        for (const route of [
            'plugins',
            'plugins/repositories',
            'plugins/catalog'
        ]) {
            await openDashboardRoute(page, route);
            await expect(page.locator('#pluginsPage')).toHaveCount(0);
            await expect(
                page.getByRole('heading', { name: 'Plugins' })
            ).toHaveCount(0);
        }
        expect(await page.evaluate(() => 'Dashboard' in window)).toBe(false);
    });

    test('a legacy dashboard view still renders through the view container', async ({
        page
    }) => {
        await openDashboardRoute(page, 'livetv/tuner');
        await expect(page.locator('#liveTvTunerPage')).toBeVisible({
            timeout: 15_000
        });
    });
});
