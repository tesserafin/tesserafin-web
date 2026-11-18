import {
    getSessionApi,
    type SessionApiGetSessionsRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import type { AxiosRequestConfig } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'Sessions';

const fetchSessions = async (
    api: TesserafinApi,
    requestParams?: SessionApiGetSessionsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getSessionApi(api).getSessions(requestParams, {
        signal: options?.signal
    });

    return response.data;
};

export const useSessions = (requestParams: SessionApiGetSessionsRequest) => {
    const { reefinApi } = useApi();
    return useQuery({
        queryKey: [QUERY_KEY, requestParams],
        queryFn: ({ signal }) =>
            fetchSessions(reefinApi!, requestParams, { signal }),
        enabled: !!reefinApi,
        refetchOnWindowFocus: false
    });
};
