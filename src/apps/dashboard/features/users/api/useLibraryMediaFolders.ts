import {
    getLibraryApi,
    type LibraryApiGetMediaFoldersRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchLibraryMediaFolders = async (
    api: TesserafinApi,
    params?: LibraryApiGetMediaFoldersRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getMediaFolders(params, options);

    return response.data;
};

export const useLibraryMediaFolders = (
    params?: LibraryApiGetMediaFoldersRequest
) => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['LibraryMediaFolders'],
        queryFn: ({ signal }) =>
            fetchLibraryMediaFolders(reefinApi!, params, { signal }),
        enabled: !!reefinApi
    });
};
