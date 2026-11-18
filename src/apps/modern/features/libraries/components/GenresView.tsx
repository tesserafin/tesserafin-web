import { type BaseItemKind, type CollectionType } from 'lib/tesserafin-sdk';
import React, { FC } from 'react';
import GenresItemsContainer from './GenresItemsContainer';
import type { ParentId } from 'types/library';

interface GenresViewProps {
    parentId: ParentId;
    collectionType: CollectionType | undefined;
    itemType: BaseItemKind[];
}

const GenresView: FC<GenresViewProps> = ({
    parentId,
    collectionType,
    itemType
}) => {
    return (
        <GenresItemsContainer
            parentId={parentId}
            collectionType={collectionType}
            itemType={itemType}
        />
    );
};

export default GenresView;
