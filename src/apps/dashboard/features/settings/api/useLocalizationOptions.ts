import { getLocalizationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchLocalizationOptions = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response =
        await getLocalizationApi(api).getLocalizationOptions(options);

    return response.data;
};

export const useLocalizationOptions = () => {
    const { reefinApi: api } = useApi();

    return useQuery({
        queryKey: ['LocalizationOptions'],
        queryFn: ({ signal }) => fetchLocalizationOptions(api!, { signal }),
        enabled: !!api
    });
};
