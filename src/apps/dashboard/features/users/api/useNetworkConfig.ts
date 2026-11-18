import {
    getSystemApi,
    type NetworkConfiguration,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

const fetchNetworkConfig = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response = await getSystemApi(api).getNamedConfiguration(
        { key: 'network' },
        options
    );

    return response.data as NetworkConfiguration;
};

export const useNetworkConfig = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: ['NetConfig'],
        queryFn: ({ signal }) => fetchNetworkConfig(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
