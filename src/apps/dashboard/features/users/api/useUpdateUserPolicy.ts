import {
    getUserApi,
    type UserApiUpdateUserPolicyRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from 'hooks/api/useUser';

export const useUpdateUserPolicy = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: UserApiUpdateUserPolicyRequest) =>
            getUserApi(reefinApi!).updateUserPolicy(params),
        onSuccess: (_, params) => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY, params.userId]
            });
        }
    });
};
