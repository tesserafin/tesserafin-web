import {
    LiveTvApi,
    type LiveTvApiCancelSeriesTimerRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import { useMutation } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const cancelSeriesTimer = async (
    apiContext: TesserafinApiContext,
    params: LiveTvApiCancelSeriesTimerRequest
) => {
    const { reefinApi: api } = apiContext;

    if (!api) throw new Error('[cancelSeriesTimer] No API instance available');

    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).cancelSeriesTimer(params);
    return response.data;
};

export const useCancelSeriesTimer = () => {
    const apiContext = useApi();
    return useMutation({
        mutationFn: (params: LiveTvApiCancelSeriesTimerRequest) =>
            cancelSeriesTimer(apiContext, params)
    });
};
