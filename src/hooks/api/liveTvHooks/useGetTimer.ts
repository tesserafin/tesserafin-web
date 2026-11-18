import {
    LiveTvApi,
    type LiveTvApiGetTimerRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import type { AxiosRequestConfig } from 'axios';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const getTimer = async (
    currentApi: TesserafinApiContext,
    params: LiveTvApiGetTimerRequest,
    options?: AxiosRequestConfig
) => {
    const { reefinApi: api } = currentApi;

    if (!api) throw new Error('[getTimer] No API instance available');

    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getTimer(params, options);
    return response.data;
};

export const getTimerQuery = (
    apiContext: TesserafinApiContext,
    params: LiveTvApiGetTimerRequest
) =>
    queryOptions({
        queryKey: ['Timer', params.timerId],
        queryFn: ({ signal }) => getTimer(apiContext, params, { signal }),
        enabled:
            !!apiContext.reefinApi && !!apiContext.user?.Id && !!params.timerId
    });

export const useGetTimer = (requestParameters: LiveTvApiGetTimerRequest) => {
    const apiContext = useApi();
    return useQuery(getTimerQuery(apiContext, requestParameters));
};
