import { describe, expect, it } from 'vitest';

import { TesserafinApi } from './client';

const api = new TesserafinApi(
    'https://media.example/base/',
    { name: 'Tesserafin Web', version: '0.0.0' },
    { name: 'test', id: 'device' },
    'secret-token'
);

describe('TesserafinApi.getUri', () => {
    it('joins the base path and the server path, without a trailing-slash doubling', () => {
        expect(api.getUri('/Branding/Splashscreen')).toBe(
            'https://media.example/base/Branding/Splashscreen'
        );
    });

    it('adds only the defined query parameters', () => {
        expect(
            api.getUri('/Branding/Splashscreen', {
                t: 42,
                skipped: undefined,
                alsoSkipped: null
            })
        ).toBe('https://media.example/base/Branding/Splashscreen?t=42');
    });

    it('never puts the access token in the URL', () => {
        expect(api.getUri('/Branding/Splashscreen', { t: 1 })).not.toContain(
            'secret-token'
        );
    });
});
