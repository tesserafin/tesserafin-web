import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import {
    type AuthenticationApiCreateKeyRequest,
    getAuthenticationApi
} from 'lib/tesserafin-sdk';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from './useApiKeys';

export const useCreateKey = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: AuthenticationApiCreateKeyRequest) =>
            getAuthenticationApi(reefinApi!).createKey(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY]
            });
        }
    });
};
