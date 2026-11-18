import { BaseItemKind } from 'lib/tesserafin-sdk/generated/models/base-item-kind';
import { CollectionType } from 'lib/tesserafin-sdk/generated/models/collection-type';
import { LibraryTab } from 'types/libraryTab';
import type { LibraryTabContent } from 'types/libraryTabContent';

const foldersTabContent: LibraryTabContent = {
    viewType: LibraryTab.Folders,
    collectionType: CollectionType.Homevideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [
        BaseItemKind.Folder,
        BaseItemKind.Photo,
        BaseItemKind.PhotoAlbum,
        BaseItemKind.Video
    ]
};

const photosTabContent: LibraryTabContent = {
    viewType: LibraryTab.Photos,
    collectionType: CollectionType.Homevideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.Photo]
};

const photoAlbumsTabContent: LibraryTabContent = {
    viewType: LibraryTab.PhotoAlbums,
    collectionType: CollectionType.Homevideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.PhotoAlbum]
};

const videosTabContent: LibraryTabContent = {
    viewType: LibraryTab.Videos,
    collectionType: CollectionType.Homevideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.Video]
};

const homeVideosViews: Record<number, LibraryTabContent> = {
    0: foldersTabContent,
    1: photosTabContent,
    2: photoAlbumsTabContent,
    3: videosTabContent
};

export default homeVideosViews;
