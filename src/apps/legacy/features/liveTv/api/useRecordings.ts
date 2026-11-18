import {
    LiveTvApi,
    type LiveTvApiGetRecordingsRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchRecordings = async (
    api: TesserafinApi,
    params?: LiveTvApiGetRecordingsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getRecordings(params, options);
    return response.data;
};

export const getRecordingsQuery = (
    api?: TesserafinApi,
    params?: LiveTvApiGetRecordingsRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'Recordings', params],
        queryFn: ({ signal }) => fetchRecordings(api!, params, { signal }),
        enabled: !!api
    });

export const useRecordings = (params?: LiveTvApiGetRecordingsRequest) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getRecordingsQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
