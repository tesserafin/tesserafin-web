/**
 * Consolidation step 1, first journey (server `docs/playback-path-inventory.md` §4): a film read
 * from a local file plays through `Playback/Sessions` alone.
 *
 * The chain is `POST Playback/Sessions` → `GET .../Stream` → the session's own file route, through
 * the generated Tesserafin SDK configured from a `TesserafinApi` - never the `@jellyfin/sdk` `Api`
 * object, never `PlaybackInfo`, never the legacy `createStreamInfo`. The server decides with the v2
 * engine alone; this module only executes what it decided.
 *
 * Outcomes are deliberately three, not two:
 *  - `planned`: the server decided a direct play; the caller plays `streamInfo` and owns `session`.
 *  - `notApplicable`: the server decided something this journey does not cover (remux, transcode,
 *    no viable direct plan). The session it created is released first, then the caller continues
 *    with the existing chain - with direct play disabled, so the old direct-play path of a film
 *    cannot come back that way.
 *  - a thrown {@link DirectPlayFilmError}: authentication, authorization, a vanished session or any
 *    other failure ends the attempt. It never falls back. When releasing the session also fails, the
 *    original error is the one thrown.
 */

import type { AxiosError } from 'axios';

import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { LibraryApi } from 'lib/tesserafin-sdk/generated/api/library-api';
import { PlaybackApi } from 'lib/tesserafin-sdk/generated/api/playback-api';
import type { BaseItemDto } from 'lib/tesserafin-sdk/generated/models/base-item-dto';
import type { MediaSourceInfo } from 'lib/tesserafin-sdk/generated/models/media-source-info';
import type { PlaybackSessionStreamDescriptor } from 'lib/tesserafin-sdk/generated/models/playback-session-stream-descriptor';
import {
    buildRetryMetadata,
    type PlaybackRetryMetadata
} from 'scripts/playbackExecutionDecision';
import {
    buildClientCapabilities,
    buildPlaybackConstraints,
    type PlaybackCapabilityInputs
} from 'scripts/tesserafinPlaybackCapabilities';

const LOG_PREFIX = '[direct-play-film]';

/**
 * A play session id for the file route and every `/Sessions/Playing*` report of this playback:
 * 128 random bits, hex. `crypto.getRandomValues` exists outside secure contexts too (a LAN server
 * over plain HTTP), unlike `crypto.randomUUID`.
 */
export function newDirectPlayFilmPlaySessionId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export {
    isDirectPlayFilmCandidate,
    type DirectPlayFilmCandidate
} from './directPlayFilmCandidate';

export interface DirectPlayFilmParams {
    api: TesserafinApi;
    itemId: string;
    userId: string;
    mediaSourceId?: string | null;
    /** Defaults to {@link newDirectPlayFilmPlaySessionId}. */
    playSessionId?: string;
    playbackAttemptId?: string;
    startPositionTicks?: number;
    maxBitrate?: number | null;
    preferredAudioStreamIndex?: number | null;
    preferredSubtitleStreamIndex?: number | null;
    capabilityInputs?: PlaybackCapabilityInputs;
}

export interface DirectPlayFilmDeps {
    /** Mints the `Media` capability for the file route (the existing credential broker). */
    mintMediaCapability: (
        itemId: string,
        mediaSourceId: string,
        playSessionId: string
    ) => Promise<string>;
    /** Adds the `Subtitles` capability to a server-relative subtitle url (the existing broker). */
    authorizeSubtitle: (
        relativeUrl: string,
        itemId: string,
        mediaSourceId: string,
        playSessionId: string
    ) => Promise<string>;
    /** Aborted when the play request is replaced or cancelled. */
    signal?: AbortSignal;
    logger?: Pick<Console, 'debug' | 'warn'>;
}

/** What the player is handed: the same fields the legacy player contract reads, built from the
 * session's descriptor only. */
export interface DirectPlayFilmStreamInfo {
    url: string;
    mimeType: string | undefined;
    transcodingOffsetTicks: 0;
    playMethod: 'DirectPlay';
    playerStartPositionTicks: number;
    item: BaseItemDto;
    mediaSource: MediaSourceInfo;
    textTracks: DirectPlayFilmTextTrack[];
    mediaType: 'Video';
    liveStreamId: undefined;
    playSessionId: string;
    title: string | null | undefined;
    executionDecision: {
        source: 'v2';
        url: string;
        playMethod: 'DirectPlay';
        mimeType: string | undefined;
        transcodingOffsetTicks: 0;
        playSessionId: string;
        playbackSessionId: string;
        protocol: string | undefined;
        container: string | undefined;
        retry: PlaybackRetryMetadata;
    };
}

export interface DirectPlayFilmTextTrack {
    url: string;
    language: string;
    isDefault: boolean;
    index: number;
    format: string;
}

/**
 * The text subtitle tracks the player offers for a direct-played file, each served by the
 * subtitle route of this item and media source: the same tracks the legacy chain offered, without
 * the `PlaybackInfo` decision that used to name them. ASS/SSA keep their format for the player's
 * renderer; every other text format is delivered as WebVTT. Image subtitles cannot accompany a
 * direct play and are not offered.
 */
export function directPlayTextTracks(
    itemId: string,
    mediaSource: MediaSourceInfo,
    defaultIndex: number | null | undefined
): Array<Omit<DirectPlayFilmTextTrack, 'url'> & { path: string }> {
    return (mediaSource.MediaStreams ?? [])
        .filter(
            (stream) =>
                stream.Type === 'Subtitle' &&
                stream.IsTextSubtitleStream &&
                stream.Index != null
        )
        .map((stream) => {
            const codec = (stream.Codec ?? '').toLowerCase();
            const format = codec === 'ass' || codec === 'ssa' ? codec : 'vtt';
            return {
                path: `/Videos/${itemId}/${encodeURIComponent(mediaSource.Id ?? '')}/Subtitles/${stream.Index}/0/Stream.${format}`,
                language: stream.Language || 'und',
                isDefault: stream.Index === defaultIndex,
                index: stream.Index as number,
                format
            };
        });
}

export interface DirectPlayFilmSession {
    id: string;
    /** DELETE the session. Idempotent; rejects only if the server could not be reached or refused. */
    release: () => Promise<void>;
}

export type DirectPlayFilmOutcome =
    | {
          kind: 'planned';
          streamInfo: DirectPlayFilmStreamInfo;
          session: DirectPlayFilmSession;
      }
    | { kind: 'notApplicable'; reason: string };

export type DirectPlayFilmFailure =
    | 'unauthenticated'
    | 'forbidden'
    | 'notFound'
    | 'cancelled'
    | 'failed';

export class DirectPlayFilmError extends Error {
    readonly failure: DirectPlayFilmFailure;
    readonly status: number | undefined;
    readonly detail: unknown;

    constructor(
        failure: DirectPlayFilmFailure,
        message: string,
        status?: number,
        detail?: unknown
    ) {
        super(message);
        this.detail = detail;
        this.name = 'DirectPlayFilmError';
        this.failure = failure;
        this.status = status;
    }
}

const statusOf = (err: unknown): number | undefined =>
    (err as AxiosError | undefined)?.response?.status;

function classify(
    stage: string,
    err: unknown,
    signal?: AbortSignal
): DirectPlayFilmError {
    if (err instanceof DirectPlayFilmError) return err;
    if (signal?.aborted) {
        return new DirectPlayFilmError(
            'cancelled',
            `${stage}: cancelled`,
            undefined,
            err
        );
    }
    const status = statusOf(err);
    const byStatus: Record<number, DirectPlayFilmFailure> = {
        401: 'unauthenticated',
        403: 'forbidden',
        404: 'notFound'
    };
    const failure: DirectPlayFilmFailure =
        (status !== undefined && byStatus[status]) || 'failed';
    return new DirectPlayFilmError(
        failure,
        `${stage}: ${status ?? 'no response'}`,
        status,
        err
    );
}

function throwIfCancelled(
    signal: AbortSignal | undefined,
    stage: string
): void {
    if (signal?.aborted) {
        throw new DirectPlayFilmError('cancelled', `${stage}: cancelled`);
    }
}

/** The descriptor URL is server-relative; the capability goes in the query, never a durable token. */
function absoluteMediaUrl(
    api: TesserafinApi,
    relative: string,
    capability: string
): string {
    const separator = relative.includes('?') ? '&' : '?';
    return `${api.basePath}${relative.startsWith('/') ? '' : '/'}${relative}${separator}playbackCapability=${encodeURIComponent(capability)}`;
}

function mediaSourceIdOf(descriptorUrl: string): string | null {
    const query = descriptorUrl.split('?')[1] ?? '';
    return new URLSearchParams(query).get('mediaSourceId');
}

/**
 * Plans the playback of a film through `Playback/Sessions` alone. See the module comment for the
 * three outcomes.
 */
export async function planDirectPlayFilm(
    params: DirectPlayFilmParams,
    deps: DirectPlayFilmDeps
): Promise<DirectPlayFilmOutcome> {
    const logger = deps.logger ?? console;
    const api = params.api;
    const signal = deps.signal;
    const playSessionId =
        params.playSessionId ?? newDirectPlayFilmPlaySessionId();
    const playback = new PlaybackApi(
        api.configuration,
        undefined,
        api.axiosInstance
    );
    const requestOptions = { signal };

    throwIfCancelled(signal, 'start');

    let sessionId: string;
    let method: string | undefined;
    let selectedSubtitle: number | null = null;
    try {
        const { data } = await playback.createPlaybackSession(
            {
                createPlaybackSessionRequest: {
                    ItemId: params.itemId,
                    UserId: params.userId,
                    MediaSourceId: params.mediaSourceId ?? undefined,
                    PlaySessionId: playSessionId,
                    PlaybackAttemptId: params.playbackAttemptId,
                    Capabilities: buildClientCapabilities(
                        params.capabilityInputs
                    ),
                    Constraints: buildPlaybackConstraints({
                        startTimeTicks: params.startPositionTicks ?? 0,
                        maxBitrate: params.maxBitrate ?? null,
                        preferredAudioStreamIndex:
                            params.preferredAudioStreamIndex ?? null,
                        preferredSubtitleStreamIndex:
                            params.preferredSubtitleStreamIndex ?? null
                    })
                }
            },
            // Deliberately NOT cancellable: once the server may have created the session, only
            // its id lets this client release it. A cancellation that arrives during the POST is
            // honoured as soon as the answer is in (below), by releasing what was created.
            {}
        );
        if (!data.Id) {
            throw new DirectPlayFilmError(
                'failed',
                'POST Playback/Sessions: no session id'
            );
        }
        sessionId = data.Id;
        method = data.Method;
        // The server's own subtitle choice (user preferences, forced/default flags) is the default track.
        selectedSubtitle = data.SelectedStreams?.Subtitle?.Index ?? null;
    } catch (err) {
        // 422: no direct plan the declared capabilities allow - a decision, not a refusal.
        if (statusOf(err) === 422) {
            return { kind: 'notApplicable', reason: 'no viable plan' };
        }
        throw classify('POST Playback/Sessions', err);
    }

    let released = false;
    const release = async (): Promise<void> => {
        if (released) return;
        released = true;
        try {
            await playback.deletePlaybackSession({ id: sessionId });
        } catch (err) {
            if (statusOf(err) === 404) return; // already gone: released.
            released = false;
            throw err;
        }
    };
    const session: DirectPlayFilmSession = { id: sessionId, release };

    // Every exit below that does not hand the session to the caller releases it. A release failure
    // is logged; the original reason is what the caller sees.
    const abandon = async (reason: unknown): Promise<never> => {
        try {
            await release();
        } catch (releaseError) {
            logger.warn(
                `${LOG_PREFIX} session ${sessionId} could not be released after an abandoned start`,
                releaseError
            );
        }
        throw reason;
    };

    if (signal?.aborted) {
        return abandon(
            new DirectPlayFilmError(
                'cancelled',
                'POST Playback/Sessions: cancelled'
            )
        );
    }

    if (method !== 'DirectPlay') {
        // The existing chain may only start once this session is gone: a release that failed
        // ends the attempt instead of risking two live sessions for one playback.
        try {
            await release();
        } catch (releaseError) {
            throw new DirectPlayFilmError(
                'failed',
                `session ${sessionId} (${method ?? 'no method'}) could not be released before falling back`,
                statusOf(releaseError),
                releaseError
            );
        }
        return {
            kind: 'notApplicable',
            reason: `server decided ${method ?? 'nothing'}`
        };
    }

    try {
        throwIfCancelled(signal, 'decision');
        const { data: descriptor } = await playback.getPlaybackSessionStream(
            { id: sessionId },
            requestOptions
        );
        const stream = descriptor as PlaybackSessionStreamDescriptor;
        const mediaSourceId = stream.Url ? mediaSourceIdOf(stream.Url) : null;
        if (!stream.Url || !mediaSourceId) {
            throw new DirectPlayFilmError(
                'failed',
                'GET .../Stream: descriptor names no file'
            );
        }

        const library = new LibraryApi(
            api.configuration,
            undefined,
            api.axiosInstance
        );
        const { data: item } = await library.getItem(
            { itemId: params.itemId, userId: params.userId },
            requestOptions
        );
        const mediaSource = item.MediaSources?.find(
            (source) => source.Id === mediaSourceId
        );
        if (!mediaSource) {
            throw new DirectPlayFilmError(
                'notFound',
                `item ${params.itemId} has no media source ${mediaSourceId}`
            );
        }

        throwIfCancelled(signal, 'capability');
        const capability = await deps.mintMediaCapability(
            params.itemId,
            mediaSourceId,
            playSessionId
        );
        throwIfCancelled(signal, 'capability');

        const url = absoluteMediaUrl(api, stream.Url, capability);
        const textTracks: DirectPlayFilmTextTrack[] = [];
        const trackPaths = new Map<number, string>();
        for (const track of directPlayTextTracks(
            params.itemId,
            mediaSource,
            selectedSubtitle ?? params.preferredSubtitleStreamIndex ?? -1
        )) {
            const { path, ...rest } = track;
            trackPaths.set(rest.index, path);
            const authorized = await deps.authorizeSubtitle(
                path,
                params.itemId,
                mediaSourceId,
                playSessionId
            );
            textTracks.push({ ...rest, url: `${api.basePath}${authorized}` });
        }
        throwIfCancelled(signal, 'subtitles');
        logger.debug(
            `${LOG_PREFIX} item ${params.itemId}: direct play from session ${sessionId}`
        );
        return {
            kind: 'planned',
            session,
            streamInfo: {
                url,
                mimeType: stream.MimeType ?? undefined,
                transcodingOffsetTicks: 0,
                playMethod: 'DirectPlay',
                playerStartPositionTicks: params.startPositionTicks ?? 0,
                item,
                // The server's selected subtitle is the source's default (-1: none).
                mediaSource: {
                    ...mediaSource,
                    DefaultSubtitleStreamIndex:
                        selectedSubtitle ??
                        params.preferredSubtitleStreamIndex ??
                        -1,
                    // The player reads a text track's delivery off the stream itself, as
                    // PlaybackInfo used to set it: External, at the subtitle route (the player
                    // adds the Subtitles capability through playbackManager.getSubtitleUrl).
                    MediaStreams: (mediaSource.MediaStreams ?? []).map(
                        (stream) => {
                            const track = trackPaths.get(stream.Index ?? -1);
                            return track
                                ? {
                                      ...stream,
                                      DeliveryMethod: 'External',
                                      DeliveryUrl: track,
                                      IsExternalUrl: false
                                  }
                                : stream;
                        }
                    )
                },
                textTracks,
                mediaType: 'Video',
                liveStreamId: undefined,
                playSessionId: playSessionId,
                title: item.Name,
                executionDecision: {
                    source: 'v2',
                    url,
                    playMethod: 'DirectPlay',
                    mimeType: stream.MimeType ?? undefined,
                    transcodingOffsetTicks: 0,
                    playSessionId: playSessionId,
                    playbackSessionId: sessionId,
                    protocol: stream.Protocol ?? undefined,
                    container: stream.Container ?? undefined,
                    retry: buildRetryMetadata('DirectPlay', null)
                }
            }
        };
    } catch (err) {
        return abandon(classify('direct play start', err, signal));
    }
}
