import {
    expect,
    type Page,
    type Request,
    request,
    test
} from '@playwright/test';

import { AUTH_HEADER, BASE_URL, PASSWORD, signIn, USER } from './support/b2';

/**
 * Consolidation step 3 (#306): the legacy library tabs that `#/movies` and `#/tv`
 * still render (`apps/modern/features/libraries`: the Studios grid and the Playlists tab, with
 * their toolbar) call the generated Tesserafin SDK (`lib/tesserafin-sdk`) instead of
 * `@jellyfin/sdk`. These cases open them against a real server and assert that every item query
 * the page makes reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

const waitAuthenticatedOk = (page: Page, pattern: RegExp, method = 'GET') =>
    page
        .waitForResponse((res) => matches(pattern, method)(res.request()), {
            timeout: 20_000
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

/**
 * Lands on `hash` by a full reload, so that the only requests that follow are the target page's:
 * the home page the sign-in lands on also queries Live TV and items.
 */
async function openRoute(page: Page, hash: string) {
    // A changed query string makes this a real document load (a hash-only goto never reloads);
    // the stored credentials keep the session.
    await page.goto(`/?load=${Date.now()}${hash}`, {
        waitUntil: 'domcontentloaded'
    });
}

/** The id of the seeded Movies library. */
async function moviesLibraryId() {
    const api = await request.newContext();
    try {
        const auth = await api.post(`${BASE_URL}/Users/AuthenticateByName`, {
            headers: { Authorization: AUTH_HEADER },
            data: { Username: USER, Pw: PASSWORD }
        });
        expect(auth.ok(), 'sign-in').toBeTruthy();
        const { AccessToken, User } = (await auth.json()) as {
            AccessToken: string;
            User: { Id: string };
        };
        const views = await api.get(`${BASE_URL}/UserViews?userId=${User.Id}`, {
            headers: { Authorization: `${AUTH_HEADER}, Token="${AccessToken}"` }
        });
        const { Items } = (await views.json()) as {
            Items: { Id: string; CollectionType?: string }[];
        };
        const movies = Items.find((v) => v.CollectionType === 'movies');
        expect(movies, 'the rig seeds a Movies library').toBeTruthy();
        return movies!.Id;
    } finally {
        await api.dispose();
    }
}

test.describe('legacy library tabs on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('Movies Studios tab: the studio grid loads', async ({ page }) => {
        const id = await moviesLibraryId();
        const studios = waitAuthenticatedOk(page, /\/Studios$/i);
        await openRoute(page, `#/movies?topParentId=${id}&tab=5`);
        await studios;
        await expect(page).toHaveURL(/#\/movies\?/);
    });

    test('Movies Playlists tab: the playlist query loads', async ({ page }) => {
        const id = await moviesLibraryId();
        const playlists = page
            .waitForResponse(
                (res) =>
                    /\/Items$/i.test(new URL(res.url()).pathname) &&
                    /Playlist/i.test(
                        new URL(res.url()).searchParams.get(
                            'includeItemTypes'
                        ) ?? ''
                    ),
                { timeout: 20_000 }
            )
            .then(async (response) => {
                expect(
                    await response.request().headerValue('authorization')
                ).toMatch(/^MediaBrowser .*Token="[^"]+"/);
                expect(response.status()).toBeLessThan(300);
            });
        await openRoute(page, `#/movies?topParentId=${id}&tab=6`);
        await playlists;
        await expect(page).toHaveURL(/#\/movies\?/);
    });
});
