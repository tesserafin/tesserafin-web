import {
    BaseItemKind,
    CollectionType,
    LibraryApiGetItemsRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { useApi } from 'hooks/useApi';
import { fetchItemsByType } from './fetchItemsByType';

const fetchPrograms = async (
    api: TesserafinApi,
    userId: string,
    params?: LibraryApiGetItemsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await fetchItemsByType(
        api,
        userId,
        {
            includeItemTypes: [BaseItemKind.LiveTvProgram],
            ...params
        },
        options
    );

    return response;
};

export const useProgramsSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string
) => {
    const { reefinApi: api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['Search', 'Programs', collectionType, parentId, searchTerm],
        queryFn: ({ signal }) =>
            fetchPrograms(
                api!,
                userId!,
                {
                    parentId,
                    searchTerm
                },
                { signal }
            ),
        enabled: !!api && !!userId && !collectionType
    });
};
