import {
    UserViewApi,
    type UserViewApiGetUserViewsRequest
} from 'lib/tesserafin-sdk/generated/api/user-view-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from '../useApi';

const fetchUserViews = async (
    api: TesserafinApi,
    params?: UserViewApiGetUserViewsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new UserViewApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getUserViews(params, options);
    return response.data;
};

export const getUserViewsQuery = (
    api?: TesserafinApi,
    params?: UserViewApiGetUserViewsRequest
) =>
    queryOptions({
        queryKey: ['User', params?.userId, 'Views', params],
        queryFn: ({ signal }) => fetchUserViews(api!, params, { signal }),
        enabled: !!api
    });

export const useUserViews = (params?: UserViewApiGetUserViewsRequest) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getUserViewsQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
