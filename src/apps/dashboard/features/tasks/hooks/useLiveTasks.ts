import { useEffect } from 'react';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY, useTasks } from '../api/useTasks';
import { type ScheduledTaskApiGetTasksRequest } from 'lib/tesserafin-sdk';
import { queryClient } from 'utils/query/queryClient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

const useLiveTasks = (params: ScheduledTaskApiGetTasksRequest) => {
    const { api } = useApi();
    const tasksQuery = useTasks(params);

    useEffect(() => {
        return api?.subscribe(
            [OutboundWebSocketMessageType.ScheduledTasksInfo],
            ({ Data }) => {
                queryClient.setQueryData([QUERY_KEY], Data ?? []);
            }
        );
    }, [api]);

    return tasksQuery;
};

export default useLiveTasks;
