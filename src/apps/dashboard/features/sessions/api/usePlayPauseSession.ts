import {
    getSessionApi,
    SessionApiSendPlaystateCommandRequest
} from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';

export const useSendPlayStateCommand = () => {
    const { reefinApi } = useApi();

    return useMutation({
        mutationFn: (params: SessionApiSendPlaystateCommandRequest) =>
            getSessionApi(reefinApi!).sendPlaystateCommand(params)
    });
};
