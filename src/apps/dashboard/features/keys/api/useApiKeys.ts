import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';
import { getAuthenticationApi, type TesserafinApi } from 'lib/tesserafin-sdk';

export const QUERY_KEY = 'ApiKeys';

const fetchApiKeys = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getAuthenticationApi(api).getKeys(options);

    return response.data;
};

export const useApiKeys = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchApiKeys(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
