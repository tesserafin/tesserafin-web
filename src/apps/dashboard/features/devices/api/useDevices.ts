import {
    type DeviceApiGetDevicesRequest,
    getDeviceApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import type { AxiosRequestConfig } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'Devices';

const fetchDevices = async (
    api: TesserafinApi,
    requestParams?: DeviceApiGetDevicesRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getDeviceApi(api).getDevices(requestParams, {
        signal: options?.signal
    });

    return response.data;
};

export const useDevices = (requestParams: DeviceApiGetDevicesRequest) => {
    const { reefinApi } = useApi();
    return useQuery({
        queryKey: [QUERY_KEY, requestParams],
        queryFn: ({ signal }) =>
            fetchDevices(reefinApi!, requestParams, { signal }),
        enabled: !!reefinApi,
        staleTime: 0 // ensure we load the latest device data
    });
};
