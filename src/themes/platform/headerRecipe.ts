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
 * B1 published the bar's look; B2 adds its arrangement (`layout`), how actions are presented
 * (`actions.labels`, `actions.grouping`) and its relation to the page (`overlap`). `anchor` (B3) is
 * not in this vocabulary until a renderer binds it.
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

/** B2. Named compositions only: the DOM order is the visual order is the keyboard order. */
export const HEADER_LAYOUTS = ['start', 'centered'] as const;
export const HEADER_ACTION_LABELS = ['icons', 'iconsAndLabels'] as const;
/** `overflow` may move SECONDARY actions into one "More" menu; never Search, the account or a live remote session. */
export const HEADER_ACTION_GROUPINGS = ['inline', 'overflow'] as const;
/** `hero`: the page starts under the bar, only on a page that declares a compatible lead image. */
export const HEADER_OVERLAPS = ['none', 'hero'] as const;

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
    layout?: (typeof HEADER_LAYOUTS)[number];
    actions?: {
        labels?: (typeof HEADER_ACTION_LABELS)[number];
        grouping?: (typeof HEADER_ACTION_GROUPINGS)[number];
    };
    overlap?: (typeof HEADER_OVERLAPS)[number];
}

export interface ResolvedHeader {
    density: NonNullable<HeaderPresentation['density']>;
    shape: NonNullable<HeaderPresentation['shape']>;
    separator: NonNullable<HeaderPresentation['separator']>;
    layout: NonNullable<HeaderPresentation['layout']>;
    overlap: NonNullable<HeaderPresentation['overlap']>;
    material: Required<NonNullable<HeaderPresentation['material']>>;
    actions: Required<NonNullable<HeaderPresentation['actions']>>;
    brand: Required<NonNullable<HeaderPresentation['brand']>>;
    /** Always set once resolved: the theme's, or derived from `surface.variant`. */
    nav: Required<NonNullable<HeaderPresentation['nav']>>;
}

/**
 * The bar as drawn before the recipe existed: fixed, dense (48 px), transparent at rest, MUI's
 * default surface with an elevation shadow once scrolled, the mark and the server name; brand and
 * destinations at the start, icon actions all in the bar, and a spacer under it on every page. `nav.style`
 * here is only the opaque-surface value: {@link resolveHeader} derives it.
 */
export const PLATFORM_DEFAULT_HEADER: ResolvedHeader = {
    density: 'compact',
    shape: 'bar',
    separator: 'shadow',
    layout: 'start',
    overlap: 'none',
    material: { rest: 'transparent', scrolled: 'surface' },
    actions: { labels: 'icons', grouping: 'inline' },
    brand: { show: 'markAndName', size: 'medium', label: 'server' },
    nav: { style: 'plain' }
};

const TABLES = {
    density: HEADER_DENSITIES,
    shape: HEADER_SHAPES,
    separator: HEADER_SEPARATORS,
    layout: HEADER_LAYOUTS,
    overlap: HEADER_OVERLAPS
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
    nav: { style: HEADER_NAV_STYLES },
    actions: {
        labels: HEADER_ACTION_LABELS,
        grouping: HEADER_ACTION_GROUPINGS
    }
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

/** The bar's actions the recipe may arrange, in the product's order. Which of them exist is not the theme's. */
export type HeaderActionId = 'syncPlay' | 'cast' | 'search';
/** One slot of the arranged bar: an action, or the "More" menu standing where the first moved one was. */
export type HeaderActionSlot = HeaderActionId | 'more';

/**
 * Where each AVAILABLE action goes under `actions.grouping` (§3.5). Pure, so the bar and the Studio
 * preview arrange from the same rule.
 *
 * - `inline`: every action in the bar, in the product's order.
 * - `overflow`: SyncPlay and Cast (the secondary actions) go to one "More" menu, which takes the
 *   place of the first of them. Search is never moved, and neither is a live remote session: while
 *   `remoteActive`, Cast stays in the bar as the session's indicator, and goes back into "More"
 *   only once the session ends. The account menu is not an action here and is never moved.
 */
export function arrangeHeaderActions(
    available: readonly HeaderActionId[],
    grouping: ResolvedHeader['actions']['grouping'],
    remoteActive: boolean
): { bar: HeaderActionSlot[]; more: HeaderActionId[] } {
    if (grouping !== 'overflow') return { bar: [...available], more: [] };
    const movable = (id: HeaderActionId) =>
        id === 'syncPlay' || (id === 'cast' && !remoteActive);
    const more = available.filter(movable);
    const bar: HeaderActionSlot[] = [];
    for (const id of available) {
        if (!movable(id)) bar.push(id);
        else if (id === more[0]) bar.push('more');
    }
    return { bar, more };
}

/**
 * What the renderer actually draws, after the fixed compact-window fallbacks (§5.2) and the page's
 * say on `overlap` (§3.6): `centered` → `start` and labels → icons on a compact window; `hero` only on
 * a wide window AND a page that declares a compatible lead image.
 */
export function effectiveHeader(
    header: ResolvedHeader,
    { compact, lead }: { compact: boolean; lead: boolean }
) {
    return {
        layout: compact ? ('start' as const) : header.layout,
        labels: compact ? ('icons' as const) : header.actions.labels,
        overlap: header.overlap === 'hero' && lead && !compact
    };
}
