import {
    expect,
    type Page,
    type Request,
    request,
    test
} from '@playwright/test';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AUTH_HEADER, BASE_URL, PASSWORD, signIn, USER } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard playback settings pages (resume, streaming,
 * transcoding, trickplay), the playback diagnostics page, the Live TV recording settings and the
 * Live TV tuner and guide provider cards, plus the shared `useConfiguration`/`useNamedConfiguration`
 * hooks, call the generated Tesserafin SDK (`lib/tesserafin-sdk`) instead of `@jellyfin/sdk`. These
 * cases drive them against a real server and assert that every call the migrated code makes
 * reaches the server authenticated and succeeds.
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

/** Calls the server as the administrator, outside the page under test. */
async function asAdministrator<T>(
    call: (
        post: (path: string, data: unknown) => Promise<unknown>
    ) => Promise<T>
) {
    const api = await request.newContext();
    try {
        const auth = await api.post(`${BASE_URL}/Users/AuthenticateByName`, {
            headers: { Authorization: AUTH_HEADER },
            data: { Username: USER, Pw: PASSWORD }
        });
        expect(auth.ok(), 'administrator sign-in').toBeTruthy();
        const { AccessToken } = (await auth.json()) as { AccessToken: string };
        return await call(async (path, data) => {
            const response = await api.post(`${BASE_URL}${path}`, {
                headers: {
                    Authorization: `${AUTH_HEADER}, Token="${AccessToken}"`
                },
                data
            });
            expect(response.status(), `POST ${path}`).toBeLessThan(300);
            return response.json();
        });
    } finally {
        await api.dispose();
    }
}

const SETTINGS_PAGES = [
    {
        route: 'playback/resume',
        page: '#playbackConfigurationPage',
        saves: /\/System\/Configuration$/i
    },
    {
        route: 'playback/streaming',
        page: '#streamingSettingsPage',
        saves: /\/System\/Configuration$/i
    },
    {
        route: 'playback/trickplay',
        page: '#trickplayConfigurationPage',
        saves: /\/System\/Configuration$/i
    },
    {
        route: 'playback/transcoding',
        page: '#encodingSettingsPage',
        saves: /\/System\/Configuration\/encoding$/i
    },
    {
        route: 'livetv/recordings',
        page: '#liveTvSettingsPage',
        saves: /\/System\/Configuration\/livetv$/i
    }
];

test.describe('dashboard playback and Live TV on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    for (const { route, page: pageId, saves } of SETTINGS_PAGES) {
        test(`${route}: Save writes the configuration`, async ({ page }) => {
            await openDashboardRoute(page, route);
            const save = page
                .locator(pageId)
                .getByRole('button', { name: 'Save' });
            await expect(save).toBeVisible({ timeout: 15_000 });
            const saved = waitAuthenticatedOk(page, saves, 'POST');
            await save.click();
            await saved;
        });
    }

    test('playback diagnostics: sessions load', async ({ page }) => {
        const listed = waitAuthenticatedOk(
            page,
            /\/System\/PlaybackDiagnostics\/Sessions$/i,
            'GET'
        );
        await openDashboardRoute(page, 'playback/diagnostics');
        await listed;
    });

    test('Live TV: delete a tuner and a guide provider', async ({ page }) => {
        const stamp = Date.now();
        const tunerName = `step3-tuner-${stamp}`;
        // The server reads the playlist when the tuner is added; it runs on this host.
        const dir = mkdtempSync(join(tmpdir(), 'step3-livetv-'));
        const playlist = join(dir, 'channels.m3u');
        writeFileSync(
            playlist,
            '#EXTM3U\n#EXTINF:-1 tvg-id="step3",Step 3\nhttp://127.0.0.1:9/stream.ts\n'
        );
        const guide = join(dir, `${stamp}.xml`);
        writeFileSync(
            guide,
            '<?xml version="1.0" encoding="UTF-8"?>\n<tv><channel id="step3"><display-name>Step 3</display-name></channel></tv>\n'
        );
        try {
            await asAdministrator(async (post) => {
                await post('/LiveTv/TunerHosts', {
                    Type: 'm3u',
                    Url: playlist,
                    FriendlyName: tunerName
                });
                await post('/LiveTv/ListingProviders?validateListings=false', {
                    Type: 'xmltv',
                    Path: guide
                });
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        const loaded = waitAuthenticatedOk(
            page,
            /\/System\/Configuration\/livetv$/i,
            'GET'
        );
        await openDashboardRoute(page, 'livetv');
        await loaded;
        const statusPage = page.locator('#liveTvStatusPage');

        const tuner = statusPage
            .locator('.MuiCard-root')
            .filter({ hasText: tunerName });
        await expect(tuner).toHaveCount(1, { timeout: 15_000 });
        await tuner.getByRole('button').last().click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        const tunerDeleted = waitAuthenticatedOk(
            page,
            /\/LiveTv\/TunerHosts$/i,
            'DELETE'
        );
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' })
            .click();
        await tunerDeleted;
        await expect(tuner).toHaveCount(0, { timeout: 15_000 });

        const provider = statusPage
            .getByRole('listitem')
            .filter({ hasText: `${stamp}.xml` });
        await expect(provider).toHaveCount(1, { timeout: 15_000 });
        await provider.getByRole('button').last().click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        const providerDeleted = waitAuthenticatedOk(
            page,
            /\/LiveTv\/ListingProviders$/i,
            'DELETE'
        );
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' })
            .click();
        await providerDeleted;
        await expect(provider).toHaveCount(0, { timeout: 15_000 });
    });
});
