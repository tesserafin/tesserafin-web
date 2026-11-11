import { useSyncExternalStore } from 'react';

import globalize from 'lib/globalize';
import type { TextSlotId } from 'themes/platform/contract';
import {
    resolveOverride,
    type SlotKind,
    type SlotText
} from 'themes/platform/slotText';
import { loadAppliedText } from 'themes/platform/localText';
import { subscribeAppliedPresentation } from 'themes/platform/localPresentation';
import { usePresentationContext } from 'ui/presentation/PresentationContext';

const NO_VARIABLES: Readonly<Record<string, string>> = {};

export interface ResolvedSlotText extends SlotText {
    /**
     * `lang` to put on the element, or `undefined` when the text is in the interface language. Set
     * when an application fallback or an override is in another language (THEME-A2 §6), so a screen
     * reader pronounces it correctly.
     */
    langAttribute?: string;
}

/**
 * The words for one theme text slot (THEME-A2 §5): the applied draft's override, then the active
 * theme's, each for the culture and then its language, then the application's translation of `key`
 * through globalize, unchanged.
 *
 * One result feeds the visible text AND the accessible name, so a screen reader never announces a
 * default the page no longer shows. `variables` are named; for the application's translation they
 * fill `{0}`, `{1}`… in the order given.
 *
 * Resolved on every render against the current culture, so a language change re-resolves.
 */
export function useSlotText(
    /** `undefined` for a place that has no slot: the application's translation, with its language. */
    slot: TextSlotId | undefined,
    key: string,
    variables: Readonly<Record<string, string>> = NO_VARIABLES,
    kind: SlotKind = 'title'
): ResolvedSlotText {
    /*
     * The applied draft's text, read here rather than by the app-root provider so it stays out of
     * the start-up bundle. A provider given `value` (the Studio preview) supplies its own layers.
     * Official manifests declare no text, so there is no theme layer to add; a test fails the day
     * one does.
     */
    const applied = useSyncExternalStore(
        subscribeAppliedPresentation,
        loadAppliedText,
        () => null
    );
    const layers = usePresentationContext().text ?? [applied];
    const culture = globalize.getCurrentLocale();
    const resolved =
        (slot && resolveOverride(layers, slot, culture, variables, kind)) ||
        globalize.translateWithLocale(key, ...Object.values(variables));
    return {
        ...resolved,
        langAttribute:
            resolved.lang.split('-')[0] === culture.split('-')[0]
                ? undefined
                : resolved.lang
    };
}
