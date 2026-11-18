import {
    BaseItemKind,
    ItemSortBy,
    getLibraryApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import type { AxiosRequestConfig } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

const fetchGetItems = async (
    api: TesserafinApi,
    userId: string,
    parentId?: string,
    options?: AxiosRequestConfig
) => {
    const response = await getLibraryApi(api).getItems(
        {
            userId,
            sortBy: [ItemSortBy.IsFavoriteOrLiked, ItemSortBy.Random],
            includeItemTypes: [
                BaseItemKind.Movie,
                BaseItemKind.Series,
                BaseItemKind.MusicArtist
            ],
            limit: 20,
            recursive: true,
            imageTypeLimit: 0,
            enableImages: false,
            parentId,
            enableTotalRecordCount: false
        },
        options
    );
    return response.data.Items || [];
};

export const useSearchSuggestions = (parentId?: string) => {
    const { reefinApi: api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['SearchSuggestions', { parentId }],
        queryFn: ({ signal }) =>
            fetchGetItems(api!, userId!, parentId, { signal }),
        refetchOnWindowFocus: false,
        enabled: !!api && !!userId
    });
};
