import { describe, expect, it } from 'vitest';

import type { ThemePresentation } from './contract';
import { getManifestForThemeId } from './manifests';
import {
    PLATFORM_DEFAULT_PRESENTATION,
    resolvePresentation
} from './resolvePresentation';

const resolve = (presentation: unknown) =>
    resolvePresentation({ presentation: presentation as ThemePresentation })
        .presentation;

describe('navigation, now that the shell reads it (THEME-IDENTITY-1)', () => {
    it('defaults to the bar the shell always rendered', () => {
        // Binding `shell` while the default still said `sidebar` would have moved every
        // undeclared theme's navigation into a column.
        expect(resolve({}).navigation.shell).toBe('topbar');
    });

    it('drops an unknown value per key, keeping the valid ones', () => {
        expect(
            resolve({
                navigation: { shell: 'floating', labels: 'never', position: 3 }
            }).navigation
        ).toEqual({
            shell: PLATFORM_DEFAULT_PRESENTATION.navigation.shell,
            labels: 'never',
            position: PLATFORM_DEFAULT_PRESENTATION.navigation.position
        });
    });

    it('ignores a navigation that is not an object', () => {
        expect(resolve({ navigation: 'sidebar' }).navigation).toEqual(
            PLATFORM_DEFAULT_PRESENTATION.navigation
        );
    });
});

describe('itemDetails.facts and the immersive hero', () => {
    it('defaults facts to the labelled table the route rendered', () => {
        expect(resolve({}).page.itemDetails.facts).toBe('table');
    });

    it('defaults controls and people to what the route rendered, and drops unknown values', () => {
        expect(resolve({}).page.itemDetails.controls).toBe('form');
        expect(resolve({}).page.itemDetails.people).toBe('cards');
        const details = resolve({
            page: { itemDetails: { controls: 'buttons', people: 'portraits' } }
        }).page.itemDetails;
        expect(details.controls).toBe('form');
        expect(details.people).toBe('portraits');
    });

    it('keeps a valid facts and hero, and drops an unknown facts on its own', () => {
        const details = resolve({
            page: { itemDetails: { hero: 'immersive', facts: 'chips' } }
        }).page.itemDetails;
        expect(details.hero).toBe('immersive');
        expect(details.facts).toBe('table');
    });
});

/*
 * The two official themes must keep differing in STRUCTURE, not only in colour. These are the
 * four structural choices this slice gives them; a manifest edit that made any pair converge
 * would silently return the themes to "the same page in two palettes".
 */
describe('official themes — structurally distinct', () => {
    const classic = resolvePresentation(
        getManifestForThemeId('official.classic') ?? {}
    ).presentation;
    const glass = resolvePresentation(
        getManifestForThemeId('official.glass') ?? {}
    ).presentation;

    it.each([
        [
            'navigation shell',
            (p: typeof classic) => p.navigation.shell,
            'sidebar',
            'topbar'
        ],
        [
            'card title placement',
            (p: typeof classic) => p.mediaCard.titlePlacement,
            'below',
            'overlay'
        ],
        [
            'details hero',
            (p: typeof classic) => p.page.itemDetails.hero,
            'backdrop',
            'immersive'
        ],
        [
            'details controls',
            (p: typeof classic) => p.page.itemDetails.controls,
            'form',
            'pill'
        ],
        [
            'details people',
            (p: typeof classic) => p.page.itemDetails.people,
            'cards',
            'portraits'
        ],
        [
            'details facts',
            (p: typeof classic) => p.page.itemDetails.facts,
            'table',
            'inline'
        ]
    ])('%s', (_, read, classicValue, glassValue) => {
        expect(read(classic)).toBe(classicValue);
        expect(read(glass)).toBe(glassValue);
    });

    it('resolves both without a fallback', () => {
        for (const id of ['official.classic', 'official.glass']) {
            const manifest = getManifestForThemeId(id);
            expect(manifest, id).toBeDefined();
            expect(resolvePresentation(manifest ?? {}).fallbacks, id).toEqual(
                []
            );
        }
    });
});
