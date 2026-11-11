import { describe, expect, it } from 'vitest';

import { fillTemplate, resolveOverride } from './slotText';

const LIBRARY = { libraryName: 'Films' };

describe('fillTemplate (THEME-A2 §4)', () => {
    it('fills a named variable', () => {
        expect(
            fillTemplate('Nouveautés · {libraryName}', LIBRARY, 'title')
        ).toBe('Nouveautés · Films');
    });

    it('refuses a template without a required variable', () => {
        expect(fillTemplate('Nouveautés', LIBRARY, 'title')).toBeNull();
    });

    it('refuses an unknown or repeated variable', () => {
        expect(fillTemplate('{library}', LIBRARY, 'title')).toBeNull();
        expect(
            fillTemplate('{libraryName} / {libraryName}', LIBRARY, 'title')
        ).toBeNull();
        expect(fillTemplate('À venir {count}', {}, 'title')).toBeNull();
    });

    it('reads doubled braces as literal ones and refuses a lone brace', () => {
        expect(fillTemplate('{{bientôt}}', {}, 'title')).toBe('{bientôt}');
        expect(fillTemplate('à venir }', {}, 'title')).toBeNull();
        expect(fillTemplate('{ à venir', {}, 'title')).toBeNull();
    });

    it('refuses empty, blank and control-character text', () => {
        expect(fillTemplate('', {}, 'title')).toBeNull();
        expect(fillTemplate('   ', {}, 'title')).toBeNull();
        expect(fillTemplate('À\nvenir', {}, 'title')).toBeNull();
        expect(fillTemplate(42, {}, 'title')).toBeNull();
    });

    it('counts the ceiling in code points, on the template, before interpolation', () => {
        const emoji = '🎬'.repeat(120); // 240 UTF-16 units, 120 code points
        expect(fillTemplate(emoji, {}, 'title')).toBe(emoji);
        expect(fillTemplate(`${emoji}x`, {}, 'title')).toBeNull();
        expect(fillTemplate('x'.repeat(81), {}, 'action')).toBeNull();
        // A long library name never invalidates a valid template.
        expect(
            fillTemplate(
                'Nouveautés · {libraryName}',
                { libraryName: 'L'.repeat(200) },
                'title'
            )
        ).toHaveLength('Nouveautés · '.length + 200);
    });

    it('inserts values as text, markup included', () => {
        expect(
            fillTemplate('{libraryName}', { libraryName: '<b>x</b>' }, 'title')
        ).toBe('<b>x</b>');
    });
});

describe('resolveOverride (THEME-A2 §5)', () => {
    const slot = 'library.suggestions.upcomingEpisodes.title';

    it('never shows an override in another language', () => {
        const layers = [{ [slot]: { fr: 'Prochains épisodes' } }];
        expect(
            resolveOverride(layers, slot, 'nl', {}, 'title')
        ).toBeUndefined();
        expect(
            resolveOverride(layers, slot, 'en-us', {}, 'title')
        ).toBeUndefined();
    });

    it('applies a language override under its regions, not the reverse', () => {
        expect(
            resolveOverride(
                [{ [slot]: { fr: 'À venir' } }],
                slot,
                'fr-ca',
                {},
                'title'
            )
        ).toEqual({ text: 'À venir', lang: 'fr' });
        expect(
            resolveOverride(
                [{ [slot]: { 'fr-ca': 'À venir (CA)' } }],
                slot,
                'fr',
                {},
                'title'
            )
        ).toBeUndefined();
    });

    it('prefers the region over the language, and the local draft over the theme', () => {
        const local = { [slot]: { fr: 'Local' } };
        const theme = { [slot]: { 'fr-ca': 'Thème CA', fr: 'Thème' } };
        expect(
            resolveOverride([null, theme], slot, 'fr-ca', {}, 'title')
        ).toEqual({
            text: 'Thème CA',
            lang: 'fr-ca'
        });
        expect(
            resolveOverride([local, theme], slot, 'fr-ca', {}, 'title')?.text
        ).toBe('Local');
    });

    it('skips an invalid value to the next one, per slot and per language', () => {
        const local = { [slot]: { 'fr-ca': '', fr: 7 as unknown as string } };
        const theme = { [slot]: { fr: 'Thème' } };
        expect(
            resolveOverride([local, theme], slot, 'fr-ca', {}, 'title')?.text
        ).toBe('Thème');
    });

    it('ignores a slot entry that is not an object', () => {
        const broken = {
            [slot]: 'Prochains' as unknown as Record<string, string>
        };
        expect(
            resolveOverride([broken], slot, 'fr', {}, 'title')
        ).toBeUndefined();
    });
});
