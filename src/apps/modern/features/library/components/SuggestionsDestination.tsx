import type { UseQueryResult } from '@tanstack/react-query';
import React, { type FC, useMemo } from 'react';

import { useSlotText } from 'hooks/useSlotText';
import globalize from 'lib/globalize';
import type { TextSlotId } from 'themes/platform/contract';
import { BaseItemKind, CollectionType } from 'lib/tesserafin-sdk';
import type { ItemDto } from 'types/base/models/item-dto';
import type { ItemDtoQueryResult } from 'types/base/models/item-dto-query-result';
import { EmptyState, LoadingState, MediaCard, MediaShelf } from 'ui';

import {
    useLibraryLatestItems,
    useLibraryMovieRecommendations,
    useLibraryNextUp,
    useLibraryResumeItems,
    useLibraryUpcoming
} from '../api/useLibraryDestinations';
import { getSuggestionsShelves } from '../constants/librarySections';
import type { LibraryDensity } from '../utils/density';
import type { LibraryCardAspect } from '../utils/libraryRecipe';
import {
    type ImageApiClient,
    toMediaCardPropsArray
} from '../utils/mediaCardProps';
import { getRecommendationTitle } from '../utils/recommendationTitle';

export interface SuggestionsDestinationProps {
    libraryId: string;
    collectionType: CollectionType | string | null | undefined;
    density: LibraryDensity;
    apiClient: ImageApiClient | undefined;
    /**
     * Resolved `presentation.page.library.cardAspect`. Suggestions is EDITORIAL — it is already a
     * column of shelves, so `layout` has nothing to compose here — but its cards are media items
     * like Browse's, and a recipe that shaped one and not the other would be a recipe the route
     * half-applies.
     */
    cardAspect: LibraryCardAspect;
}

/** Section name (`types/sections.ts` `SectionType` values) → its shelf heading. */
const SHELF_TITLE_KEY: Record<string, string> = {
    ContinueWatchingMovies: 'HeaderContinueWatching',
    ContinueWatchingEpisode: 'HeaderContinueWatching',
    LatestMovies: 'HeaderLatestMovies',
    LatestEpisode: 'HeaderLatestEpisodes',
    NextUp: 'NextUp',
    UpcomingEpisodes: 'HeaderUpcoming'
};

/**
 * The shelves a theme may reword (THEME-A2). Their own slots, distinct from Home's even where the
 * translation key is shared, so renaming Home's "Next up" leaves this tab alone and vice versa.
 */
const SHELF_TITLE_SLOT: Record<string, TextSlotId> = {
    ContinueWatchingMovies: 'library.suggestions.continueWatching.title',
    ContinueWatchingEpisode: 'library.suggestions.continueWatching.title',
    NextUp: 'library.suggestions.nextUp.title',
    UpcomingEpisodes: 'library.suggestions.upcomingEpisodes.title'
};

interface ShelfProps {
    /** The section's `SectionType` name, which picks both its heading key and its text slot. */
    name: string;
    query: UseQueryResult<ItemDtoQueryResult | undefined, Error>;
    density: LibraryDensity;
    apiClient: ImageApiClient | undefined;
    cardAspect: LibraryCardAspect;
}

/**
 * One shelf. An **empty shelf renders nothing at all** rather than an "empty" placeholder: a
 * Suggestions page is editorial, and a column of "nothing here" boxes for every shelf a new user
 * has not populated yet would be worse than a shorter page. Errors are swallowed for the same
 * reason — one failing shelf must not replace the whole destination with an error state.
 */
const Shelf: FC<ShelfProps> = ({
    name,
    query,
    density,
    apiClient,
    cardAspect
}) => {
    const cards = useMemo(
        () => toMediaCardPropsArray(query.data?.Items, apiClient, cardAspect),
        [query.data?.Items, apiClient, cardAspect]
    );
    const title = useSlotText(
        SHELF_TITLE_SLOT[name],
        SHELF_TITLE_KEY[name] ?? name
    );

    if (query.isPending && query.fetchStatus !== 'idle') {
        return (
            <LoadingState
                variant='shelf'
                label={globalize.translate('Loading')}
            />
        );
    }

    if (!cards.length) return null;

    return (
        <MediaShelf
            title={title.text}
            titleLang={title.langAttribute}
            density={density}
        >
            {cards.map((cardProps) => (
                <MediaCard key={cardProps.href} {...cardProps} />
            ))}
        </MediaShelf>
    );
};

/**
 * Suggestions — a destination because its content is **editorialised**, not expressible as one
 * query (design §3.1 criterion 2 read the other way round: no single `getItems` call produces
 * "continue watching, then latest, then because-you-watched").
 *
 * This is also where **Upcoming** now lives. Design §3.2 folds the legacy Upcoming *tab* in here as
 * a shelf, on the evidence that `upcomingTabContent` carries no `itemType` at all: it was already a
 * sections view, never a list, so it had no business being a peer of Series. `getSuggestionsShelves`
 * is what encodes that, and it is the only place the shelf set is decided.
 */
export const SuggestionsDestination: FC<SuggestionsDestinationProps> = ({
    libraryId,
    collectionType,
    density,
    apiClient,
    cardAspect
}) => {
    const shelves = getSuggestionsShelves(collectionType);
    const has = (name: string) => shelves.includes(name);

    const isTvshows = collectionType === CollectionType.Tvshows;
    const itemKind = isTvshows ? BaseItemKind.Episode : BaseItemKind.Movie;

    const shelfParams = libraryId
        ? { parentId: libraryId, includeItemTypes: [itemKind] }
        : undefined;
    const enabledParams = (name: string) =>
        has(name) ? shelfParams : undefined;

    // Every hook is called unconditionally (rules of hooks); `enabled` inside each one is what
    // actually decides whether a request goes out — see `useLibraryDestinations.ts`.
    const resumeQuery = useLibraryResumeItems(
        enabledParams(
            isTvshows ? 'ContinueWatchingEpisode' : 'ContinueWatchingMovies'
        )
    );
    const latestQuery = useLibraryLatestItems(
        enabledParams(isTvshows ? 'LatestEpisode' : 'LatestMovies')
    );
    const nextUpQuery = useLibraryNextUp(enabledParams('NextUp'));
    const upcomingQuery = useLibraryUpcoming(
        has('UpcomingEpisodes') && libraryId
            ? { parentId: libraryId }
            : undefined
    );
    const recommendationsQuery = useLibraryMovieRecommendations(
        enabledParams('MovieRecommendations')
    );

    const recommendationShelves = useMemo(
        () =>
            (recommendationsQuery.data ?? [])
                .filter((group) => !!group.Items?.length)
                .map((group, index) => ({
                    key: group.CategoryId ?? `recommendation-${index}`,
                    title: getRecommendationTitle(group),
                    cards: toMediaCardPropsArray(
                        // `RecommendationDto.Items` is the SDK's `BaseItemDto`; the card adapter
                        // works in `ItemDto` (`types/base/models/item-dto.ts`), the same flattened
                        // shape `useLibraryItems` casts its `getItems` response to. Only the fields
                        // the adapter reads matter here, and they are identical in both.
                        group.Items as unknown as ItemDto[],
                        apiClient,
                        cardAspect
                    )
                })),
        [recommendationsQuery.data, apiClient, cardAspect]
    );

    const orderedShelves = shelves
        .map((name) => {
            switch (name) {
                case 'ContinueWatchingMovies':
                case 'ContinueWatchingEpisode':
                    return { name, query: resumeQuery };
                case 'LatestMovies':
                case 'LatestEpisode':
                    return { name, query: latestQuery };
                case 'NextUp':
                    return { name, query: nextUpQuery };
                case 'UpcomingEpisodes':
                    return { name, query: upcomingQuery };
                default:
                    return undefined;
            }
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry);

    const isEverythingEmpty =
        !recommendationShelves.length &&
        orderedShelves.every(
            (entry) =>
                !entry.query.isPending && !entry.query.data?.Items?.length
        );

    if (isEverythingEmpty) {
        return (
            <EmptyState
                title={globalize.translate('MessageNoItemsAvailable')}
            />
        );
    }

    return (
        <div className='rf-library-view__shelves'>
            {orderedShelves.map((entry) => (
                <Shelf
                    key={entry.name}
                    name={entry.name}
                    query={entry.query}
                    density={density}
                    apiClient={apiClient}
                    cardAspect={cardAspect}
                />
            ))}

            {recommendationShelves.map((shelf) => (
                <MediaShelf
                    key={shelf.key}
                    title={shelf.title}
                    density={density}
                >
                    {shelf.cards.map((cardProps) => (
                        <MediaCard key={cardProps.href} {...cardProps} />
                    ))}
                </MediaShelf>
            ))}
        </div>
    );
};

export default SuggestionsDestination;
