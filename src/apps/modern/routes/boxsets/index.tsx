import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const BoxSets: FC = () => {
    return <LibraryPage type={CollectionType.Boxsets} />;
};

export default BoxSets;
