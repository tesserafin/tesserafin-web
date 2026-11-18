import { getLocalizationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchCountries = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getLocalizationApi(api).getCountries(options);

    return response.data;
};

export const useCountries = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['Countries'],
        queryFn: ({ signal }) => fetchCountries(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
