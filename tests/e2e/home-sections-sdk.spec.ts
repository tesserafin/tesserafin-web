import { expect, type Response, test } from '@playwright/test';

import { applyFormFactor, signIn } from './support/b2';

/**
 * Consolidation step 3 (#306): the home page sections (`components/homesections`: My Media,
 * Continue Watching, Next Up, Latest, Live TV), the queries they run
 * (`apps/legacy/features/{libraries,liveTv}/api`), the user views behind the app bar and the
 * drawer, and the shared `hooks/api` hooks call the generated Tesserafin SDK
 * (`lib/tesserafin-sdk`) instead of `@jellyfin/sdk`. This case loads the home page against a real
 * server and asserts that each of those queries reaches the server authenticated and succeeds.
 *
 * The home sections render in the legacy app, which the TV layout selects
 * (`layoutManager.modern` is false for it); the desktop layout's modern home does not use them.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const HOME_QUERIES: { name: string; path: RegExp }[] = [
    { name: 'user views', path: /\/UserViews$/i },
    { name: 'Continue Watching', path: /\/UserItems\/Resume$/i },
    { name: 'Next Up', path: /\/Shows\/NextUp$/i },
    { name: 'Latest', path: /\/Items\/Latest$/i }
];

test('home sections: every section query carries the session token and succeeds', async ({
    page
}) => {
    const seen = new Map<string, Response[]>();
    page.on('response', (response) => {
        const { pathname } = new URL(response.url());
        for (const { name, path } of HOME_QUERIES) {
            if (path.test(pathname)) {
                seen.set(name, [...(seen.get(name) ?? []), response]);
            }
        }
    });

    await applyFormFactor(page, 'tv');
    await signIn(page);
    await expect(page.locator('html')).toHaveClass(/layout-tv/);
    await expect(
        page.locator('.homeSectionsContainer').first(),
        'the TV layout must render the legacy home sections'
    ).toBeAttached({ timeout: 25_000 });
    // No reload: the query cache is persisted (IndexedDB), so a reloaded home page can draw its
    // sections from it without asking the server.

    for (const { name } of HOME_QUERIES) {
        await expect
            .poll(() => seen.get(name)?.length ?? 0, {
                message: `the home page must query ${name}`,
                timeout: 25_000
            })
            .toBeGreaterThan(0);
    }

    for (const [name, responses] of seen) {
        for (const response of responses) {
            expect(
                await response.request().headerValue('authorization'),
                `${name} (${new URL(response.url()).pathname}) must carry the session token`
            ).toMatch(/^MediaBrowser .*Token="[^"]+"/);
            expect(
                response.status(),
                `${name} (${response.url()}) must succeed`
            ).toBeLessThan(300);
        }
    }
});
