import { getBackupApi } from 'lib/tesserafin-sdk';
import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export const useRestoreBackup = () => {
    const { reefinApi: api } = useApi();

    return useMutation({
        mutationFn: (fileName: string) =>
            getBackupApi(api!).startRestoreBackup({
                backupRestoreRequestDto: {
                    ArchiveFileName: fileName
                }
            })
    });
};
