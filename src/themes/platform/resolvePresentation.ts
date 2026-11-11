/**
 * Capability resolution and graceful fallback (RFC-0007 §5.3).
 *
 * A theme declares what it uses; a renderer declares what it implements. This module is the one
 * place those two lists meet, and it answers two questions:
 *
 *   1. May this theme activate at all? — only if every capability in `capabilities.required` is
 *      implemented by the renderer. A theme that *requires* something the renderer cannot do must
 *      be refused with a reason, not rendered half-right and left to look broken.
 *   2. What does the renderer actually apply? — the theme's presentation choices for supported
 *      capabilities, and the PLATFORM DEFAULT for every capability it does not support. Each such
 *      substitution is reported in `fallbacks`, so "it fell back" is observable rather than
 *      invisible.
 *
 * Fallback is per-capability, never per-key: a renderer either speaks `presentation.mediaCard` or
 * it does not. Partially honouring a capability would produce a presentation neither the theme
 * author nor the platform designed.
 */

import {
    GRID_CONTEXTS,
    GRID_ITEM_SIZES,
    type GridPresentation,
    type HeaderPresentation,
    PAGE_BACKDROPS,
    HOME_SECTIONS,
    HOME_SHELF_DENSITIES,
    type PageBackdrop,
    type HomeRecipe,
    type HomeSection,
    type HomeShelfDensity,
    ITEM_DETAILS_CONTROLS,
    ITEM_DETAILS_FACTS,
    ITEM_DETAILS_HEROES,
    ITEM_DETAILS_PEOPLE,
    ITEM_DETAILS_SECTIONS,
    type ItemDetailsControls,
    type ItemDetailsFacts,
    type ItemDetailsHero,
    type ItemDetailsPeople,
    type ItemDetailsRecipe,
    type ItemDetailsSection,
    LIBRARY_CARD_ASPECTS,
    LIBRARY_FILTER_PRESENTATIONS,
    LIBRARY_LAYOUTS,
    type LibraryRecipe,
    MEDIA_CARD_TITLE_LINES,
    type MediaCardPresentation,
    NAVIGATION_LABELS,
    NAVIGATION_POSITIONS,
    NAVIGATION_SHELLS,
    NAVIGATION_TABS,
    type NavigationPresentation,
    SECTION_TITLE_ALIGNS,
    SECTION_TITLE_CASES,
    SECTION_TITLE_SIZES,
    SECTION_TITLE_SPACINGS,
    SECTION_TITLE_WEIGHTS,
    type SectionTitlePresentation,
    type SurfacePresentation,
    type ThemeCapability,
    type ThemeManifest,
    type ThemePresentation
} from './contract';

/**
 * A fully-resolved presentation: every key present, nothing optional. This is what a renderer
 * reads, so it never has to ask "and if the theme did not say?".
 */
export interface ResolvedPresentation {
    surface: Required<SurfacePresentation>;
    mediaCard: Required<MediaCardPresentation>;
    navigation: Required<NavigationPresentation>;
    sectionTitle: Required<SectionTitlePresentation>;
    grid: Required<GridPresentation>;
    /**
     * THEME-B1: the theme's header group as declared, or `{}`. Resolved by the header itself
     * (`headerRecipe.ts#resolveHeader`), outside the start-up bundle.
     */
    header: HeaderPresentation;
    page: {
        home: {
            sections: readonly HomeSection[];
            shelfDensity: HomeShelfDensity;
            backdrop: PageBackdrop;
        };
        library: Required<LibraryRecipe>;
        itemDetails: {
            hero: ItemDetailsHero;
            sections: readonly ItemDetailsSection[];
            backdrop: PageBackdrop;
            facts: ItemDetailsFacts;
            controls: ItemDetailsControls;
            people: ItemDetailsPeople;
        };
    };
}

/**
 * The presentation a renderer produces when a theme says nothing — and the value it falls back to
 * when a theme *does* say something the renderer cannot honour.
 *
 * These are Tesserafin Classic's shape because Classic is the default experience; they are not
 * "Classic's settings" in any binding sense — `tesserafin-design/themes/classic/theme.json`
 * declares its own, identical values, and changing one does not change the other. Keeping them
 * separate is what lets a fallback be a *neutral* result rather than "whatever Classic happens to
 * be this week".
 */
export const PLATFORM_DEFAULT_PRESENTATION: ResolvedPresentation = {
    surface: {
        variant: 'opaque',
        border: 'none',
        elevation: 'level1'
    },
    mediaCard: {
        imageAspect: 'poster',
        titlePlacement: 'below',
        hoverEffect: 'lift',
        progressStyle: 'bar',
        // What every card rendered before the key existed; search states its own 2.
        titleLines: 1
    },
    /*
     * Corrected when the modern shell began reading `shell` (THEME-IDENTITY-1), on the terms Home's
     * order and Item Details' order were corrected before it: while nothing read it this said
     * `sidebar`, and every user saw destinations in the application bar. Binding the value without
     * correcting the default would have moved navigation into a column for every theme that never
     * declared one. `topbar` is what the shell rendered; Classic now asks for `sidebar` and gets it.
     */
    navigation: {
        shell: 'topbar',
        labels: 'always',
        position: 'start',
        // Home and Library both drew underlined tabs before the key existed.
        tabs: 'underline'
    },
    /*
     * THEME-A1. Every value reproduces what the three page families drew before the recipe existed:
     * all their section headings were `font-size-lg` / `font-weight-medium` with no margin, and
     * `auto` keeps the Item Details hero's own heading scale.
     */
    sectionTitle: {
        size: 'auto',
        weight: 'auto',
        align: 'start',
        case: 'none',
        spacing: 'normal'
    },
    grid: {
        library: 'medium',
        people: 'medium',
        episodes: 'medium',
        chapters: 'medium'
    },
    // THEME-B1: resolved by the header itself; see `headerRecipe.ts`.
    header: {},
    page: {
        home: {
            /*
             * The order the modern Home route rendered BEFORE `presentation.page.home` was bound
             * (`apps/modern/features/home/components/HomeTab.tsx`): My media, Continue watching,
             * Next up, then one "Latest from <library>" shelf per eligible view.
             *
             * It was `continueWatching, nextUp, latestMedia, libraries` while nothing read it,
             * which was harmless only for as long as it was unread. Binding the capability without
             * correcting it would have silently reordered Home for every user who has never
             * touched a theme — a default must reproduce current behaviour, not impose a new one.
             */
            sections: [
                'libraries',
                'continueWatching',
                'nextUp',
                'latestMedia'
            ],
            shelfDensity: 'comfortable',
            backdrop: 'none'
        },
        /*
         * Checked against the route before `presentation.page.library` was bound, the way Home's
         * order should have been. `/library/:libraryId` rendered its items through `MediaGrid`
         * (`LibraryItemsGrid.tsx`), built every media-item card with a hard-coded
         * `imageAspect: 'poster'` (`library/utils/mediaCardProps.ts`), and laid its sort/genre/
         * year/studio controls out in the always-visible `rf-library-view__controls` bar
         * (`BrowseDestination.tsx`). `grid` / `poster` / `inline` therefore already WAS the product
         * behaviour, and `LibraryView.recipe.test.tsx` pins that equality so the two cannot drift.
         *
         * Unlike Home, no correction was needed here — which is why the check mattered: the answer
         * was not known in advance either time.
         */
        library: {
            layout: 'grid',
            cardAspect: 'poster',
            filters: 'inline'
        },
        /*
         * Corrected at binding time, the way Home's was, and for the same reason.
         *
         * While nothing read it this declared `overview, cast, episodes, related, mediaInfo` —
         * an order NO equivalence class rendered. `legacy-contract.json` recorded the comparison
         * honestly at the time: 13 MISMATCH, 11 NOT APPLICABLE, 0 MATCH. Binding the capability
         * without correcting the declaration would have silently recomposed Item Details for every
         * user who has never touched a theme, which is precisely what a platform default exists to
         * prevent.
         *
         * The order below is the one the MIGRATED route already rendered, expressed in the
         * published vocabulary. `tests/fixtures/item-details/pre-binding-composition.json` — 24
         * classes captured before this line changed, checksum-guarded in test source — is what says
         * so, and `itemDetails.recipe.test.tsx` replays every class against it.
         *
         * `hero: 'backdrop'` is unchanged, because it was already right: the pre-binding route
         * rendered the backdrop layer for every class that may have one.
         */
        itemDetails: {
            hero: 'backdrop',
            sections: [...ITEM_DETAILS_SECTIONS],
            backdrop: 'none',
            // What the route rendered before these keys existed.
            facts: 'table',
            controls: 'form',
            people: 'cards'
        }
    }
};

/**
 * The Web renderer's capabilities, told by exception: everything in the closed vocabulary except
 * the two it defines and does not bind (see `WEB_RENDERER_CAPABILITIES`). Equivalent to that list
 * — `contract.parity.test.ts` holds them equal — and kept as a two-name set so the start-up bundle
 * does not carry the thirteen-name list just to default a parameter (THEME-B1 paid for its bytes so).
 */
const UNBOUND_BY_WEB: ReadonlySet<ThemeCapability> = new Set([
    'assets.roles',
    'source.web.css'
]);

export const isBoundByWebRenderer = (capability: ThemeCapability) =>
    !UNBOUND_BY_WEB.has(capability);

export interface CapabilityFallback {
    capability: ThemeCapability;
    /** Why the platform default was used instead of the theme's value. */
    reason: 'unsupported-by-renderer';
}

export interface PresentationResolution {
    /** `false` when a REQUIRED capability is unsupported: the theme must not be activated. */
    activatable: boolean;
    /** Required capabilities the renderer does not implement. Empty when `activatable`. */
    missingRequired: readonly ThemeCapability[];
    /** Optional capabilities that were declared, used, and silently replaced by the default. */
    fallbacks: readonly CapabilityFallback[];
    /** What the renderer should actually apply. Always complete, even when the theme said nothing. */
    presentation: ResolvedPresentation;
}

/**
 * Which capability governs which `presentation` key: `presentation.<key>`, and
 * `presentation.page.<key>` for a page recipe. Derived rather than tabled, and checked by the
 * compiler: a key whose derived name is not a published capability does not type-check.
 */
type GroupKey =
    | 'surface'
    | 'mediaCard'
    | 'navigation'
    | 'sectionTitle'
    | 'grid'
    | 'header';
type PageKey = 'home' | 'library' | 'itemDetails';
const groupCapability = (key: GroupKey) =>
    `presentation.${key}` as const satisfies ThemeCapability;
const pageCapability = (key: PageKey) =>
    `presentation.page.${key}` as const satisfies ThemeCapability;

const HOME_SECTION_NAMES: ReadonlySet<string> = new Set(HOME_SECTIONS);
const HOME_SHELF_DENSITY_NAMES: ReadonlySet<string> = new Set(
    HOME_SHELF_DENSITIES
);
const PAGE_BACKDROP_NAMES: ReadonlySet<string> = new Set(PAGE_BACKDROPS);

/**
 * The Home recipe is the first presentation value that is an ARRAY, and the first that reaches the
 * resolver from a hand-editable place: `localPresentation.ts` reads a `localStorage` record whose
 * *values* were schema-validated when the draft was applied, but which a user can edit afterwards.
 * The existing shape check there rejects a non-object record; it cannot reject
 * `{"page":{"home":{"sections":"latestMedia"}}}`, and `sections.map` on a string would throw
 * during render — from a provider that sits above the whole app.
 *
 * The rule is deterministic and stated once here so both callers get it:
 *
 *   - a `sections` that is not an array is ignored entirely;
 *   - unknown section names are dropped (an older theme naming a section this build has retired
 *     should lose that section, not the whole recipe);
 *   - duplicates are dropped, keeping the first occurrence, because a section rendered twice is
 *     never what a recipe meant;
 *   - if nothing survives, `sections` is ignored and the platform default order applies — an empty
 *     Home is not a composition anyone chose;
 *   - an unknown `shelfDensity` or `backdrop` is ignored independently, so one bad key cannot
 *     cost the others.
 *
 * Note this is sanitisation, not validation: it never throws and never reports. A theme author
 * gets a real error from `validateManifest`; this path exists so that a corrupted browser record
 * degrades to the default instead of preventing boot.
 */
function sanitizeHomeRecipe(override: HomeRecipe | undefined): HomeRecipe {
    const clean = pickEnums<HomeRecipe>(override, {
        shelfDensity: HOME_SHELF_DENSITY_NAMES,
        backdrop: PAGE_BACKDROP_NAMES
    });
    const sections = pickSections<HomeSection>(
        override?.sections,
        HOME_SECTION_NAMES
    );
    if (sections) clean.sections = sections;
    return clean;
}

/**
 * The scalar half of every sanitiser below, written once (THEME-IDENTITY-1 added the fourth
 * caller, `navigation`, and a fifth copy of the same `typeof … && set.has(…)` block was the wrong
 * way to pay for it in the start-up bundle). Each key of `table` is kept when `override` names one
 * of its published values and dropped otherwise, INDEPENDENTLY of the others; anything that is not
 * an object yields `{}`. It never throws and never reports.
 */
function pickEnums<T>(
    override: unknown,
    table: Record<string, ReadonlySet<unknown>>
): Partial<T> {
    const clean: Record<string, unknown> = {};
    if (override && typeof override === 'object') {
        for (const key of Object.keys(table)) {
            const value = (override as Record<string, unknown>)[key];
            // `Set.has` is an identity check, so a number (`titleLines`) passes only as a number
            // and an object or array never matches a published value.
            if (table[key].has(value)) clean[key] = value;
        }
    }
    return clean as Partial<T>;
}

/**
 * The array half: known names only, first occurrence kept, and `undefined` when nothing survives
 * so the platform default order applies (an empty composition is not one anyone chose). A value
 * that is not an array is ignored entirely.
 */
function pickSections<S extends string>(
    value: unknown,
    names: ReadonlySet<string>
): S[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const seen = new Set<string>();
    const sections = value.filter(
        (section): section is S =>
            typeof section === 'string' &&
            names.has(section) &&
            !seen.has(section) &&
            !!seen.add(section)
    );
    return sections.length > 0 ? sections : undefined;
}

const LIBRARY_ENUMS = {
    layout: new Set<string>(LIBRARY_LAYOUTS),
    cardAspect: new Set<string>(LIBRARY_CARD_ASPECTS),
    filters: new Set<string>(LIBRARY_FILTER_PRESENTATIONS)
};

/**
 * The Library recipe's three keys are scalar enums, which is exactly why they need this: `object`
 * spread in {@link resolvePresentation} would merge `{"layout":"enormous"}` straight into the resolved
 * presentation, and the route would then branch on a value no renderer defines.
 *
 * Same rule as {@link sanitizeHomeRecipe}, and same reason — a hand-edited `localStorage` record
 * must degrade, never throw, and never prevent boot:
 *
 *   - each key is validated INDEPENDENTLY, so one bad value cannot cost the other two;
 *   - an unknown value is dropped, leaving the platform default for that key alone;
 *   - nothing is reported. A theme author gets a real error from `validateManifest`.
 */
function sanitizeLibraryRecipe(
    override: LibraryRecipe | undefined
): LibraryRecipe {
    return pickEnums<LibraryRecipe>(override, LIBRARY_ENUMS);
}

const ITEM_DETAILS_SECTION_NAMES: ReadonlySet<string> = new Set(
    ITEM_DETAILS_SECTIONS
);
const ITEM_DETAILS_ENUMS = {
    hero: new Set<string>(ITEM_DETAILS_HEROES),
    backdrop: PAGE_BACKDROP_NAMES,
    facts: new Set<string>(ITEM_DETAILS_FACTS),
    controls: new Set<string>(ITEM_DETAILS_CONTROLS),
    people: new Set<string>(ITEM_DETAILS_PEOPLE)
};

/**
 * The Item Details recipe has one of each shape the other two recipes have separately — an ordered
 * array and a scalar enum — so it needs both rules, applied INDEPENDENTLY:
 *
 *   - a `sections` that is not an array is ignored entirely, and `hero` survives it;
 *   - unknown section names are dropped, so a recipe naming a family this build has retired loses
 *     that family rather than the whole composition;
 *   - duplicates are dropped keeping the first occurrence, because a content family rendered twice
 *     is never what a recipe meant, and the schema's `uniqueItems` cannot reach a hand-edited
 *     `localStorage` record;
 *   - if nothing survives, `sections` is ignored and the platform default order applies — an Item
 *     Details page with no content is not a composition anyone chose;
 *   - an unknown `hero`, `backdrop` or `facts` is ignored on its own, so one bad key never costs
 *     another.
 *
 * The last point is the one Step 2 is asked to prove: `{"hero":"cinematic","sections":["cast"]}`
 * must keep `cast` and fall back to the default hero, not discard both.
 */
function sanitizeItemDetailsRecipe(
    override: ItemDetailsRecipe | undefined
): ItemDetailsRecipe {
    const clean = pickEnums<ItemDetailsRecipe>(override, ITEM_DETAILS_ENUMS);
    const sections = pickSections<ItemDetailsSection>(
        override?.sections,
        ITEM_DETAILS_SECTION_NAMES
    );
    if (sections) clean.sections = sections;
    return clean;
}

const GRID_SIZE_NAMES: ReadonlySet<string> = new Set(GRID_ITEM_SIZES);

/**
 * The scalar enums of the top-level groups, checked key by key with {@link pickEnums}.
 *
 * `navigation` became a LAYOUT input when the modern shell began reading `shell`
 * (THEME-IDENTITY-1). Spread unchecked, `{"shell":"floating"}` from a hand-edited record would
 * reach that branch as a value no renderer defines. `sectionTitle` and `grid` (THEME-A1) are read
 * the same way from the start. Same rule as the page recipes: each key is kept only when it names a
 * published value, independently of the others, and nothing throws.
 *
 * `surface` and `mediaCard` predate the rule and are still spread as declared, except for
 * `mediaCard.titleLines`, the one key of theirs that is new: see {@link sanitizeGroup}.
 */
const GROUP_ENUMS: Partial<
    Record<GroupKey, Record<string, ReadonlySet<unknown>>>
> = {
    mediaCard: { titleLines: new Set<unknown>(MEDIA_CARD_TITLE_LINES) },
    navigation: {
        shell: new Set<string>(NAVIGATION_SHELLS),
        labels: new Set<string>(NAVIGATION_LABELS),
        position: new Set<string>(NAVIGATION_POSITIONS),
        tabs: new Set<string>(NAVIGATION_TABS)
    },
    sectionTitle: {
        size: new Set<string>(SECTION_TITLE_SIZES),
        weight: new Set<string>(SECTION_TITLE_WEIGHTS),
        align: new Set<string>(SECTION_TITLE_ALIGNS),
        case: new Set<string>(SECTION_TITLE_CASES),
        spacing: new Set<string>(SECTION_TITLE_SPACINGS)
    },
    grid: Object.fromEntries(
        GRID_CONTEXTS.map((context) => [context, GRID_SIZE_NAMES])
    )
};

/**
 * `mediaCard` keeps every key it declares and is checked only on `titleLines`: the four older keys
 * were spread unchecked before this rule existed, and tightening them is a change of its own.
 */
function sanitizeGroup(
    key: GroupKey,
    override: object | undefined
): object | undefined {
    // THEME-B1: the header passes through as declared (an object, or nothing).
    if (key === 'header')
        return override && typeof override === 'object' ? override : undefined;
    const table = GROUP_ENUMS[key];
    if (!table) return override;
    const clean = pickEnums<object>(override, table);
    if (key !== 'mediaCard' || !override) return clean;
    const { titleLines: _checked, ...declared } =
        override as MediaCardPresentation;
    return { ...declared, ...clean };
}

/**
 * @param manifest The theme's v2 manifest.
 * @param rendererCapabilities What the *active* renderer implements. Defaults to the Web renderer.
 */
export function resolvePresentation(
    manifest: Pick<ThemeManifest, 'presentation' | 'capabilities'>,
    rendererCapabilities?: readonly ThemeCapability[]
): PresentationResolution {
    const supportedSet = new Set(rendererCapabilities);
    const supports = rendererCapabilities
        ? (capability: ThemeCapability) => supportedSet.has(capability)
        : isBoundByWebRenderer;

    const missingRequired = (manifest.capabilities?.required ?? []).filter(
        (capability) => !supports(capability)
    );

    const fallbacks: CapabilityFallback[] = [];
    const themePresentation: ThemePresentation = manifest.presentation ?? {};
    const defaults = PLATFORM_DEFAULT_PRESENTATION;

    const merge = <T extends object>(
        groupDefaults: T,
        override: object | undefined,
        capability: ThemeCapability
    ): T => {
        if (!override || Object.keys(override).length === 0)
            return groupDefaults;
        if (!supports(capability)) {
            // The theme asked for something this renderer cannot express. Record it and use the
            // default — an unsupported capability is a documented downgrade, not an error.
            fallbacks.push({ capability, reason: 'unsupported-by-renderer' });
            return groupDefaults;
        }
        return { ...groupDefaults, ...override };
    };
    const group = <K extends GroupKey>(key: K): ResolvedPresentation[K] =>
        merge(
            defaults[key],
            sanitizeGroup(key, themePresentation[key]),
            groupCapability(key)
        );

    // Built in this order, which is also the order `fallbacks` reports in.
    const presentation: ResolvedPresentation = {
        surface: group('surface'),
        mediaCard: group('mediaCard'),
        navigation: group('navigation'),
        sectionTitle: group('sectionTitle'),
        grid: group('grid'),
        header: group('header'),
        page: {
            home: merge(
                defaults.page.home,
                sanitizeHomeRecipe(themePresentation.page?.home),
                pageCapability('home')
            ),
            library: merge(
                defaults.page.library,
                sanitizeLibraryRecipe(themePresentation.page?.library),
                pageCapability('library')
            ),
            itemDetails: merge(
                defaults.page.itemDetails,
                sanitizeItemDetailsRecipe(themePresentation.page?.itemDetails),
                pageCapability('itemDetails')
            )
        }
    };

    return {
        activatable: missingRequired.length === 0,
        missingRequired,
        fallbacks,
        presentation
    };
}
