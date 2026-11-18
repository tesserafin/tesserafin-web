import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';
import { getSystemApi, type TesserafinApi } from 'lib/tesserafin-sdk';

const fetchServerLog = async (
    api: TesserafinApi,
    name: string,
    options?: AxiosRequestConfig
) => {
    const response = await getSystemApi(api).getLogFile({ name }, options);

    // The generated client types this as a File, but the server sends text (or JSON).
    const data = response.data as never as string | object;

    if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
    } else {
        return data;
    }
};

export const useServerLog = (name: string, refetchInterval: false | number) => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['ServerLog', name],
        queryFn: ({ signal }) => fetchServerLog(reefinApi!, name, { signal }),
        enabled: !!reefinApi,
        refetchInterval,
        staleTime: 0 // ensure we load the latest log data
    });
};
