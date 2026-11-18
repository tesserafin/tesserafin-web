import {
    getLibraryStructureApi,
    type LibraryStructureApiRemoveVirtualFolderRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

import { invalidateVirtualFolders } from './invalidateVirtualFolders';

export const useRemoveVirtualFolder = () => {
    const { reefinApi, user } = useApi();
    return useMutation({
        mutationFn: (params: LibraryStructureApiRemoveVirtualFolderRequest) =>
            getLibraryStructureApi(reefinApi!).removeVirtualFolder(params),
        onSuccess: () => {
            invalidateVirtualFolders(user);
        }
    });
};
