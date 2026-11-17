/**
 * Consolidation step 1, fourth journey: a local EPISODE plays through `Playback/Sessions` alone,
 * exactly like a local film, on a real server, from a production bundle - and the queue that
 * moves to the next episode stays there.
 *
 * What a visually identical playback through the old chain would get wrong, and what is therefore
 * asserted here rather than "the episode plays":
 *  - `PlaybackInfo` is aborted at the network: a journey that still asked for it does not start.
 *  - Every media request is a route of a session (`/Playback/Sessions/{id}/Hls/...`); none goes to
 *    `/Videos/.../*.m3u8`, `/Videos/.../hls1/...` or `/Videos/ActiveEncodings`.
 *  - One `POST Playback/Sessions` per episode, decided by the server: the first episode's audio
 *    (AC-3) is encoded and its video copied, the second episode is remuxed. Each episode has its
 *    own session and FFmpeg job, and the first episode's session is released when the queue moves.
 *  - After the stop nothing is left.
 *
 * The fixtures are the rig's "Series Probes" library: "Probe Series", season 1, episode 1
 * (H.264 + AC-3 in Matroska, 20 s) and episode 2 (H.264 + AAC in MPEG-TS, 20 s), both resolved as
 * `Episode`s of one series.
 */
import { expect, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import {
    ffmpegLogs,
    liveSessions,
    seekTo,
    startFilm,
    stopPlayer,
    videoTime,
    watch
} from './support/filmSession';
import { admin, itemIdByName } from './support/rig';

const EPISODE1 = 'Probe Series S01E01';
const EPISODE2 = 'Probe Series S01E02';

test.describe('local episodes on Playback/Sessions', () => {
    test('plays an episode, moves to the next one and stops without ever leaving Sessions', async ({
        page
    }) => {
        const a = await admin();
        try {
            const firstId = await itemIdByName(a, EPISODE1);
            const secondId = await itemIdByName(a, EPISODE2);
            const traffic = await watch(page);
            await signIn(page);
            await startFilm(page, EPISODE1);

            await expect
                .poll(() => videoTime(page), {
                    timeout: 45_000,
                    message: 'the first episode must play'
                })
                .toBeGreaterThan(0.5);
            expect(traffic.creates, 'one POST, decided as a transcode').toEqual(
                ['Transcode']
            );
            expect(
                await liveSessions(a, firstId),
                'exactly one session lives while the first episode plays'
            ).toBe(1);

            // FFmpeg: only the audio is the problem, so only the audio is encoded.
            const firstLogs = await ffmpegLogs(a, firstId);
            expect(
                firstLogs.length,
                'one FFmpeg job for the first episode'
            ).toBe(1);
            expect(firstLogs[0].text).toContain('-codec:v:0 copy');
            expect(firstLogs[0].text).not.toContain('-codec:a:0 copy');

            // Seek to just before the end: the queue moves on by itself.
            await seekTo(page, 17);
            await expect
                .poll(() => traffic.creates, {
                    timeout: 45_000,
                    message:
                        'the next episode must be planned on its own session'
                })
                .toEqual(['Transcode', 'Remux']);
            await expect
                .poll(() => liveSessions(a, secondId), {
                    timeout: 30_000,
                    message: 'the second episode has its session'
                })
                .toBe(1);
            await expect
                .poll(() => liveSessions(a, firstId), {
                    timeout: 15_000,
                    message: 'the first episode session is released'
                })
                .toBe(0);
            await expect
                .poll(
                    async () =>
                        (await ffmpegLogs(a, secondId)).map(
                            (log) => log.name.split('-')[0]
                        ),
                    {
                        timeout: 30_000,
                        message: 'the second episode is a stream copy'
                    }
                )
                .toEqual(['FFmpeg.Remux']);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 30_000,
                    message: 'the second episode must play'
                })
                .toBeGreaterThan(0.5);

            expect(traffic.sessionIds.length).toBe(2);
            expect(traffic.sessionIds[0]).not.toBe(traffic.sessionIds[1]);
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                traffic.legacyMedia,
                'no media request may go to the existing chain'
            ).toEqual([]);
            expect(
                traffic.hlsStatuses.every((status) => status === 200),
                `HLS responses: ${traffic.hlsStatuses.join(',')}`
            ).toBe(true);
            expect(
                [...traffic.playlistUrls, ...traffic.segmentUrls].every(
                    (url) =>
                        traffic.sessionIds.some((id) =>
                            url.includes(`/Playback/Sessions/${id}/Hls/`)
                        ) && /[?&]playbackCapability=/.test(url)
                ),
                'every HLS request is a session’s own and carries a capability'
            ).toBe(true);
            expect(
                traffic.durableTokenInMediaUrl,
                'no durable token in a media url'
            ).toBe(false);

            await stopPlayer(page, traffic);
            await expect
                .poll(() => liveSessions(a, secondId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            expect(traffic.playbackInfo).toBe(0);
            expect(traffic.legacyMedia).toEqual([]);
        } finally {
            await a.dispose();
        }
    });
});
