/**
 * Consolidation step 1: which playbacks the session video journey owns. Kept apart from
 * `sessionVideo.ts` so the playback manager can decide synchronously without pulling the journey
 * (and the generated SDK it uses) into the main bundle; the journey itself is loaded on demand.
 */

/**
 * The library video families this journey owns. Live TV channels, programmes and recordings, and
 * channel-plugin items, plan elsewhere.
 */
const LIBRARY_VIDEO_TYPES = new Set([
    'Movie',
    'Episode',
    'Video',
    'MusicVideo',
    'Trailer'
]);

/** The item fields that decide whether this journey owns a playback. */
export interface SessionVideoCandidate {
    Id?: string | null;
    Type?: string | null;
    MediaType?: string | null;
    LocationType?: string | null;
    IsPlaceHolder?: boolean | null;
}

/**
 * Whether this journey owns the playback of `item` on `player`: a library video (film, episode, home video, music video, trailer), on the server, played by the
 * local HTML video player (not a cast or remote target, which plan for themselves).
 */
export function isSessionVideoCandidate(
    item: SessionVideoCandidate | null | undefined,
    player: { id?: string; isLocalPlayer?: boolean } | null | undefined
): boolean {
    return (
        !!item?.Id &&
        LIBRARY_VIDEO_TYPES.has(item.Type ?? '') &&
        item.MediaType === 'Video' &&
        (item.LocationType == null || item.LocationType === 'FileSystem') &&
        !item.IsPlaceHolder &&
        !!player?.isLocalPlayer &&
        player.id === 'htmlvideoplayer'
    );
}
