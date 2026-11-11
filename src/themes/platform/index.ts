/**
 * Theme Platform v2 public surface (RFC-0007).
 *
 * Everything a caller needs to read a theme manifest, decide whether the active renderer can honour
 * it, and know what it will actually apply. Nothing here touches the DOM, MUI or the network.
 */

export type {
    HomeRecipe,
    HomeSection,
    HomeShelfDensity,
    ItemDetailsControls,
    ItemDetailsFacts,
    ItemDetailsHero,
    ItemDetailsPeople,
    ItemDetailsRecipe,
    ItemDetailsSection,
    LibraryCardAspect,
    LibraryFilterPresentation,
    LibraryLayout,
    LibraryRecipe,
    GridContext,
    GridItemSize,
    GridPresentation,
    MediaCardPresentation,
    MediaCardTitleLines,
    NavigationLabels,
    NavigationPosition,
    NavigationPresentation,
    NavigationShell,
    NavigationTabs,
    PageRecipes,
    SectionTitlePresentation,
    SurfacePresentation,
    ThemeAssetRole,
    ThemeCapability,
    PageBackdrop,
    ThemeLineage,
    ThemeManifest,
    ThemeMode,
    ThemePresentation,
    ThemeProfileName,
    ThemeRendererDeclaration,
    ThemeTokensPartial,
    WebRendererDeclaration
} from './contract';
export {
    GRID_CONTEXTS,
    GRID_ITEM_SIZES,
    HOME_SECTIONS,
    HOME_SHELF_DENSITIES,
    ITEM_DETAILS_CONTROLS,
    ITEM_DETAILS_FACTS,
    ITEM_DETAILS_HEROES,
    ITEM_DETAILS_PEOPLE,
    ITEM_DETAILS_SECTIONS,
    LIBRARY_CARD_ASPECTS,
    LIBRARY_FILTER_PRESENTATIONS,
    LIBRARY_LAYOUTS,
    MEDIA_CARD_TITLE_LINES,
    NAVIGATION_LABELS,
    NAVIGATION_POSITIONS,
    NAVIGATION_SHELLS,
    NAVIGATION_TABS,
    PAGE_BACKDROPS,
    SECTION_TITLE_ALIGNS,
    SECTION_TITLE_CASES,
    SECTION_TITLE_SIZES,
    SECTION_TITLE_SPACINGS,
    SECTION_TITLE_WEIGHTS,
    THEME_CAPABILITIES,
    THEME_CONTRACT_VERSION,
    WEB_RENDERER_CAPABILITIES
} from './contract';

export type {
    CapabilityFallback,
    PresentationResolution,
    ResolvedPresentation
} from './resolvePresentation';
export {
    PLATFORM_DEFAULT_PRESENTATION,
    resolvePresentation
} from './resolvePresentation';

export { getManifestForThemeId, MANIFEST_THEME_IDS } from './manifests';

export {
    clearAppliedPresentation,
    loadAppliedPresentation,
    saveAppliedPresentation
} from './localPresentation';

export type {
    ThemeValidationCode,
    ThemeValidationIssue,
    ThemeValidationResult
} from './validateManifest';
export {
    assertNoExecutableSurface,
    satisfiesLooseRange,
    validateManifest,
    validateThemePackage
} from './validateManifest';
