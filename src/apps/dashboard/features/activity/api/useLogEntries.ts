import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';
import {
    getSystemApi,
    type SystemApiGetLogEntriesRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';

const fetchLogEntries = async (
    api: TesserafinApi,
    requestParams?: SystemApiGetLogEntriesRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getSystemApi(api).getLogEntries(requestParams, {
        signal: options?.signal
    });

    return response.data;
};

export const useLogEntries = (requestParams: SystemApiGetLogEntriesRequest) => {
    const { reefinApi } = useApi();
    return useQuery({
        queryKey: ['ActivityLogEntries', requestParams],
        queryFn: ({ signal }) =>
            fetchLogEntries(reefinApi!, requestParams, { signal }),
        enabled: !!reefinApi,
        refetchOnMount: false,
        staleTime: 0 // ensure we load the latest log entries
    });
};
