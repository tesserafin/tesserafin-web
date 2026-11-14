import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import type { BaseItemDto } from 'lib/tesserafin-sdk/generated/models/base-item-dto';
import type { PlaybackProgressInfo } from 'lib/tesserafin-sdk/generated/models/playback-progress-info';
import type { PlaybackStartInfo } from 'lib/tesserafin-sdk/generated/models/playback-start-info';
import type { PlaybackStopInfo } from 'lib/tesserafin-sdk/generated/models/playback-stop-info';
import type { QueueItem } from 'lib/tesserafin-sdk/generated/models/queue-item';

export type PlaybackReportKind = 'start' | 'progress' | 'stop';

export type ReportInfo = PlaybackStartInfo &
    PlaybackProgressInfo &
    PlaybackStopInfo;

/** Player state is projected onto the generated contract, not a second set of report DTOs. */
export interface PlaybackReportState {
    /** Local execution identity, preserved across stream changes; never sent to the server. */
    reportingOwner: object;
    PlayState: ReportInfo;
    NowPlayingItem: Pick<BaseItemDto, 'Id'>;
    NextMediaType?: string | null;
}

export interface CapturedPlaybackReport {
    api: TesserafinApi;
    kind: PlaybackReportKind;
    info: ReportInfo;
    owner: object;
    authorization: string;
    basePath: string;
    configuration: TesserafinApi['configuration'];
    axios: TesserafinApi['axiosInstance'];
}

let reporting: Promise<typeof import('./playbackReportingQueue')> | undefined;

/** Snapshot at event time; register on one lazy promise so reports keep their invocation order. */
export function reportPlayback(
    api: TesserafinApi,
    kind: PlaybackReportKind,
    state: PlaybackReportState,
    queue?: ReadonlyArray<QueueItem>
): Promise<boolean> {
    const info: ReportInfo = structuredClone({
        ...state.PlayState,
        ItemId: state.NowPlayingItem.Id,
        ...(queue && {
            NowPlayingQueue: queue.map(({ Id, PlaylistItemId }) => ({
                Id,
                PlaylistItemId
            }))
        }),
        ...(kind === 'stop' && { NextMediaType: state.NextMediaType })
    });
    const captured: CapturedPlaybackReport = {
        api,
        kind,
        info,
        owner: state.reportingOwner,
        authorization: api.authorizationHeader,
        basePath: api.basePath,
        configuration: api.configuration,
        axios: api.axiosInstance
    };
    reporting ??= import(
        /* webpackChunkName: "playback-reporting" */
        './playbackReportingQueue'
    );
    return reporting.then((module) => module.reportPlayback(captured));
}
