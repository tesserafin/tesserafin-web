import { getAuthenticationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchAuthProviders = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getAuthenticationApi(api).getAuthProviders(options);

    return response.data;
};

export const useAuthProviders = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['AuthProviders'],
        queryFn: ({ signal }) => fetchAuthProviders(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
