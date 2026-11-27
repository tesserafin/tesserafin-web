/**
 * Consolidation step 1, Live TV: a recording still being written plays through `Playback/Sessions`
 * alone, on a real server, from a production bundle. The server records a programme of the
 * software tuner's guide; while it is still recording, the browser plays the recording's item. The
 * session opens the growing file as a stream it holds, the server's v2 engine decides on it, and the
 * browser plays the session's own live playlist.
 *
 * What a playback through the old chain would do instead, and what is therefore asserted rather
 * than "the recording plays":
 *  - `PlaybackInfo` is aborted at the network: a journey that still asked for it does not start.
 *  - No request goes to `/LiveTv/LiveRecordings`, `/LiveStreams/Open|Close` or
 *    `/Videos/{id}/live.m3u8|master.m3u8`.
 *  - One `POST Playback/Sessions`, a remux or a transcode, and the playlist and segments come from
 *    `/Playback/Sessions/{id}/Hls/live.m3u8` with a capability, never a durable token.
 *  - The server's FFmpeg reads the recording through its provider (`pipe:0`), not the
 *    `[Authorize]`d recording route it cannot authenticate to.
 *  - Playback advances (past 8 s, and past whatever length the item listed): a recording still
 *    being written lists no length the player could stop at.
 *  - The stop ends the session; the recording goes on.
 */
import { expect, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import {
    adminHeaders,
    ffmpegLogs,
    liveSessions,
    watch
} from './support/filmSession';
import { startSoftwareTuner } from './support/fixtures';
import type { Admin } from './support/rig';
import { admin, playControl } from './support/rig';

const CHANNEL = 'A1 Record One';
const PROGRAMME = 'A1 Recording In Progress';

test.describe('Live TV recordings on Playback/Sessions', () => {
    test('plays a recording still being written from its session live playlist', async ({
        page
    }) => {
        test.setTimeout(420_000);
        const a = await admin();
        const tuner = await startSoftwareTuner(a, CHANNEL, 300, PROGRAMME);
        const cleanup: Array<() => Promise<unknown>> = [];
        const legacy: string[] = [];
        const hlsResponses: Array<{ status: number; url: string }> = [];
        let deletesSent = 0;
        try {
            const recordingId = await recordFromTheGuide(
                a,
                tuner.channelId,
                tuner.guideUrl,
                cleanup
            );
            const listedSeconds = await listedRunTimeSeconds(a, recordingId);

            const traffic = await watch(page);
            page.on('request', (req) => {
                const path = new URL(req.url()).pathname;
                if (
                    /\/LiveTv\/LiveRecordings|\/LiveStreams\/(Open|Close)|\/Videos\/[^/]+\/(live|master)\.m3u8/i.test(
                        path
                    )
                ) {
                    legacy.push(`${req.method()} ${path}`);
                }
                if (
                    req.method() === 'DELETE' &&
                    /\/Playback\/Sessions\/[0-9a-f]+$/i.test(path)
                ) {
                    deletesSent += 1;
                }
            });
            page.on('response', (response) => {
                const url = response.url();
                if (/\/Playback\/Sessions\/[0-9a-f]+\/Hls\//i.test(url)) {
                    hlsResponses.push({ status: response.status(), url });
                }
            });

            await signIn(page);
            await page.goto(`/#/details?id=${recordingId}`);
            await expect(playControl(page)).toBeVisible({ timeout: 60_000 });
            await playControl(page).click();

            // Past whatever the item listed when it was scanned (nothing, while it is recorded).
            const beyond = Math.max(listedSeconds, 0) + 8;
            await expect
                .poll(
                    () =>
                        page.evaluate(
                            () =>
                                document.querySelector('video')?.currentTime ??
                                -1
                        ),
                    {
                        timeout: 120_000,
                        message: `the recording must play past the ${listedSeconds}s its item listed`
                    }
                )
                .toBeGreaterThan(beyond);
            expect(
                await liveSessions(a, recordingId),
                'exactly one session lives while the recording plays'
            ).toBe(1);

            expect(traffic.creates.length, 'one POST').toBe(1);
            expect(['Remux', 'Transcode']).toContain(traffic.creates[0]);
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                legacy,
                'no request may go to the existing recording or live routes'
            ).toEqual([]);
            const own = `/Playback/Sessions/${traffic.sessionIds[0]}/Hls/`;
            expect(
                hlsResponses.some((r) => r.url.includes(`${own}live.m3u8`)),
                'the playlist is the session live playlist'
            ).toBe(true);
            expect(
                hlsResponses.some((r) => r.url.includes(`${own}hls/`)),
                'the segments come from the session route'
            ).toBe(true);
            expect(
                hlsResponses.every(
                    (r) =>
                        r.status === 200 &&
                        r.url.includes(own) &&
                        /[?&]playbackCapability=/.test(r.url) &&
                        !/[?&](ApiKey|api_key|LiveStreamId)=/i.test(r.url)
                ),
                `hls responses: ${hlsResponses.map((r) => `${r.status} ${new URL(r.url).pathname}`).join(', ')}`
            ).toBe(true);
            const commands = await ffmpegLogs(a, recordingId);
            expect(
                commands.some((log) => /-i pipe:0/.test(log.text)),
                `ffmpeg reads the recording through its provider: ${commands.map((log) => log.name).join(', ')}`
            ).toBe(true);
            expect(
                commands.some((log) => /LiveRecordings/i.test(log.text)),
                'ffmpeg never names the recording route'
            ).toBe(false);

            // Stop: leaving the player ends the playback and the session; the recording goes on.
            await page.keyboard.press('MediaStop').catch(() => undefined);
            await page.goto('/#/home');
            await expect
                .poll(() => deletesSent, {
                    timeout: 30_000,
                    message: 'the stop must DELETE the session'
                })
                .toBeGreaterThan(0);
            await expect
                .poll(() => liveSessions(a, recordingId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            expect(
                await isInProgress(a, recordingId),
                'the recording is still being written after the stop'
            ).toBe(true);
            expect(traffic.playbackInfo).toBe(0);
            expect(legacy).toEqual([]);
        } finally {
            for (const step of cleanup.reverse()) {
                await step().catch(() => undefined);
            }
            await tuner.dispose();
            await a.dispose();
        }
    });
});

/**
 * Has the server record the tuner's one guide programme, airing now, and returns the recording's
 * item once it exists in the library while the recording is still being written.
 */
async function recordFromTheGuide(
    a: Admin,
    channelId: string,
    guideUrl: string,
    cleanup: Array<() => Promise<unknown>>
): Promise<string> {
    const headers = adminHeaders(a);
    const provider = await a.api.post('/LiveTv/ListingProviders', {
        headers: { ...headers, 'Content-Type': 'application/json' },
        params: { validateListings: false, validateLogin: false },
        data: { Type: 'xmltv', Path: guideUrl, EnableAllTuners: true }
    });
    expect(
        provider.ok(),
        `the guide must register: ${provider.status()} ${await provider.text()}`
    ).toBe(true);
    const providerId = String((await provider.json()).Id);
    cleanup.push(() =>
        a.api.delete('/LiveTv/ListingProviders', {
            headers,
            params: { id: providerId }
        })
    );

    const tasks = (await (
        await a.api.get('/ScheduledTasks', { headers })
    ).json()) as Array<{ Id: string; Key: string }>;
    const refresh = tasks.find((t) => t.Key === 'RefreshGuide');
    expect(refresh, 'the guide refresh task must exist').toBeTruthy();
    const started = await a.api.post(`/ScheduledTasks/Running/${refresh?.Id}`, {
        headers
    });
    expect(started.ok(), 'the guide refresh must start').toBe(true);

    let programId = '';
    await expect
        .poll(
            async () => {
                const res = await a.api.get('/LiveTv/Programs', {
                    headers,
                    params: {
                        userId: a.userId,
                        channelIds: channelId,
                        isAiring: true
                    }
                });
                const items = res.ok()
                    ? ((await res.json()).Items as Array<{
                          Id: string;
                          Name: string;
                      }>)
                    : [];
                programId = items.find((i) => i.Name === PROGRAMME)?.Id ?? '';
                return programId;
            },
            {
                timeout: 120_000,
                message: 'the guide programme must be airing on the channel'
            }
        )
        .not.toBe('');

    const defaults = await a.api.get('/LiveTv/Timers/Defaults', {
        headers,
        params: { programId }
    });
    expect(defaults.ok(), 'the timer defaults must answer').toBe(true);
    const timer = await a.api.post('/LiveTv/Timers', {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: await defaults.json()
    });
    expect(
        timer.ok(),
        `the timer must be created: ${timer.status()} ${await timer.text()}`
    ).toBe(true);

    let recordingId = '';
    let timerId = '';
    await expect
        .poll(
            async () => {
                const timers = (await (
                    await a.api.get('/LiveTv/Timers', { headers })
                ).json()) as {
                    Items: Array<{ Id: string; ProgramId?: string }>;
                };
                timerId =
                    timers.Items.find((t) => t.ProgramId === programId)?.Id ??
                    timerId;
                const res = await a.api.get('/LiveTv/Recordings', {
                    headers,
                    params: { userId: a.userId, isInProgress: true }
                });
                const items = res.ok()
                    ? ((await res.json()).Items as Array<{
                          Id: string;
                          Name: string;
                      }>)
                    : [];
                recordingId = items.find((i) => i.Name === PROGRAMME)?.Id ?? '';
                return recordingId;
            },
            {
                timeout: 150_000,
                message:
                    'the recording must appear in the library while it is recorded'
            }
        )
        .not.toBe('');
    cleanup.push(() =>
        timerId
            ? a.api.delete(`/LiveTv/Timers/${timerId}`, { headers })
            : Promise.resolve()
    );
    return recordingId;
}

async function recordingItem(
    a: Admin,
    recordingId: string
): Promise<{ RunTimeTicks?: number | null; Status?: string | null }> {
    const res = await a.api.get(`/Items/${recordingId}`, {
        headers: adminHeaders(a),
        params: { userId: a.userId }
    });
    expect(res.ok(), 'the recording item must answer').toBe(true);
    return res.json();
}

/** What the recording's item lists as its length, from its last scan. */
async function listedRunTimeSeconds(
    a: Admin,
    recordingId: string
): Promise<number> {
    const item = await recordingItem(a, recordingId);
    return Math.round((item.RunTimeTicks ?? 0) / 10_000_000);
}

async function isInProgress(a: Admin, recordingId: string): Promise<boolean> {
    return (await recordingItem(a, recordingId)).Status === 'InProgress';
}
