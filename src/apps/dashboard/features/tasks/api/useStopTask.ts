import {
    getScheduledTaskApi,
    type ScheduledTaskApiStartTaskRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY } from './useTasks';

export const useStopTask = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: ScheduledTaskApiStartTaskRequest) =>
            getScheduledTaskApi(reefinApi!).stopTask(params),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: [QUERY_KEY]
            });
        }
    });
};
