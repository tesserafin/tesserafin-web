/**
 * Consolidation step 1: which playbacks the session media journey owns. Kept apart from
 * `sessionMedia.ts` so the playback manager can decide synchronously without pulling the journey
 * (and the generated SDK it uses) into the main bundle; the journey itself is loaded on demand.
 */

/**
 * Video families supported by the session media journey, including items from channel plugins and
 * Live TV recordings (`Recording`: the type a recording's item takes, finished or still being
 * written - the session plays one still being written from its live playlist).
 */
const SESSION_VIDEO_TYPES = new Set([
    'Movie',
    'Episode',
    'Video',
    'MusicVideo',
    'Trailer',
    'Recording'
]);

/** The item fields that decide whether this journey owns a playback. */
export interface SessionMediaCandidate {
    Id?: string | null;
    Type?: string | null;
    MediaType?: string | null;
    LocationType?: string | null;
    SourceType?: string | null;
    IsPlaceHolder?: boolean | null;
}

/**
 * Whether this journey owns the playback of `item` on `player`: a library video (film, episode,
 * home video, music video, trailer, Live TV recording) or a Live TV channel on the local HTML video player, or a
 * library audio track or audiobook on the local HTML audio player. Channel-plugin videos and
 * audio use the same journey. Cast and remote players plan for themselves.
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
    if (
        item.LocationType != null &&
        item.LocationType !== 'FileSystem' &&
        !(item.LocationType === 'Remote' && item.SourceType === 'Channel')
    ) {
        return false;
    }
    if (item.MediaType === 'Video') {
        return (
            SESSION_VIDEO_TYPES.has(item.Type ?? '') &&
            player.id === 'htmlvideoplayer'
        );
    }
    return (
        item.MediaType === 'Audio' &&
        (item.Type === 'Audio' || item.Type === 'AudioBook') &&
        player.id === 'htmlaudioplayer'
    );
}
