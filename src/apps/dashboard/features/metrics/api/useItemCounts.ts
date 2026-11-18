import {
    getLibraryApi,
    type LibraryApiGetItemCountsRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchItemCounts = async (
    api: TesserafinApi,
    params?: LibraryApiGetItemCountsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getItemCounts(params, options);
    return response.data;
};

const getItemCountsQuery = (
    api?: TesserafinApi,
    params?: LibraryApiGetItemCountsRequest
) =>
    queryOptions({
        queryKey: ['ItemCounts', params],
        queryFn: ({ signal }) => fetchItemCounts(api!, params, { signal }),
        enabled: !!api,
        refetchOnWindowFocus: false
    });

export const useItemCounts = (params?: LibraryApiGetItemCountsRequest) => {
    const { reefinApi: api } = useApi();
    return useQuery(getItemCountsQuery(api, params));
};
