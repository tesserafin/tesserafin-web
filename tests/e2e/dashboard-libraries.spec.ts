import {
    expect,
    type Page,
    type Request,
    request,
    test
} from '@playwright/test';

import { AUTH_HEADER, BASE_URL, PASSWORD, signIn, USER } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard library pages (library cards, rename and removal,
 * display, metadata and NFO settings) call the generated Tesserafin SDK (`lib/tesserafin-sdk`)
 * instead of `@jellyfin/sdk`. These cases drive them against a real server and assert that every
 * call the migrated code makes reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

const waitAuthenticatedOk = (page: Page, pattern: RegExp, method: string) =>
    page
        .waitForResponse((res) => matches(pattern, method)(res.request()), {
            timeout: 15_000
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

/** Creates an empty library (no folder, no scan) as the administrator. */
async function createEmptyLibrary(name: string) {
    const api = await request.newContext();
    try {
        const auth = await api.post(`${BASE_URL}/Users/AuthenticateByName`, {
            headers: { Authorization: AUTH_HEADER },
            data: { Username: USER, Pw: PASSWORD }
        });
        expect(auth.ok(), 'administrator sign-in').toBeTruthy();
        const { AccessToken } = (await auth.json()) as { AccessToken: string };
        const created = await api.post(
            `${BASE_URL}/Library/VirtualFolders?name=${encodeURIComponent(name)}&collectionType=movies&refreshLibrary=false`,
            {
                headers: {
                    Authorization: `${AUTH_HEADER}, Token="${AccessToken}"`
                },
                data: { LibraryOptions: {} }
            }
        );
        expect(created.status(), 'empty library creation').toBeLessThan(300);
    } finally {
        await api.dispose();
    }
}

const libraryCard = (page: Page, name: string) =>
    page.locator('.MuiCard-root').filter({ hasText: name });

test.describe('dashboard libraries on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('libraries: list, rename and remove a library', async ({ page }) => {
        const stamp = Date.now();
        const name = `step3-lib-${stamp}`;
        const renamed = `step3-lib-renamed-${stamp}`;
        await createEmptyLibrary(name);

        const listed = waitAuthenticatedOk(
            page,
            /\/Library\/VirtualFolders$/i,
            'GET'
        );
        await openDashboardRoute(page, 'libraries');
        await listed;
        const card = libraryCard(page, name);
        await expect(card).toHaveCount(1, { timeout: 15_000 });

        await card.getByRole('button').last().click();
        await page.getByRole('menuitem', { name: 'Rename' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('textbox').fill(renamed);
        const renameCall = waitAuthenticatedOk(
            page,
            /\/Library\/VirtualFolders\/Name$/i,
            'POST'
        );
        await dialog.getByRole('button', { name: 'Rename' }).click();
        await renameCall;
        const renamedCard = libraryCard(page, renamed);
        await expect(renamedCard).toHaveCount(1, { timeout: 15_000 });

        await renamedCard.getByRole('button').last().click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();
        const removeCall = waitAuthenticatedOk(
            page,
            /\/Library\/VirtualFolders$/i,
            'DELETE'
        );
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' })
            .click();
        await removeCall;
        await expect(renamedCard).toHaveCount(0, { timeout: 15_000 });
    });

    test('metadata settings: countries and cultures load, Save writes the configuration', async ({
        page
    }) => {
        const countries = waitAuthenticatedOk(
            page,
            /\/Localization\/Countries$/i,
            'GET'
        );
        const cultures = waitAuthenticatedOk(
            page,
            /\/Localization\/Cultures$/i,
            'GET'
        );
        await openDashboardRoute(page, 'libraries/metadata');
        await Promise.all([countries, cultures]);
        const saved = waitAuthenticatedOk(
            page,
            /\/System\/Configuration$/i,
            'POST'
        );
        await page
            .locator('#metadataImagesConfigurationPage')
            .getByRole('button', { name: 'Save' })
            .click();
        await saved;
    });

    test('NFO settings: Save writes the xbmcmetadata configuration', async ({
        page
    }) => {
        await openDashboardRoute(page, 'libraries/nfo');
        const save = page
            .locator('#metadataNfoPage')
            .getByRole('button', { name: 'Save' });
        await expect(save).toBeVisible({ timeout: 15_000 });
        const saved = waitAuthenticatedOk(
            page,
            /\/System\/Configuration\/xbmcmetadata$/i,
            'POST'
        );
        await save.click();
        await saved;
    });

    test('display settings: Save writes the server and metadata configuration', async ({
        page
    }) => {
        await openDashboardRoute(page, 'libraries/display');
        const save = page
            .locator('#libraryDisplayPage')
            .getByRole('button', { name: 'Save' });
        await expect(save).toBeVisible({ timeout: 15_000 });
        const server = waitAuthenticatedOk(
            page,
            /\/System\/Configuration$/i,
            'POST'
        );
        const metadata = waitAuthenticatedOk(
            page,
            /\/System\/Configuration\/metadata$/i,
            'POST'
        );
        await save.click();
        await Promise.all([server, metadata]);
    });
});
