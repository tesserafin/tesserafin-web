import {
    getScheduledTaskApi,
    type ScheduledTaskApiGetTaskRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import type { AxiosRequestConfig } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { QUERY_KEY } from './useTasks';

const fetchTask = async (
    api: TesserafinApi,
    params: ScheduledTaskApiGetTaskRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getScheduledTaskApi(api).getTask(params, options);

    return response.data;
};

export const useTask = (params: ScheduledTaskApiGetTaskRequest) => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY, params.taskId],
        queryFn: ({ signal }) => fetchTask(reefinApi!, params, { signal }),
        enabled: !!reefinApi
    });
};
