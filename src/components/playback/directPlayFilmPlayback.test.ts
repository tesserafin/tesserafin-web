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
const fetchCalls: Array<{ url: string; method?: string }> = [];
const alerts: unknown[] = [];

vi.mock('@jellyfin/sdk/lib/utils/api/media-info-api', () => ({
    getMediaInfoApi: () => ({ getPostedPlaybackInfo: postedPlaybackInfo })
}));

vi.mock('scripts/playbackExecutionDecision', async (importOriginal) => {
    const actual = await importOriginal<typeof import('scripts/playbackExecutionDecision')>();
    return {
        ...actual,
        buildLegacyExecutionDecision: (...args: Parameters<typeof actual.buildLegacyExecutionDecision>) => {
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
        getPlaybackSessionStream() {
            return Promise.resolve({
                data: {
                    Url: `/Playback/Sessions/${SESSION_ID}/File?itemId=${VIDEO_ITEM_ID}&mediaSourceId=${videoSource().Id}&playSessionId=ps`,
                    MimeType: 'video/mp4',
                    Container: 'mp4',
                    Protocol: 'Http'
                }
            });
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
    getCurrentUser: () => Promise.resolve({ Id: USER_ID, Configuration: {}, Policy: {} }),
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
    const actual = await importOriginal<typeof import('lib/jellyfin-apiclient')>();
    return { ...actual, ...serverConnectionsMock };
});
vi.mock('lib/jellyfin-apiclient/ServerConnections', () => ({
    default: serverConnectionsMock.ServerConnections
}));

const { PlaybackManager } = await import('components/playback/playbackmanager');
const { pluginManager } = await import('components/pluginManager');
const Events = (await import('utils/events')).default;

function mountManager() {
    const manager = new PlaybackManager();
    const player = createFakePlayer();
    player.id = 'htmlvideoplayer';
    Events.trigger(pluginManager, 'registered', [player]);
    return { manager, player };
}

describe('direct-play film journey', { timeout: 60000 }, () => {
    beforeEach(() => {
        postedPlaybackInfo.mockReset();
        postedPlaybackInfo.mockImplementation(createPlaybackInfoResponder({ [VIDEO_ITEM_ID]: [videoSource()] }));
        legacyStreamInfoBuilt.mockReset();
        createSession.mockReset();
        deleteSession.mockReset();
        deleteSession.mockResolvedValue({ data: undefined });
        fetchCalls.length = 0;
        alerts.length = 0;
        vi.stubGlobal('fetch', (url: string, init?: { method?: string }) => {
            fetchCalls.push({ url, method: init?.method });
            return Promise.resolve({ ok: true, status: 204 });
        });
    });

    it('plays from the session file route without PlaybackInfo or createStreamInfo, and releases on stop', async () => {
        createSession.mockResolvedValue({ data: { Id: SESSION_ID, Method: 'DirectPlay' } });
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(player.played).toHaveLength(1), { timeout: 20000, interval: 10 });

        const streamInfo = (player.played as Array<{ url: string; playMethod: string }>)[0];
        expect(streamInfo.url).toContain(`/Playback/Sessions/${SESSION_ID}/File?`);
        expect(streamInfo.url).toContain('playbackCapability=film-capability');
        expect(streamInfo.url).not.toMatch(/ApiKey|api_key/i);
        expect(streamInfo.playMethod).toBe('DirectPlay');
        expect(createSession).toHaveBeenCalledTimes(1);
        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();

        await manager.stop(player);
        // A real player answers stop() with its `stopped` event; the release hangs off that event.
        Events.trigger(player, 'stopped', [{}]);
        await vi.waitFor(() => expect(fetchCalls.filter((c) => c.method === 'DELETE')).toHaveLength(1), { timeout: 20000, interval: 10 });
        expect(fetchCalls[0].url).toBe(`http://127.0.0.1:8096/Playback/Sessions/${SESSION_ID}`);
    });

    it('releases the session before the legacy chain when the server decides a transcode, then plays without direct play', async () => {
        createSession.mockResolvedValue({ data: { Id: SESSION_ID, Method: 'Transcode' } });
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(postedPlaybackInfo).toHaveBeenCalled(), { timeout: 20000, interval: 10 });

        expect(createSession).toHaveBeenCalledTimes(1);
        expect(deleteSession).toHaveBeenCalledTimes(1);
        expect(deleteSession.mock.invocationCallOrder[0]).toBeLessThan(postedPlaybackInfo.mock.invocationCallOrder[0]);
        expect(postedPlaybackInfo.mock.calls[0][0].playbackInfoDto.EnableDirectPlay).toBe(false);
        await vi.waitFor(() => expect(player.played).toHaveLength(1), { timeout: 20000, interval: 10 });
    });

    it('ends the attempt on a refusal: no legacy chain, no playback', async () => {
        createSession.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403 } }));
        const { manager, player } = mountManager();

        await manager.play({ items: [videoItem()], startPositionTicks: 0 });
        await vi.waitFor(() => expect(alerts).toHaveLength(1), { timeout: 20000, interval: 10 });

        expect(postedPlaybackInfo).not.toHaveBeenCalled();
        expect(legacyStreamInfoBuilt).not.toHaveBeenCalled();
        expect(player.played).toHaveLength(0);
    });
});
