import {
    UserApi,
    type UserApiGetUserByIdRequest
} from 'lib/tesserafin-sdk/generated/api/user-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

/** UserApiGetUserByIdRequest without required userId */
interface GetUserByIdParams {
    userId?: string;
}

export const QUERY_KEY = 'User';

const fetchUser = async (
    api: TesserafinApi,
    params: UserApiGetUserByIdRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new UserApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getUserById(params, options);

    return response.data;
};

export const getUserQuery = (
    api?: TesserafinApi,
    { userId }: GetUserByIdParams = {}
) =>
    queryOptions({
        queryKey: [QUERY_KEY, userId],
        queryFn: ({ signal }) =>
            fetchUser(api!, { userId: userId! }, { signal }),
        enabled: !!api && !!userId
    });

export const useUser = ({ userId }: GetUserByIdParams) => {
    const { reefinApi: api, user } = useApi();

    return useQuery(getUserQuery(api, { userId: userId || user?.Id }));
};
