/**
 * Run-time resolution of a theme text slot (THEME-A2, `docs/tesserafin/design-theme-text-slots.md`
 * §5). On the start-up path, so deliberately small: no registry, no messages. The registry, the
 * validation messages and the recommendations live in `textSlots.ts`, which only validation and the
 * Theme Studio load.
 *
 * A call site names its slot, its default translation key and its variables. Overrides are tried in
 * order — the locally applied draft, then the active theme — each for the culture and then for its
 * language, and the first template that is valid FOR THESE VARIABLES wins. An invalid one is skipped,
 * never thrown: a hand-edited record degrades per slot and per language and never blocks start-up.
 */

import type { ThemeTextSlots } from './contract';

/** Technical ceilings, in Unicode code points, counted on the template before interpolation. */
const CEILING = { title: 120, action: 80 } as const;

export type SlotKind = keyof typeof CEILING;

export interface SlotText {
    text: string;
    /** The locale the text is written in: an override's key, or the dictionary's culture. */
    lang: string;
}

/**
 * Fills `template` with `variables`, or returns `null` when the template is not valid for them:
 * - empty after trimming, over the ceiling, or holding a control character;
 * - an unknown, missing or repeated variable;
 * - a lone brace.
 *
 * `{{` and `}}` are literal braces. Values are inserted as text: the result is rendered as a React
 * text node, never parsed as markup.
 */
export function fillTemplate(
    template: unknown,
    variables: Readonly<Record<string, string>>,
    kind: SlotKind
): string | null {
    if (
        typeof template !== 'string' ||
        !template.trim() ||
        [...template].length > CEILING[kind] ||
        // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
        /[\u0000-\u001f\u007f]/.test(template)
    ) {
        return null;
    }
    const used = new Set<string>();
    let valid = true;
    const text = template.replace(
        /\{\{|\}\}|\{([A-Za-z]+)\}|[{}]/g,
        (match, name: string | undefined) => {
            if (match === '{{') return '{';
            if (match === '}}') return '}';
            if (
                !name ||
                !Object.keys(variables).includes(name) ||
                used.has(name)
            ) {
                valid = false;
                return '';
            }
            used.add(name);
            return variables[name];
        }
    );
    return valid && used.size === Object.keys(variables).length ? text : null;
}

/**
 * The first valid override for `slot`, from `layers` in order, for `culture` and then its language.
 * `undefined` when no layer has one: the caller then uses the application's translation.
 */
export function resolveOverride(
    layers: readonly (ThemeTextSlots | null | undefined)[],
    slot: string,
    culture: string,
    variables: Readonly<Record<string, string>>,
    kind: SlotKind
): SlotText | undefined {
    const language = culture.split('-')[0];
    const locales = language === culture ? [culture] : [culture, language];
    for (const layer of layers) {
        const entry = layer?.[slot];
        if (!entry || typeof entry !== 'object') continue;
        for (const locale of locales) {
            const text = fillTemplate(entry[locale], variables, kind);
            if (text !== null) return { text, lang: locale };
        }
    }
    return undefined;
}
