import { getLocalizationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchCultures = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getLocalizationApi(api).getCultures(options);

    return response.data;
};

export const useCultures = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['Cultures'],
        queryFn: ({ signal }) => fetchCultures(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
