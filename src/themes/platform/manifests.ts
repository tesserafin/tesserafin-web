/**
 * The bridge between the theme *registry* and the theme *contract* (RFC-0007 §4.6).
 *
 * `src/themes/registry.ts` answers "what may a picker offer, and how is its colour scheme loaded".
 * `tesserafin-design/themes/<id>/theme.json` answers "what presentation does this theme declare".
 * Nothing joined the two, which is why the `presentation.*` capabilities were declared supported by
 * the Web renderer while nothing read them. This module is that join.
 *
 * ## Why a lookup rather than a field on the registry entry
 *
 * A registry entry is not one-to-one with a theme: `official.glass.light` is a second entry for the
 * *same* theme, and `dark`, `light`, `appletv`, `blueradiance`, `purplehaze` and `wmc` are legacy
 * colour presets with no manifest at all (RFC-0005 §8.1). Putting a manifest on each entry would
 * mean duplicating one for Glass and inventing six that do not exist. A lookup keyed by
 * `tokenThemeId ?? id` — the same resolution `useAppTheme` already uses to pick a stylesheet —
 * returns Glass's manifest for both its entries and `undefined` for the presets, which then get the
 * platform default. That is the honest answer: a legacy preset declares no presentation.
 *
 * ## Bundle cost
 *
 * Both manifests are imported statically: they are read on the app's main theme path, so a dynamic
 * import would only move the cost to a chunk that is always fetched anyway, while making the
 * presentation arrive one tick after first paint.
 *
 * Only what the renderer reads (`presentation`, `capabilities.required`, and `id`, its lookup key) are taken from them, by static property access, and that
 * is what lets webpack drop the rest of each document — description, author, licence,
 * compatibility, modes, renderer declarations, lineage, ~1.3 KB — from the start-up bundle
 * (THEME-A1 paid for its own vocabulary that way). It works only while nothing else in the build
 * reads those keys from THIS module: the Theme Studio, which does, imports the files with a
 * `?document` query, which makes its copy a separate module in its own chunk.
 */

import classicManifest from '../../../tesserafin-design/themes/classic/theme.json';
import glassManifest from '../../../tesserafin-design/themes/glass/theme.json';

import { getThemeEntry } from '../registry';

import type { ThemeCapability, ThemeManifest } from './contract';

/** What the renderer reads of a manifest. Nothing else of it reaches the start-up bundle. */
export type RuntimeManifest = Pick<ThemeManifest, 'id' | 'presentation'> & {
    capabilities: { required: readonly ThemeCapability[] };
};

// Spelled out key by key, never spread: a spread reads every key and would keep them all.
const MANIFESTS: Readonly<Record<string, RuntimeManifest>> = {
    [classicManifest.id]: {
        id: classicManifest.id,
        presentation:
            classicManifest.presentation as ThemeManifest['presentation'],
        // `required` only: it is all the resolver reads (may this theme activate?), and naming it
        // lets webpack drop the `optional` list from the start-up bundle too.
        capabilities: {
            required: classicManifest.capabilities.required as ThemeCapability[]
        }
    },
    [glassManifest.id]: {
        id: glassManifest.id,
        presentation:
            glassManifest.presentation as ThemeManifest['presentation'],
        // `required` only: it is all the resolver reads (may this theme activate?), and naming it
        // lets webpack drop the `optional` list from the start-up bundle too.
        capabilities: {
            required: glassManifest.capabilities.required as ThemeCapability[]
        }
    }
};

/**
 * The manifest backing a registry theme id, or `undefined` when the entry has none.
 *
 * @param themeId A registry id, e.g. `official.classic`, `official.glass.light`, `blueradiance`.
 */
export function getManifestForThemeId(
    themeId: string
): RuntimeManifest | undefined {
    const entry = getThemeEntry(themeId);
    // Same resolution as `useAppTheme`'s `data-rf-theme`: a `.light` entry renders its parent
    // theme's tokens, and must therefore also render its parent theme's presentation.
    return MANIFESTS[entry?.tokenThemeId ?? themeId];
}

/**
 * Every theme id that declares a manifest. Read by the parity assertions in
 * `ui/presentation/PresentationContext.test.tsx`, not by the app: a registry rename would otherwise
 * orphan a manifest silently — the theme would keep its palette and quietly lose its presentation,
 * with nothing failing.
 */
export const MANIFEST_THEME_IDS = Object.keys(MANIFESTS);
