import { getUserApi, type UserApiUpdateUserRequest } from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from 'hooks/api/useUser';

export const useUpdateUser = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: UserApiUpdateUserRequest) =>
            getUserApi(reefinApi!).updateUser(params),
        onSuccess: (_, params) => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY, params.userId]
            });
        }
    });
};
