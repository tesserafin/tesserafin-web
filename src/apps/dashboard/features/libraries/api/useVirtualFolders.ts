import { getLibraryStructureApi, type TesserafinApi } from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

export const QUERY_KEY = 'VirtualFolders';

const fetchVirtualFolders = async (
    api: TesserafinApi,
    options?: AxiosRequestConfig
) => {
    const response =
        await getLibraryStructureApi(api).getVirtualFolders(options);

    return response.data;
};

export const useVirtualFolders = () => {
    const { reefinApi } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchVirtualFolders(reefinApi!, { signal }),
        enabled: !!reefinApi
    });
};
