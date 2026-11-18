import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const Music: FC = () => {
    return <LibraryPage type={CollectionType.Music} />;
};

export default Music;
