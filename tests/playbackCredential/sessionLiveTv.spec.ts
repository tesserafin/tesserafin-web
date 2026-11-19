/**
 * Consolidation step 1, Live TV: a channel of an M3U tuner plays through `Playback/Sessions` alone,
 * on a real server, from a production bundle. The session opens the tuner stream, the server's v2
 * engine decides on it, and the browser plays the session's own live playlist.
 *
 * What a playback through the old chain would do instead, and what is therefore asserted rather
 * than "the channel plays":
 *  - `PlaybackInfo` is aborted at the network: a journey that still asked for it does not start.
 *  - No request goes to `/LiveStreams/Open|Close`, `/Videos/{id}/live.m3u8|master.m3u8` or
 *    `/LiveTv/LiveStreamFiles`.
 *  - One `POST Playback/Sessions`, a remux or a transcode, and the playlist and segments come from
 *    `/Playback/Sessions/{id}/Hls/` with a capability, never a durable token.
 *  - One tuner stream is opened, and the stop closes it.
 *
 * The tuner is a paced software tuner this spec starts and registers (`startSoftwareTuner`).
 */
import { expect, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import { liveSessions, watch } from './support/filmSession';
import { startSoftwareTuner } from './support/fixtures';
import { admin, playControl } from './support/rig';

test.describe('Live TV on Playback/Sessions', () => {
    test('plays a channel from its session live playlist on one tuner stream, closed by the stop', async ({
        page
    }) => {
        test.setTimeout(240_000);
        const a = await admin();
        const tuner = await startSoftwareTuner(a);
        const legacyLive: string[] = [];
        const hlsResponses: Array<{ status: number; url: string }> = [];
        // Counted when sent: leaving the player navigates away while the DELETE is in flight, and
        // its response then never reaches the page. What it did is read on the server below.
        let deletesSent = 0;
        try {
            const traffic = await watch(page);
            page.on('request', (req) => {
                const path = new URL(req.url()).pathname;
                if (
                    /\/LiveStreams\/(Open|Close)|\/Videos\/[^/]+\/(live|master)\.m3u8|\/LiveTv\/LiveStreamFiles/i.test(
                        path
                    )
                ) {
                    legacyLive.push(`${req.method()} ${path}`);
                }
            });
            page.on('request', (req) => {
                if (
                    req.method() === 'DELETE' &&
                    /\/Playback\/Sessions\/[0-9a-f]+$/i.test(
                        new URL(req.url()).pathname
                    )
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
            await page.goto(`/#/details?id=${tuner.channelId}`);
            await expect(playControl(page)).toBeVisible({ timeout: 60_000 });
            await playControl(page).click();

            await expect
                .poll(
                    () =>
                        page.evaluate(
                            () =>
                                document.querySelector('video')?.currentTime ??
                                -1
                        ),
                    { timeout: 60_000, message: 'the channel must play' }
                )
                .toBeGreaterThan(2);
            expect(
                await liveSessions(a, tuner.channelId),
                'exactly one session lives while the channel plays'
            ).toBe(1);
            expect(
                tuner.streamsOpened(),
                'one tuner stream for one playback'
            ).toBe(1);

            expect(traffic.creates.length, 'one POST').toBe(1);
            expect(['Remux', 'Transcode']).toContain(traffic.creates[0]);
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                legacyLive,
                'no request may go to the existing Live TV routes'
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

            // Stop: leaving the player ends the playback, the session and its tuner stream.
            await page.keyboard.press('MediaStop').catch(() => undefined);
            await page.goto('/#/home');
            await expect
                .poll(() => deletesSent, {
                    timeout: 30_000,
                    message: 'the stop must DELETE the session'
                })
                .toBeGreaterThan(0);
            await expect
                .poll(() => liveSessions(a, tuner.channelId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            await expect
                .poll(() => tuner.openStreams(), {
                    timeout: 30_000,
                    message: 'the stop must close the tuner stream'
                })
                .toBe(0);
            expect(traffic.playbackInfo).toBe(0);
            expect(legacyLive).toEqual([]);
        } finally {
            await tuner.dispose();
            await a.dispose();
        }
    });
});
