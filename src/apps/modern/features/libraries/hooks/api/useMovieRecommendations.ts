import {
    getMovieApi,
    type MovieApiGetMovieRecommendationsRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchGetMovieRecommendations = async (
    api: TesserafinApi,
    params: MovieApiGetMovieRecommendationsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getMovieApi(api).getMovieRecommendations(
        params,
        options
    );
    return response.data;
};

/** Query options for fetching movie recommendations. */
export const getMovieRecommendationsQuery = (
    api?: TesserafinApi,
    params: MovieApiGetMovieRecommendationsRequest = {},
    enabled = true
) =>
    queryOptions({
        queryKey: ['MovieRecommendations', params?.parentId],
        queryFn: ({ signal }) =>
            fetchGetMovieRecommendations(api!, params, { signal }),
        enabled: !!api && enabled
    });

/** Hook for fetching movie recommendations. */
export const useMovieRecommendations = (
    params?: MovieApiGetMovieRecommendationsRequest,
    enabled?: boolean
) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getMovieRecommendationsQuery(
            api,
            {
                ...params,
                userId: params?.userId || user?.Id
            },
            enabled
        )
    );
};
