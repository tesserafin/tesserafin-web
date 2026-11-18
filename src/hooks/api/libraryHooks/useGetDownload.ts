import {
    LibraryApi,
    type LibraryApiGetDownloadRequest
} from 'lib/tesserafin-sdk/generated/api/library-api';
import type { AxiosRequestConfig } from 'axios';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const getDownload = async (
    apiContext: TesserafinApiContext,
    params: LibraryApiGetDownloadRequest,
    options?: AxiosRequestConfig
) => {
    const { reefinApi: api, user } = apiContext;

    if (!api) throw new Error('[getDownload] No API instance available');
    if (!user?.Id) throw new Error('[getDownload] No User ID provided');

    const response = await new LibraryApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getDownload(params, options);
    return response.data;
};

export const getDownloadQuery = (
    apiContext: TesserafinApiContext,
    params: LibraryApiGetDownloadRequest
) =>
    queryOptions({
        queryKey: ['Download', params.itemId],
        queryFn: ({ signal }) => getDownload(apiContext, params, { signal }),
        enabled:
            !!apiContext.reefinApi && !!apiContext.user?.Id && !!params.itemId
    });

export const useGetDownload = (params: LibraryApiGetDownloadRequest) => {
    const apiContext = useApi();
    return useQuery(getDownloadQuery(apiContext, params));
};
