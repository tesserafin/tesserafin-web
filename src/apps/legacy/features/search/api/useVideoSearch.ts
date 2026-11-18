import {
    BaseItemKind,
    CollectionType,
    LibraryApiGetItemsRequest,
    MediaType,
    getLibraryApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { useApi } from 'hooks/useApi';
import { QUERY_OPTIONS } from '../constants/queryOptions';

const fetchVideos = async (
    api: TesserafinApi,
    userId: string,
    params?: LibraryApiGetItemsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getItems(
        {
            ...QUERY_OPTIONS,
            userId,
            recursive: true,
            mediaTypes: [MediaType.Video],
            excludeItemTypes: [
                BaseItemKind.Movie,
                BaseItemKind.Episode,
                BaseItemKind.TvChannel
            ],
            ...params
        },
        options
    );
    return response.data;
};

export const useVideoSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string
) => {
    const { reefinApi: api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['Search', 'Video', collectionType, parentId, searchTerm],
        queryFn: ({ signal }) =>
            fetchVideos(
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
