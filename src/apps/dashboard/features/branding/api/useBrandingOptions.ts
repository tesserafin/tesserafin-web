// Concrete modules, not the `lib/tesserafin-sdk` barrel: CustomCss and autoBackdrops reach this
// file from the main bundle, and the barrel would pull every generated API class into it.
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { BrandingApi } from 'lib/tesserafin-sdk/generated/api/branding-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'BrandingOptions';

const fetchBrandingOptions = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    return new BrandingApi(api.configuration, undefined, api.axiosInstance)
        .getBrandingOptions(options)
        .then(({ data }) => data);
};

export const getBrandingOptionsQuery = (api?: TesserafinApi) =>
    queryOptions({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchBrandingOptions(api!, { signal }),
        enabled: !!api
    });

export const useBrandingOptions = () => {
    const { reefinApi: api } = useApi();
    return useQuery(getBrandingOptionsQuery(api));
};
