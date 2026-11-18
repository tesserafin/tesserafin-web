import { CollectionType } from 'lib/tesserafin-sdk';
import React, { type FC } from 'react';

import LibraryPage from 'apps/modern/features/libraries/components/LibraryPage';

const LiveTv: FC = () => {
    return <LibraryPage type={CollectionType.Livetv} />;
};

export default LiveTv;
