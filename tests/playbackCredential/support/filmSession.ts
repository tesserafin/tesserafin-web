/**
 * What the film journeys on `Playback/Sessions` (direct play, remux, transcode) share in the
 * browser suites: the traffic a playback produces, read at the network; the server's own view of
 * it (live sessions, FFmpeg logs through the admin log API); and the player gestures.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { openDetailByName, playControl, type Admin } from './rig';

const RESTRICTED_USER =
    process.env.TESSERAFIN_E2E_RESTRICTED_USER ?? 'smokerestricted';
const RESTRICTED_PASSWORD =
    process.env.TESSERAFIN_E2E_RESTRICTED_PASSWORD ?? 'restrictedpass123';

export interface Traffic {
    playbackInfo: number;
    creates: string[];
    sessionIds: string[];
    deletes: number;
    playlistUrls: string[];
    segmentUrls: string[];
    hlsStatuses: number[];
    legacyMedia: string[];
    subtitleStatuses: number[];
    durableTokenInMediaUrl: boolean;
}

export async function watch(page: Page): Promise<Traffic> {
    const traffic: Traffic = {
        playbackInfo: 0,
        creates: [],
        sessionIds: [],
        deletes: 0,
        playlistUrls: [],
        segmentUrls: [],
        hlsStatuses: [],
        legacyMedia: [],
        subtitleStatuses: [],
        durableTokenInMediaUrl: false
    };
    await page.route(/\/Items\/[^/]+\/PlaybackInfo/i, (route) => {
        traffic.playbackInfo += 1;
        return route.abort('blockedbyclient');
    });
    page.on('request', (req) => {
        const path = new URL(req.url()).pathname;
        if (
            /\/Videos\/[^/]+\/(master|main|live)\.m3u8$/i.test(path) ||
            /\/Videos\/[^/]+\/hls1\//i.test(path) ||
            /\/Videos\/[^/]+\/stream(\.|$)/i.test(path) ||
            /\/Videos\/ActiveEncodings$/i.test(path)
        ) {
            traffic.legacyMedia.push(`${req.method()} ${path}`);
        }
    });
    page.on('response', async (response) => {
        const url = response.url();
        const path = new URL(url).pathname;
        const method = response.request().method();
        if (method === 'POST' && /\/Playback\/Sessions$/i.test(path)) {
            const body = await response.json().catch(() => ({}));
            traffic.creates.push(String(body.Method ?? response.status()));
            if (body.Id) traffic.sessionIds.push(String(body.Id));
        }
        if (
            method === 'DELETE' &&
            /\/Playback\/Sessions\/[0-9a-f]+$/i.test(path)
        )
            traffic.deletes += 1;
        if (/\/Playback\/Sessions\/[0-9a-f]+\/Hls\//i.test(path)) {
            traffic.hlsStatuses.push(response.status());
            (path.endsWith('main.m3u8')
                ? traffic.playlistUrls
                : traffic.segmentUrls
            ).push(url);
            if (/[?&](ApiKey|api_key)=/i.test(url))
                traffic.durableTokenInMediaUrl = true;
        }
        if (/\/Subtitles\/\d+\/\d+\/Stream\./i.test(path))
            traffic.subtitleStatuses.push(response.status());
    });
    return traffic;
}

export const adminHeaders = (a: Admin) => ({
    Authorization: `MediaBrowser Client="e2e", Device="e2e", DeviceId="e2e-admin", Version="1", Token="${a.token}"`
});

export async function liveSessions(a: Admin, itemId: string): Promise<number> {
    const response = await a.api.get('/System/PlaybackDiagnostics/Sessions', {
        headers: adminHeaders(a)
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

/** The server's FFmpeg logs for one media source: name and the command line each one ran. */
export async function ffmpegLogs(
    a: Admin,
    mediaSourceId: string
): Promise<Array<{ name: string; text: string }>> {
    const headers = adminHeaders(a);
    const listing = (await (
        await a.api.get('/System/Logs', { headers })
    ).json()) as Array<{ Name: string }>;
    const wanted = mediaSourceId.replace(/-/g, '').toLowerCase();
    const logs = [];
    for (const { Name } of listing) {
        if (!/^FFmpeg\./.test(Name) || !Name.toLowerCase().includes(wanted))
            continue;
        const text = await (
            await a.api.get(
                `/System/Logs/Log?name=${encodeURIComponent(Name)}`,
                { headers }
            )
        ).text();
        logs.push({ name: Name, text });
    }
    return logs;
}

export async function videoTime(page: Page): Promise<number> {
    return page.evaluate(
        () => document.querySelector('video')?.currentTime ?? -1
    );
}

export async function startFilm(page: Page, film: string): Promise<void> {
    await openDetailByName(page, film);
    const reachedPlayer = page.waitForURL(/#\/video/, { timeout: 30_000 });
    await playControl(page).click();
    await reachedPlayer;
}

export async function stopPlayer(page: Page, traffic: Traffic): Promise<void> {
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

export async function seekTo(page: Page, seconds: number): Promise<void> {
    await page.evaluate((target) => {
        const video = document.querySelector('video');
        if (video) video.currentTime = target;
    }, seconds);
}

export async function setMinResume(a: Admin, seconds: number): Promise<number> {
    const headers = adminHeaders(a);
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

/** Sets the admin's own subtitle mode; returns the previous one. */
export async function setSubtitleMode(a: Admin, mode: string): Promise<string> {
    const headers = adminHeaders(a);
    const user = await (
        await a.api.get(`/Users/${a.userId}`, { headers })
    ).json();
    const previous = String(user.Configuration.SubtitleMode ?? 'Default');
    const saved = await a.api.post(`/Users/Configuration?userId=${a.userId}`, {
        headers,
        data: { ...user.Configuration, SubtitleMode: mode }
    });
    expect(saved.ok(), 'the user configuration must be saved').toBe(true);
    return previous;
}

export async function restrictedToken(api: APIRequestContext): Promise<string> {
    const response = await api.post('/Users/AuthenticateByName', {
        headers: {
            Authorization:
                'MediaBrowser Client="e2e", Device="e2e-restricted", DeviceId="e2e-restricted", Version="1"'
        },
        data: { Username: RESTRICTED_USER, Pw: RESTRICTED_PASSWORD }
    });
    expect(response.ok(), 'the rig seeds a restricted user').toBe(true);
    return String((await response.json()).AccessToken);
}

export function recordPlaying(page: Page): Promise<void> {
    return page.addInitScript(() => {
        document.addEventListener(
            'playing',
            (event) => {
                const w = window as unknown as { __playingAt?: number[] };
                w.__playingAt = w.__playingAt ?? [];
                w.__playingAt.push(
                    (event.target as HTMLMediaElement).currentTime
                );
            },
            true
        );
    });
}
