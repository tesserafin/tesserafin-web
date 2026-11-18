import {
    LibraryApiGetItemsRequest,
    getLibraryApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { AxiosRequestConfig } from 'axios';
import { QUERY_OPTIONS } from '../constants/queryOptions';

export const fetchItemsByType = async (
    api: TesserafinApi,
    userId?: string,
    params?: LibraryApiGetItemsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getItems(
        {
            ...QUERY_OPTIONS,
            userId,
            recursive: true,
            ...params
        },
        options
    );
    return response.data;
};
