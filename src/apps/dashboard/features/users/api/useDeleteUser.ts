import { getUserApi, type UserApiDeleteUserRequest } from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY } from 'hooks/useUsers';
import { queryClient } from 'utils/query/queryClient';

export const useDeleteUser = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: UserApiDeleteUserRequest) =>
            getUserApi(reefinApi!).deleteUser(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY]
            });
        }
    });
};
