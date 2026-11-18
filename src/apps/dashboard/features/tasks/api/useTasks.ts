import {
    getScheduledTaskApi,
    type ScheduledTaskApiGetTasksRequest,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import type { AxiosRequestConfig } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'Tasks';

const fetchTasks = async (
    api: TesserafinApi,
    params?: ScheduledTaskApiGetTasksRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getScheduledTaskApi(api).getTasks(params, options);

    return response.data;
};

export const useTasks = (params?: ScheduledTaskApiGetTasksRequest) => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchTasks(reefinApi!, params, { signal }),
        enabled: !!reefinApi
    });
};
