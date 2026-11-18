import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import {
    getLiveTvApi,
    type LiveTvApiDeleteListingProviderRequest
} from 'lib/tesserafin-sdk';

export const useDeleteProvider = () => {
    const { reefinApi: api } = useApi();

    return useMutation({
        mutationFn: (params: LiveTvApiDeleteListingProviderRequest) =>
            getLiveTvApi(api!).deleteListingProvider(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['NamedConfiguration', 'livetv']
            });
        }
    });
};
