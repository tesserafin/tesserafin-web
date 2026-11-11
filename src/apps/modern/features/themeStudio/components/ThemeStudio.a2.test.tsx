// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAppliedText } from 'themes/platform/localText';

import { draftReducer, initHistory } from '../draftState';
import { parseDraft, serialiseDraft } from '../draftFormat';
import { loadDraft } from '../draftStorage';
import { getOfficialSource } from '../officialSources';
import { createDraft } from '../draftState';

import { ThemeStudio } from './ThemeStudio';

/**
 * THEME-A2 in the Studio: a text edit shows in the preview through the page's own resolution,
 * reaches the live record on Apply, survives a reload and an export, and the two ways a value can
 * be wrong or reset behave as the contract says.
 */

/*
 * The real module's import chain needs the app host; the shipped English dictionary stands in, so
 * the application text the fields show is the real one.
 */
vi.mock('lib/globalize', async () => {
    const dictionary = (await import('../../../../../strings/en-us.json'))
        .default as Record<string, string>;
    const translate = (key: string, ...args: unknown[]) =>
        args.reduce<string>(
            (text, value, index) =>
                text.split(`{${index}}`).join(String(value)),
            dictionary[key] ?? key
        );
    const api = {
        translate,
        getCurrentLocale: () => 'en-us',
        translateWithLocale: (key: string, ...args: unknown[]) => ({
            text: translate(key, ...args),
            lang: 'en-us'
        })
    };
    return { ...api, default: api };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        root = createRoot(container);
    });
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
});

const render = () => act(() => root.render(<ThemeStudio />));

function clickButton(text: string) {
    const button = [...container.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes(text)
    );
    if (!button) throw new Error(`No button "${text}"`);
    act(() => button.click());
    return button;
}

const field = (slot: string) =>
    container.querySelector<HTMLInputElement>(
        `[data-text-slot="${slot}"] input`
    );

/** Types into a controlled input the way React listens for it. */
function type(slot: string, value: string) {
    const input = field(slot);
    if (!input) throw new Error(`No field for ${slot}`);
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
    )?.set;
    act(() => {
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

const helper = (slot: string) =>
    container.querySelector(
        `[data-text-slot="${slot}"] .MuiFormHelperText-root`
    )?.textContent;

const previewHeadings = () =>
    [
        ...container.querySelectorAll('[data-testid="theme-studio-preview"] h2')
    ].map((node) => node.textContent);

/**
 * Each flow drives the whole Studio through real MUI selects and inputs. Alone a flow takes 1-3 s;
 * under the full suite's parallel load it has crossed the 5 s default, so the budget is explicit.
 */
const FLOW_TIMEOUT = 15_000;

describe('Theme Studio — THEME-A2 texts are real', () => {
    it(
        'shows the application text, then the edit in the preview through the page resolution',
        () => {
            render();
            clickButton('Copy Tesserafin Classic');
            expect(helper('home.nextUp.title')).toBe(
                'Application text: “Next Up”'
            );
            expect(previewHeadings()).toContain('Next Up');

            type('home.nextUp.title', 'Up next for you');
            expect(previewHeadings()).toContain('Up next for you');
            expect(previewHeadings()).not.toContain('Next Up');
        },
        FLOW_TIMEOUT
    );

    it(
        'refuses an empty text instead of treating it as a reset, and blocks Apply',
        () => {
            render();
            clickButton('Copy Tesserafin Classic');
            type('home.nextUp.title', 'x');
            type('home.nextUp.title', '');
            expect(helper('home.nextUp.title')).toBe('The text is empty.');
            clickButton('Apply to Tesserafin');
            expect(loadAppliedText()).toBeNull();
        },
        FLOW_TIMEOUT
    );

    it(
        'resets by removing the entry, so the slot inherits again',
        () => {
            render();
            clickButton('Copy Tesserafin Classic');
            type('home.nextUp.title', 'Up next for you');
            // The field's own Reset — the Studio also has a draft-wide "Reset" that must not be the one
            // clicked here: it reverts every edit, and would pass this test for the wrong reason.
            const reset = [
                ...container.querySelectorAll<HTMLButtonElement>(
                    '[data-text-slot="home.nextUp.title"] button'
                )
            ].find((button) => button.textContent === 'Reset');
            if (!reset) throw new Error('no Reset on the field');
            type('home.libraries.title', 'Our libraries');
            act(() => reset.click());
            expect(field('home.nextUp.title')?.value).toBe('');
            expect(helper('home.nextUp.title')).toBe(
                'Application text: “Next Up”'
            );
            // Only that slot went back to inheriting: the other edit is untouched.
            expect(loadDraft()?.manifest.text).toEqual({
                slots: { 'home.libraries.title': { 'en-us': 'Our libraries' } }
            });
        },
        FLOW_TIMEOUT
    );

    it(
        'names a missing required variable and inserts it as a token',
        () => {
            render();
            clickButton('Copy Tesserafin Classic');
            type('home.latestMedia.title', 'New in ');
            expect(helper('home.latestMedia.title')).toMatch(
                '{libraryName} is required'
            );
            act(() => field('home.latestMedia.title')?.setSelectionRange(7, 7));
            clickButton('Insert {libraryName}');
            expect(field('home.latestMedia.title')?.value).toBe(
                'New in {libraryName}'
            );
            expect(helper('home.latestMedia.title')).toMatch('Set for en-us');
        },
        FLOW_TIMEOUT
    );

    it(
        'reaches the live record on Apply, survives a reload, and round-trips on export',
        () => {
            render();
            clickButton('Copy Tesserafin Classic');
            type('library.suggestions.upcomingEpisodes.title', 'Coming soon');
            clickButton('Apply to Tesserafin');
            expect(loadAppliedText()).toEqual({
                'library.suggestions.upcomingEpisodes.title': {
                    'en-us': 'Coming soon'
                }
            });

            act(() => {
                root.unmount();
                root = createRoot(container);
            });
            render();
            expect(
                field('library.suggestions.upcomingEpisodes.title')?.value
            ).toBe('Coming soon');

            const stored = loadDraft();
            if (!stored) throw new Error('draft must persist');
            const again = parseDraft(serialiseDraft(stored));
            expect(again.issues).toEqual([]);
            expect(again.valid && again.draft.manifest.text?.slots).toEqual({
                'library.suggestions.upcomingEpisodes.title': {
                    'en-us': 'Coming soon'
                }
            });
            expect(
                again.valid && again.draft.manifest.capabilities?.optional
            ).toContain('text.slots');
        },
        FLOW_TIMEOUT
    );
});

describe('draftReducer set-text', () => {
    const source = getOfficialSource('official.glass');
    if (!source) throw new Error('Glass must be a source');
    const history = initHistory(createDraft(source, 'Copy', 'Author'));

    it('drops empty slot maps and the group itself, and adds the capability once', () => {
        const set = draftReducer(history, {
            type: 'set-text',
            slots: {
                'home.nextUp.title': { fr: 'À suivre' },
                'home.libraries.title': {}
            }
        });
        expect(set?.present.manifest.text).toEqual({
            slots: { 'home.nextUp.title': { fr: 'À suivre' } }
        });
        const optional = set?.present.manifest.capabilities?.optional ?? [];
        expect(optional.filter((entry) => entry === 'text.slots')).toHaveLength(
            1
        );

        const cleared = draftReducer(set, {
            type: 'set-text',
            slots: { 'home.nextUp.title': {} }
        });
        expect(cleared?.present.manifest.text).toBeUndefined();
    });
});
