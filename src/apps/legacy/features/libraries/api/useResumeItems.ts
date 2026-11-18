import {
    LibraryApi,
    type LibraryApiGetResumeItemsRequest
} from 'lib/tesserafin-sdk/generated/api/library-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchResumeItems = async (
    api: TesserafinApi,
    params?: LibraryApiGetResumeItemsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new LibraryApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getResumeItems(params, options);
    return response.data;
};

export const getResumeItemsQuery = (
    api?: TesserafinApi,
    params?: LibraryApiGetResumeItemsRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'ResumeItems', params],
        queryFn: ({ signal }) => fetchResumeItems(api!, params, { signal }),
        enabled: !!api
    });

export const useResumeItems = (params?: LibraryApiGetResumeItemsRequest) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getResumeItemsQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
