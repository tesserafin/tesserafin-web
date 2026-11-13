import { describe, expect, it, vi } from 'vitest';

import type { TesserafinApi } from 'lib/tesserafin-sdk/client';

import {
    SessionVideoError,
    isSessionVideoCandidate,
    newSessionVideoPlaySessionId,
    planSessionVideo
} from './sessionVideo';

const ITEM = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SOURCE = ITEM;
const SESSION = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

interface Call {
    method: string;
    url: string;
}

/** An axios stand-in answering the four routes this journey uses, recording every request. */
function fakeApi(answers: {
    create?: () => unknown;
    stream?: () => unknown;
    item?: () => unknown;
    del?: () => unknown;
}) {
    const calls: Call[] = [];
    const fail = (status: number) =>
        Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    const request = vi.fn(
        async (config: {
            method?: string;
            url?: string;
            signal?: AbortSignal;
        }) => {
            const method = (config.method ?? 'GET').toUpperCase();
            const url = config.url ?? '';
            calls.push({ method, url });
            const pick = (
                fn: (() => unknown) | undefined,
                fallback: unknown
            ) => {
                const value = fn ? fn() : fallback;
                // Like axios: a response that arrives after its signal aborted is discarded.
                if (config.signal?.aborted)
                    throw Object.assign(new Error('canceled'), {
                        code: 'ERR_CANCELED'
                    });
                if (typeof value === 'number') throw fail(value);
                return { data: value, status: 200 };
            };
            if (method === 'POST' && url.endsWith('/Playback/Sessions'))
                return pick(answers.create, {
                    Id: SESSION,
                    Method: 'DirectPlay',
                    SelectedStreams: {
                        Subtitle: { Index: 2, Delivery: 'External' }
                    }
                });
            if (method === 'GET' && url.includes('/Stream'))
                return pick(answers.stream, {
                    Url: `/Playback/Sessions/${SESSION}/File?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`,
                    MimeType: 'video/mp4',
                    Container: 'mp4',
                    Protocol: 'Http'
                });
            if (method === 'GET' && url.includes(`/Items/${ITEM}`))
                return pick(answers.item, {
                    Id: ITEM,
                    Name: 'Film',
                    MediaSources: [
                        {
                            Id: SOURCE,
                            MediaStreams: [
                                { Index: 0, Type: 'Video' },
                                {
                                    Index: 2,
                                    Type: 'Subtitle',
                                    Codec: 'subrip',
                                    IsTextSubtitleStream: true,
                                    IsExternal: true,
                                    Language: 'eng'
                                },
                                {
                                    Index: 3,
                                    Type: 'Subtitle',
                                    Codec: 'ass',
                                    IsTextSubtitleStream: true
                                },
                                {
                                    Index: 4,
                                    Type: 'Subtitle',
                                    Codec: 'PGSSUB',
                                    IsTextSubtitleStream: false
                                }
                            ]
                        }
                    ]
                });
            if (method === 'DELETE') return pick(answers.del, undefined);
            throw new Error(`unexpected ${method} ${url}`);
        }
    );
    const api = {
        basePath: 'http://server:8096',
        configuration: {
            basePath: 'http://server:8096',
            isJsonMime: () => true
        },
        axiosInstance: { request, defaults: {} }
    } as unknown as TesserafinApi;
    return { api, calls };
}

const params = (api: TesserafinApi) => ({
    api,
    itemId: ITEM,
    userId: 'u',
    playSessionId: 'ps',
    startPositionTicks: 0
});
const quiet = { debug: vi.fn(), warn: vi.fn() };
const subtitle = vi.fn(
    async (path: string) => `${path}?playbackCapability=SUB`
);

describe('isSessionVideoCandidate', () => {
    const html = { id: 'htmlvideoplayer', isLocalPlayer: true };
    it('owns local films and episodes on the HTML player', () => {
        expect(
            isSessionVideoCandidate(
                {
                    Id: ITEM,
                    Type: 'Movie',
                    MediaType: 'Video',
                    LocationType: 'FileSystem'
                },
                html
            )
        ).toBe(true);
        expect(
            isSessionVideoCandidate(
                { Id: ITEM, Type: 'Episode', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionVideoCandidate(
                {
                    Id: ITEM,
                    Type: 'Movie',
                    MediaType: 'Video',
                    LocationType: 'Remote'
                },
                html
            )
        ).toBe(false);
        expect(
            isSessionVideoCandidate(
                { Id: ITEM, Type: 'Movie', MediaType: 'Video' },
                { id: 'chromecast', isLocalPlayer: false }
            )
        ).toBe(false);
        expect(
            isSessionVideoCandidate(
                { Id: ITEM, Type: 'TvChannel', MediaType: 'Video' },
                html
            )
        ).toBe(false);
    });
    it.each(['Movie', 'Episode'])(
        'rejects remote, placeholder and cast %s items',
        (Type) => {
            const item = { Id: ITEM, Type, MediaType: 'Video' };
            expect(
                isSessionVideoCandidate(
                    { ...item, LocationType: 'Remote' },
                    html
                )
            ).toBe(false);
            expect(
                isSessionVideoCandidate({ ...item, IsPlaceHolder: true }, html)
            ).toBe(false);
            expect(
                isSessionVideoCandidate(item, {
                    id: 'chromecast',
                    isLocalPlayer: false
                })
            ).toBe(false);
        }
    );
});

describe('planSessionVideo', () => {
    it('plans a direct play from the session descriptor alone, with a capability and no durable token', async () => {
        const { api, calls } = fakeApi({});
        const mint = vi.fn(async () => 'CAP');
        const outcome = await planSessionVideo(params(api), {
            mintMediaCapability: mint,
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome.kind).toBe('planned');
        if (outcome.kind !== 'planned') return;
        expect(outcome.streamInfo.url).toBe(
            `http://server:8096/Playback/Sessions/${SESSION}/File?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps&playbackCapability=CAP`
        );
        expect(outcome.streamInfo.playSessionId).toBe('ps');
        expect(outcome.streamInfo.executionDecision).toMatchObject({
            source: 'v2',
            playbackSessionId: SESSION,
            playMethod: 'DirectPlay'
        });
        expect(mint).toHaveBeenCalledWith(ITEM, SOURCE, 'ps');
        expect(outcome.streamInfo.mediaSource.DefaultSubtitleStreamIndex).toBe(
            2
        );
        expect(outcome.streamInfo.mediaSource.MediaStreams?.[1]).toMatchObject({
            DeliveryMethod: 'External',
            DeliveryUrl: `/Videos/${ITEM}/${SOURCE}/Subtitles/2/0/Stream.vtt`
        });
        expect(
            outcome.streamInfo.mediaSource.MediaStreams?.[3]?.DeliveryMethod
        ).toBeUndefined();
        expect(outcome.streamInfo.textTracks).toEqual([
            {
                url: `http://server:8096/Videos/${ITEM}/${SOURCE}/Subtitles/2/0/Stream.vtt?playbackCapability=SUB`,
                language: 'eng',
                isDefault: true,
                index: 2,
                format: 'vtt'
            },
            {
                url: `http://server:8096/Videos/${ITEM}/${SOURCE}/Subtitles/3/0/Stream.ass?playbackCapability=SUB`,
                language: 'und',
                isDefault: false,
                index: 3,
                format: 'ass'
            }
        ]);
        expect(
            calls.map(
                (c) => c.method + ' ' + c.url.replace('http://server:8096', '')
            )
        ).toEqual([
            'POST /Playback/Sessions',
            `GET /Playback/Sessions/${SESSION}/Stream`,
            `GET /Items/${ITEM}?userId=u`
        ]);
        expect(calls.some((c) => /PlaybackInfo/i.test(c.url))).toBe(false);
    });

    it('plans a remux from the session HLS route: one audio rendition, native seek, no legacy url', async () => {
        const hls = `/Playback/Sessions/${SESSION}/Hls/main.m3u8?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`;
        const { api, calls } = fakeApi({
            create: () => ({
                Id: SESSION,
                Method: 'Remux',
                SelectedStreams: { Audio: 1, Subtitle: null }
            }),
            stream: () => ({
                Url: hls,
                MimeType: 'application/x-mpegURL',
                Container: 'mp4',
                Protocol: 'Hls'
            })
        });
        const mint = vi.fn(async () => 'CAP');
        const outcome = await planSessionVideo(
            { ...params(api), startPositionTicks: 50_000_000 },
            {
                mintMediaCapability: mint,
                authorizeSubtitle: subtitle,
                logger: quiet
            }
        );

        expect(outcome.kind).toBe('planned');
        if (outcome.kind !== 'planned') return;
        const { streamInfo } = outcome;
        expect(streamInfo.url).toBe(
            `http://server:8096${hls}&playbackCapability=CAP`
        );
        // The player's contract: a server-produced HLS stream, played by hls.js, sought natively.
        expect(streamInfo.playMethod).toBe('Transcode');
        expect(streamInfo.mimeType).toBe('application/x-mpegURL');
        expect(streamInfo.mediaSource.TranscodingSubProtocol).toBe('hls');
        expect(streamInfo.mediaSource.DefaultAudioStreamIndex).toBe(1);
        expect(streamInfo.mediaSource.DefaultSubtitleStreamIndex).toBe(-1);
        expect(streamInfo.transcodingOffsetTicks).toBe(0);
        expect(streamInfo.playerStartPositionTicks).toBe(50_000_000);
        expect(streamInfo.executionDecision).toMatchObject({
            source: 'v2',
            sessionOwned: true,
            method: 'Remux',
            playbackSessionId: SESSION,
            protocol: 'Hls',
            container: 'mp4'
        });
        // Text subtitles stay client-side tracks of the same item and source.
        expect(streamInfo.textTracks.map((t) => t.index)).toEqual([2, 3]);
        for (const legacy of [
            'ApiKey',
            'VideoCodec',
            'Static=',
            'PlaybackInfo',
            '/Videos/'
        ]) {
            expect(streamInfo.url).not.toContain(legacy);
        }
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
        expect(calls.some((c) => /PlaybackInfo/i.test(c.url))).toBe(false);
    });

    it('declines a remux the server does not serve from the session, releasing it first', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Remux' }),
            stream: () => ({
                Url: `/Videos/${ITEM}/master.m3u8?MediaSourceId=${SOURCE}&ApiKey=secret`,
                Protocol: 'Hls',
                Container: 'ts'
            })
        });
        const mint = vi.fn(async () => 'CAP');
        const outcome = await planSessionVideo(params(api), {
            mintMediaCapability: mint,
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome).toEqual({
            kind: 'notApplicable',
            reason: 'server decided an output it does not serve from the session'
        });
        expect(mint).not.toHaveBeenCalled();
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('refuses a direct-play descriptor that names another session', async () => {
        const { api, calls } = fakeApi({
            stream: () => ({
                Url: `/Playback/Sessions/cccccccccccccccccccccccccccccccc/File?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`,
                Protocol: 'Http'
            })
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(async () => 'CAP'),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'failed' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('releases the session before falling back when the server decides a transcode', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({ Url: '/Videos/film/master.m3u8', Protocol: 'Hls' })
        });
        const outcome = await planSessionVideo(params(api), {
            mintMediaCapability: vi.fn(),
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome).toEqual({
            kind: 'notApplicable',
            reason: 'server decided an output it does not serve from the session'
        });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('falls back without a session to release when no direct plan is viable (422)', async () => {
        const { api, calls } = fakeApi({ create: () => 422 });
        const outcome = await planSessionVideo(params(api), {
            mintMediaCapability: vi.fn(),
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome.kind).toBe('notApplicable');
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    });

    it.each([
        [401, 'unauthenticated'],
        [403, 'forbidden'],
        [404, 'notFound'],
        [500, 'failed']
    ])(
        'ends the attempt on a %i from POST instead of falling back',
        async (status, failure) => {
            const { api } = fakeApi({ create: () => status });
            await expect(
                planSessionVideo(params(api), {
                    mintMediaCapability: vi.fn(),
                    authorizeSubtitle: subtitle,
                    logger: quiet
                })
            ).rejects.toMatchObject({
                name: 'SessionVideoError',
                failure,
                status
            });
        }
    );

    it('releases the session and keeps the original error when the descriptor is refused', async () => {
        const { api, calls } = fakeApi({ stream: () => 403 });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'forbidden', status: 403 });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('keeps the original error when releasing also fails', async () => {
        const { api } = fakeApi({ stream: () => 401, del: () => 500 });
        const logger = { debug: vi.fn(), warn: vi.fn() };
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger
            })
        ).rejects.toMatchObject({ failure: 'unauthenticated', status: 401 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('releases the session when the credential broker fails', async () => {
        const { api, calls } = fakeApi({});
        const brokerError = Object.assign(new Error('mint refused'), {
            response: { status: 403 }
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(async () => {
                    throw brokerError;
                }),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toBeInstanceOf(SessionVideoError);
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('releases the session when the start is cancelled while minting', async () => {
        const { api, calls } = fakeApi({});
        const controller = new AbortController();
        const mint = vi.fn(async () => {
            controller.abort();
            return 'CAP';
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: mint,
                authorizeSubtitle: subtitle,
                signal: controller.signal,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'cancelled' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });
});

describe('planSessionVideo review fixes (#404)', () => {
    it('does not fall back if the start is cancelled while deleting the declined session', async () => {
        const controller = new AbortController();
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({
                Url: '/Videos/film/master.m3u8',
                Protocol: 'Hls'
            }),
            del: () => {
                controller.abort();
            }
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                signal: controller.signal,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'cancelled' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('releases a session the server created while the start was being cancelled', async () => {
        const controller = new AbortController();
        const { api, calls } = fakeApi({
            create: () => {
                // The answer arrives after the user cancelled: the session exists server-side.
                controller.abort();
                return { Id: SESSION, Method: 'DirectPlay' };
            }
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                signal: controller.signal,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'cancelled' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
        expect(calls.some((c) => c.url.includes('/Stream'))).toBe(false);
    });

    it('does not fall back when the declined session could not be released', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({
                Url: '/Videos/film/master.m3u8',
                Protocol: 'Hls'
            }),
            del: () => 500
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({
            name: 'SessionVideoError',
            failure: 'failed',
            status: 500
        });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('still falls back when the declined session is already gone (404)', async () => {
        const { api } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({
                Url: '/Videos/film/master.m3u8',
                Protocol: 'Hls'
            }),
            del: () => 404
        });
        await expect(
            planSessionVideo(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).resolves.toMatchObject({ kind: 'notApplicable' });
    });
});

describe('newSessionVideoPlaySessionId', () => {
    it('is 128 random bits in hex', () => {
        const a = newSessionVideoPlaySessionId();
        expect(a).toMatch(/^[0-9a-f]{32}$/);
        expect(newSessionVideoPlaySessionId()).not.toBe(a);
    });
});
