import axios, { type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { reportPlayback, type PlaybackReportState } from './playbackReporting';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function rig(
    beforeResponse?: (config: InternalAxiosRequestConfig) => Promise<void>
) {
    const requests: InternalAxiosRequestConfig[] = [];
    const transport = axios.create({
        adapter: async (config) => {
            requests.push(config);
            await beforeResponse?.(config);
            return {
                data: undefined,
                status: 204,
                statusText: 'No Content',
                headers: {},
                config
            };
        }
    });
    const api = new TesserafinApi(
        'https://media.test/base',
        { name: 'Web', version: '1' },
        { name: 'Browser', id: 'device' },
        'credential-a',
        transport
    );
    return { api, requests };
}

function state(id = 'a'): PlaybackReportState {
    return {
        reportingOwner: {},
        PlayState: {
            PlaySessionId: `play-${id}`,
            MediaSourceId: `source-${id}`,
            PositionTicks: 420000000,
            IsPaused: false,
            AudioStreamIndex: 1,
            SubtitleStreamIndex: -1
        },
        NowPlayingItem: { Id: id }
    };
}

function body(request: InternalAxiosRequestConfig) {
    return JSON.parse(String(request.data));
}

function routes(requests: InternalAxiosRequestConfig[]) {
    return requests.map((r) =>
        new URL(String(r.url)).pathname.replace(/^\/base/, '')
    );
}

describe('generated-SDK playback reporting', () => {
    it('uses the three generated routes and header auth, with final position and queue', async () => {
        const { api, requests } = rig();
        const playing = state();
        await reportPlayback(api, 'start', playing, [
            { Id: 'a', PlaylistItemId: 'queue-a' }
        ]);
        playing.PlayState.IsPaused = true;
        await reportPlayback(api, 'progress', playing);
        playing.PlayState.PositionTicks = 470000000;
        playing.NextMediaType = 'Audio';
        await reportPlayback(api, 'stop', playing);
        expect(routes(requests)).toEqual([
            '/Sessions/Playing',
            '/Sessions/Playing/Progress',
            '/Sessions/Playing/Stopped'
        ]);
        for (const request of requests) {
            expect(request.method).toBe('post');
            expect(request.headers.Authorization).toBe(api.authorizationHeader);
            expect(request.url).toMatch(
                new RegExp(`^${api.basePath}/Sessions/`)
            );
            expect(request.url).not.toMatch(/credential|api_key|token/i);
            expect(request.timeout).toBe(10000);
            expect(body(request)).toMatchObject({
                ItemId: 'a',
                PlaySessionId: 'play-a',
                AudioStreamIndex: 1,
                SubtitleStreamIndex: -1
            });
        }
        expect(body(requests[0]).NowPlayingQueue).toEqual([
            { Id: 'a', PlaylistItemId: 'queue-a' }
        ]);
        expect(body(requests[1]).IsPaused).toBe(true);
        expect(body(requests[2])).toMatchObject({
            PositionTicks: 470000000,
            NextMediaType: 'Audio'
        });
        expect(body(requests[0])).not.toHaveProperty('reportingOwner');
    });

    it('snapshots position, identity and queue before lazy loading or transport waits', async () => {
        const hold = deferred();
        const { api, requests } = rig(() => hold.promise);
        const playing = state();
        const queue = [{ Id: 'a', PlaylistItemId: 'q-a' }];
        const start = reportPlayback(api, 'start', playing, queue);
        playing.PlayState.PositionTicks = 5;
        playing.NowPlayingItem.Id = 'b';
        queue[0].Id = 'b';
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        expect(body(requests[0])).toMatchObject({
            ItemId: 'a',
            PositionTicks: 420000000,
            NowPlayingQueue: [{ Id: 'a' }]
        });
        hold.resolve();
        expect(await start).toBe(true);
    });

    it('finishes A progress and stop before starting B, even when A is slow', async () => {
        const hold = deferred();
        const { api, requests } = rig(async () => {
            if (requests.length === 1) await hold.promise;
        });
        const a = state('a');
        const b = state('b');
        const sent = [
            reportPlayback(api, 'start', a),
            reportPlayback(api, 'progress', a),
            reportPlayback(api, 'stop', a),
            reportPlayback(api, 'start', b)
        ];
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        expect(await reportPlayback(api, 'progress', a)).toBe(false);
        expect(await reportPlayback(api, 'stop', a)).toBe(false);
        hold.resolve();
        await Promise.all(sent);
        expect(routes(requests)).toEqual([
            '/Sessions/Playing',
            '/Sessions/Playing/Progress',
            '/Sessions/Playing/Stopped',
            '/Sessions/Playing'
        ]);
        expect(requests.map((r) => body(r).PlaySessionId)).toEqual([
            'play-a',
            'play-a',
            'play-a',
            'play-b'
        ]);
    });

    it('distinguishes repeated playback of the same item and server play session', async () => {
        const { api, requests } = rig();
        const first = state();
        await reportPlayback(api, 'start', first);
        await reportPlayback(api, 'stop', first);
        const second = state();
        await reportPlayback(api, 'start', second);
        expect(await reportPlayback(api, 'stop', first)).toBe(false);
        expect(await reportPlayback(api, 'progress', first)).toBe(false);
        expect(await reportPlayback(api, 'progress', second)).toBe(true);
        expect(requests).toHaveLength(4);
    });

    it('preserves the local playback owner when stream changes replace the server play session', async () => {
        const { api, requests } = rig();
        const playing = state();
        await reportPlayback(api, 'start', playing);
        playing.PlayState.PlaySessionId = 'software-retry';
        playing.PlayState.MediaSourceId = 'alternate-source';
        expect(await reportPlayback(api, 'progress', playing)).toBe(true);
        expect(await reportPlayback(api, 'stop', playing)).toBe(true);
        expect(body(requests[2])).toMatchObject({
            PlaySessionId: 'software-retry',
            MediaSourceId: 'alternate-source'
        });
    });

    it('drops progress before start and duplicate stop/progress after stop', async () => {
        const { api, requests } = rig();
        const playing = state();
        expect(await reportPlayback(api, 'progress', playing)).toBe(false);
        await reportPlayback(api, 'start', playing);
        await reportPlayback(api, 'stop', playing);
        expect(await reportPlayback(api, 'stop', playing)).toBe(false);
        expect(await reportPlayback(api, 'progress', playing)).toBe(false);
        expect(requests).toHaveLength(2);
    });

    it('reports a transport failure without retrying or poisoning the following stop', async () => {
        const { api, requests } = rig(async () => {
            if (requests.length === 2) throw new Error('timeout');
        });
        const playing = state();
        await reportPlayback(api, 'start', playing);
        await expect(reportPlayback(api, 'progress', playing)).rejects.toThrow(
            'timeout'
        );
        expect(await reportPlayback(api, 'stop', playing)).toBe(true);
        expect(requests).toHaveLength(3);
    });

    it('discards queued reports after credential rotation, without reauthenticating them', async () => {
        const hold = deferred();
        const { api, requests } = rig(async () => {
            if (requests.length === 1) await hold.promise;
        });
        const old = state();
        const start = reportPlayback(api, 'start', old);
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        const oldStop = reportPlayback(api, 'stop', old);
        api.update({
            accessToken: 'credential-b',
            basePath: 'https://other.test'
        });
        const next = reportPlayback(api, 'start', state('b'));
        hold.resolve();
        await start;
        expect(await oldStop).toBe(false);
        expect(await next).toBe(true);
        expect(requests).toHaveLength(2);
        expect(requests[0].headers.Authorization).toContain('credential-a');
        expect(requests[1].headers.Authorization).toContain('credential-b');
        expect(requests[1].url).toBe('https://other.test/Sessions/Playing');
    });

    it('discards queued work when the server address changes without a credential change', async () => {
        const hold = deferred();
        const { api, requests } = rig(async () => {
            if (requests.length === 1) await hold.promise;
        });
        const playing = state();
        const start = reportPlayback(api, 'start', playing);
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        const stop = reportPlayback(api, 'stop', playing);
        api.update({ basePath: 'https://moved.test' });
        const next = reportPlayback(api, 'start', state('b'));
        hold.resolve();
        await start;
        expect(await stop).toBe(false);
        expect(await next).toBe(true);
        expect(requests.map((r) => new URL(String(r.url)).host)).toEqual([
            'media.test',
            'moved.test'
        ]);
    });

    it('keeps separate active playback owners for explicitly addressed device sessions', async () => {
        const { api, requests } = rig();
        const a = state();
        const b = state('b');
        a.PlayState.SessionId = 'device-a';
        b.PlayState.SessionId = 'device-b';
        await reportPlayback(api, 'start', a);
        await reportPlayback(api, 'start', b);
        expect(await reportPlayback(api, 'stop', a)).toBe(true);
        expect(await reportPlayback(api, 'progress', b)).toBe(true);
        expect(requests.map((r) => body(r).SessionId)).toEqual([
            'device-a',
            'device-b',
            'device-a',
            'device-b'
        ]);
    });

    it('does not block an unrelated server behind a stalled connection', async () => {
        const hold = deferred();
        const a = rig(() => hold.promise);
        const b = rig();
        const pending = reportPlayback(a.api, 'start', state());
        expect(await reportPlayback(b.api, 'start', state())).toBe(true);
        hold.resolve();
        await pending;
    });
});
