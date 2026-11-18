import {
    CollectionType,
    PersonApiGetPersonsRequest,
    PersonKind,
    getPersonApi,
    type TesserafinApi
} from 'lib/tesserafin-sdk';
import { useQuery } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { useApi } from 'hooks/useApi';
import { QUERY_OPTIONS } from '../constants/queryOptions';
import { isMovies, isTVShows } from '../utils/search';

const fetchPeople = async (
    api: TesserafinApi,
    userId: string,
    params?: PersonApiGetPersonsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getPersonApi(api).getPersons(
        {
            ...QUERY_OPTIONS,
            userId,
            ...params
        },
        options
    );
    return response.data;
};

export const usePeopleSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string
) => {
    const { reefinApi: api, user } = useApi();
    const userId = user?.Id;

    const isPeopleEnabled =
        !collectionType ||
        isMovies(collectionType) ||
        isTVShows(collectionType);

    return useQuery({
        queryKey: ['Search', 'People', collectionType, parentId, searchTerm],
        queryFn: ({ signal }) =>
            fetchPeople(
                api!,
                userId!,
                {
                    searchTerm,
                    // TODO remove this exclusion when artists are migrated to the persons endpoint
                    excludePersonTypes: [
                        PersonKind.Artist,
                        PersonKind.AlbumArtist
                    ]
                },
                { signal }
            ),
        enabled: !!api && !!userId && isPeopleEnabled
    });
};
