import {
    ShowApi,
    type ShowApiGetNextUpRequest
} from 'lib/tesserafin-sdk/generated/api/show-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchNextUp = async (
    api: TesserafinApi,
    params?: ShowApiGetNextUpRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new ShowApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getNextUp(params, options);
    return response.data;
};

export const getNextUpQuery = (
    api?: TesserafinApi,
    params?: ShowApiGetNextUpRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'NextUp', params],
        queryFn: ({ signal }) => fetchNextUp(api!, params, { signal }),
        enabled: !!api
    });

export const useNextUp = (params?: ShowApiGetNextUpRequest) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getNextUpQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
