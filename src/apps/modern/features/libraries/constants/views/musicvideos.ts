import { BaseItemKind } from 'lib/tesserafin-sdk/generated/models/base-item-kind';
import { CollectionType } from 'lib/tesserafin-sdk/generated/models/collection-type';
import { LibraryTab } from 'types/libraryTab';
import type { LibraryTabContent } from 'types/libraryTabContent';
import { SectionType } from 'types/sections';

const foldersTabContent: LibraryTabContent = {
    viewType: LibraryTab.Folders,
    collectionType: CollectionType.Musicvideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.Folder, BaseItemKind.MusicVideo]
};

const suggestionsTabContent: LibraryTabContent = {
    viewType: LibraryTab.Suggestions,
    collectionType: CollectionType.Musicvideos,
    sectionsView: {
        suggestionSections: [
            SectionType.LatestMusicVideos,
            SectionType.FrequentlyPlayedMusicVideos,
            SectionType.RecentlyPlayedMusicVideos
        ]
    }
};

const musicVideosTabContent: LibraryTabContent = {
    viewType: LibraryTab.MusicVideos,
    collectionType: CollectionType.Musicvideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.MusicVideo]
};

const playlistsTabContent: LibraryTabContent = {
    viewType: LibraryTab.Playlists,
    isBtnFilterEnabled: false,
    isBtnGridListEnabled: false,
    isBtnNewPlaylistEnabled: true,
    isAlphabetPickerEnabled: false,
    itemType: [BaseItemKind.Playlist]
};

const musicVideosViews: Record<number, LibraryTabContent> = {
    0: foldersTabContent,
    1: suggestionsTabContent,
    2: musicVideosTabContent,
    3: playlistsTabContent
};

export default musicVideosViews;
