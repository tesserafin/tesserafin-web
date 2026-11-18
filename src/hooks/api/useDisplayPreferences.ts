import {
    DisplayPreferenceApiGetDisplayPreferencesRequest,
    DisplayPreferenceApi
} from 'lib/tesserafin-sdk/generated/api/display-preference-api';
import type { TesserafinApi } from 'lib/tesserafin-sdk/client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

const fetchDisplayPreferences = async (
    api: TesserafinApi,
    params: DisplayPreferenceApiGetDisplayPreferencesRequest,
    options?: AxiosRequestConfig
) => {
    const response = await new DisplayPreferenceApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).getDisplayPreferences(params, options);
    return response.data;
};

export const getDisplayPreferencesQuery = (
    api?: TesserafinApi,
    params?: DisplayPreferenceApiGetDisplayPreferencesRequest
) =>
    queryOptions({
        queryKey: [
            'User',
            params?.userId,
            'DisplayPreferences',
            params?.displayPreferencesId,
            params?.client
        ],
        queryFn: ({ signal }) =>
            fetchDisplayPreferences(api!, params!, { signal }),
        enabled: !!api && !!params
    });

export const useDisplayPreferences = (
    params: DisplayPreferenceApiGetDisplayPreferencesRequest
) => {
    const { reefinApi: api, user } = useApi();
    return useQuery(
        getDisplayPreferencesQuery(api, {
            ...params,
            userId: params?.userId || user?.Id
        })
    );
};
