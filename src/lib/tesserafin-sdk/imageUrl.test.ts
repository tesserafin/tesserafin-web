import { describe, expect, it } from 'vitest';

import type { TesserafinApi } from './client';
import { ImageType } from './generated/models/image-type';
import { getItemImageUrl } from './imageUrl';

const api = { basePath: 'https://media.example/base' } as TesserafinApi;

describe('getItemImageUrl', () => {
    it('builds the item image route with only the given parameters', () => {
        expect(
            getItemImageUrl(api, 'abc', ImageType.Primary, {
                maxWidth: 640,
                quality: undefined
            })
        ).toBe(
            'https://media.example/base/Items/abc/Images/Primary?maxWidth=640'
        );
    });

    it('omits the query string when no parameter is set', () => {
        expect(getItemImageUrl(api, 'abc', ImageType.Backdrop)).toBe(
            'https://media.example/base/Items/abc/Images/Backdrop'
        );
    });

    it('encodes the item id', () => {
        expect(getItemImageUrl(api, 'a/b c', ImageType.Primary)).toBe(
            'https://media.example/base/Items/a%2Fb%20c/Images/Primary'
        );
    });
});
