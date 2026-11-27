import { describe, expect, it, vi } from 'vitest';

import type { TesserafinApi } from 'lib/tesserafin-sdk/client';

import {
    SessionMediaError,
    isSessionMediaCandidate,
    newSessionMediaPlaySessionId,
    planSessionMedia
} from './sessionMedia';

const ITEM = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SOURCE = ITEM;
const SESSION = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

interface Call {
    method: string;
    url: string;
    data?: { Constraints?: Record<string, unknown> };
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
            data?: unknown;
            signal?: AbortSignal;
        }) => {
            const method = (config.method ?? 'GET').toUpperCase();
            const url = config.url ?? '';
            calls.push({
                method,
                url,
                data:
                    typeof config.data === 'string'
                        ? JSON.parse(config.data)
                        : undefined
            });
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
                if (value instanceof Error) throw value;
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
                            ],
                            MediaAttachments: [
                                {
                                    Index: 5,
                                    MimeType: 'font/ttf',
                                    FileName: 'font.ttf'
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

describe('isSessionMediaCandidate', () => {
    const html = { id: 'htmlvideoplayer', isLocalPlayer: true };
    it('owns a library video on the local html player only', () => {
        expect(
            isSessionMediaCandidate(
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
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Episode', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Video', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'MusicVideo', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Trailer', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Recording', MediaType: 'Video' },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'ChannelVideoItem', MediaType: 'Video' },
                html
            )
        ).toBe(false);
        // A remote file (its path a url): the server reads it from the session or refuses it.
        expect(
            isSessionMediaCandidate(
                {
                    Id: ITEM,
                    Type: 'Movie',
                    MediaType: 'Video',
                    LocationType: 'Remote'
                },
                html
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Movie', MediaType: 'Video' },
                { id: 'chromecast', isLocalPlayer: false }
            )
        ).toBe(false);
    });

    it.each([
        ['Movie', 'Video', 'htmlvideoplayer'],
        ['Audio', 'Audio', 'htmlaudioplayer'],
        ['AudioBook', 'Audio', 'htmlaudioplayer']
    ])(
        'owns a remote channel-plugin %s on the local HTML player',
        (type, mediaType, playerId) => {
            const item = {
                Id: ITEM,
                Type: type,
                MediaType: mediaType,
                LocationType: 'Remote',
                SourceType: 'Channel'
            };
            expect(
                isSessionMediaCandidate(item, {
                    id: playerId,
                    isLocalPlayer: true
                })
            ).toBe(true);
            expect(
                isSessionMediaCandidate(item, {
                    id: 'chromecast',
                    isLocalPlayer: false
                })
            ).toBe(false);
        }
    );

    it('owns a Live TV recording, finished or still being written, on the local html video player', () => {
        const videoPlayer = { id: 'htmlvideoplayer', isLocalPlayer: true };
        for (const Status of ['InProgress', 'Completed']) {
            const recording = {
                Id: ITEM,
                Type: 'Recording',
                MediaType: 'Video',
                LocationType: 'FileSystem',
                Status
            };
            expect(isSessionMediaCandidate(recording, videoPlayer)).toBe(true);
            expect(
                isSessionMediaCandidate(recording, {
                    id: 'chromecast',
                    isLocalPlayer: false
                })
            ).toBe(false);
        }
    });

    it('owns a Live TV channel on the local html video player only', () => {
        const videoPlayer = { id: 'htmlvideoplayer', isLocalPlayer: true };
        const channel = {
            Id: ITEM,
            Type: 'TvChannel',
            MediaType: 'Video',
            LocationType: 'Remote'
        };
        expect(isSessionMediaCandidate(channel, videoPlayer)).toBe(true);
        expect(
            isSessionMediaCandidate(channel, {
                id: 'htmlaudioplayer',
                isLocalPlayer: true
            })
        ).toBe(false);
        expect(
            isSessionMediaCandidate(channel, {
                id: 'chromecast',
                isLocalPlayer: false
            })
        ).toBe(false);
    });

    it('owns a library audio track or audiobook on the local html audio player only', () => {
        const audioPlayer = { id: 'htmlaudioplayer', isLocalPlayer: true };
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Audio', MediaType: 'Audio' },
                audioPlayer
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Audio', MediaType: 'Audio' },
                html
            )
        ).toBe(false);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'AudioBook', MediaType: 'Audio' },
                audioPlayer
            )
        ).toBe(true);
        expect(
            isSessionMediaCandidate(
                {
                    Id: ITEM,
                    Type: 'Audio',
                    MediaType: 'Audio',
                    LocationType: 'Remote'
                },
                audioPlayer
            )
        ).toBe(true);
        // A virtual item has nothing to play: refused by the caller, never another chain.
        expect(
            isSessionMediaCandidate(
                {
                    Id: ITEM,
                    Type: 'Audio',
                    MediaType: 'Audio',
                    LocationType: 'Virtual'
                },
                audioPlayer
            )
        ).toBe(false);
        expect(
            isSessionMediaCandidate(
                { Id: ITEM, Type: 'Audio', MediaType: 'Audio' },
                { id: 'chromecast', isLocalPlayer: false }
            )
        ).toBe(false);
    });
});

describe('planSessionMedia', () => {
    it('plans a direct play from the session descriptor alone, with a capability and no durable token', async () => {
        const { api, calls } = fakeApi({});
        const mint = vi.fn(async () => 'CAP');
        const outcome = await planSessionMedia(params(api), {
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
        expect(outcome.streamInfo.mediaSource.MediaAttachments).toEqual([
            {
                Index: 5,
                MimeType: 'font/ttf',
                FileName: 'font.ttf',
                DeliveryUrl: `/Videos/${ITEM}/${SOURCE}/Attachments/5`
            }
        ]);
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
        const outcome = await planSessionMedia(
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

    it('plans an audio transcode from the session HLS route as an audio stream', async () => {
        const hls = `/Playback/Sessions/${SESSION}/Hls/main.m3u8?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`;
        const { api, calls } = fakeApi({
            create: () => ({
                Id: SESSION,
                Method: 'Transcode',
                SelectedStreams: { Audio: 0, Subtitle: null }
            }),
            stream: () => ({
                Url: hls,
                MimeType: 'application/x-mpegURL',
                Container: 'mp4',
                Protocol: 'Hls'
            }),
            item: () => ({
                Id: ITEM,
                Name: 'Track',
                Type: 'Audio',
                MediaType: 'Audio',
                MediaSources: [
                    {
                        Id: SOURCE,
                        Container: 'asf',
                        MediaStreams: [
                            { Index: 0, Type: 'Audio', Codec: 'wmav2' }
                        ]
                    }
                ]
            })
        });
        const outcome = await planSessionMedia(params(api), {
            mintMediaCapability: vi.fn(async () => 'CAP'),
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome.kind).toBe('planned');
        if (outcome.kind !== 'planned') return;
        const { streamInfo } = outcome;
        expect(streamInfo.mediaType).toBe('Audio');
        expect(streamInfo.url).toBe(
            `http://server:8096${hls}&playbackCapability=CAP`
        );
        expect(streamInfo.playMethod).toBe('Transcode');
        expect(streamInfo.mediaSource.TranscodingSubProtocol).toBe('hls');
        expect(streamInfo.mediaSource.DefaultAudioStreamIndex).toBe(0);
        expect(streamInfo.textTracks).toEqual([]);
        expect(streamInfo.executionDecision).toMatchObject({
            source: 'v2',
            sessionOwned: true,
            method: 'Transcode',
            playbackSessionId: SESSION
        });
        expect(streamInfo.url).not.toMatch(/\/Audio\/|universal|ApiKey/);
        expect(calls.some((c) => /PlaybackInfo|\/Audio\//i.test(c.url))).toBe(
            false
        );
    });

    it('plays a Live TV channel from the session live playlist', async () => {
        const live = `/Playback/Sessions/${SESSION}/Hls/live.m3u8?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`;
        const { api, calls } = fakeApi({
            create: () => ({
                Id: SESSION,
                Method: 'Remux',
                SelectedStreams: { Audio: 1 }
            }),
            stream: () => ({
                Url: live,
                MimeType: 'application/x-mpegURL',
                Container: 'mp4',
                Protocol: 'Hls'
            }),
            // A channel lists no media source of its own.
            item: () => ({
                Id: ITEM,
                Name: 'Channel',
                Type: 'TvChannel',
                MediaType: 'Video'
            })
        });
        const outcome = await planSessionMedia(params(api), {
            mintMediaCapability: vi.fn(async () => 'CAP'),
            authorizeSubtitle: subtitle,
            logger: quiet
        });

        expect(outcome.kind).toBe('planned');
        if (outcome.kind !== 'planned') return;
        expect(outcome.streamInfo.url).toBe(
            `http://server:8096${live}&playbackCapability=CAP`
        );
        expect(outcome.streamInfo.playMethod).toBe('Transcode');
        expect(outcome.streamInfo.mediaSource.TranscodingSubProtocol).toBe(
            'hls'
        );
        expect(outcome.streamInfo.mediaSource).toMatchObject({
            Id: SOURCE,
            IsInfiniteStream: true
        });
        expect(outcome.streamInfo.liveStreamId).toBeUndefined();
        expect(
            calls.some((c) =>
                /PlaybackInfo|LiveStreams|LiveStreamFiles/i.test(c.url)
            )
        ).toBe(false);
    });

    it('ends with a contract error, releasing the session, when a remux is not served from the session', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Remux' }),
            stream: () => ({
                Url: `/Videos/${ITEM}/master.m3u8?MediaSourceId=${SOURCE}&ApiKey=secret`,
                Protocol: 'Hls',
                Container: 'ts'
            })
        });
        const mint = vi.fn(async () => 'CAP');

        // tesserafin#129 audit W2: a descriptor naming no route of the session is a contract
        // error, never a fallback to PlaybackInfo.
        await expect(
            planSessionMedia(params(api), {
                mintMediaCapability: mint,
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({
            name: 'SessionMediaError',
            failure: 'failed'
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
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(async () => 'CAP'),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'failed' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('plans a transcode from the session HLS route, like a remux, and names no encoding option', async () => {
        const hls = `/Playback/Sessions/${SESSION}/Hls/main.m3u8?itemId=${ITEM}&mediaSourceId=${SOURCE}&playSessionId=ps`;
        const { api, calls } = fakeApi({
            create: () => ({
                Id: SESSION,
                Method: 'Transcode',
                SelectedStreams: { Audio: 2, Subtitle: { Index: 2 } }
            }),
            stream: () => ({
                Url: hls,
                MimeType: 'application/x-mpegURL',
                Container: 'mp4',
                Protocol: 'Hls'
            })
        });
        const outcome = await planSessionMedia(
            {
                ...params(api),
                startPositionTicks: 70_000_000,
                maxBitrate: 1_500_000,
                preferredAudioStreamIndex: 2,
                allowVideoStreamCopy: false
            },
            {
                mintMediaCapability: vi.fn(async () => 'CAP'),
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
        expect(streamInfo.playMethod).toBe('Transcode');
        expect(streamInfo.mediaSource.TranscodingSubProtocol).toBe('hls');
        expect(streamInfo.mediaSource.DefaultAudioStreamIndex).toBe(2);
        expect(streamInfo.mediaSource.DefaultSubtitleStreamIndex).toBe(2);
        // The playlist describes the whole film: the resume is the player's seek, in media time.
        expect(streamInfo.transcodingOffsetTicks).toBe(0);
        expect(streamInfo.playerStartPositionTicks).toBe(70_000_000);
        expect(streamInfo.executionDecision).toMatchObject({
            source: 'v2',
            sessionOwned: true,
            method: 'Transcode',
            playbackSessionId: SESSION
        });
        // What the change asked for went to the server as constraints, not into the url.
        const post = calls.find((c) => c.method === 'POST');
        expect(post?.data?.Constraints).toMatchObject({
            MaxBitrate: 1_500_000,
            PreferredAudioStreamIndex: 2,
            AllowVideoStreamCopy: false
        });
        for (const legacy of [
            'ApiKey',
            'VideoCodec',
            'AudioCodec',
            'VideoBitrate',
            'MaxStreamingBitrate',
            'AudioStreamIndex',
            '/Videos/'
        ]) {
            expect(streamInfo.url).not.toContain(legacy);
        }
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
        expect(calls.some((c) => /PlaybackInfo/i.test(c.url))).toBe(false);
    });

    it('ends with a contract error, releasing the session, when a transcode is not served from the session', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({
                Url: `/Videos/${ITEM}/master.m3u8?MediaSourceId=${SOURCE}&VideoCodec=h264`,
                Protocol: 'Hls',
                Container: 'ts'
            })
        });

        await expect(
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'failed' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('is refused, with the reason the server named, when the server answers 422', async () => {
        const refused = Object.assign(new Error('HTTP 422'), {
            response: {
                status: 422,
                data: { reason: 'ToneMappingUnavailable' }
            }
        });
        const { api, calls } = fakeApi({ create: () => refused });

        await expect(
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({
            name: 'SessionMediaError',
            failure: 'refused',
            status: 422,
            reason: 'ToneMappingUnavailable'
        });
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
                planSessionMedia(params(api), {
                    mintMediaCapability: vi.fn(),
                    authorizeSubtitle: subtitle,
                    logger: quiet
                })
            ).rejects.toMatchObject({
                name: 'SessionMediaError',
                failure,
                status
            });
        }
    );

    it('releases the session and keeps the original error when the descriptor is refused', async () => {
        const { api, calls } = fakeApi({ stream: () => 403 });
        await expect(
            planSessionMedia(params(api), {
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
            planSessionMedia(params(api), {
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
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(async () => {
                    throw brokerError;
                }),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toBeInstanceOf(SessionMediaError);
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
            planSessionMedia(params(api), {
                mintMediaCapability: mint,
                authorizeSubtitle: subtitle,
                signal: controller.signal,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'cancelled' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });
});

describe('planSessionMedia review fixes (#404)', () => {
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
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                signal: controller.signal,
                logger: quiet
            })
        ).rejects.toMatchObject({ failure: 'cancelled' });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
        expect(calls.some((c) => c.url.includes('/Stream'))).toBe(false);
    });

    it('throws the contract error, not the release failure, when the session cannot be released', async () => {
        const { api, calls } = fakeApi({
            create: () => ({ Id: SESSION, Method: 'Transcode' }),
            stream: () => ({
                Url: `/Videos/${ITEM}/master.m3u8?MediaSourceId=${SOURCE}&VideoCodec=h264`,
                Protocol: 'Hls',
                Container: 'ts'
            }),
            del: () => 500
        });
        await expect(
            planSessionMedia(params(api), {
                mintMediaCapability: vi.fn(),
                authorizeSubtitle: subtitle,
                logger: quiet
            })
        ).rejects.toMatchObject({
            name: 'SessionMediaError',
            failure: 'failed',
            message: 'GET .../Stream: descriptor names no route of this session'
        });
        expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });
});

describe('newSessionMediaPlaySessionId', () => {
    it('is 128 random bits in hex', () => {
        const a = newSessionMediaPlaySessionId();
        expect(a).toMatch(/^[0-9a-f]{32}$/);
        expect(newSessionMediaPlaySessionId()).not.toBe(a);
    });
});
