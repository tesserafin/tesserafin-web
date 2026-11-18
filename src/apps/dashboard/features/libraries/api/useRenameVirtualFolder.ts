import {
    getLibraryStructureApi,
    type LibraryStructureApiRenameVirtualFolderRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

import { invalidateVirtualFolders } from './invalidateVirtualFolders';

export const useRenameVirtualFolder = () => {
    const { reefinApi, user } = useApi();
    return useMutation({
        mutationFn: (params: LibraryStructureApiRenameVirtualFolderRequest) =>
            getLibraryStructureApi(reefinApi!).renameVirtualFolder(params),
        onSuccess: () => {
            invalidateVirtualFolders(user);
        }
    });
};
