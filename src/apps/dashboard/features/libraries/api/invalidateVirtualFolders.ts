import { type UserDto, type VirtualFolderInfo } from 'lib/tesserafin-sdk';

import { queryClient } from 'utils/query/queryClient';

import { QUERY_KEY } from './useVirtualFolders';

/** Invalidates queries related to libraries/virtual folders. */
export const invalidateVirtualFolders = (
    user?: UserDto,
    virtualFolder?: VirtualFolderInfo
) => {
    // Admin API - Virtual Folders
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

    if (user) {
        // User API - Views
        void queryClient.invalidateQueries({
            queryKey: ['User', user.Id, 'Views']
        });

        if (virtualFolder?.ItemId) {
            // Items API - Library children
            void queryClient.invalidateQueries({
                queryKey: ['User', user.Id, 'Items', virtualFolder.ItemId]
            });
        }
    }
};
