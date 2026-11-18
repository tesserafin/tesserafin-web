import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const Playlists: FC = () => {
    return <LibraryPage type={CollectionType.Playlists} />;
};

export default Playlists;
