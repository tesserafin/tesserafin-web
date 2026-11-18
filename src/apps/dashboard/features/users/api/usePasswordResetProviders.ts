import { getAuthenticationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchPasswordResetProviders = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response =
        await getAuthenticationApi(api).getPasswordResetProviders(options);

    return response.data;
};

export const usePasswordResetProviders = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['PasswordResetProviders'],
        queryFn: ({ signal }) =>
            fetchPasswordResetProviders(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
