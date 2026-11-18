import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const HomeVideos: FC = () => {
    return <LibraryPage type={CollectionType.Homevideos} />;
};

export default HomeVideos;
