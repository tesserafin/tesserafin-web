import globalize from 'lib/globalize';
import { ImageType } from 'lib/tesserafin-sdk';
import { getWatchState } from 'utils/watchState';

import type { ImageApiClient } from 'apps/modern/features/home/utils/mediaCardProps';
import type { ItemDto } from 'types/base/models/item-dto';
import type { MediaCardProps } from 'ui';

/**
 * `ItemDto` (`types/base/models/item-dto.ts`) to `ui`'s `MediaCardProps` adapter for
 * `/library/:libraryId` (RFC-0005 §11 WP-C step 4). `/home`'s own adapter
 * (`apps/modern/features/home/utils/mediaCardProps.ts`) does the same job but is typed against
 * `lib/tesserafin-sdk`'s `BaseItemDto` (RFC-0005 §4.2) - a different, non-assignable nominal type from
 * the `ItemDto` this route's grid works in, which `useLibraryItems` produces by casting its
 * `getItems` response to `ItemDtoQueryResult`. Rather than force a
 * generic cross-realm shared module (more coupling than the ~20 lines below are worth), this
 * re-implements only what a movies/tvshows grid card needs: `ImageApiClient` is re-imported
 * (type-only, no behavior duplicated) since `useApi().__legacyApiClient__` has the same shape either
 * way; the image-selection and href logic below are deliberately smaller than `/home`'s - no
 * series-inherited image or folder/library-tile href branches, since every item in this grid is a
 * leaf `Movie`/`Series` with its own artwork and its own details page.
 */
export type { ImageApiClient };

/**
 * The artwork that FITS the card's shape, chosen from tags the catalogue response already carries.
 *
 * A `backdrop` card takes the item's landscape art — its `Thumb`, else its first `Backdrop` — and
 * falls back to the poster only when the item has neither. Before THEME-IDENTITY-1 every shape got
 * the poster, so a 16:9 card showed a band cut from the middle of a 2:3 image: the composition
 * asked for a landscape card and the adapter filled it with a portrait. `/home` has always made
 * this choice for its 16:9 shelves (`preferThumb`); this is the same rule.
 *
 * What it does not do is change a REQUEST to the API. The tags are fields of the item the route
 * already fetched, the catalogue query is untouched (`LibraryView.recipe.test.tsx` holds its ledger
 * byte-identical across recipes), and an image URL names artwork the server advertised for this
 * item — the same class of choice as which `<img>` to draw, not a different question to the server.
 */
const selectImage = (
    item: ItemDto,
    imageAspect: MediaCardProps['imageAspect']
): { type: ImageType; tag: string } | undefined => {
    if (imageAspect === 'backdrop') {
        const thumb = item.ImageTags?.Thumb;
        if (thumb) return { type: ImageType.Thumb, tag: thumb };
        const backdrop = item.BackdropImageTags?.[0];
        if (backdrop) return { type: ImageType.Backdrop, tag: backdrop };
    }
    const primary = item.ImageTags?.Primary;
    return primary ? { type: ImageType.Primary, tag: primary } : undefined;
};

const getItemImageUrl = (
    item: ItemDto,
    apiClient: ImageApiClient | undefined,
    imageAspect: MediaCardProps['imageAspect']
): string | undefined => {
    if (!apiClient || !item.Id) return undefined;

    const image = selectImage(item, imageAspect);
    if (!image) return undefined;

    return apiClient.getImageUrl(item.Id, {
        type: image.type,
        tag: image.tag,
        quality: 96
    });
};

/**
 * `Movie`/`Series` always link to the generic details page (mirrors `appRouter.getRouteUrl()`'s
 * fallback for non-folder/non-library items - series aren't folder tiles from this grid's point of
 * view, they still open their details page like a movie does).
 */
const getItemHref = (item: ItemDto, fallbackServerId?: string): string => {
    const id = item.Id ?? '';
    const serverId = item.ServerId ?? fallbackServerId ?? '';

    return `#/details?id=${id}&serverId=${serverId}`;
};

/**
 * @param imageAspect The shape the card is drawn at, resolved from
 * `presentation.page.library.cardAspect` by `utils/libraryRecipe.ts`. Required rather than
 * defaulted: a call site that forgot it would silently render the platform default under every
 * theme, which is the "control that does nothing" failure the binding exists to avoid.
 *
 * The aspect also picks which of the item's advertised artworks fills the box ({@link selectImage}):
 * landscape art for a `backdrop` card, the poster otherwise. The catalogue request is the same under
 * every aspect.
 */
export const toMediaCardProps = (
    item: ItemDto,
    apiClient: ImageApiClient | undefined,
    imageAspect: MediaCardProps['imageAspect']
): MediaCardProps => {
    // The `ItemDto` type flattens `UserItemDataDto` onto the item, but the response it is cast from
    // nests it under `UserData`, as the server sends it. Reading the flattened field found nothing,
    // so no library card ever showed progress (WEB-UX-1).
    const watch = getWatchState(item.UserData);

    return {
        title: item.Name ?? '',
        subtitle: item.ProductionYear ? String(item.ProductionYear) : undefined,
        imageUrl: getItemImageUrl(item, apiClient, imageAspect),
        imageAspect,
        progressPercent: watch.progressPercent,
        played: watch.played,
        playedLabel: globalize.translate('Watched'),
        href: getItemHref(item, apiClient?.serverId?.())
    };
};

export const toMediaCardPropsArray = (
    items: ItemDto[] | null | undefined,
    apiClient: ImageApiClient | undefined,
    imageAspect: MediaCardProps['imageAspect']
): MediaCardProps[] =>
    (items ?? []).map((item) => toMediaCardProps(item, apiClient, imageAspect));
