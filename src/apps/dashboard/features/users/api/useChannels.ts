import {
    type ChannelApiGetChannelsRequest,
    getChannelApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchChannels = async (
    api: TesserafinApi,
    params?: ChannelApiGetChannelsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getChannelApi(api).getChannels(params, options);

    return response.data;
};

export const useChannels = (params?: ChannelApiGetChannelsRequest) => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['Channels'],
        queryFn: ({ signal }) => fetchChannels(reefinApi!, params, { signal }),
        enabled: !!reefinApi
    });
};
