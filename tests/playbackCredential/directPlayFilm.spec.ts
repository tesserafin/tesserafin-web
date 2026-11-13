/**
 * Consolidation step 1 (tesserafin#129, #305) - the direct-play film journey, on the real rig
 * (`ci/serve-e2e.sh` in the server repository: a real server, a real production bundle, ffmpeg
 * media in a real library).
 *
 * What this proves, and how it can fail:
 *
 *   * The film plays through `Playback/Sessions` alone. Every `PlaybackInfo` request is ABORTED by
 *     the page for the film tests and counted: a single one fails the test even if playback would
 *     have survived it. The bytes must come from the session's own file route, as 206 range
 *     responses, with a `playbackCapability` and never a durable token.
 *   * Exactly one Sessions session is alive while it plays (admin diagnostics listing), and none
 *     after the stop; the file url replayed after the stop is refused.
 *   * Resume is measured in MEDIA TIME: the stopped position is stored, and the resumed player's
 *     first `playing` event is at that position within {@link RESUME_TOLERANCE_SECONDS}.
 *   * Withdrawing the user's access to the library while the session lives stops the file route.
 *   * A film the server decides to transcode releases its session before the legacy chain plays it,
 *     so one session at most is alive, and it still plays.
 *
 * `createStreamInfo` cannot be observed from a browser; `directPlayFilmPlayback.test.ts` asserts it
 * at the playback manager. OUTPUT SAFETY: urls are kept in memory; reports carry paths and status
 * codes, never a query value.
 */
import { expect, request, test, type Page } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import {
    admin,
    itemIdByName,
    openDetailByName,
    playControl,
    TRANSCODE_TITLE,
    type Admin
} from './support/rig';

const FILM = 'Smoke Test Movie';
const RESUME_TOLERANCE_SECONDS = 0.35;
const RESTRICTED_USER =
    process.env.TESSERAFIN_E2E_RESTRICTED_USER ?? 'smokerestricted';
const RESTRICTED_PASSWORD =
    process.env.TESSERAFIN_E2E_RESTRICTED_PASSWORD ?? 'restrictedpass123';

interface Traffic {
    playbackInfo: number;
    creates: string[];
    deletes: number;
    fileStatuses: number[];
    fileUrls: string[];
    durableTokenInMediaUrl: boolean;
}

function watch(page: Page, forbidPlaybackInfo: boolean): Traffic {
    const traffic: Traffic = {
        playbackInfo: 0,
        creates: [],
        deletes: 0,
        fileStatuses: [],
        fileUrls: [],
        durableTokenInMediaUrl: false
    };
    void page.route(/\/Items\/[^/]+\/PlaybackInfo/i, (route) => {
        traffic.playbackInfo += 1;
        return forbidPlaybackInfo
            ? route.abort('blockedbyclient')
            : route.continue();
    });
    page.on('response', async (response) => {
        const url = response.url();
        const method = response.request().method();
        if (
            method === 'POST' &&
            /\/Playback\/Sessions$/i.test(new URL(url).pathname)
        ) {
            const body = await response.json().catch(() => ({}));
            traffic.creates.push(String(body.Method ?? response.status()));
        }
        if (
            method === 'DELETE' &&
            /\/Playback\/Sessions\/[0-9a-f]+$/i.test(new URL(url).pathname)
        )
            traffic.deletes += 1;
        if (/\/Playback\/Sessions\/[0-9a-f]+\/File/i.test(url)) {
            traffic.fileStatuses.push(response.status());
            traffic.fileUrls.push(url);
            if (/[?&](ApiKey|api_key)=/i.test(url))
                traffic.durableTokenInMediaUrl = true;
        }
    });
    return traffic;
}

async function liveSessions(a: Admin, itemId: string): Promise<number> {
    const response = await a.api.get('/System/PlaybackDiagnostics/Sessions', {
        headers: {
            Authorization: `MediaBrowser Client="e2e", Device="e2e", DeviceId="e2e-admin", Version="1", Token="${a.token}"`
        }
    });
    expect(response.ok(), 'the admin diagnostics listing must answer').toBe(
        true
    );
    const normalize = (id: string | null | undefined) =>
        (id ?? '').replace(/-/g, '').toLowerCase();
    const sessions = (await response.json()) as Array<{
        ItemId?: string | null;
    }>;
    return sessions.filter((s) => normalize(s.ItemId) === normalize(itemId))
        .length;
}

async function videoTime(page: Page): Promise<number> {
    return page.evaluate(
        () => document.querySelector('video')?.currentTime ?? -1
    );
}

async function startFilm(page: Page): Promise<void> {
    await openDetailByName(page, FILM);
    const reachedPlayer = page.waitForURL(/#\/video/, { timeout: 30_000 });
    await playControl(page).click();
    await reachedPlayer;
}

async function stopPlayer(page: Page, traffic: Traffic): Promise<void> {
    const deletesBefore = traffic.deletes;
    await page.keyboard.press('Escape');
    // A paused player keeps Escape for its controls; leaving the player route stops it too.
    const stoppedByEscape = await expect
        .poll(() => traffic.deletes, { timeout: 4_000 })
        .toBeGreaterThan(deletesBefore)
        .then(
            () => true,
            () => false
        );
    if (!stoppedByEscape) await page.goBack();
    await expect
        .poll(() => traffic.deletes, {
            timeout: 15_000,
            message: 'stopping must DELETE the session'
        })
        .toBeGreaterThan(deletesBefore);
}

async function setMinResume(a: Admin, seconds: number): Promise<number> {
    const headers = {
        Authorization: `MediaBrowser Client="e2e", Device="e2e", DeviceId="e2e-admin", Version="1", Token="${a.token}"`
    };
    const configuration = await (
        await a.api.get('/System/Configuration', { headers })
    ).json();
    const previous = Number(configuration.MinResumeDurationSeconds);
    configuration.MinResumeDurationSeconds = seconds;
    const saved = await a.api.post('/System/Configuration', {
        headers,
        data: configuration
    });
    expect(
        saved.ok(),
        'the server configuration must accept the resume floor'
    ).toBe(true);
    return previous;
}

test.describe('direct-play film on Playback/Sessions', () => {
    test('plays from the session file with range responses, one live session, and nothing after the stop', async ({
        page
    }) => {
        const a = await admin();
        try {
            const itemId = await itemIdByName(a, FILM);
            const traffic = watch(page, true);
            await signIn(page);
            await startFilm(page);

            await expect
                .poll(() => videoTime(page), {
                    timeout: 30_000,
                    message: 'the film must play'
                })
                .toBeGreaterThan(0.2);
            expect(
                await liveSessions(a, itemId),
                'exactly one session lives while the film plays'
            ).toBe(1);

            // Seek back to the start: the element must land there and keep playing from the file.
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) video.currentTime = 0.1;
            });
            await expect
                .poll(() => videoTime(page), { timeout: 10_000 })
                .toBeLessThan(0.9);

            expect(
                traffic.creates,
                'one POST, decided as a direct play'
            ).toEqual(['DirectPlay']);
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                traffic.fileStatuses.length,
                'the bytes come from the session file route'
            ).toBeGreaterThan(0);
            expect(
                traffic.fileStatuses.every((status) => status === 206),
                `file responses must be ranges: ${traffic.fileStatuses.join(',')}`
            ).toBe(true);
            expect(
                traffic.fileUrls.every((url) =>
                    /[?&]playbackCapability=/.test(url)
                ),
                'every file request carries a capability'
            ).toBe(true);
            expect(
                traffic.durableTokenInMediaUrl,
                'no durable token in a media url'
            ).toBe(false);

            const replayUrl = traffic.fileUrls[0];
            await stopPlayer(page, traffic);
            await expect
                .poll(() => liveSessions(a, itemId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);

            const anonymous = await request.newContext();
            try {
                const replay = await anonymous.get(replayUrl, {
                    headers: { Range: 'bytes=0-15' }
                });
                expect(
                    [401, 404],
                    `the file url replayed after the stop answered ${replay.status()}`
                ).toContain(replay.status());
            } finally {
                await anonymous.dispose();
            }
        } finally {
            await a.dispose();
        }
    });

    test('resumes at the stored position, measured in media time', async ({
        page,
        browser
    }) => {
        const a = await admin();
        const previousFloor = await setMinResume(a, 0);
        try {
            const itemId = await itemIdByName(a, FILM);
            const traffic = watch(page, true);
            await page.addInitScript(() => {
                document.addEventListener(
                    'playing',
                    (event) => {
                        const w = window as unknown as {
                            __playingAt?: number[];
                        };
                        w.__playingAt = w.__playingAt ?? [];
                        w.__playingAt.push(
                            (event.target as HTMLMediaElement).currentTime
                        );
                    },
                    true
                );
            });
            await signIn(page);
            await startFilm(page);
            await expect
                .poll(() => videoTime(page), { timeout: 30_000 })
                .toBeGreaterThan(0.2);

            // Hold the film at a known position, then stop: the stop report carries that position.
            // 0.6 s of the rig's 2 s film: above MinResumePct (5 %) and below the server's
            // "played to completion" mark (runtime - 1 s), so the server keeps it as a resume point.
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    video.pause();
                    video.currentTime = 0.6;
                }
            });
            await expect
                .poll(() => videoTime(page), { timeout: 10_000 })
                .toBeGreaterThan(0.5);
            const stoppedAt = await videoTime(page);
            await stopPlayer(page, traffic);

            const headers = {
                Authorization: `MediaBrowser Client="e2e", Device="e2e", DeviceId="e2e-admin", Version="1", Token="${a.token}"`
            };
            await expect
                .poll(
                    async () => {
                        const data = await (
                            await a.api.get(
                                `/UserItems/${itemId}/UserData?userId=${a.userId}`,
                                { headers }
                            )
                        ).json();
                        return (
                            Number(data.PlaybackPositionTicks ?? 0) / 10_000_000
                        );
                    },
                    {
                        timeout: 15_000,
                        message: 'the stopped position must be stored'
                    }
                )
                .toBeGreaterThan(stoppedAt - RESUME_TOLERANCE_SECONDS);

            // A fresh browser profile: the detail page reads the stored position from the server.
            // (Whether the SAME tab shows Resume after its own stop is recorded separately.)
            const resumeContext = await browser.newContext();
            const resumePage = await resumeContext.newPage();
            const resumeTraffic = watch(resumePage, true);
            await resumePage.addInitScript(() => {
                document.addEventListener(
                    'playing',
                    (event) => {
                        const w = window as unknown as {
                            __playingAt?: number[];
                        };
                        w.__playingAt = w.__playingAt ?? [];
                        w.__playingAt.push(
                            (event.target as HTMLMediaElement).currentTime
                        );
                    },
                    true
                );
            });
            await signIn(resumePage);
            await openDetailByName(resumePage, FILM);
            const resume = resumePage
                .locator('[data-detail-section="mainDetailButtons"]')
                .getByRole('button', { name: /^(Resume|Reprendre)\b/ });
            await expect(
                resume,
                'a stored position must surface Resume'
            ).toBeVisible({ timeout: 25_000 });
            const reachedPlayer = resumePage.waitForURL(/#\/video/, {
                timeout: 30_000
            });
            await resume.click();
            await reachedPlayer;

            const firstPlaying = await expect
                .poll(
                    () =>
                        resumePage.evaluate(
                            () =>
                                (
                                    window as unknown as {
                                        __playingAt?: number[];
                                    }
                                ).__playingAt?.[0] ?? null
                        ),
                    {
                        timeout: 30_000,
                        message: 'the resumed film must start playing'
                    }
                )
                .not.toBeNull()
                .then(() =>
                    resumePage.evaluate(
                        () =>
                            (window as unknown as { __playingAt?: number[] })
                                .__playingAt![0]
                    )
                );
            expect(
                Math.abs(firstPlaying - stoppedAt),
                `resumed at ${firstPlaying}s for a stop at ${stoppedAt}s`
            ).toBeLessThanOrEqual(RESUME_TOLERANCE_SECONDS);
            expect(traffic.playbackInfo + resumeTraffic.playbackInfo).toBe(0);
            expect(resumeTraffic.creates).toEqual(['DirectPlay']);
            await stopPlayer(resumePage, resumeTraffic);
            await resumeContext.close();
        } finally {
            await setMinResume(a, previousFloor);
            await a.dispose();
        }
    });

    test('withdrawing the library from the user stops the file route of a live session', async ({
        browser
    }) => {
        const a = await admin();
        const headers = {
            Authorization: `MediaBrowser Client="e2e", Device="e2e", DeviceId="e2e-admin", Version="1", Token="${a.token}"`
        };
        const users = (await (
            await a.api.get('/Users', { headers })
        ).json()) as Array<{ Id: string; Name: string }>;
        const restricted = users.find((u) => u.Name === RESTRICTED_USER);
        expect(restricted, 'the rig seeds a restricted user').toBeTruthy();
        const original = (
            await (
                await a.api.get(`/Users/${restricted!.Id}`, { headers })
            ).json()
        ).Policy;
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            const traffic = watch(page, true);
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await page.locator('#txtManualName:visible').fill(RESTRICTED_USER);
            await page
                .locator('#txtManualPassword:visible')
                .fill(RESTRICTED_PASSWORD);
            await page.locator('button[type="submit"]:visible').first().click();
            await page.waitForURL('**/#/home**', { timeout: 20_000 });
            await startFilm(page);
            await expect
                .poll(() => videoTime(page), { timeout: 30_000 })
                .toBeGreaterThan(0.2);
            const fileUrl = traffic.fileUrls[0];

            const withdrawn = await a.api.post(
                `/Users/${restricted!.Id}/Policy`,
                {
                    headers,
                    data: {
                        ...original,
                        EnableAllFolders: false,
                        EnabledFolders: []
                    }
                }
            );
            expect(withdrawn.ok()).toBe(true);

            const after = await page.request.get(fileUrl, {
                headers: { Range: 'bytes=0-15' }
            });
            expect(
                after.status(),
                'the file route must stop serving once the item is no longer visible'
            ).toBe(404);
            expect(traffic.playbackInfo).toBe(0);
        } finally {
            await a.api.post(`/Users/${restricted!.Id}/Policy`, {
                headers,
                data: original
            });
            await context.close();
            await a.dispose();
        }
    });

    test('a film decided as a transcode plays through its own session without PlaybackInfo', async ({
        page
    }) => {
        const a = await admin();
        try {
            const itemId = await itemIdByName(a, TRANSCODE_TITLE);
            const traffic = watch(page, true);
            await signIn(page);
            await openDetailByName(page, TRANSCODE_TITLE);
            const reachedPlayer = page.waitForURL(/#\/video/, {
                timeout: 30_000
            });
            await playControl(page).click();
            await reachedPlayer;
            await expect
                .poll(() => videoTime(page), {
                    timeout: 60_000,
                    message: 'the transcode must play'
                })
                .toBeGreaterThan(0.2);

            expect(traffic.creates).toEqual(['Transcode']);
            expect(traffic.deletes).toBe(0);
            expect(traffic.playbackInfo).toBe(0);
            expect(
                traffic.fileStatuses,
                'no session file route for a transcode'
            ).toEqual([]);
            expect(
                await liveSessions(a, itemId),
                'at most one session lives'
            ).toBeLessThanOrEqual(1);
            await page.keyboard.press('Escape');
        } finally {
            await a.dispose();
        }
    });
});
