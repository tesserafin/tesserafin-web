/**
 * Consolidation step 1, second journey: a film whose codecs the browser decodes but whose
 * container it does not is REMUXED - both streams copied - and plays through `Playback/Sessions`
 * alone, on a real server, from a production bundle.
 *
 * What a visually identical playback through the old chain would get wrong, and what is therefore
 * asserted here rather than "the film plays":
 *  - `PlaybackInfo` is aborted at the network: a journey that still asked for it does not start.
 *  - Every media request is a route of the session (`/Playback/Sessions/{id}/Hls/...`); none goes to
 *    `/Videos/.../*.m3u8`, `/Videos/.../hls1/...` or `/Videos/ActiveEncodings`.
 *  - One `POST Playback/Sessions`, decided `Remux`, for the whole playback - start, seeks and
 *    subtitles included - one live session, and one FFmpeg job whose command copies both streams
 *    (read from the server's own FFmpeg log through the admin log API).
 *  - After the stop nothing is left: no session, and the playlist url no longer answers.
 *
 * The fixture is the rig's "Container Film (2023)": a `Movie` (H.264 + AAC in MPEG-TS, 30 s, a
 * keyframe every second) with a SubRip sidecar. "Remux Probe" is a `Video` of a homevideos library
 * and proves nothing about the film journey.
 */
import { expect, request, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import {
    adminHeaders,
    ffmpegLogs,
    liveSessions,
    recordPlaying,
    restrictedToken,
    seekTo,
    setMinResume,
    setSubtitleMode,
    startFilm,
    stopPlayer,
    videoTime,
    watch
} from './support/filmSession';
import { admin, itemIdByName, openDetailByName } from './support/rig';

const FILM = 'Container Film';
const RESUME_TOLERANCE_SECONDS = 1.0;
test.describe('remux film on Playback/Sessions', () => {
    test('starts, seeks, shows text subtitles and stops on one session and one stream-copy job', async ({
        page
    }) => {
        const a = await admin();
        const previousSubtitleMode = await setSubtitleMode(a, 'Always');
        try {
            const itemId = await itemIdByName(a, FILM);
            const traffic = await watch(page);
            await signIn(page);
            await startFilm(page, FILM);

            await expect
                .poll(() => videoTime(page), {
                    timeout: 45_000,
                    message: 'the remuxed film must play'
                })
                .toBeGreaterThan(0.5);
            expect(
                await liveSessions(a, itemId),
                'exactly one session lives while the film plays'
            ).toBe(1);

            // Seek far forward, then back: the player's own seek inside the session's playlist.
            await seekTo(page, 21);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 20_000,
                    message: 'the film must play on after a forward seek'
                })
                .toBeGreaterThan(21.5);
            expect(await videoTime(page)).toBeLessThan(29);
            await seekTo(page, 4);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 20_000,
                    message: 'the film must play on after a backward seek'
                })
                .toBeGreaterThan(4.5);
            expect(await videoTime(page)).toBeLessThan(15);

            // Text subtitles: the sidecar, through the subtitle route, shown over the film.
            await expect
                .poll(() => traffic.subtitleStatuses, {
                    timeout: 15_000,
                    message: 'the sidecar subtitle must be fetched'
                })
                .toContain(200);
            await expect
                .poll(
                    () =>
                        page.evaluate(() => {
                            const video = document.querySelector('video');
                            const native = Array.from(video?.textTracks ?? [])
                                .filter((track) => track.mode === 'showing')
                                .flatMap((track) =>
                                    Array.from(track.cues ?? []).map(
                                        (cue) => (cue as VTTCue).text
                                    )
                                )
                                .join(' ');
                            const overlay =
                                document.querySelector('.videoSubtitles')
                                    ?.textContent ?? '';
                            return `${native} ${overlay}`;
                        }),
                    {
                        timeout: 15_000,
                        message: 'a subtitle cue of the sidecar must be loaded'
                    }
                )
                .toContain('remux film subtitle');

            // The whole playback so far: one decision, one session, only the session's routes.
            expect(traffic.creates, 'one POST, decided as a remux').toEqual([
                'Remux'
            ]);
            expect(traffic.deletes, 'the session is kept until the stop').toBe(
                0
            );
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                traffic.legacyMedia,
                'no media request may go to the existing chain'
            ).toEqual([]);
            expect(traffic.playlistUrls.length).toBeGreaterThan(0);
            expect(
                traffic.segmentUrls.length,
                'the bytes come from the session HLS route'
            ).toBeGreaterThan(2);
            expect(
                traffic.hlsStatuses.every((status) => status === 200),
                `HLS responses: ${traffic.hlsStatuses.join(',')}`
            ).toBe(true);
            expect(
                [...traffic.playlistUrls, ...traffic.segmentUrls].every(
                    (url) =>
                        /[?&]playbackCapability=/.test(url) &&
                        url.includes(
                            `/Playback/Sessions/${traffic.sessionIds[0]}/Hls/`
                        )
                ),
                'every HLS request is this session’s and carries a capability'
            ).toBe(true);
            expect(
                traffic.segmentUrls.every((url) =>
                    /\.mp4$/.test(new URL(url).pathname)
                ),
                'segments are in the container the browser declared first (fMP4)'
            ).toBe(true);
            expect(
                traffic.durableTokenInMediaUrl,
                'no durable token in a media url'
            ).toBe(false);

            // Another user can neither read nor stop this session.
            const playlistUrl = traffic.playlistUrls[0];
            const other = await request.newContext({
                baseURL: new URL(playlistUrl).origin
            });
            try {
                const token = await restrictedToken(other);
                const headers = {
                    Authorization: `MediaBrowser Client="e2e", Device="e2e-restricted", DeviceId="e2e-restricted", Version="1", Token="${token}"`
                };
                const withoutCapability = playlistUrl.replace(
                    /&playbackCapability=[^&]+/,
                    ''
                );
                expect(
                    [403, 404],
                    'another user must not read the playlist'
                ).toContain(
                    (await other.get(withoutCapability, { headers })).status()
                );
                expect(
                    (
                        await other.delete(
                            `/Playback/Sessions/${traffic.sessionIds[0]}`,
                            { headers }
                        )
                    ).status(),
                    'another user must not stop the session'
                ).toBe(403);
            } finally {
                await other.dispose();
            }
            expect(await liveSessions(a, itemId)).toBe(1);

            // FFmpeg: one job for all of the above, and it copied both streams.
            const logs = await ffmpegLogs(a, itemId);
            expect(
                logs.map((log) => log.name.split('-')[0]),
                'one FFmpeg job, named a remux by the server'
            ).toEqual(['FFmpeg.Remux']);
            expect(logs[0].text).toContain('-codec:v:0 copy');
            expect(logs[0].text).toContain('-codec:a:0 copy');
            expect(logs[0].text).not.toMatch(/-codec:v:0 (lib|h264_|hevc_)/);

            await stopPlayer(page, traffic);
            await expect
                .poll(() => liveSessions(a, itemId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            expect(traffic.playbackInfo).toBe(0);
            expect(traffic.legacyMedia).toEqual([]);

            const anonymous = await request.newContext();
            try {
                for (const url of [playlistUrl, traffic.segmentUrls[0]]) {
                    const replay = await anonymous.get(url);
                    expect(
                        [401, 404],
                        `a media url replayed after the stop answered ${replay.status()}`
                    ).toContain(replay.status());
                }
            } finally {
                await anonymous.dispose();
            }
            expect(
                (await ffmpegLogs(a, itemId)).length,
                'the stop starts nothing'
            ).toBe(1);
        } finally {
            await setSubtitleMode(a, previousSubtitleMode);
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
            const traffic = await watch(page);
            await signIn(page);
            await startFilm(page, FILM);
            await expect
                .poll(() => videoTime(page), { timeout: 45_000 })
                .toBeGreaterThan(0.5);

            // Hold the film at a known position, then stop: the stop report carries it. 12 s of a
            // 30 s film is far from both ends, so the server keeps it as a resume point.
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    video.pause();
                    video.currentTime = 12;
                }
            });
            await expect
                .poll(() => videoTime(page), { timeout: 15_000 })
                .toBeGreaterThan(11.5);
            const stoppedAt = await videoTime(page);
            await stopPlayer(page, traffic);

            await expect
                .poll(
                    async () => {
                        const data = await (
                            await a.api.get(
                                `/UserItems/${itemId}/UserData?userId=${a.userId}`,
                                { headers: adminHeaders(a) }
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
            const resumeContext = await browser.newContext();
            const resumePage = await resumeContext.newPage();
            const resumeTraffic = await watch(resumePage);
            await recordPlaying(resumePage);
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

            await expect
                .poll(
                    () =>
                        resumePage.evaluate(
                            () =>
                                (
                                    window as unknown as {
                                        __playingAt?: number[];
                                    }
                                ).__playingAt?.length ?? 0
                        ),
                    {
                        timeout: 45_000,
                        message: 'the resumed film must start playing'
                    }
                )
                .toBeGreaterThan(0);
            const firstPlaying = await resumePage.evaluate(
                () =>
                    (window as unknown as { __playingAt?: number[] })
                        .__playingAt![0]
            );
            expect(
                Math.abs(firstPlaying - stoppedAt),
                `resumed at ${firstPlaying}s for a stop at ${stoppedAt}s`
            ).toBeLessThanOrEqual(RESUME_TOLERANCE_SECONDS);
            await expect
                .poll(() => videoTime(resumePage), {
                    timeout: 20_000,
                    message: 'the resumed film must play on'
                })
                .toBeGreaterThan(stoppedAt + 1);
            expect(traffic.playbackInfo + resumeTraffic.playbackInfo).toBe(0);
            expect([
                ...traffic.legacyMedia,
                ...resumeTraffic.legacyMedia
            ]).toEqual([]);
            expect(traffic.creates).toEqual(['Remux']);
            expect(resumeTraffic.creates).toEqual(['Remux']);
            await stopPlayer(resumePage, resumeTraffic);
            await resumeContext.close();
            await expect
                .poll(() => liveSessions(a, itemId), { timeout: 15_000 })
                .toBe(0);
        } finally {
            await setMinResume(a, previousFloor);
            await a.dispose();
        }
    });
});
