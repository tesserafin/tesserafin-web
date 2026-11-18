import { CollectionType } from 'lib/tesserafin-sdk/generated/models/collection-type';
import { LibraryTabContent } from 'types/libraryTabContent';

import defaultViewContent from '../constants/views/defaults';
import viewsByKind from '../constants/views';

export function getViewContent(
    collectionType: CollectionType,
    viewIndex: number
): LibraryTabContent {
    const viewContent = viewsByKind[collectionType][viewIndex];
    return {
        ...defaultViewContent,
        ...viewContent
    };
}
