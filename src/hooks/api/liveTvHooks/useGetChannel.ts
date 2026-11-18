import {
    LiveTvApi,
    type LiveTvApiGetChannelRequest
} from 'lib/tesserafin-sdk/generated/api/live-tv-api';
import type { AxiosRequestConfig } from 'axios';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const getChannel = async (
    apiContext: TesserafinApiContext,
    params: LiveTvApiGetChannelRequest,
    options?: AxiosRequestConfig
) => {
    const { reefinApi: api, user } = apiContext;

    if (!api) throw new Error('[getChannel] No API instance available');
    if (!user?.Id) throw new Error('[getChannel] No User ID provided');

    const response = await new LiveTvApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getChannel(
        {
            userId: user.Id,
            ...params
        },
        options
    );
    return response.data;
};

export const getChannelQuery = (
    apiContext: TesserafinApiContext,
    params: LiveTvApiGetChannelRequest
) =>
    queryOptions({
        queryKey: ['Channel', params.channelId],
        queryFn: ({ signal }) => getChannel(apiContext, params, { signal }),
        enabled:
            !!apiContext.reefinApi &&
            !!apiContext.user?.Id &&
            !!params.channelId
    });

export const useGetChannel = (params: LiveTvApiGetChannelRequest) => {
    const apiContext = useApi();
    return useQuery(getChannelQuery(apiContext, params));
};
