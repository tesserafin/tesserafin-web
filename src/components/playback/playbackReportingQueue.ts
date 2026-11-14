import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { SessionApi } from 'lib/tesserafin-sdk/generated/api/session-api';
import type { CapturedPlaybackReport } from './playbackReporting';

interface ReportingConnection {
    authorization: string;
    basePath: string;
    tail: Promise<unknown>;
    active: Map<string, { owner: object; stopped: boolean }>;
}

// NowPlayingItem is shared by successive plays on the device. A queue per play session would
// still let A's stop erase B's live state. Other server connections remain independent.
const connections = new WeakMap<TesserafinApi, ReportingConnection>();

/** Serializes reports to the device session; a failed report never blocks the next one. */
export function reportPlayback({
    api,
    kind,
    info,
    owner,
    authorization,
    basePath,
    configuration,
    axios
}: CapturedPlaybackReport): Promise<boolean> {
    let connection = connections.get(api);
    if (!connection) {
        connection = {
            authorization,
            basePath,
            tail: Promise.resolve(),
            active: new Map()
        };
        connections.set(api, connection);
    }
    if (
        connection.authorization !== authorization ||
        connection.basePath !== basePath
    ) {
        connection.active.clear();
        connection.authorization = authorization;
        connection.basePath = basePath;
    }
    const slot = info.SessionId ?? '';
    const active = connection.active.get(slot);
    if (kind === 'start') {
        connection.active.set(slot, { owner, stopped: false });
    } else {
        if (!active || active.stopped || active.owner !== owner)
            return Promise.resolve(false);
        if (kind === 'stop') active.stopped = true;
    }
    const result = connection.tail.then(async () => {
        // A queued report keeps the identity captured when the event occurred. It must not be
        // reauthenticated as another user or redirected after the connection changes.
        if (
            api.authorizationHeader !== authorization ||
            api.basePath !== basePath
        )
            return false;
        const client = new SessionApi(configuration, undefined, axios);
        const options = { timeout: 10_000 };
        switch (kind) {
            case 'start':
                await client.reportPlaybackStart(
                    { playbackStartInfo: info },
                    options
                );
                break;
            case 'progress':
                await client.reportPlaybackProgress(
                    { playbackProgressInfo: info },
                    options
                );
                break;
            case 'stop':
                await client.reportPlaybackStopped(
                    { playbackStopInfo: info },
                    options
                );
                break;
        }
        return true;
    });
    // Capture the rejection separately so callers see this failure and the next report proceeds.
    connection.tail = result.catch(() => undefined);
    return result;
}
