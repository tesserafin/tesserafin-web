import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import {
    type AuthenticationApiRevokeKeyRequest,
    getAuthenticationApi
} from 'lib/tesserafin-sdk';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from './useApiKeys';

export const useRevokeKey = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: AuthenticationApiRevokeKeyRequest) =>
            getAuthenticationApi(reefinApi!).revokeKey(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY]
            });
        }
    });
};
