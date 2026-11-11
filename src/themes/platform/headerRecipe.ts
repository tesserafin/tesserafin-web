/**
 * The header recipe (THEME-B1, `docs/tesserafin/design-theme-header.md`): its vocabulary, its
 * platform defaults and its resolution, in a module of its own.
 *
 * Only the header itself (the modern shell's lazy chunk) and the Theme Studio need any of it, so it
 * stays out of the start-up bundle: `resolvePresentation` passes the theme's `header` group through
 * untouched — still reporting a capability fallback — and the bar resolves it here when it renders.
 * Kept out of `contract.ts` on purpose: everything exported from there ships at start-up.
 */

import type { SurfacePresentation } from './contract';

/**
 * The vocabulary (§3). How the
 * bar looks, never what it holds: which actions, destinations and menus exist stays the product's.
 * Only the B1 keys are published; `layout`, `actions`, `overlap` (B2) and `anchor` (B3) are not in
 * this vocabulary until a renderer binds them.
 *
 * Every default reproduces the bar as drawn before the key existed. `nav.style` has no fixed
 * default: absent, it is DERIVED from the resolved `surface.variant` (glass → `floating`, else
 * `plain`), which is what the bar did, and it never reads the header's own material.
 */
export const HEADER_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const HEADER_SHAPES = ['bar', 'floating'] as const;
export const HEADER_REST_MATERIALS = [
    'transparent',
    'surface',
    'glass'
] as const;
export const HEADER_SCROLLED_MATERIALS = ['surface', 'glass'] as const;
export const HEADER_SEPARATORS = ['none', 'hairline', 'shadow'] as const;
export const HEADER_BRAND_SHOWS = ['markAndName', 'mark', 'name'] as const;
export const HEADER_BRAND_SIZES = ['small', 'medium', 'large'] as const;
export const HEADER_BRAND_LABELS = ['server', 'product'] as const;
export const HEADER_NAV_STYLES = [
    'plain',
    'underline',
    'segmented',
    'floating'
] as const;

export interface HeaderPresentation {
    density?: (typeof HEADER_DENSITIES)[number];
    shape?: (typeof HEADER_SHAPES)[number];
    material?: {
        rest?: (typeof HEADER_REST_MATERIALS)[number];
        scrolled?: (typeof HEADER_SCROLLED_MATERIALS)[number];
    };
    separator?: (typeof HEADER_SEPARATORS)[number];
    brand?: {
        show?: (typeof HEADER_BRAND_SHOWS)[number];
        size?: (typeof HEADER_BRAND_SIZES)[number];
        label?: (typeof HEADER_BRAND_LABELS)[number];
    };
    nav?: { style?: (typeof HEADER_NAV_STYLES)[number] };
}

export interface ResolvedHeader {
    density: NonNullable<HeaderPresentation['density']>;
    shape: NonNullable<HeaderPresentation['shape']>;
    separator: NonNullable<HeaderPresentation['separator']>;
    material: Required<NonNullable<HeaderPresentation['material']>>;
    brand: Required<NonNullable<HeaderPresentation['brand']>>;
    /** Always set once resolved: the theme's, or derived from `surface.variant`. */
    nav: Required<NonNullable<HeaderPresentation['nav']>>;
}

/**
 * The bar as drawn before the recipe existed: fixed, dense (48 px), transparent at rest, MUI's
 * default surface with an elevation shadow once scrolled, the mark and the server name. `nav.style`
 * here is only the opaque-surface value: {@link resolveHeader} derives it.
 */
export const PLATFORM_DEFAULT_HEADER: ResolvedHeader = {
    density: 'compact',
    shape: 'bar',
    separator: 'shadow',
    material: { rest: 'transparent', scrolled: 'surface' },
    brand: { show: 'markAndName', size: 'medium', label: 'server' },
    nav: { style: 'plain' }
};

const TABLES = {
    density: HEADER_DENSITIES,
    shape: HEADER_SHAPES,
    separator: HEADER_SEPARATORS
};
const NESTED = {
    material: {
        rest: HEADER_REST_MATERIALS,
        scrolled: HEADER_SCROLLED_MATERIALS
    },
    brand: {
        show: HEADER_BRAND_SHOWS,
        size: HEADER_BRAND_SIZES,
        label: HEADER_BRAND_LABELS
    },
    nav: { style: HEADER_NAV_STYLES }
};

const pick = (
    source: unknown,
    table: Record<string, readonly string[]>
): Record<string, string> => {
    const clean: Record<string, string> = {};
    if (source && typeof source === 'object') {
        for (const [key, values] of Object.entries(table)) {
            const value = (source as Record<string, unknown>)[key];
            if (values.includes(value as string)) clean[key] = value as string;
        }
    }
    return clean;
};

/**
 * The theme's `header` group, resolved. Checked level by level — a bad `brand.size` costs that key
 * only — merged over the defaults one level down, so `{ material: { rest: 'glass' } }` keeps the
 * default `scrolled`. A hand-edited record degrades; nothing throws.
 *
 * `nav.style`, when the theme does not state a valid one, comes from the RESOLVED global surface —
 * the value `AppTopNav.scss` keyed on before — never from the header's own material, so it neither
 * changes on scroll nor because the bar was given a material.
 */
export function resolveHeader(
    header: unknown,
    surfaceVariant: SurfacePresentation['variant']
): ResolvedHeader {
    const flat = pick(header, TABLES);
    const nested = Object.fromEntries(
        Object.entries(NESTED).map(([key, table]) => [
            key,
            {
                ...PLATFORM_DEFAULT_HEADER[key as keyof typeof NESTED],
                ...pick(
                    (header as Record<string, unknown> | undefined)?.[key],
                    table
                )
            }
        ])
    );
    const resolved = {
        ...PLATFORM_DEFAULT_HEADER,
        ...flat,
        ...nested
    } as ResolvedHeader;
    if (
        !pick((header as Record<string, unknown> | undefined)?.nav, NESTED.nav)
            .style
    ) {
        resolved.nav = {
            style: surfaceVariant === 'glass' ? 'floating' : 'plain'
        };
    }
    return resolved;
}
