import {
    type DeviceApiDeleteDeviceRequest,
    getDeviceApi
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from './useDevices';

export const useDeleteDevice = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: DeviceApiDeleteDeviceRequest) =>
            getDeviceApi(reefinApi!).deleteDevice(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY]
            });
        }
    });
};
