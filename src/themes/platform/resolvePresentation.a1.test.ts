import { describe, expect, it } from 'vitest';

import {
    type ThemeCapability,
    type ThemePresentation,
    WEB_RENDERER_CAPABILITIES
} from './contract';
import { getManifestForThemeId } from './manifests';
import {
    PLATFORM_DEFAULT_PRESENTATION,
    resolvePresentation
} from './resolvePresentation';

const resolve = (presentation: unknown) =>
    resolvePresentation({ presentation: presentation as ThemePresentation })
        .presentation;

/**
 * THEME-A1: section titles, card title lines, tab style and grid sizes. The defaults must reproduce
 * the product as it was drawn before the keys existed, and a hand-edited applied-presentation
 * record must degrade key by key rather than reach a component.
 */
describe('THEME-A1 defaults reproduce the product as it was', () => {
    it('keeps one-line card titles and underlined tabs', () => {
        expect(resolve({}).mediaCard.titleLines).toBe(1);
        expect(resolve({}).navigation.tabs).toBe('underline');
    });

    it('leaves every section heading to its page', () => {
        expect(resolve({}).sectionTitle).toEqual({
            size: 'auto',
            weight: 'auto',
            align: 'start',
            case: 'none',
            spacing: 'normal'
        });
    });

    it('draws every grid at its own size', () => {
        expect(resolve({}).grid).toEqual({
            library: 'medium',
            people: 'medium',
            episodes: 'medium',
            chapters: 'medium'
        });
    });

    it('resolves Classic, which declares none of them, to exactly those defaults', () => {
        const classic = getManifestForThemeId('official.classic');
        if (!classic) throw new Error('Classic must have a manifest');
        const { presentation } = resolvePresentation(classic);
        expect(presentation.sectionTitle).toEqual(
            PLATFORM_DEFAULT_PRESENTATION.sectionTitle
        );
        expect(presentation.grid).toEqual(PLATFORM_DEFAULT_PRESENTATION.grid);
        expect(presentation.navigation.tabs).toBe('underline');
        expect(presentation.mediaCard.titleLines).toBe(1);
    });

    it('gives Glass its pill tabs and bold, larger section titles', () => {
        const glass = getManifestForThemeId('official.glass');
        if (!glass) throw new Error('Glass must have a manifest');
        const resolution = resolvePresentation(glass);
        expect(resolution.fallbacks).toEqual([]);
        expect(resolution.presentation.navigation.tabs).toBe('pills');
        expect(resolution.presentation.sectionTitle.size).toBe('large');
        expect(resolution.presentation.sectionTitle.weight).toBe('bold');
        // Stated keys only: the rest of the recipe is still the default.
        expect(resolution.presentation.sectionTitle.align).toBe('start');
    });
});

describe('THEME-A1 values are checked key by key', () => {
    it('keeps a valid title-line count and drops one outside 1-3', () => {
        expect(
            resolve({ mediaCard: { titleLines: 3 } }).mediaCard.titleLines
        ).toBe(3);
        expect(
            resolve({ mediaCard: { titleLines: 4 } }).mediaCard.titleLines
        ).toBe(1);
        expect(
            resolve({ mediaCard: { titleLines: 0 } }).mediaCard.titleLines
        ).toBe(1);
    });

    it('drops a title-line count written as a string — the schema says a number', () => {
        expect(
            resolve({ mediaCard: { titleLines: '2' } }).mediaCard.titleLines
        ).toBe(1);
    });

    it('keeps the other media-card keys when titleLines is dropped', () => {
        const mediaCard = resolve({
            mediaCard: { titlePlacement: 'overlay', titleLines: 'many' }
        }).mediaCard;
        expect(mediaCard.titlePlacement).toBe('overlay');
        expect(mediaCard.titleLines).toBe(1);
        expect(Object.keys(mediaCard)).not.toContain('many');
    });

    it('drops an unknown section-title value without costing the others', () => {
        expect(
            resolve({
                sectionTitle: {
                    size: 'huge',
                    align: 'center',
                    case: 'shouting'
                }
            }).sectionTitle
        ).toEqual({
            ...PLATFORM_DEFAULT_PRESENTATION.sectionTitle,
            align: 'center'
        });
    });

    it('drops an unknown grid context and an unknown size independently', () => {
        expect(
            resolve({
                grid: { people: 'large', posters: 'large', chapters: 'giant' }
            }).grid
        ).toEqual({ ...PLATFORM_DEFAULT_PRESENTATION.grid, people: 'large' });
    });

    it('drops an unknown tab style and keeps the shell', () => {
        const navigation = resolve({
            navigation: { shell: 'sidebar', tabs: 'ribbon' }
        }).navigation;
        expect(navigation.shell).toBe('sidebar');
        expect(navigation.tabs).toBe('underline');
    });

    it('ignores groups that are not objects', () => {
        expect(resolve({ sectionTitle: 'large', grid: ['large'] })).toEqual(
            PLATFORM_DEFAULT_PRESENTATION
        );
    });
});

describe('THEME-A1 capabilities fall back like every other', () => {
    const without = (capability: ThemeCapability) =>
        WEB_RENDERER_CAPABILITIES.filter((entry) => entry !== capability);

    it('reports a renderer that cannot draw section titles, and uses the default', () => {
        const resolution = resolvePresentation(
            { presentation: { sectionTitle: { size: 'large' } } },
            without('presentation.sectionTitle')
        );
        expect(resolution.presentation.sectionTitle).toEqual(
            PLATFORM_DEFAULT_PRESENTATION.sectionTitle
        );
        expect(resolution.fallbacks).toEqual([
            {
                capability: 'presentation.sectionTitle',
                reason: 'unsupported-by-renderer'
            }
        ]);
    });

    it('reports a renderer that cannot size grids, and uses the default', () => {
        const resolution = resolvePresentation(
            { presentation: { grid: { library: 'small' } } },
            without('presentation.grid')
        );
        expect(resolution.presentation.grid).toEqual(
            PLATFORM_DEFAULT_PRESENTATION.grid
        );
        expect(resolution.fallbacks.map((entry) => entry.capability)).toEqual([
            'presentation.grid'
        ]);
    });

    it('refuses a theme that requires one of them on such a renderer', () => {
        const resolution = resolvePresentation(
            {
                presentation: {},
                capabilities: { required: ['presentation.grid'] }
            },
            without('presentation.grid')
        );
        expect(resolution.activatable).toBe(false);
        expect(resolution.missingRequired).toEqual(['presentation.grid']);
    });

    it('still reports page fallbacks in their old order, after the new groups', () => {
        const resolution = resolvePresentation(
            {
                presentation: {
                    grid: { people: 'small' },
                    page: { home: { shelfDensity: 'compact' } }
                }
            },
            ['tokens.core']
        );
        expect(resolution.fallbacks.map((entry) => entry.capability)).toEqual([
            'presentation.grid',
            'presentation.page.home'
        ]);
    });
});
