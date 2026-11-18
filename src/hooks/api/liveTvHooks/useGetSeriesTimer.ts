import {
    LiveTvApi,
    type LiveTvApiGetSeriesTimerRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import type { AxiosRequestConfig } from 'axios';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const getSeriesTimer = async (
    apiContext: TesserafinApiContext,
    params: LiveTvApiGetSeriesTimerRequest,
    options?: AxiosRequestConfig
) => {
    const { reefinApi: api } = apiContext;

    if (!api) throw new Error('[getSeriesTimer] No API instance available');

    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getSeriesTimer(params, options);
    return response.data;
};

export const getSeriesTimerQuery = (
    apiContext: TesserafinApiContext,
    params: LiveTvApiGetSeriesTimerRequest
) =>
    queryOptions({
        queryKey: ['SeriesTimer', params.timerId],
        queryFn: ({ signal }) => getSeriesTimer(apiContext, params, { signal }),
        enabled:
            !!apiContext.reefinApi && !!apiContext.user?.Id && !!params.timerId
    });

export const useGetSeriesTimer = (
    requestParameters: LiveTvApiGetSeriesTimerRequest
) => {
    const apiContext = useApi();
    return useQuery(getSeriesTimerQuery(apiContext, requestParameters));
};
