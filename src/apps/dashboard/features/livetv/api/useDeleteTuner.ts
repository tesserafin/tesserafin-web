import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import {
    getLiveTvApi,
    type LiveTvApiDeleteTunerHostRequest
} from 'lib/tesserafin-sdk';

export const useDeleteTuner = () => {
    const { reefinApi: api } = useApi();

    return useMutation({
        mutationFn: (params: LiveTvApiDeleteTunerHostRequest) =>
            getLiveTvApi(api!).deleteTunerHost(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['NamedConfiguration', 'livetv']
            });
        }
    });
};
