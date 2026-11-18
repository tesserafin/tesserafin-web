import type { TesserafinApi } from './client';
import type { ImageType } from './generated/models/image-type';

/**
 * Query parameters accepted by `GET /Items/{itemId}/Images/{imageType}` that the Web client sets
 * when it only needs a URL (an `<img src>`), not a request.
 */
export interface ItemImageUrlParams {
    maxWidth?: number;
    maxHeight?: number;
    width?: number;
    height?: number;
    quality?: number;
    fillWidth?: number;
    fillHeight?: number;
    tag?: string;
}

/**
 * Builds an item image URL for one server connection, synchronously. The generated `ImageApi`
 * only offers request methods and an async parameter creator; an `<img src>` needs a plain URL.
 * Same shape as `@jellyfin/sdk`'s `getItemImageUrlById`: no credential in the URL.
 */
export const getItemImageUrl = (
    api: TesserafinApi,
    itemId: string,
    imageType: ImageType,
    params: ItemImageUrlParams = {}
): string => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            query.set(key, String(value));
        }
    }
    const search = query.toString();
    return `${api.basePath}/Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(imageType)}${search ? `?${search}` : ''}`;
};
