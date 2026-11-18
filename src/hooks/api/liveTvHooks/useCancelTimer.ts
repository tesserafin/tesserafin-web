import {
    LiveTvApi,
    type LiveTvApiCancelTimerRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import { useMutation } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const cancelTimer = async (
    apiContext: TesserafinApiContext,
    params: LiveTvApiCancelTimerRequest
) => {
    const { reefinApi: api } = apiContext;

    if (!api) throw new Error('[cancelTimer] No API instance available');

    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).cancelTimer(params);
    return response.data;
};

export const useCancelTimer = () => {
    const apiContext = useApi();
    return useMutation({
        mutationFn: (params: LiveTvApiCancelTimerRequest) =>
            cancelTimer(apiContext, params)
    });
};
