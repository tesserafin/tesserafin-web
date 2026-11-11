import { describe, expect, it } from 'vitest';

import themeSchema from '../../../tesserafin-design/schema/theme.schema.json';

import { type ThemePresentation, WEB_RENDERER_CAPABILITIES } from './contract';
import {
    HEADER_BRAND_LABELS,
    HEADER_BRAND_SHOWS,
    HEADER_BRAND_SIZES,
    HEADER_DENSITIES,
    HEADER_NAV_STYLES,
    HEADER_REST_MATERIALS,
    HEADER_SCROLLED_MATERIALS,
    HEADER_SEPARATORS,
    HEADER_SHAPES,
    PLATFORM_DEFAULT_HEADER,
    resolveHeader
} from './headerRecipe';
import { getManifestForThemeId } from './manifests';
import { resolvePresentation } from './resolvePresentation';

/** What the bar does: resolve the passed-through `header` group against the resolved surface. */
const resolve = (presentation: unknown) => {
    const resolved = resolvePresentation({
        presentation: presentation as ThemePresentation
    }).presentation;
    return { header: resolveHeader(resolved.header, resolved.surface.variant) };
};
const officialHeader = (themeId: string) => {
    const manifest = getManifestForThemeId(themeId);
    if (!manifest) throw new Error(themeId);
    const resolved = resolvePresentation(manifest).presentation;
    return resolveHeader(resolved.header, resolved.surface.variant);
};

describe('header recipe defaults (THEME-B1)', () => {
    it('reproduces the bar as it was: dense, transparent then surface with a shadow, mark and name', () => {
        expect(resolve({}).header).toEqual({
            density: 'compact',
            shape: 'bar',
            separator: 'shadow',
            material: { rest: 'transparent', scrolled: 'surface' },
            brand: { show: 'markAndName', size: 'medium', label: 'server' },
            nav: { style: 'plain' }
        });
    });

    it('derives the destinations style from the resolved surface, as AppTopNav.scss did', () => {
        expect(
            resolve({ surface: { variant: 'glass' } }).header.nav.style
        ).toBe('floating');
        expect(
            resolve({ surface: { variant: 'opaque' } }).header.nav.style
        ).toBe('plain');
        expect(officialHeader('official.glass').nav.style).toBe('floating');
        expect(officialHeader('official.classic').nav.style).toBe('plain');
    });

    it('never derives it from the header material, so it does not change on scroll', () => {
        const glassBar = resolve({
            surface: { variant: 'opaque' },
            header: { material: { rest: 'glass', scrolled: 'glass' } }
        });
        expect(glassBar.header.nav.style).toBe('plain');
    });

    it('lets a stated style win in both directions', () => {
        expect(
            resolve({
                surface: { variant: 'glass' },
                header: { nav: { style: 'underline' } }
            }).header.nav.style
        ).toBe('underline');
        expect(
            resolve({
                surface: { variant: 'opaque' },
                header: { nav: { style: 'floating' } }
            }).header.nav.style
        ).toBe('floating');
    });
});

describe('header recipe sanitising', () => {
    it('merges nested groups one level down', () => {
        const header = resolve({
            header: { material: { rest: 'glass' }, brand: { size: 'large' } }
        }).header;
        expect(header.material).toEqual({ rest: 'glass', scrolled: 'surface' });
        expect(header.brand).toEqual({
            show: 'markAndName',
            size: 'large',
            label: 'server'
        });
    });

    it('drops a bad value at its own level only', () => {
        const header = resolve({
            header: {
                density: 'huge',
                shape: 'floating',
                brand: { show: 'logo', size: 'small' },
                material: 'glass',
                nav: { style: 'pills' }
            }
        }).header;
        expect(header.density).toBe('compact');
        expect(header.shape).toBe('floating');
        expect(header.brand).toEqual({
            show: 'markAndName',
            size: 'small',
            label: 'server'
        });
        expect(header.material).toEqual(PLATFORM_DEFAULT_HEADER.material);
        expect(header.nav.style).toBe('plain');
    });

    it('falls back as one capability on a renderer that lacks it', () => {
        const resolution = resolvePresentation(
            { presentation: { header: { density: 'spacious' } } },
            WEB_RENDERER_CAPABILITIES.filter(
                (entry) => entry !== 'presentation.header'
            )
        );
        expect(resolution.presentation.header).toEqual({});
        expect(resolution.fallbacks.map((entry) => entry.capability)).toEqual([
            'presentation.header'
        ]);
    });

    it('publishes only the B1 keys, and the same lists as the schema', () => {
        type Node = { enum?: string[]; properties: Record<string, Node> };
        const def = (themeSchema.$defs as unknown as Record<string, Node>)
            .headerVariant;
        expect(Object.keys(def.properties).sort()).toEqual(
            ['brand', 'density', 'material', 'nav', 'separator', 'shape'].sort()
        );
        expect(def.properties.density.enum).toEqual([...HEADER_DENSITIES]);
        expect(def.properties.shape.enum).toEqual([...HEADER_SHAPES]);
        expect(def.properties.separator.enum).toEqual([...HEADER_SEPARATORS]);
        expect(def.properties.material.properties.rest.enum).toEqual([
            ...HEADER_REST_MATERIALS
        ]);
        expect(def.properties.material.properties.scrolled.enum).toEqual([
            ...HEADER_SCROLLED_MATERIALS
        ]);
        expect(def.properties.brand.properties.show.enum).toEqual([
            ...HEADER_BRAND_SHOWS
        ]);
        expect(def.properties.brand.properties.size.enum).toEqual([
            ...HEADER_BRAND_SIZES
        ]);
        expect(def.properties.brand.properties.label.enum).toEqual([
            ...HEADER_BRAND_LABELS
        ]);
        expect(def.properties.nav.properties.style.enum).toEqual([
            ...HEADER_NAV_STYLES
        ]);
    });
});
