/**
 * Consolidation step 1, audio: a library audio track the browser plays as it is is decided by the
 * server's v2 engine and played from the session's own file route, through `Playback/Sessions`
 * alone, on a real server, from a production bundle.
 *
 * What a playback through the old chain would do instead, and what is therefore asserted rather
 * than "the track plays":
 *  - `PlaybackInfo` is aborted at the network: a journey that still asked for it does not start.
 *  - No request goes to `/Audio/{id}/universal` or `/Audio/{id}/stream`.
 *  - One `POST Playback/Sessions`, decided `DirectPlay`, and the bytes come from
 *    `/Playback/Sessions/{id}/File` with a capability, never a durable token.
 *  - After the stop the session is gone.
 *
 * The fixture is an MP3 of its own music library (`seedAudioLibrary`). A track no browser decodes
 * is the existing chain's (`audioRevocation.spec.ts`, `matrix.spec.ts`).
 */
import { expect, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import { liveSessions, watch } from './support/filmSession';
import { mediaItemIdByName, seedAudioLibrary } from './support/fixtures';
import { admin, playControl } from './support/rig';

const LABEL = 'A1 Session Audio';

test.describe('local audio on Playback/Sessions', () => {
    test('plays a track the browser decodes from its session file route and stops', async ({
        page
    }) => {
        test.setTimeout(180_000);
        const a = await admin();
        const audio = await seedAudioLibrary(a, LABEL);
        const legacyAudio: string[] = [];
        const fileResponses: Array<{ status: number; url: string }> = [];
        try {
            const traffic = await watch(page);
            page.on('request', (req) => {
                const path = new URL(req.url()).pathname;
                if (/\/Audio\/[^/]+\/(universal|stream)/i.test(path)) {
                    legacyAudio.push(`${req.method()} ${path}`);
                }
            });
            page.on('response', (response) => {
                const url = response.url();
                if (/\/Playback\/Sessions\/[0-9a-f]+\/File/i.test(url)) {
                    fileResponses.push({ status: response.status(), url });
                }
            });

            await signIn(page);
            const itemId = await mediaItemIdByName(
                a,
                `${LABEL} Probe`,
                'Audio'
            );
            await page.goto(`/#/details?id=${itemId}`);
            await expect(playControl(page)).toBeVisible({ timeout: 60_000 });
            await playControl(page).click();

            await expect
                .poll(
                    () =>
                        page.evaluate(
                            () =>
                                document.querySelector('audio')?.currentTime ??
                                -1
                        ),
                    {
                        timeout: 45_000,
                        message: 'the track must play'
                    }
                )
                .toBeGreaterThan(0.5);
            expect(
                await liveSessions(a, itemId),
                'exactly one session lives while the track plays'
            ).toBe(1);

            expect(
                traffic.creates,
                'one POST, decided as a direct play'
            ).toEqual(['DirectPlay']);
            expect(
                traffic.playbackInfo,
                'PlaybackInfo must never be requested on this journey'
            ).toBe(0);
            expect(
                legacyAudio,
                'no request may go to the existing audio routes'
            ).toEqual([]);
            expect(
                fileResponses.length,
                'the bytes come from the session file route'
            ).toBeGreaterThan(0);
            expect(
                fileResponses.every(
                    (r) =>
                        (r.status === 200 || r.status === 206) &&
                        r.url.includes(
                            `/Playback/Sessions/${traffic.sessionIds[0]}/File`
                        ) &&
                        /[?&]playbackCapability=/.test(r.url) &&
                        !/[?&](ApiKey|api_key)=/i.test(r.url)
                ),
                `file responses: ${fileResponses.map((r) => r.status).join(',')}`
            ).toBe(true);

            // The fixture is eight seconds long: its natural end stops the playback.
            await expect
                .poll(() => traffic.deletes, {
                    timeout: 30_000,
                    message: 'the end of the track must DELETE the session'
                })
                .toBeGreaterThan(0);
            await expect
                .poll(() => liveSessions(a, itemId), {
                    timeout: 15_000,
                    message: 'no session survives the stop'
                })
                .toBe(0);
            expect(traffic.playbackInfo).toBe(0);
            expect(legacyAudio).toEqual([]);
        } finally {
            await audio.dispose();
            await a.dispose();
        }
    });
});
