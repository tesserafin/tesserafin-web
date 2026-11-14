/**
 * Consolidation step 1, third journey: a film that needs an SDR transcode plays through
 * `Playback/Sessions` alone, on a real server, from a production bundle - at start and through
 * every change of the playback.
 *
 * What a visually identical playback through the old chain would get wrong, and what is therefore
 * asserted here rather than "the film plays":
 *  - `PlaybackInfo` is aborted at the network: a start, a track change or a quality change that
 *    still asked for it does not happen.
 *  - Every media request is a route of a session (`/Playback/Sessions/{id}/Hls/...`); none goes to
 *    `/Videos/.../*.m3u8`, `/Videos/.../hls1/...` or `/Videos/ActiveEncodings`.
 *  - What FFmpeg actually did is read from the server's own FFmpeg logs (admin log API), not from
 *    the decision's label: the video copied and the audio encoded at start; the other audio track
 *    mapped after the track change; the video encoded under a ceiling after the quality change.
 *  - One live session at every moment, each change releasing the one it replaces, and nothing left
 *    after the stop.
 *
 * The fixture is the rig's "Dubbed Film (2024)": a `Movie` (H.264 + two AC-3 tracks in Matroska,
 * 30 s) with a SubRip sidecar. A browser decodes its video and not its audio; the two audio
 * tracks differ (index 1: 1000 Hz, "fre"; index 2: 440 Hz, "eng", the default).
 */
import { expect, request, test, type Page } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import {
    adminHeaders,
    ffmpegLogs,
    liveSessions,
    recordPlaying,
    seekTo,
    setMinResume,
    setSubtitleMode,
    startFilm,
    stopPlayer,
    videoTime,
    watch,
    type Traffic
} from './support/filmSession';
import { admin, itemIdByName, openDetailByName } from './support/rig';

const FILM = 'Dubbed Film';
const RESUME_TOLERANCE_SECONDS = 1.0;
const AUDIO_ENCODED = /-codec:a:0 (aac|libfdk_aac|aac_at)\b/;
const VIDEO_ENCODED = /-codec:v:0 (libx264|h264_[a-z0-9]+)\b/;

/** Opens one of the player's menus; the controls hide while the film plays. */
async function openPlayerMenu(page: Page, kind: string): Promise<void> {
    await page.mouse.move(240, 180);
    await page.mouse.move(260, 200);
    await page.locator(`[data-track-menu="${kind}"]`).first().click();
    await expect(
        page.locator('[data-rf-slot="track-menu"]'),
        `the ${kind} menu must open`
    ).toBeVisible({ timeout: 10_000 });
}

async function chooseRow(page: Page, key: string): Promise<void> {
    await page
        .locator(`[data-rf-slot="track-menu"] [data-track="${key}"]`)
        .click();
}

/** The session the playback is on now; every HLS request since it was created is its own. */
function expectOnlySessionRoutes(traffic: Traffic): void {
    expect(
        traffic.playbackInfo,
        'PlaybackInfo must never be requested on this journey'
    ).toBe(0);
    expect(
        traffic.legacyMedia,
        'no media request may go to the existing chain'
    ).toEqual([]);
    expect(
        [...traffic.playlistUrls, ...traffic.segmentUrls].every(
            (url) =>
                /[?&]playbackCapability=/.test(url) &&
                traffic.sessionIds.some((id) =>
                    url.includes(`/Playback/Sessions/${id}/Hls/`)
                )
        ),
        'every HLS request belongs to a session of this playback and carries a capability'
    ).toBe(true);
    expect(
        [...traffic.playlistUrls, ...traffic.segmentUrls].some((url) =>
            /[?&](VideoCodec|AudioCodec|VideoBitrate|AudioBitrate|MaxWidth|AudioStreamIndex|TranscodeReasons)=/i.test(
                url
            )
        ),
        'no encoding option travels in a media url'
    ).toBe(false);
    expect(
        traffic.durableTokenInMediaUrl,
        'no durable token in a media url'
    ).toBe(false);
}

test.describe('transcode film on Playback/Sessions', () => {
    test('starts, seeks, changes audio track and quality, and stops without ever leaving Sessions', async ({
        page
    }) => {
        test.setTimeout(240_000);
        const a = await admin();
        const previousSubtitleMode = await setSubtitleMode(a, 'Always');
        try {
            const itemId = await itemIdByName(a, FILM);
            const traffic = await watch(page);
            await signIn(page);
            await startFilm(page, FILM);

            await expect
                .poll(() => videoTime(page), {
                    timeout: 60_000,
                    message: 'the transcoded film must play'
                })
                .toBeGreaterThan(0.5);
            expect(
                await liveSessions(a, itemId),
                'exactly one session lives while the film plays'
            ).toBe(1);
            expect(traffic.creates, 'one POST, decided as a transcode').toEqual(
                ['Transcode']
            );

            // Start: the video is copied, the audio encoded, from the default track (index 2).
            let logs = await ffmpegLogs(a, itemId);
            expect(logs, 'one FFmpeg job for the start').toHaveLength(1);
            expect(logs[0].text).toContain('-codec:v:0 copy');
            expect(logs[0].text).toMatch(AUDIO_ENCODED);
            expect(logs[0].text).toContain('-map 0:2 ');

            // Seek far forward, then back: the player's own seek inside the session's playlist.
            await seekTo(page, 21);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 30_000,
                    message: 'the film must play on after a forward seek'
                })
                .toBeGreaterThan(21.5);
            await seekTo(page, 4);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 30_000,
                    message: 'the film must play on after a backward seek'
                })
                .toBeGreaterThan(4.5);
            expect(await videoTime(page)).toBeLessThan(15);
            expect(traffic.creates, 'a seek plans nothing').toEqual([
                'Transcode'
            ]);

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
                .toContain('transcode film subtitle');
            expectOnlySessionRoutes(traffic);

            // Audio track change, through the player's own menu: the session in place is
            // released, the playback is planned again through Sessions, and FFmpeg maps the
            // other track. The film goes on from where it was, in media time.
            const beforeTrack = await videoTime(page);
            await openPlayerMenu(page, 'audio');
            await chooseRow(page, '1');
            await expect
                .poll(() => traffic.creates, {
                    timeout: 30_000,
                    message: 'the track change must be planned through Sessions'
                })
                .toEqual(['Transcode', 'Transcode']);
            await expect
                .poll(
                    async () =>
                        (await ffmpegLogs(a, itemId)).some((log) =>
                            log.text.includes('-map 0:1 ')
                        ),
                    {
                        timeout: 45_000,
                        message:
                            'FFmpeg must be started on the other audio track'
                    }
                )
                .toBe(true);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 45_000,
                    message: 'the film must play on after the track change'
                })
                .toBeGreaterThan(beforeTrack + 1);
            expect(
                await videoTime(page),
                'the track change resumes where the film was, not at its start or end'
            ).toBeLessThan(beforeTrack + 12);
            expect(traffic.deletes, 'the first session was released').toBe(1);
            expect(
                await liveSessions(a, itemId),
                'one session after the track change'
            ).toBe(1);
            logs = await ffmpegLogs(a, itemId);
            const trackJob = logs.find((log) => log.text.includes('-map 0:1 '));
            expect(trackJob?.text).toContain('-codec:v:0 copy');
            expect(trackJob?.text).toMatch(AUDIO_ENCODED);
            expectOnlySessionRoutes(traffic);

            // Quality change, through the player's own menu, to the lowest ceiling offered: it
            // is under the film's bitrate, so the video is now encoded, under that ceiling.
            const beforeQuality = await videoTime(page);
            const jobsBeforeQuality = logs.length;
            await openPlayerMenu(page, 'settings');
            await chooseRow(page, 'quality');
            const lowest = await page
                .locator('[data-rf-slot="track-menu"] [data-track]')
                .evaluateAll(
                    (rows) =>
                        rows
                            .map((row) =>
                                Number(row.getAttribute('data-track'))
                            )
                            .filter((bitrate) => bitrate > 0)
                            .sort((x, y) => x - y)[0]
                );
            expect(lowest, 'the quality menu offers a ceiling').toBeGreaterThan(
                0
            );
            await chooseRow(page, String(lowest));
            await expect
                .poll(() => traffic.creates, {
                    timeout: 30_000,
                    message:
                        'the quality change must be planned through Sessions'
                })
                .toEqual(['Transcode', 'Transcode', 'Transcode']);
            await expect
                .poll(async () => (await ffmpegLogs(a, itemId)).length, {
                    timeout: 45_000,
                    message: 'FFmpeg must be started for the new quality'
                })
                .toBeGreaterThan(jobsBeforeQuality);
            await expect
                .poll(() => videoTime(page), {
                    timeout: 60_000,
                    message: 'the film must play on after the quality change'
                })
                .toBeGreaterThan(beforeQuality + 1);
            logs = await ffmpegLogs(a, itemId);
            const qualityJob = logs.find((log) => VIDEO_ENCODED.test(log.text));
            expect(
                qualityJob,
                `a job must encode the video (commands: ${logs.map((log) => log.name).join(', ')})`
            ).toBeTruthy();
            const maxrate = Number(
                /-maxrate (\d+)/.exec(qualityJob!.text)?.[1] ?? 0
            );
            expect(maxrate, 'the encoder is given a ceiling').toBeGreaterThan(
                0
            );
            expect(
                maxrate,
                'the ceiling the encoder is given is not above the one chosen'
            ).toBeLessThanOrEqual(Math.max(lowest, 100_000));
            expect(qualityJob!.text).toContain('-map 0:1 ');
            expect(traffic.deletes, 'the second session was released').toBe(2);
            expect(
                await liveSessions(a, itemId),
                'one session after the quality change'
            ).toBe(1);
            expectOnlySessionRoutes(traffic);
            const jobs = logs.length;

            // Stop: nothing is left.
            const lastPlaylist =
                traffic.playlistUrls[traffic.playlistUrls.length - 1];
            await stopPlayer(page, traffic);
            await expect
                .poll(() => liveSessions(a, itemId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            const anonymous = await request.newContext();
            try {
                for (const url of [traffic.playlistUrls[0], lastPlaylist]) {
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
            ).toBe(jobs);
            expectOnlySessionRoutes(traffic);
        } finally {
            await setSubtitleMode(a, previousSubtitleMode);
            await a.dispose();
        }
    });

    test('resumes at the stored position, measured in media time', async ({
        page,
        browser
    }) => {
        test.setTimeout(180_000);
        const a = await admin();
        const previousFloor = await setMinResume(a, 0);
        try {
            const itemId = await itemIdByName(a, FILM);
            const traffic = await watch(page);
            await signIn(page);
            await startFilm(page, FILM);
            await expect
                .poll(() => videoTime(page), { timeout: 60_000 })
                .toBeGreaterThan(0.5);

            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    video.pause();
                    video.currentTime = 12;
                }
            });
            await expect
                .poll(() => videoTime(page), { timeout: 30_000 })
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
                        timeout: 60_000,
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
                    timeout: 30_000,
                    message: 'the resumed film must play on'
                })
                .toBeGreaterThan(stoppedAt + 1);
            expect(traffic.creates).toEqual(['Transcode']);
            expect(resumeTraffic.creates).toEqual(['Transcode']);
            expectOnlySessionRoutes(traffic);
            expectOnlySessionRoutes(resumeTraffic);
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
