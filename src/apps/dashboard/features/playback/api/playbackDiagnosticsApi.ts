import { getSystemApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import type {
    PlaybackDiagnosticDetail,
    PlaybackSessionListItem
} from './types';

/**
 * Generated client for the Tesserafin-specific admin playback diagnostics routes
 * (`PlaybackDiagnosticsSessionsController`, `[Authorize(Policy = Policies.RequiresElevation)]`),
 * called through the session's `TesserafinApi` (`useApi().reefinApi`).
 */
/**
 * Every generated model property is optional (see `./types.ts`'s file-level comment on
 * `DeepRequired`) even though the wire contract guarantees these fields — asserting through
 * `unknown` here is the one place that gap has to be bridged, right at the client boundary, so the
 * rest of this feature can keep working against the stricter local types unchanged.
 */
const asContract = <T>(data: unknown): T => data as T;

/** Gets a snapshot of all currently tracked playback sessions. */
export async function fetchPlaybackSessions(
    api: TesserafinApi,
    signal?: AbortSignal
): Promise<PlaybackSessionListItem[]> {
    const { data } = await getSystemApi(api).getPlaybackSessions({ signal });
    return asContract<PlaybackSessionListItem[]>(data);
}

/** Gets a single tracked playback session's diagnostic detail. */
export async function fetchPlaybackSessionDetail(
    api: TesserafinApi,
    id: string,
    signal?: AbortSignal
): Promise<PlaybackDiagnosticDetail> {
    const { data } = await getSystemApi(api).getPlaybackSession(
        { id },
        { signal }
    );
    return asContract<PlaybackDiagnosticDetail>(data);
}

/**
 * Exports a session's retained shadow diagnostic as a playback-compatibility-lab fixture.
 * Returns 422 if the session has no retained diagnostic (`HasDiagnostic: false`). The generated
 * operation is typed `AxiosPromise<void>` (the route's 200 response has no declared JSON schema in
 * the OpenAPI spec, since it deliberately serializes camelCase-always rather than through the
 * normal content model — design doc §4.1/design-web-playback-diagnostics.md §4.2) — `responseType:
 * 'blob'` is passed the same way it was against the raw-axios version of this function, and the
 * result is asserted to `Blob` for the same reason as `asContract` above.
 */
export async function fetchPlaybackSessionFixture(
    api: TesserafinApi,
    id: string
): Promise<Blob> {
    const { data } = await getSystemApi(api).exportFixture(
        { id },
        { responseType: 'blob' }
    );
    return asContract<Blob>(data);
}
