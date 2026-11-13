/**
 * Consolidation step 1: which playbacks the local film and episode journey owns. Kept apart from
 * `sessionVideo.ts` so the playback manager can decide synchronously without pulling the journey
 * (and the generated SDK it uses) into the main bundle; the journey itself is loaded on demand.
 */

/** The item fields that decide whether this journey owns a playback. */
export interface SessionVideoCandidate {
    Id?: string | null;
    Type?: string | null;
    MediaType?: string | null;
    LocationType?: string | null;
    IsPlaceHolder?: boolean | null;
}

/**
 * Whether this journey owns the playback of `item` on `player`: a film or episode, on the server, played by the
 * local HTML video player (not a cast or remote target, which plan for themselves).
 */
export function isSessionVideoCandidate(
    item: SessionVideoCandidate | null | undefined,
    player: { id?: string; isLocalPlayer?: boolean } | null | undefined
): boolean {
    return (
        !!item?.Id &&
        (item.Type === 'Movie' || item.Type === 'Episode') &&
        item.MediaType === 'Video' &&
        (item.LocationType == null || item.LocationType === 'FileSystem') &&
        !item.IsPlaceHolder &&
        !!player?.isLocalPlayer &&
        player.id === 'htmlvideoplayer'
    );
}
