/**
 * Consolidation step 1: which playbacks the session media journey owns. Kept apart from
 * `sessionMedia.ts` so the playback manager can decide synchronously without pulling the journey
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
export interface SessionMediaCandidate {
    Id?: string | null;
    Type?: string | null;
    MediaType?: string | null;
    LocationType?: string | null;
    IsPlaceHolder?: boolean | null;
}

/**
 * Whether this journey owns the playback of `item` on `player`: a library video (film, episode,
 * home video, music video, trailer) or a Live TV channel on the local HTML video player, or a
 * library audio track on the local HTML audio player - on the server, not a cast or remote target,
 * which plan for themselves.
 */
export function isSessionMediaCandidate(
    item: SessionMediaCandidate | null | undefined,
    player: { id?: string; isLocalPlayer?: boolean } | null | undefined
): boolean {
    if (!item?.Id || item.IsPlaceHolder || !player?.isLocalPlayer) {
        return false;
    }
    // A Live TV channel: the session opens its tuner stream and plays it from its live HLS route.
    if (item.Type === 'TvChannel') {
        return player.id === 'htmlvideoplayer';
    }
    if (item.LocationType != null && item.LocationType !== 'FileSystem') {
        return false;
    }
    if (item.MediaType === 'Video') {
        return (
            LIBRARY_VIDEO_TYPES.has(item.Type ?? '') &&
            player.id === 'htmlvideoplayer'
        );
    }
    return (
        item.MediaType === 'Audio' &&
        item.Type === 'Audio' &&
        player.id === 'htmlaudioplayer'
    );
}
