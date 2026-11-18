import {
    getScheduledTaskApi,
    type ScheduledTaskApiUpdateTaskRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from './useTasks';

export const useUpdateTask = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: ScheduledTaskApiUpdateTaskRequest) =>
            getScheduledTaskApi(reefinApi!).updateTask(params),
        onSuccess: (_data, params) => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY, params.taskId]
            });
        }
    });
};
