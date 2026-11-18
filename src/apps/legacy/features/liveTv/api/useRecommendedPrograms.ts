import {
    LiveTvApi,
    type LiveTvApiGetRecommendedProgramsRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchRecommendedPrograms = async (
    api: TesserafinApi,
    params?: LiveTvApiGetRecommendedProgramsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getRecommendedPrograms(params, options);
    return response.data;
};

export const getRecommendedProgramsQuery = (
    api?: TesserafinApi,
    params?: LiveTvApiGetRecommendedProgramsRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'RecommendedPrograms', params],
        queryFn: ({ signal }) =>
            fetchRecommendedPrograms(api!, params, { signal }),
        enabled: !!api
    });

export const useRecommendedPrograms = (
    params?: LiveTvApiGetRecommendedProgramsRequest
) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getRecommendedProgramsQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
