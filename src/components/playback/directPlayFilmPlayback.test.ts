/**
 * Consolidation step 1: the real playback manager, playing a film, never reaches the legacy chain.
 *
 * `PlaybackInfo` is observed at its SDK boundary (`getMediaInfoApi().getPostedPlaybackInfo`) and
 * `createStreamInfo` through `buildLegacyExecutionDecision`, which it - and only it - calls for every
 * stream it builds. Either one being called on this journey fails the test, however identical the
 * resulting playback would look.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__WEBPACK_SERVE__', false);
vi.stubGlobal('__USE_SYSTEM_FONTS__', false);
vi.stubGlobal('__JF_BUILD_VERSION__', 'test');

import {
    SERVER_ID,
    USER_ID,
    VIDEO_ITEM_ID,
    createFakePlayer,
    createPlaybackInfoResponder,
    videoItem,
    videoSource
} from './__testSupport/livetvHarness';

const SESSION_ID = 'cccccccccccccccccccccccccccccccc';
const postedPlaybackInfo = vi.fn();
const legacyStreamInfoBuilt = vi.fn();
const createSession = vi.fn();
const deleteSession = vi.fn();
const streamDescriptor = vi.fn();
const fileDescriptor = (sessionId: string) => ({
    Url: `/Playback/Sessions/${sessionId}/File?itemId=${VIDEO_ITEM_ID}&mediaSourceId=${videoSource().Id}&playSessionId=ps`,
    MimeType: 'video/mp4',
    Container: 'mp4',
    Protocol: 'Http'
});
const hlsDescriptor = (sessionId: string) => ({
    Url: `/Playback/Sessions/${sessionId}/Hls/main.m3u8?itemId=${VIDEO_ITEM_ID}&mediaSourceId=${videoSource().Id}&playSessionId=ps`,
    MimeType: 'application/x-mpegURL',
    Container: 'mp4',
    Protocol: 'Hls'
});
const fetchCalls: Array<{ url: string; method?: string }> = [];
const alerts: unknown[] = [];

vi.mock('@jellyfin/sdk/lib/utils/api/media-info-api', () => ({
    getMediaInfoApi: () => ({ getPostedPlaybackInfo: postedPlaybackInfo })
}));

vi.mock('scripts/playbackExecutionDecision', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('scripts/playbackExecutionDecision')
        >();
    return {
        ...actual,
        buildLegacyExecutionDecision: (
            ...args: Parameters<typeof actual.buildLegacyExecutionDecision>
        ) => {
            legacyStreamInfoBuilt();
            return actual.buildLegacyExecutionDecision(...args);
        }
    };
});

vi.mock('lib/tesserafin-sdk/generated/api/playback-api', () => ({
    PlaybackApi: class {
        createPlaybackSession(request: unknown) {
            return createSession(request);
        }
        getPlaybackSessionStream(request: { id: string }) {
            return Promise.resolve({ data: streamDescriptor(request.id) });
        }
        deletePlaybackSession(request: unknown) {
            return deleteSession(request);
        }
    }
}));

vi.mock('lib/tesserafin-sdk/generated/api/library-api', () => ({
    LibraryApi: class {
        getItem() {
            return Promise.resolve({ data: videoItem() });
        }
    }
}));

vi.mock('lib/tesserafin-sdk/generated/api/playback-credentials-api', () => ({
    PlaybackCredentialsApi: class {
        mintPlaybackCapability() {
            return Promise.resolve({
                data: {
                    CapabilityId: 'cap-1',
                    Value: 'film-capability',
                    IssuedAt: new Date().toISOString(),
                    ExpiresAt: new Date(Date.now() + 900_000).toISOString(),
                    Scopes: ['Media']
                }
            });
        }
        renewPlaybackCapability() {
            return Promise.reject(new Error('not expected'));
        }
    }
}));

vi.mock('components/alert', () => ({
    default: (opts: unknown) => {
        alerts.push(opts);
        return Promise.resolve();
    }
}));

const tesserafinApi = {
    basePath: 'http://127.0.0.1:8096',
    configuration: {},
    axiosInstance: {},
    authorizationHeader: 'MediaBrowser Token="t"'
};

const apiClient = {
    _tesserafinSdk: tesserafinApi,
    serverId: () => SERVER_ID,
    serverAddress: () => 'http://127.0.0.1:8096',
    accessToken: () => 'test-token',
    deviceId: () => 'film-device',
    deviceName: () => 'film-device-name',
    appName: () => 'film',
    appVersion: () => '1.0.0',
    getCurrentUserId: () => USER_ID,
    getCurrentUser: () =>
        Promise.resolve({ Id: USER_ID, Configuration: {}, Policy: {} }),
    getEndpointInfo: () => Promise.resolve({ IsInNetwork: true }),
    getSavedEndpointInfo: () => ({ IsInNetwork: true }),
    getItem: () => Promise.resolve(videoItem()),
    getItems: () => Promise.resolve({ Items: [] }),
    getIntros: () => Promise.resolve({ Items: [] }),
    getUser: () => Promise.resolve({ Id: USER_ID, Configuration: {} }),
    getUrl: (path: string) => 'http://127.0.0.1:8096/' + path,
    isMinServerVersion: () => true,
    reportPlaybackStart: () => Promise.resolve(),
    reportPlaybackProgress: () => Promise.resolve(),
    reportPlaybackStopped: () => Promise.resolve(),
    sendMessage: () => undefined,
    ajax: () => Promise.resolve({})
};

const serverConnectionsMock = {
    ServerConnections: {
        getApiClient: () => apiClient,
        getApi: () => ({ axiosInstance: {}, basePath: '', accessToken: '' }),
        getTesserafinApi: () => tesserafinApi,
        currentApiClient: () => apiClient
    }
};

vi.mock('lib/jellyfin-apiclient', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('lib/jellyfin-apiclient')>();
    return { ...actual, ...serverConnectionsMock };
});
vi.mock('lib/jellyfin-apiclient/ServerConnections', () => ({
    default: serverConnectionsMock.ServerConnections
}));

const { PlaybackManager } = await import('components/playback/playbackmanager');
const { pluginManager } = await import('components/pluginManager');
const Events = (await import('utils/events')).default;

const errors: unknown[] = [];
const stops: unknown[] = [];

function mountManager() {
    errors.length = 0;
    stops.length = 0;
    const manager = new PlaybackManager();
    Events.on(manager, 'playbackerror', (_e: unknown, code: unknown) =>
        errors.push(code)
    );
    Events.on(manager, 'playbackstop', (_e: unknown, info: unknown) =>
        stops.push(info)
    );
    const player = createFakePlayer();
    player.id = 'htmlvideoplayer';
    Events.trigger(pluginManager, 'registered', [player]);
    return { manager, player };
}

describe('direct-play film journey', { timeout: 60000 }, () => {
    beforeEach(() => {
        postedPlaybackInfo.mockReset();
        postedPlaybackInfo.mockImplementation(
            createPlaybackInfoResponder({ [VIDEO_ITEM_ID]: [videoSource()] })
        );
        legacyStreamInfoBuilt.mockReset();
        createSession.mockReset();
        deleteSession.mockReset();
        deleteSession.mockResolvedValue({ data: undefined });
        streamDescriptor.mockReset();
        streamDescriptor.mockImplementation(fileDescriptor);
        fetchCalls.length = 0;
        alerts.length = 0;
        vi.stubGlobal('fetch', (url: string, init?: { method?: string }) => {
            fetchCalls.push({ url, method: init?.method });
            return Promise.resolve({ ok: true, status: 204 });
        });
    });

    it('plays from the session file route without PlaybackInfo or createStreamInfo, and releases on stop', async () => {
        createSession.mockResolvedValue({
            data: { Id: SESSION_ID, Method: 'DirectPlay' }
        });
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        const streamInfo = (
            player.played as Array<{ url: string; playMethod: string }>
        )[0];
        expect(streamInfo.url).toContain(
            `/Playback/Sessions/${SESSION_ID}/File?`
        );
        expect(streamInfo.url).toContain('playbackCapability=film-capability');
        expect(streamInfo.url).not.toMatch(/ApiKey|api_key/i);
        expect(streamInfo.playMethod).toBe('DirectPlay');
        expect(createSession).toHaveBeenCalledTimes(1);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();

        await manager.stop(player);
        // A real player answers stop() with its `stopped` event; the release hangs off that event.
        Events.trigger(player, 'stopped', [{}]);
        await vi.waitFor(
            () =>
                expect(
                    fetchCalls.filter((c) => c.method === 'DELETE')
                ).toHaveLength(1),
            { timeout: 20000, interval: 10 }
        );
        expect(fetchCalls[0].url).toBe(
            `http://127.0.0.1:8096/Playback/Sessions/${SESSION_ID}`
        );
    });

    it('releases an output outside the migrated scope before the legacy chain', async () => {
        streamDescriptor.mockReturnValue({
            Url: '/Videos/film/master.m3u8',
            Protocol: 'Hls'
        });
        createSession.mockResolvedValue({
            data: { Id: SESSION_ID, Method: 'Transcode' }
        });
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(postedPlaybackInfo).toHaveBeenCalled(), {
            timeout: 20000,
            interval: 10
        });

        expect(createSession).toHaveBeenCalledTimes(1);
        expect(deleteSession).toHaveBeenCalledTimes(1);
        expect(deleteSession.mock.invocationCallOrder[0]).toBeLessThan(
            postedPlaybackInfo.mock.invocationCallOrder[0]
        );
        expect(
            postedPlaybackInfo.mock.calls[0][0].playbackInfoDto.EnableDirectPlay
        ).toBe(false);
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });
    });

    it.each(['Remux', 'Transcode'])(
        'plays %s from the session HLS route without PlaybackInfo or createStreamInfo, and releases on stop',
        async (method) => {
            createSession.mockResolvedValue({
                data: {
                    Id: SESSION_ID,
                    Method: method,
                    SelectedStreams: { Audio: 1 }
                }
            });
            streamDescriptor.mockImplementation(hlsDescriptor);
            const { manager, player } = mountManager();

            await manager.play({ items: [videoItem()], startPositionTicks: 0 });
            await vi.waitFor(() => expect(player.played).toHaveLength(1), {
                timeout: 20000,
                interval: 10
            });

            const streamInfo = (
                player.played as Array<{
                    url: string;
                    playMethod: string;
                    mediaSource: { TranscodingSubProtocol?: string };
                }>
            )[0];
            expect(streamInfo.url).toContain(
                `/Playback/Sessions/${SESSION_ID}/Hls/main.m3u8?`
            );
            expect(streamInfo.url).toContain(
                'playbackCapability=film-capability'
            );
            expect(streamInfo.url).not.toMatch(/ApiKey|api_key|\/Videos\//i);
            expect(streamInfo.playMethod).toBe('Transcode');
            expect(streamInfo.mediaSource.TranscodingSubProtocol).toBe('hls');

            // A seek is the player's own: the playlist describes the whole film.
            const sought: number[] = [];
            player.currentTime = (value?: number) => {
                if (value !== undefined) sought.push(value);
                return 0;
            };
            manager.seek(50_000_000, player);
            expect(sought).toEqual([5000]);

            expect(createSession).toHaveBeenCalledTimes(1);
            expect(deleteSession).not.toHaveBeenCalled();
            expect(postedPlaybackInfo).not.toHaveBeenCalled();
            expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();

            await manager.stop(player);
            Events.trigger(player, 'stopped', [{}]);
            await vi.waitFor(
                () =>
                    expect(
                        fetchCalls.filter((c) => c.method === 'DELETE')
                    ).toHaveLength(1),
                { timeout: 20000, interval: 10 }
            );
            expect(fetchCalls[0].url).toBe(
                `http://127.0.0.1:8096/Playback/Sessions/${SESSION_ID}`
            );
            expect(postedPlaybackInfo).not.toHaveBeenCalled();
        }
    );

    it('re-plans an audio change through Sessions: releases the session in place first, never PlaybackInfo', async () => {
        const SECOND = 'dddddddddddddddddddddddddddddddd';
        createSession
            .mockResolvedValueOnce({
                data: {
                    Id: SESSION_ID,
                    Method: 'Remux',
                    SelectedStreams: { Audio: 1 }
                }
            })
            .mockResolvedValueOnce({
                data: {
                    Id: SECOND,
                    Method: 'Remux',
                    SelectedStreams: { Audio: 2 }
                }
            });
        streamDescriptor.mockImplementation(hlsDescriptor);
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        manager.setAudioStreamIndex(2, player);
        await vi.waitFor(() => expect(player.played).toHaveLength(2), {
            timeout: 20000,
            interval: 10
        });

        expect(createSession).toHaveBeenCalledTimes(2);
        expect(
            createSession.mock.calls[1][0].createPlaybackSessionRequest
                .Constraints.PreferredAudioStreamIndex
        ).toBe(2);
        // One session at a time: the first is gone before the second is asked for.
        expect(deleteSession).toHaveBeenCalledTimes(1);
        expect(deleteSession.mock.calls[0][0]).toEqual({ id: SESSION_ID });
        expect(deleteSession.mock.invocationCallOrder[0]).toBeLessThan(
            createSession.mock.invocationCallOrder[1]
        );
        expect((player.played as Array<{ url: string }>)[1].url).toContain(
            `/Playback/Sessions/${SECOND}/Hls/main.m3u8?`
        );
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();

        // The stop gives back the session now in place, and only that one: the first was
        // released once, by the change, and is not asked for again.
        await manager.stop(player);
        Events.trigger(player, 'stopped', [{}]);
        await vi.waitFor(
            () =>
                expect(
                    fetchCalls
                        .filter((c) => c.method === 'DELETE')
                        .map((c) => c.url)
                ).toEqual([
                    `http://127.0.0.1:8096/Playback/Sessions/${SECOND}`
                ]),
            { timeout: 20000, interval: 10 }
        );
        expect(deleteSession).toHaveBeenCalledTimes(1);
    });

    it('continues a change on the existing chain only for an output outside the migrated scope, after both releases', async () => {
        const SECOND = 'dddddddddddddddddddddddddddddddd';
        createSession
            .mockResolvedValueOnce({
                data: { Id: SESSION_ID, Method: 'Remux' }
            })
            .mockResolvedValueOnce({
                data: { Id: SECOND, Method: 'Transcode' }
            });
        streamDescriptor.mockImplementation((id) =>
            id === SECOND
                ? { Url: '/Videos/film/master.m3u8', Protocol: 'Hls' }
                : hlsDescriptor(id)
        );
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        manager.setAudioStreamIndex(2, player);
        await vi.waitFor(() => expect(postedPlaybackInfo).toHaveBeenCalled(), {
            timeout: 20000,
            interval: 10
        });

        expect(deleteSession.mock.calls.map((call) => call[0])).toEqual([
            { id: SESSION_ID },
            { id: SECOND }
        ]);
        expect(deleteSession.mock.invocationCallOrder[1]).toBeLessThan(
            postedPlaybackInfo.mock.invocationCallOrder[0]
        );
        expect(
            postedPlaybackInfo.mock.calls[0][0].playbackInfoDto.EnableDirectPlay
        ).toBe(false);
    });

    it('ends the playback when a change is refused: no legacy chain', async () => {
        createSession
            .mockResolvedValueOnce({
                data: { Id: SESSION_ID, Method: 'Remux' }
            })
            .mockRejectedValueOnce(
                Object.assign(new Error('403'), { response: { status: 403 } })
            );
        streamDescriptor.mockImplementation(hlsDescriptor);
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        manager.setAudioStreamIndex(2, player);
        await vi.waitFor(() => expect(alerts).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        expect(deleteSession).toHaveBeenCalledTimes(1);
        expect(player.played).toHaveLength(1);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();
        // Ended as an error, not as an item that finished: a queue must not move on.
        expect(errors).toEqual(['SERVER_ERROR']);
        expect(stops).toHaveLength(1);
    });

    it('a retry after an error forbids what failed: the server transcodes through the same session delivery', async () => {
        const SECOND = 'dddddddddddddddddddddddddddddddd';
        createSession
            .mockResolvedValueOnce({
                data: { Id: SESSION_ID, Method: 'Remux' }
            })
            .mockResolvedValueOnce({
                data: { Id: SECOND, Method: 'Transcode' }
            });
        streamDescriptor.mockImplementation(hlsDescriptor);
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        Events.trigger(player, 'error', [{ type: 'mediadecodeerror' }]);
        // The stream on its way out keeps failing while the re-plan runs: neither a second
        // re-plan nor the existing chain may start on it.
        Events.trigger(player, 'error', [{ type: 'network' }]);
        Events.trigger(player, 'error', [{ type: 'network' }]);
        await vi.waitFor(() => expect(player.played).toHaveLength(2), {
            timeout: 20000,
            interval: 10
        });

        expect(createSession).toHaveBeenCalledTimes(2);
        expect(
            createSession.mock.calls[1][0].createPlaybackSessionRequest
                .Constraints
        ).toMatchObject({
            AllowDirectPlay: false,
            AllowDirectStream: false,
            AllowVideoStreamCopy: false
        });
        expect(deleteSession.mock.calls.map((call) => call[0])).toEqual([
            { id: SESSION_ID }
        ]);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();
        expect(
            (player.played[1] as { executionDecision: unknown })
                .executionDecision
        ).toMatchObject({
            method: 'Transcode',
            sessionOwned: true,
            playbackSessionId: SECOND
        });
    });

    it('makes one change at a time: a second one during a re-plan starts nothing', async () => {
        const SECOND = 'dddddddddddddddddddddddddddddddd';
        let answerSecond: (value: unknown) => void = () => undefined;
        createSession
            .mockResolvedValueOnce({
                data: { Id: SESSION_ID, Method: 'Remux' }
            })
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        answerSecond = resolve;
                    })
            );
        streamDescriptor.mockImplementation(hlsDescriptor);
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        manager.setAudioStreamIndex(2, player);
        await vi.waitFor(() => expect(createSession).toHaveBeenCalledTimes(2), {
            timeout: 20000,
            interval: 10
        });
        manager.setAudioStreamIndex(1, player);
        Events.trigger(player, 'error', [{ type: 'network' }]);
        answerSecond({ data: { Id: SECOND, Method: 'Remux' } });
        await vi.waitFor(() => expect(player.played).toHaveLength(2), {
            timeout: 20000,
            interval: 10
        });

        expect(createSession).toHaveBeenCalledTimes(2);
        expect(deleteSession).toHaveBeenCalledTimes(1);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(errors).toEqual([]);
        expect(stops).toHaveLength(0);
    });

    it('keeps the film playing when the session cannot be released for a change the viewer asked for', async () => {
        createSession.mockResolvedValueOnce({
            data: { Id: SESSION_ID, Method: 'Remux' }
        });
        deleteSession.mockRejectedValueOnce(
            Object.assign(new Error('503'), { response: { status: 503 } })
        );
        streamDescriptor.mockImplementation(hlsDescriptor);
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        manager.setAudioStreamIndex(2, player);
        await vi.waitFor(() => expect(deleteSession).toHaveBeenCalledTimes(1), {
            timeout: 20000,
            interval: 10
        });
        await new Promise((resolve) => setTimeout(resolve, 50));

        // No second session while the first may still live, and the playback is left alone.
        expect(createSession).toHaveBeenCalledTimes(1);
        expect(player.played).toHaveLength(1);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(errors).toEqual([]);
        expect(stops).toHaveLength(0);

        // The session is still the playback's: the stop gives it back.
        await manager.stop(player);
        Events.trigger(player, 'stopped', [{}]);
        await vi.waitFor(
            () =>
                expect(
                    fetchCalls
                        .filter((c) => c.method === 'DELETE')
                        .map((c) => c.url)
                ).toEqual([
                    `http://127.0.0.1:8096/Playback/Sessions/${SESSION_ID}`
                ]),
            { timeout: 20000, interval: 10 }
        );
    });

    it('ends the attempt on a refusal: no legacy chain, no playback', async () => {
        createSession.mockRejectedValue(
            Object.assign(new Error('403'), { response: { status: 403 } })
        );
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(alerts).toHaveLength(1), {
            timeout: 20000,
            interval: 10
        });

        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();
        expect(player.played).toHaveLength(0);
    });
});
