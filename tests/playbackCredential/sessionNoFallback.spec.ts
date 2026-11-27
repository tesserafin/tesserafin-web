/**
 * tesserafin#129 audit W1-W3 (decided 2026-11-27): the Web client has no PlaybackInfo chain left
 * to fall back to. A server item plays from its `Playback/Sessions` session, or the attempt ends
 * and says why. Real server, production bundle, `PlaybackInfo` aborted at the network.
 *
 * Two `.strm` items whose targets a loopback HTTP server serves:
 *  - one names a finished MP4: the server reads it as a remote file and the browser plays it from
 *    the session (the `.strm` case the owner asked to keep in the browser validation);
 *  - one names an endless body with no known length: the server refuses it with a 422 and a
 *    reason, and the browser says that reason - it does not try another chain.
 */
import { expect, test } from '@playwright/test';

import { signIn } from '../e2e/support/b2';
import { videoTime, watch } from './support/filmSession';
import { mediaItemIdByName, seedStrmLibrary } from './support/fixtures';
import { admin, playControl } from './support/rig';

test.describe('No PlaybackInfo fallback', () => {
    test('plays a .strm item from its session and says why one is refused', async ({
        page
    }) => {
        test.setTimeout(240_000);
        const a = await admin();
        const library = await seedStrmLibrary(a);
        try {
            const traffic = await watch(page);
            const refusals: Array<{ status: number; reason?: string }> = [];
            page.on('response', async (response) => {
                const path = new URL(response.url()).pathname;
                if (
                    response.request().method() === 'POST' &&
                    /\/Playback\/Sessions$/i.test(path) &&
                    response.status() === 422
                ) {
                    const body = await response.json().catch(() => ({}));
                    refusals.push({
                        status: response.status(),
                        reason: body.reason
                    });
                }
            });

            await signIn(page);

            // The .strm target the server reads: played from the session alone.
            const playableId = await mediaItemIdByName(
                a,
                library.playable,
                'Video'
            );
            await page.goto(`/#/details?id=${playableId}`);
            await expect(playControl(page)).toBeVisible({ timeout: 60_000 });
            await playControl(page).click();
            await expect
                .poll(() => videoTime(page), {
                    timeout: 90_000,
                    message: 'the .strm item must play'
                })
                .toBeGreaterThan(2);
            expect(traffic.creates.length, 'one POST').toBe(1);
            expect(['DirectPlay', 'Remux', 'Transcode']).toContain(
                traffic.creates[0]
            );
            expect(traffic.playbackInfo).toBe(0);
            expect(traffic.legacyMedia).toEqual([]);
            expect(traffic.durableTokenInMediaUrl).toBe(false);

            await page.keyboard.press('MediaStop').catch(() => undefined);
            await page.goto('/#/home');

            // The target no session provider reads: refused, and the refusal is what the viewer
            // is told. Nothing falls back.
            const unreadableId = await mediaItemIdByName(
                a,
                library.unreadable,
                'Video'
            );
            await page.goto(`/#/details?id=${unreadableId}`);
            await expect(playControl(page)).toBeVisible({ timeout: 60_000 });
            await playControl(page).click();
            await expect(
                page.getByText("The server can't read this item's source.")
            ).toBeVisible({ timeout: 60_000 });
            expect(refusals).toEqual([
                { status: 422, reason: 'NoSessionProvider' }
            ]);
            expect(traffic.playbackInfo, 'never PlaybackInfo').toBe(0);
            expect(traffic.legacyMedia).toEqual([]);
            expect(
                await page.evaluate(
                    () => document.querySelector('video')?.currentTime ?? -1
                )
            ).toBeLessThanOrEqual(0);
        } finally {
            await library.dispose();
            await a.dispose();
        }
    });
});
