import {
    getSessionApi,
    SessionApiSendMessageCommandRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';

export const useSendMessage = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: SessionApiSendMessageCommandRequest) =>
            getSessionApi(reefinApi!).sendMessageCommand(params)
    });
};
