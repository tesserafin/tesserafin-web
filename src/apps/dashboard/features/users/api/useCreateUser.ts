import {
    getUserApi,
    type UserApiCreateUserByNameRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';

export const useCreateUser = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: UserApiCreateUserByNameRequest) =>
            getUserApi(reefinApi!).createUserByName(params)
    });
};
