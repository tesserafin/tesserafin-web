import { getSystemApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

export const QUERY_KEY = 'Configuration';

export const fetchConfiguration = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getSystemApi(api).getConfiguration(options);

    return response.data;
};

export const useConfiguration = () => {
    const { reefinApi: api } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchConfiguration(api!, { signal }),
        enabled: !!api
    });
};
