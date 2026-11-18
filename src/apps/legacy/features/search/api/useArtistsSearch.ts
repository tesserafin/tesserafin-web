import {
    ArtistApiGetArtistsRequest,
    CollectionType,
    getArtistApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { useApi } from 'hooks/useApi';
import { QUERY_OPTIONS } from '../constants/queryOptions';
import { isMusic } from '../utils/search';

const fetchArtists = async (
    api: TesserafinApi,
    userId: string,
    params?: ArtistApiGetArtistsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getArtistApi(api).getArtists(
        {
            ...QUERY_OPTIONS,
            userId,
            ...params
        },
        options
    );
    return response.data;
};

export const useArtistsSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string
) => {
    const { reefinApi: api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['Search', 'Artists', collectionType, parentId, searchTerm],
        queryFn: ({ signal }) =>
            fetchArtists(
                api!,
                userId!,
                {
                    parentId,
                    searchTerm
                },
                { signal }
            ),
        enabled:
            !!api && !!userId && (!collectionType || isMusic(collectionType))
    });
};
