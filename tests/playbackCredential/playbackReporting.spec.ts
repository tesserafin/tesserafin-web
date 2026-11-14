/** Real production bundle + server. Old report methods throw; no transport is mocked. */
import { expect, test, type Page } from '@playwright/test';
import { TesserafinApi } from '../../src/lib/tesserafin-sdk/client';
import {
    reportPlayback,
    type PlaybackReportState
} from '../../src/components/playback/playbackReporting';
import { signIn, AUTH_HEADER, BASE_URL } from '../e2e/support/b2';
import {
    admin,
    itemIdByName,
    openDetailByName,
    playControl
} from './support/rig';

interface Report {
    path: string;
    itemId: string;
    playSessionId: string;
    position: number;
    paused: boolean;
    status: number;
    authenticated: boolean;
}

function watchReports(page: Page): Report[] {
    const reports: Report[] = [];
    page.on('response', (response) => {
        const url = new URL(response.url());
        if (
            !/^\/Sessions\/Playing(?:\/Progress|\/Stopped)?$/i.test(
                url.pathname
            )
        )
            return;
        const request = response.request();
        if (request.method() !== 'POST') return;
        const info = request.postDataJSON();
        reports.push({
            path: url.pathname,
            itemId: info.ItemId,
            playSessionId: info.PlaySessionId,
            position: Number(info.PositionTicks ?? 0) / 10_000_000,
            paused: info.IsPaused === true,
            status: response.status(),
            authenticated:
                Boolean(request.headers().authorization) && !url.search
        });
    });
    return reports;
}

async function forbidOldReports(page: Page) {
    const installed = await page.evaluate(() => {
        const w = window as unknown as {
            ApiClient?: Record<string, unknown>;
            __oldReportCalls: number;
        };
        if (!w.ApiClient) return false;
        w.__oldReportCalls = 0;
        for (const name of [
            'reportPlaybackStart',
            'reportPlaybackProgress',
            'reportPlaybackStopped'
        ]) {
            w.ApiClient[name] = () => {
                w.__oldReportCalls++;
                throw new Error('old playback report reached');
            };
        }
        return true;
    });
    expect(
        installed,
        'the old-client negative control must actually be installed'
    ).toBe(true);
}

async function start(page: Page) {
    await openDetailByName(page, 'Smoke Test Movie');
    const opened = page.waitForURL(/#\/video/, { timeout: 30_000 });
    await playControl(page).click();
    await opened;
}

async function stop(page: Page, reports: Report[]) {
    await page.keyboard.press('Escape');
    const stopped = await expect
        .poll(() => reports.some((r) => /Stopped$/i.test(r.path)), {
            timeout: 3000
        })
        .toBe(true)
        .then(
            () => true,
            () => false
        );
    if (!stopped) await page.goBack();
    await expect
        .poll(() => reports.filter((r) => /Stopped$/i.test(r.path)).length, {
            timeout: 15000
        })
        .toBe(1);
    expect(
        await page.evaluate(
            () =>
                (window as unknown as { __oldReportCalls: number })
                    .__oldReportCalls
        )
    ).toBe(0);
}

test('SDK reports start, seek, pause, stop and persisted resume with old methods forbidden', async ({
    page,
    browser
}) => {
    const a = await admin();
    const headers = { Authorization: `${AUTH_HEADER}, Token="${a.token}"` };
    const configuration = await (
        await a.api.get('/System/Configuration', { headers })
    ).json();
    const previousFloor = configuration.MinResumeDurationSeconds;
    configuration.MinResumeDurationSeconds = 0;
    expect(
        (
            await a.api.post('/System/Configuration', {
                headers,
                data: configuration
            })
        ).ok()
    ).toBe(true);
    const itemId = await itemIdByName(a, 'Smoke Test Movie');
    const userData = `/UserItems/${itemId}/UserData?userId=${a.userId}`;
    await a.api.post(userData, {
        headers,
        data: { PlaybackPositionTicks: 0, Played: false }
    });
    let resumedContext:
        | Awaited<ReturnType<typeof browser.newContext>>
        | undefined;
    try {
        // The fixture is two seconds long. Hold it after real media time advances, before it ends.
        await page.addInitScript(() => {
            let held = false;
            document.addEventListener(
                'timeupdate',
                (event) => {
                    const media = event.target;
                    if (
                        !held &&
                        media instanceof HTMLVideoElement &&
                        media.currentTime > 0.2
                    ) {
                        held = true;
                        media.pause();
                        media.currentTime = 0.6;
                    }
                },
                true
            );
        });
        const reports = watchReports(page);
        await signIn(page);
        await forbidOldReports(page);
        await start(page);
        await expect
            .poll(() => reports.some((r) => r.path === '/Sessions/Playing'), {
                timeout: 30000
            })
            .toBe(true);
        await expect
            .poll(() =>
                page.evaluate(
                    () => document.querySelector('video')?.currentTime ?? -1
                )
            )
            .toBeCloseTo(0.6, 1);
        await expect
            .poll(
                () => reports.some((r) => /Progress$/.test(r.path) && r.paused),
                { timeout: 15000 }
            )
            .toBe(true);
        await stop(page, reports);
        const stopped = reports.find((r) => /Stopped$/.test(r.path))!;
        expect(stopped.position).toBeCloseTo(0.6, 1);
        expect(new Set(reports.map((r) => r.playSessionId)).size).toBe(1);
        expect(
            reports.every(
                (r) =>
                    r.itemId.replace(/-/g, '') === itemId.replace(/-/g, '') &&
                    r.status === 204 &&
                    r.authenticated
            )
        ).toBe(true);
        await expect
            .poll(
                async () => {
                    const data = await (
                        await a.api.get(userData, { headers })
                    ).json();
                    return Number(data.PlaybackPositionTicks ?? 0) / 10_000_000;
                },
                { timeout: 15000 }
            )
            .toBeCloseTo(0.6, 1);

        resumedContext = await browser.newContext();
        const resumed = await resumedContext.newPage();
        await resumed.addInitScript(() => {
            document.addEventListener(
                'playing',
                (event) => {
                    if (event.target instanceof HTMLVideoElement) {
                        const w = window as unknown as { __resumeAt?: number };
                        w.__resumeAt ??= event.target.currentTime;
                        event.target.pause();
                    }
                },
                true
            );
        });
        const resumedReports = watchReports(resumed);
        await signIn(resumed);
        await forbidOldReports(resumed);
        await start(resumed);
        await expect
            .poll(
                () =>
                    resumed.evaluate(
                        () =>
                            (window as unknown as { __resumeAt?: number })
                                .__resumeAt ?? -1
                    ),
                { timeout: 30000 }
            )
            .toBeGreaterThan(0.25);
        const resumedAt = await resumed.evaluate(
            () => (window as unknown as { __resumeAt: number }).__resumeAt
        );
        expect(Math.abs(resumedAt - stopped.position)).toBeLessThan(0.35);
        await stop(resumed, resumedReports);
        expect(resumedReports[0].playSessionId).not.toBe(stopped.playSessionId);
    } finally {
        await resumedContext?.close();
        configuration.MinResumeDurationSeconds = previousFloor;
        await a.api.post('/System/Configuration', {
            headers,
            data: configuration
        });
        await a.dispose();
    }
});

// This exercises the production reporter and generated transport against the real server without
// a browser fixture. It verifies persistence/order; it is not a decoder or browser acceptance claim.
test('real-server SDK reports persist position and reject an old stop after the next start', async () => {
    const a = await admin();
    const headers = { Authorization: `${AUTH_HEADER}, Token="${a.token}"` };
    const configuration = await (
        await a.api.get('/System/Configuration', { headers })
    ).json();
    const previousFloor = configuration.MinResumeDurationSeconds;
    configuration.MinResumeDurationSeconds = 0;
    expect(
        (
            await a.api.post('/System/Configuration', {
                headers,
                data: configuration
            })
        ).ok()
    ).toBe(true);
    const itemId = await itemIdByName(a, 'Smoke Test Movie');
    const nextId = await itemIdByName(a, 'Container Film');
    const api = new TesserafinApi(
        BASE_URL,
        { name: 'Tesserafin Web B2', version: '0.0.0' },
        { name: 'Playwright', id: 'tesserafin-e2e-b2' },
        a.token
    );
    const first: PlaybackReportState = {
        reportingOwner: {},
        NowPlayingItem: { Id: itemId },
        PlayState: {
            PlaySessionId: 'report-first',
            PositionTicks: 0,
            CanSeek: true,
            MediaSourceId: itemId,
            PlayMethod: 'DirectPlay'
        }
    };
    const second: PlaybackReportState = {
        reportingOwner: {},
        NowPlayingItem: { Id: nextId },
        PlayState: {
            PlaySessionId: 'report-second',
            PositionTicks: 70000000,
            CanSeek: true,
            MediaSourceId: nextId,
            PlayMethod: 'DirectPlay'
        }
    };
    try {
        expect(await reportPlayback(api, 'start', first)).toBe(true);
        first.PlayState.PositionTicks = 6000000;
        first.PlayState.IsPaused = true;
        expect(await reportPlayback(api, 'progress', first)).toBe(true);
        const stop = reportPlayback(api, 'stop', first);
        const nextStart = reportPlayback(api, 'start', second);
        expect(await stop).toBe(true);
        expect(await nextStart).toBe(true);
        first.PlayState.PositionTicks = 900000000;
        expect(await reportPlayback(api, 'stop', first)).toBe(false);
        expect(await reportPlayback(api, 'progress', first)).toBe(false);
        const saved = await (
            await a.api.get(
                `/UserItems/${itemId}/UserData?userId=${a.userId}`,
                { headers }
            )
        ).json();
        expect(saved.PlaybackPositionTicks).toBe(6000000);
        const sessions = await (
            await a.api.get('/Sessions', { headers })
        ).json();
        const session = sessions.find(
            (value: { DeviceId?: string }) =>
                value.DeviceId === 'tesserafin-e2e-b2'
        );
        expect(session.NowPlayingItem.Id.replace(/-/g, '')).toBe(
            nextId.replace(/-/g, '')
        );
        expect(await reportPlayback(api, 'stop', second)).toBe(true);
    } finally {
        await reportPlayback(api, 'stop', second);
        configuration.MinResumeDurationSeconds = previousFloor;
        await a.api.post('/System/Configuration', {
            headers,
            data: configuration
        });
        await a.dispose();
    }
});
