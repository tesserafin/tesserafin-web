import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const Mixed: FC = () => {
    return (
        // Technically mixed libraries have an undefined collection type, but unknown is otherwise unused
        <LibraryPage type={CollectionType.Unknown} />
    );
};

export default Mixed;
