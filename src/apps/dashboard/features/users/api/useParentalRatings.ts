import { getLocalizationApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchParentalRatings = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getLocalizationApi(api).getParentalRatings(options);

    return response.data;
};

export const useParentalRatings = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['ParentalRatings'],
        queryFn: ({ signal }) => fetchParentalRatings(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
