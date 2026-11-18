import { getSystemApi } from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';

const useShutdownServer = () => {
    const { reefinApi: api } = useApi();

    return useMutation({
        mutationFn: () => {
            return getSystemApi(api!).shutdownApplication();
        }
    });
};

export default useShutdownServer;
