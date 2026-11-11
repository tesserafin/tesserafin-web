/**
 * Theme Platform v2 — TypeScript mirror of `tesserafin-design/schema/theme.schema.json`
 * (RFC-0007 §4/§5).
 *
 * Hand-written, like `src/ui/tokens/types.ts` is for `tokens.schema.json`, and for the same reason:
 * the schema is the published contract and this file is the in-app view of it, not a build output.
 * `contract.parity.test.ts` fails if the two drift on the parts a mismatch would actually break —
 * the capability enum and the presentation vocabularies.
 *
 * The split this file encodes is the whole point of v2:
 *
 *   - the UNIVERSAL layer (`ThemeManifest` minus `renderers`) is platform-neutral. It names
 *     semantic colour, type, spacing, shape, elevation, blur, density, motion, asset roles,
 *     component variants and page composition — concepts every renderer can honour;
 *   - the PLATFORM RENDERER layer (`renderers`) is where anything platform-specific lives. Adding
 *     the Android or Apple renderer adds a key there and changes nothing above it, which is what
 *     stops the universal contract from quietly becoming Web-only.
 */

import type { TesserafinTokens } from 'ui/tokens/types';

/** A deep-partial of the token set — the shape of every `profiles.<name>` override. */
export type ThemeTokensPartial = {
    [K in keyof TesserafinTokens]?: NonNullable<
        TesserafinTokens[K]
    > extends object
        ? { [P in keyof TesserafinTokens[K]]?: unknown }
        : TesserafinTokens[K];
};

/**
 * The closed capability vocabulary (RFC-0007 §5.2).
 *
 * Closed, not open, on purpose: a theme that could claim an undefined capability would be asking
 * a renderer to guarantee something nobody has specified. An unknown name is a validation error.
 */
export const THEME_CAPABILITIES = [
    'tokens.core',
    'tokens.profiles',
    'assets.roles',
    'presentation.surface',
    'presentation.mediaCard',
    'presentation.navigation',
    'presentation.sectionTitle',
    'presentation.grid',
    'presentation.header',
    'presentation.page.home',
    'presentation.page.library',
    'presentation.page.itemDetails',
    'text.slots',
    'source.web.css'
] as const;

export type ThemeCapability = (typeof THEME_CAPABILITIES)[number];

/**
 * What the WEB renderer implements today.
 *
 * Deliberately narrower than {@link THEME_CAPABILITIES}. The four capabilities absent here are
 * DEFINED by the contract and NOT YET BOUND by this renderer, and the honest way to say that is to
 * leave them out of this list and let the resolver fall back, rather than to omit them from the
 * contract and pretend the vocabulary is smaller than the product direction requires.
 *
 * `assets.roles` was on this list until it was checked. Nothing read it: a theme's `assets` block
 * maps a role to a PACKAGE-RELATIVE path, and there is no theme package — an official theme ships
 * no asset files and a local draft is one JSON document with nothing attached to it. There was
 * therefore no file any loader could have resolved. Binding it needs the package format from
 * #117, not a loader, so it moved from "declared" to "declared and not yet bound" — the same
 * correction #122 made in the other direction for `presentation.*`.
 *
 * `presentation.page.home` joined this list once the modern Home route actually read the resolved
 * recipe (`apps/modern/features/home`), and not before. `presentation.page.library` joined it on the
 * same terms: `apps/modern/features/library` now reads `page.library` through `usePresentation()`
 * and composes the route from it. `presentation.page.itemDetails` joined it last, on exactly those
 * terms and no others: `apps/modern/features/details` reads `page.itemDetails` through
 * `usePresentation()` and composes the route from it (#129 Step 2). It was off this list for as
 * long as the route was a legacy `controller` + `view.html` view, then for as long as the migrated
 * route rendered a fixed composition, and it moved in the same commit the route began reading a
 * recipe — never before.
 *
 * `source.web.css` in particular is the advanced CSS/SCSS/LESS/Sass authoring layer: the manifest
 * reserves its shape (`renderers.web.source`) so the package format is already right, while the
 * schema accepts only `kind: "none"` until an isolated compiler boundary exists (RFC-0007 §7).
 */
export const WEB_RENDERER_CAPABILITIES: readonly ThemeCapability[] = [
    'tokens.core',
    'tokens.profiles',
    'presentation.surface',
    'presentation.mediaCard',
    'presentation.navigation',
    'presentation.sectionTitle',
    'presentation.grid',
    'presentation.header',
    'presentation.page.home',
    'presentation.page.library',
    'presentation.page.itemDetails',
    'text.slots'
] as const;

export type ThemeMode = 'light' | 'dark';

export type ThemeProfileName =
    | 'pointer'
    | 'touch'
    | 'remote'
    | 'compact'
    | 'medium'
    | 'expanded'
    | 'reducedMotion'
    | 'reducedTransparency'
    | 'lowPower';

export type ThemeAssetRole =
    | 'logo'
    | 'wordmark'
    | 'monogram'
    | 'favicon'
    | 'backdrop'
    | 'loginBackdrop'
    | 'placeholderPoster'
    | 'placeholderBackdrop';

export interface SurfacePresentation {
    variant?: 'glass' | 'opaque';
    border?: 'none' | 'hairline';
    elevation?: 'level0' | 'level1' | 'level2' | 'level3';
}

/**
 * How many lines a card's title may take before it is cut (THEME-A1). The THEME'S DEFAULT: a call
 * site that states its own (`titleLines={2}` in search, where the title is what tells results apart)
 * keeps it. An overlay title never takes fewer than two — there is no caption below to finish it.
 */
export const MEDIA_CARD_TITLE_LINES = [1, 2, 3] as const;

export type MediaCardTitleLines = (typeof MEDIA_CARD_TITLE_LINES)[number];

export interface MediaCardPresentation {
    imageAspect?: 'poster' | 'backdrop' | 'square';
    titlePlacement?: 'below' | 'overlay';
    hoverEffect?: 'none' | 'lift' | 'zoom';
    progressStyle?: 'bar' | 'none';
    titleLines?: MediaCardTitleLines;
}

/**
 * The section-title vocabulary (THEME-A1): one recipe for every section heading of Home, Library
 * and Item Details, whatever state the section is in. It changes how a heading LOOKS — never its
 * level, its text or whether it exists: an `h2` stays an `h2` under every value.
 *
 *   - `size` / `weight`: `auto` keeps what the page does today, including the Item Details hero's
 *     own heading scale (smaller under `minimal`, larger and bolder under `immersive`). Any other
 *     value is a deliberate choice and wins over the hero, which is what lets an immersive page
 *     carry small section titles.
 *   - `align`: `start` or `center`, in logical terms (right-to-left languages mirror `start`).
 *   - `case`: `uppercase` adds the letter spacing capitals need; the text in the DOM is unchanged,
 *     so screen readers and search read the real words.
 *   - `spacing`: `loose` puts room above and below the heading; `normal` is today's.
 *
 * Every size is a step of the token type scale, in `rem`, so it follows the user's zoom.
 */
export const SECTION_TITLE_SIZES = [
    'auto',
    'small',
    'medium',
    'large'
] as const;
export const SECTION_TITLE_WEIGHTS = [
    'auto',
    'regular',
    'medium',
    'bold'
] as const;
export const SECTION_TITLE_ALIGNS = ['start', 'center'] as const;
export const SECTION_TITLE_CASES = ['none', 'uppercase'] as const;
export const SECTION_TITLE_SPACINGS = ['normal', 'loose'] as const;

export interface SectionTitlePresentation {
    size?: (typeof SECTION_TITLE_SIZES)[number];
    weight?: (typeof SECTION_TITLE_WEIGHTS)[number];
    align?: (typeof SECTION_TITLE_ALIGNS)[number];
    case?: (typeof SECTION_TITLE_CASES)[number];
    spacing?: (typeof SECTION_TITLE_SPACINGS)[number];
}

/**
 * Media grids by SEMANTIC CONTEXT (THEME-A1), never by component or route:
 *
 *   - `library`: a library's items, its genres, a content pack's items;
 *   - `people`: cast and crew;
 *   - `episodes`: a container's children (the Item Details `episodes` family);
 *   - `chapters`: an item's chapters.
 *
 * Each takes a bounded item size. It scales the grid's minimum column width; it never sets a pixel
 * value, never changes what is listed, and never overrides the user's own density toggle — `small`
 * cards under the user's `compact` are smaller still. `large` applies only where there is room for
 * it (from a 40em-wide viewport, in `em` so it follows zoom); a phone keeps `medium`.
 */
export const GRID_CONTEXTS = [
    'library',
    'people',
    'episodes',
    'chapters'
] as const;

export type GridContext = (typeof GRID_CONTEXTS)[number];

export const GRID_ITEM_SIZES = ['small', 'medium', 'large'] as const;

export type GridItemSize = (typeof GRID_ITEM_SIZES)[number];

export type GridPresentation = Partial<Record<GridContext, GridItemSize>>;

/**
 * The navigation vocabulary, as runtime lists for the reason {@link HOME_SECTIONS} is one: the
 * applied-presentation record is hand-editable, and since the modern shell began READING `shell`
 * (THEME-IDENTITY-1) an unknown value would otherwise reach a layout branch.
 *
 *   - `topbar`: the destinations sit in the application bar, above the page;
 *   - `sidebar`: a persistent column beside the page on wide screens, one destination per row;
 *   - `rail`: the same column, narrow, with each label under its icon.
 *
 * On a narrow screen every shell collapses to the drawer: a persistent column on a phone costs the
 * content it is meant to organise, and a theme cannot overrule that (usage before identity).
 */
export const NAVIGATION_SHELLS = ['sidebar', 'rail', 'topbar'] as const;

export type NavigationShell = (typeof NAVIGATION_SHELLS)[number];

export const NAVIGATION_LABELS = ['always', 'active', 'never'] as const;

export type NavigationLabels = (typeof NAVIGATION_LABELS)[number];

export const NAVIGATION_POSITIONS = ['start', 'end'] as const;

export type NavigationPosition = (typeof NAVIGATION_POSITIONS)[number];

/**
 * How in-page tabs are drawn (THEME-A1) — Home's and a library's destinations. The theme's default:
 * a call site that states its own variant keeps it. Same tabs, same order, same keyboard contract.
 */
export const NAVIGATION_TABS = ['underline', 'pills'] as const;

export type NavigationTabs = (typeof NAVIGATION_TABS)[number];

/**
 * How navigation LOOKS. Never what it CONTAINS: which destinations exist is authorization and
 * library state, and a theme has no say in it (RFC-0007 §6.1).
 */
export interface NavigationPresentation {
    shell?: NavigationShell;
    labels?: NavigationLabels;
    position?: NavigationPosition;
    tabs?: NavigationTabs;
}

/**
 * The sections a Home recipe may order. UNIVERSAL vocabulary: it names sections every renderer
 * could offer, not the ones the Web renderer happens to have built.
 *
 * A recipe SELECTS AND ORDERS sections. It never decides what a section contains, and it never
 * decides whether a section's data is requested — the Home route issues the same queries under
 * every recipe (RFC-0007 §6.1). Omitting a section from a recipe is a presentation choice about
 * what is shown, and is deliberately NOT a way to influence ranking or fetching.
 *
 * `latestMedia` is the one 1:N token: it expands to one shelf per eligible user view, so a recipe
 * cannot address an individual library — which libraries exist is authorization state.
 *
 * `recommendations` is DECLARED and NOT RENDERED by the Web renderer. It would need the
 * `/Movies/Recommendations` query, and a recipe token that makes a request fire is a theme
 * controlling API queries. Web therefore renders nothing for it; see
 * `apps/modern/features/home/utils/homeRecipe.ts` and
 * `docs/tesserafin/presentation-boundary.md`. It is kept in the vocabulary because dropping a
 * universal-layer name for a Web gap is precisely how the universal layer becomes Web-only.
 */
export const HOME_SECTIONS = [
    'hero',
    'continueWatching',
    'nextUp',
    'latestMedia',
    'libraries',
    'recommendations'
] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number];

/**
 * A runtime list, not only a type, because the applied-presentation record in `localStorage` is
 * hand-editable: the resolver has to be able to reject a section name at runtime, and a TypeScript
 * union cannot do that. Same reason for {@link HOME_SHELF_DENSITIES}.
 */
export const HOME_SHELF_DENSITIES = [
    'compact',
    'comfortable',
    'spacious'
] as const;

export type HomeShelfDensity = (typeof HOME_SHELF_DENSITIES)[number];

/**
 * What stands behind a page's composition (THEME-PRESENTATION-1), for the Home and Item Details
 * recipes alike.
 *
 * `ambient` lays the page's lead artwork, blurred and dimmed, behind the whole page, so a
 * translucent surface has something to frost; without it a glass card stands on a flat colour and
 * reads as an opaque one. It only ever RE-USES an image the page already shows — Home's `hero`
 * artwork, the details poster — so it never makes a request of its own, and it shows nothing when
 * there is no such image (Home without `hero`, an item without a poster). The renderer drops it
 * under the `reducedTransparency` and `lowPower` profiles.
 */
export const PAGE_BACKDROPS = ['none', 'ambient'] as const;

export type PageBackdrop = (typeof PAGE_BACKDROPS)[number];

/**
 * The content families an Item Details recipe may order (RFC-0007 §4.7).
 *
 * A runtime list for the reason {@link HOME_SECTIONS} is one — the applied-presentation record is
 * hand-editable and a union type cannot reject `{"sections":["castt"]}` at runtime.
 *
 * ## What a token is, and what it is not
 *
 * Each name here is a durable, cross-platform USER-FACING CONTENT FAMILY. None of them is a Web
 * component, a DOM id, a Jellyfin name or an item type. In particular this vocabulary is NOT the
 * 33 `data-detail-section` identifiers the migrated route emits: those are characterization hooks
 * that let the frozen P5 fixture judge the route, they are private implementation evidence, and no
 * recipe reads or exposes one. `apps/modern/features/details/utils/itemDetailsRecipe.ts` is the
 * single place the two vocabularies meet, and it maps every concrete surface to exactly one token
 * here or to a permanently fixed region.
 *
 * ## The five names that were already published
 *
 * `overview`, `cast`, `episodes`, `related` and `mediaInfo` shipped in the closed contract before
 * any route read it. They are RETAINED VERBATIM, because renaming a published enum member would
 * invalidate manifests that are valid today, and a closed vocabulary that renames itself is not
 * closed. Two of them read oddly against the rule that a token must not encode an item type or a
 * legacy name:
 *
 *   - `episodes` covers a folder's contained children whatever they are — seasons, episodes,
 *     tracks, playlist entries, collection members, the further parts of a multi-part video;
 *   - `mediaInfo` covers the item's factual panel: birth and death dates, birthplace, broadcast
 *     day, tags, outward reference links and the genre/studio/crew lists.
 *
 * Both are wider than their names suggest. That is a cost of backward compatibility, paid once and
 * documented here; the six names ADDED by #129 Step 2 follow the rule.
 *
 * ## What a recipe cannot reach
 *
 * There is deliberately no token for the item's identity, its primary information, the action bar,
 * the media-source/audio/subtitle/video selectors, the played/favourite/rating controls, the
 * recording editor, permission gates or any warning. Those are FIXED REGIONS: RFC-0007 §6.1 keeps
 * them outside theme authority, and a token for one of them would be a theme deciding what the
 * product does rather than how it looks.
 */
export const ITEM_DETAILS_SECTIONS = [
    'overview',
    'mediaInfo',
    'nextUp',
    'episodes',
    'lyrics',
    'moreFrom',
    'cast',
    'schedule',
    'extras',
    'chapters',
    'related'
] as const;

export type ItemDetailsSection = (typeof ITEM_DETAILS_SECTIONS)[number];

/**
 * How the item's artwork is laid out. A LAYOUT treatment, never data eligibility (RFC-0007 §6.1).
 *
 * No value here causes an extra image or API request, none overrides the user's details-banner
 * setting, none gives a `Person` or a `Book` a backdrop, and the poster is rendered under all
 * four — `MUST PRESERVE` #9 is a product guarantee, not a theme preference.
 *
 * `immersive` (THEME-IDENTITY-1) makes the item's backdrop the page's lead: a full-width band
 * with the identity, facts and actions set over its foot, and the poster as a smaller inset. It
 * reads the same backdrop URL `backdrop` reads, so it adds no request, and it degrades to the
 * `poster` layout whenever the band cannot render — an item with no backdrop, a `Person`, a
 * `Book`, or a user who turned the details banner off.
 */
export const ITEM_DETAILS_HEROES = [
    'backdrop',
    'poster',
    'minimal',
    'immersive'
] as const;

export type ItemDetailsHero = (typeof ITEM_DETAILS_HEROES)[number];

/**
 * How the item's factual lists — people, studios, genres — are GROUPED (THEME-IDENTITY-1).
 *
 *   - `table`: one labelled row per list, label and values in two aligned columns. A catalogue
 *     reading: every fact has a fixed place, so the eye finds "Director" in the same spot on
 *     every page.
 *   - `inline`: the lists run together on one line under the item's identity, values first and
 *     labels kept for assistive technology only. The fact line reads as part of the title block
 *     rather than as a form.
 *
 * Neither value changes WHICH lists exist, their order, their links or their data: the six lists
 * and their gates are the route's, and the same links are emitted under both.
 */
export const ITEM_DETAILS_FACTS = ['table', 'inline'] as const;

export type ItemDetailsFacts = (typeof ITEM_DETAILS_FACTS)[number];

/**
 * How the FIXED controls are dressed — the action bar and the track selectors (THEME-IDENTITY-1).
 *
 *   - `form`: a labelled form. Rectangular buttons in a row; each selector with its label in a
 *     column of its own.
 *   - `pill`: a player's controls. The play action is a large pill with a play glyph, secondary
 *     actions are outlined pills, icon actions are round, and the selectors run as one row of chips
 *     with the label set inside each chip.
 *
 * A presentation of the fixed region, never a decision about it: the same controls, in the same
 * order, with the same labels, states and keyboard behaviour exist under both values. Which actions
 * and tracks are offered stays the route's, as RFC-0007 §6.1 requires.
 */
export const ITEM_DETAILS_CONTROLS = ['form', 'pill'] as const;

export type ItemDetailsControls = (typeof ITEM_DETAILS_CONTROLS)[number];

/**
 * How people (cast, crew, guest stars) are drawn: `cards` are poster cards with the name and role
 * under them; `portraits` are round head-shots with the name centred under them. Same people, same
 * order, same links.
 */
export const ITEM_DETAILS_PEOPLE = ['cards', 'portraits'] as const;

export type ItemDetailsPeople = (typeof ITEM_DETAILS_PEOPLE)[number];

export interface ItemDetailsRecipe {
    hero?: ItemDetailsHero;
    backdrop?: PageBackdrop;
    facts?: ItemDetailsFacts;
    controls?: ItemDetailsControls;
    people?: ItemDetailsPeople;
    sections?: readonly ItemDetailsSection[];
}

export interface HomeRecipe {
    sections?: readonly HomeSection[];
    shelfDensity?: HomeShelfDensity;
    backdrop?: PageBackdrop;
}

/**
 * The Library recipe vocabulary (RFC-0007 §4.7), as runtime lists for the same reason
 * {@link HOME_SECTIONS} is one: the applied-presentation record in `localStorage` is hand-editable,
 * so the resolver has to be able to reject `{"layout":"enormous"}` at runtime, and a TypeScript
 * union cannot do that.
 *
 * Every value here is a statement about COMPOSITION — how the library's item list is laid out, how
 * a card is shaped, where the filter controls live. None of them is a statement about the CATALOGUE
 * QUERY. `startIndex`, `limit`, sort, and every filter parameter are decided by the route's URL
 * state and the user's page-size setting, above any recipe read, and
 * `LibraryView.recipe.test.tsx` asserts the issued request ledger is byte-identical across every
 * recipe below (RFC-0007 §6.1).
 */
export const LIBRARY_LAYOUTS = ['grid', 'shelf'] as const;

export type LibraryLayout = (typeof LIBRARY_LAYOUTS)[number];

export const LIBRARY_CARD_ASPECTS = ['poster', 'backdrop', 'square'] as const;

export type LibraryCardAspect = (typeof LIBRARY_CARD_ASPECTS)[number];

export const LIBRARY_FILTER_PRESENTATIONS = ['inline', 'drawer'] as const;

export type LibraryFilterPresentation =
    (typeof LIBRARY_FILTER_PRESENTATIONS)[number];

export interface LibraryRecipe {
    layout?: LibraryLayout;
    cardAspect?: LibraryCardAspect;
    filters?: LibraryFilterPresentation;
}

export interface PageRecipes {
    home?: HomeRecipe;
    library?: LibraryRecipe;
    itemDetails?: ItemDetailsRecipe;
}

/** THEME-B1: the header recipe's vocabulary lives with its resolver, outside the start-up bundle. */
export type { HeaderPresentation } from './headerRecipe';
import type { HeaderPresentation } from './headerRecipe';

export interface ThemePresentation {
    surface?: SurfacePresentation;
    mediaCard?: MediaCardPresentation;
    navigation?: NavigationPresentation;
    sectionTitle?: SectionTitlePresentation;
    grid?: GridPresentation;
    header?: HeaderPresentation;
    page?: PageRecipes;
}

/**
 * Per-language wording of a closed set of semantic text slots (THEME-A2,
 * `docs/tesserafin/design-theme-text-slots.md`): `slots[<slot id>][<locale>] = <template>`.
 *
 * The slot ids and their metadata live in `themes/platform/textSlots.ts`, which only validation and
 * the Theme Studio load. The application reads a slot by id with its own default key and variables,
 * so the start-up bundle carries no registry.
 */
/** The closed slot vocabulary. A type only: the runtime list lives with the registry. */
export type TextSlotId =
    | 'home.libraries.title'
    | 'home.continueWatching.title'
    | 'home.nextUp.title'
    | 'home.latestMedia.title'
    | 'library.suggestions.continueWatching.title'
    | 'library.suggestions.nextUp.title'
    | 'library.suggestions.upcomingEpisodes.title'
    | 'details.schedule.title'
    | 'details.overview.expand.label'
    | 'details.overview.collapse.label';

export type ThemeTextSlots = Readonly<
    Record<string, Readonly<Record<string, string>>>
>;

export interface ThemeText {
    slots?: ThemeTextSlots;
}

export interface ThemeRendererDeclaration {
    supports?: readonly ThemeCapability[];
}

export interface WebRendererDeclaration extends ThemeRendererDeclaration {
    /**
     * RESERVED extension point for the advanced Web authoring layer (RFC-0007 §7). `kind: 'none'`
     * is the only accepted value today; widening it is the one schema change that opens the layer.
     */
    source?: { kind: 'none' };
}

export interface ThemeLineage {
    basedOn?: { id: string; version: string };
    /** Declared authoring intent. Recorded, not enforced — signing and source protection are out of scope. */
    remixable: boolean;
    attribution?: string;
}

/** A complete v2 manifest, exactly as `theme.schema.json` accepts it. */
export interface ThemeManifest {
    contractVersion: 2;
    id: string;
    version: string;
    name: string;
    description?: string;
    author: string;
    license: string;
    compatibility: {
        web?: string;
        android?: string;
        ios?: string;
        tv?: string;
    };
    modes: readonly ThemeMode[];
    profiles?: Partial<Record<ThemeProfileName, ThemeTokensPartial>>;
    assets?: Partial<Record<ThemeAssetRole, string>>;
    presentation?: ThemePresentation;
    text?: ThemeText;
    capabilities?: {
        required?: readonly ThemeCapability[];
        optional?: readonly ThemeCapability[];
    };
    renderers?: {
        web?: WebRendererDeclaration;
        android?: ThemeRendererDeclaration;
        ios?: ThemeRendererDeclaration;
        tv?: ThemeRendererDeclaration;
    };
    lineage?: ThemeLineage;
}

/** The contract version this build of Tesserafin Web speaks. */
export const THEME_CONTRACT_VERSION = 2 as const;
