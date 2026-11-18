import {
    LibraryApi,
    type LibraryApiGetLatestMediaRequest
} from 'lib/tesserafin-sdk/generated/api/library-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchLatestMedia = async (
    api: TesserafinApi,
    params?: LibraryApiGetLatestMediaRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new LibraryApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getLatestMedia(params, options);
    return response.data;
};

export const getLatestMediaQuery = (
    api?: TesserafinApi,
    params?: LibraryApiGetLatestMediaRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'LatestMedia', params],
        queryFn: ({ signal }) => fetchLatestMedia(api!, params, { signal }),
        enabled: !!api
    });

export const useLatestMedia = (params?: LibraryApiGetLatestMediaRequest) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getLatestMediaQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
