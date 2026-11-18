import {
    getLibraryApi,
    type LibraryApiGetAncestorsRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

interface AncestorsParams {
    itemId?: string;
    userId?: string;
}

const fetchAncestors = async (
    api: TesserafinApi,
    params: LibraryApiGetAncestorsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getAncestors(params, options);
    return response.data;
};

/** Query options for fetching the hierarchy of ancestors of a given item. */
export const getAncestorsQuery = (
    api?: TesserafinApi,
    params?: AncestorsParams
) =>
    queryOptions({
        queryKey: ['Items', params?.itemId, 'Ancestors'],
        queryFn: ({ signal }) =>
            fetchAncestors(api!, params as LibraryApiGetAncestorsRequest, {
                signal
            }),
        staleTime: Infinity, // Ancestors are unlikely to change
        enabled: !!api && !!params?.itemId
    });

/** Hook to fetch the hierarchy of ancestors of a given item. */
export const useAncestors = (params: AncestorsParams) => {
    const apiContext = useApi();
    const { reefinApi: api } = apiContext;
    return useQuery(getAncestorsQuery(api, params));
};
