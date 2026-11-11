/**
 * The text slot registry and its validation (THEME-A2, `docs/tesserafin/design-theme-text-slots.md`
 * §2, §4, §7). Loaded by `validateManifest` and the Theme Studio only, never on the start-up path:
 * the application reads a slot through `useSlotText` with its own key and variables.
 *
 * `textSlots.parity.test.ts` holds this list, the schema and the call sites together.
 */

import type { TextSlotId, ThemeText } from './contract';
import { fillTemplate, type SlotKind } from './slotText';

export interface TextSlotDefinition {
    /** The page an author finds it on. */
    page: 'home' | 'library' | 'itemDetails';
    /** Where it appears, in words an author recognises. */
    context: string;
    /** The application translation key used when nothing overrides the slot. */
    key: string;
    kind: SlotKind;
    /** Named variables, all required. Mapped to the key's `{0}`, `{1}`… in this order. */
    variables?: readonly string[];
    /** Advice only (§7): the Studio warns past it, never rejects. */
    recommended: number;
}

export const TEXT_SLOTS: Readonly<Record<TextSlotId, TextSlotDefinition>> = {
    'home.libraries.title': {
        page: 'home',
        context: 'Home, "My media" shelf',
        key: 'HeaderMyMedia',
        kind: 'title',
        recommended: 40
    },
    'home.continueWatching.title': {
        page: 'home',
        context: 'Home, resume shelf',
        key: 'HeaderContinueWatching',
        kind: 'title',
        recommended: 40
    },
    'home.nextUp.title': {
        page: 'home',
        context: 'Home, next episode shelf',
        key: 'NextUp',
        kind: 'title',
        recommended: 40
    },
    'home.latestMedia.title': {
        page: 'home',
        context: 'Home, one shelf per library',
        key: 'LatestFromLibrary',
        kind: 'title',
        variables: ['libraryName'],
        recommended: 60
    },
    'library.suggestions.continueWatching.title': {
        page: 'library',
        context: "A library's Suggestions tab, resume shelf",
        key: 'HeaderContinueWatching',
        kind: 'title',
        recommended: 40
    },
    'library.suggestions.nextUp.title': {
        page: 'library',
        context: "A library's Suggestions tab, next episode shelf",
        key: 'NextUp',
        kind: 'title',
        recommended: 40
    },
    'library.suggestions.upcomingEpisodes.title': {
        page: 'library',
        context: "A library's Suggestions tab, announced episodes",
        key: 'HeaderUpcoming',
        kind: 'title',
        recommended: 40
    },
    'details.schedule.title': {
        page: 'itemDetails',
        context: 'Item Details, upcoming TV airings',
        key: 'HeaderUpcomingOnTV',
        kind: 'title',
        recommended: 40
    },
    'details.overview.expand.label': {
        page: 'itemDetails',
        context: 'Item Details, expand the synopsis',
        key: 'ShowMore',
        kind: 'action',
        recommended: 30
    },
    'details.overview.collapse.label': {
        page: 'itemDetails',
        context: 'Item Details, collapse the synopsis',
        key: 'ShowLess',
        kind: 'action',
        recommended: 30
    }
};

export const TEXT_SLOT_IDS = Object.keys(TEXT_SLOTS) as TextSlotId[];

const CEILING: Record<SlotKind, number> = { title: 120, action: 80 };

/**
 * Why `template` is not valid for `slot`, or `null` when it is. One message, the first rule broken,
 * in the order an author would fix them.
 */
export function slotTemplateError(
    slot: TextSlotId,
    template: string
): string | null {
    const definition = TEXT_SLOTS[slot];
    const declared = definition.variables ?? [];
    if (!template.trim()) return 'The text is empty.';
    if ([...template].length > CEILING[definition.kind]) {
        return `The text is longer than ${CEILING[definition.kind]} characters.`;
    }
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
    if (/[\u0000-\u001f\u007f]/.test(template)) {
        return 'The text contains a control character (a line break or a tab).';
    }
    const names = [
        ...template.replace(/\{\{|\}\}/g, '').matchAll(/\{([A-Za-z]+)\}/g)
    ].map((match) => match[1]);
    const unknown = names.find((name) => !declared.includes(name));
    if (unknown) {
        return declared.length
            ? `{${unknown}} is not a variable of this text. Use ${declared.map((name) => `{${name}}`).join(', ')}.`
            : `{${unknown}} is not a variable: this text takes none. Write {{ and }} for literal braces.`;
    }
    const repeated = names.find((name, index) => names.indexOf(name) !== index);
    if (repeated) return `{${repeated}} appears more than once.`;
    const missing = declared.find((name) => !names.includes(name));
    if (missing) {
        return `{${missing}} is required: without it the page could not tell one shelf from another.`;
    }
    const sample = Object.fromEntries(declared.map((name) => [name, name]));
    if (fillTemplate(template, sample, definition.kind) === null) {
        return 'A brace is not closed. Write {{ and }} for literal braces.';
    }
    return null;
}

/** Advice for `template` (§7): longer than recommended. Never blocks anything. */
export function slotTemplateWarning(
    slot: TextSlotId,
    template: string
): string | null {
    const { recommended } = TEXT_SLOTS[slot];
    return [...template].length > recommended
        ? `Longer than the recommended ${recommended} characters: it will wrap.`
        : null;
}

export interface TextSlotIssue {
    path: string;
    message: string;
}

/** Every invalid template in `text`, with its path. The schema has already checked ids and locales. */
export function validateTextSlots(
    text: ThemeText | undefined
): TextSlotIssue[] {
    const issues: TextSlotIssue[] = [];
    for (const [slot, entry] of Object.entries(text?.slots ?? {})) {
        for (const [locale, template] of Object.entries(entry)) {
            const error = slotTemplateError(slot as TextSlotId, template);
            if (error) {
                issues.push({
                    path: `$.text.slots.${slot}.${locale}`,
                    message: `${slot} (${locale}): ${error}`
                });
            }
        }
    }
    return issues;
}
