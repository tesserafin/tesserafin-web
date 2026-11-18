import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';
import { getSystemApi, type TesserafinApi } from 'lib/tesserafin-sdk';

const fetchServerLogs = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getSystemApi(api).getServerLogs(options);

    return response.data;
};

export const useServerLogs = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['ServerLogs'],
        queryFn: ({ signal }) => fetchServerLogs(reefinApi!, { signal }),
        enabled: !!reefinApi,
        staleTime: 0 // ensure we load the latest log entries
    });
};
