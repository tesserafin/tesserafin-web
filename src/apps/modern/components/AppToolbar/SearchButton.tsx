import React, { type FC } from 'react';
import {
    Link,
    URLSearchParamsInit,
    createSearchParams,
    useLocation,
    useSearchParams
} from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import HeaderActionButton from 'components/toolbar/HeaderActionButton';
import { useItem } from 'hooks/useItem';
import globalize from 'lib/globalize';

const getUrlParams = (
    searchParams: URLSearchParams,
    library?: { id?: string; collectionType?: string | null }
) => {
    const parentId =
        searchParams.get('parentId') ||
        searchParams.get('topParentId') ||
        library?.id;
    const collectionType =
        searchParams.get('collectionType') || library?.collectionType;
    const params: URLSearchParamsInit = {};

    if (parentId) {
        params.parentId = parentId;
    }

    if (collectionType) {
        params.collectionType = collectionType;
    }
    return params;
};

/** Search is never moved into "More" (THEME-B2 §3.5); only its label is the recipe's. */
const SearchButton: FC<{ labelled?: boolean }> = ({ labelled }) => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    // `/library/:libraryId` names its library in the path, not the query: without this the button
    // opened a global search from inside a movies or shows library (DEBT-WEB-1).
    // Read from the path rather than with `useMatch`, which put ~130 B of route matching on the
    // start-up bundle for one segment.
    const libraryId = /^\/library\/([^/]+)/.exec(location.pathname)?.[1];
    const { data: library } = useItem(libraryId);

    const isSearchPath = location.pathname === '/search';
    const search = createSearchParams(
        getUrlParams(
            searchParams,
            libraryId
                ? { id: libraryId, collectionType: library?.CollectionType }
                : undefined
        )
    );
    const createSearchLink = {
        pathname: '/search',
        search: search ? `?${search}` : undefined
    };

    return (
        <HeaderActionButton
            label={globalize.translate('Search')}
            labelled={labelled}
            icon={<SearchIcon />}
            component={Link}
            disabled={isSearchPath}
            to={createSearchLink}
        />
    );
};

export default SearchButton;
