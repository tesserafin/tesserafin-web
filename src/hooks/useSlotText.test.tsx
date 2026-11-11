// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaShelf } from 'ui/components/MediaShelf/MediaShelf';
import { PLATFORM_DEFAULT_PRESENTATION } from 'themes/platform/resolvePresentation';
import type { ThemeTextSlots } from 'themes/platform/contract';
import { PresentationProvider } from 'ui/presentation/PresentationContext';

import { useSlotText } from './useSlotText';

/*
 * A two-language application: French with one key missing (so globalize falls back to English for
 * it, as it really does), and the culture switchable per test.
 */
const state = vi.hoisted(() => ({ culture: 'fr' }));
vi.mock('lib/globalize', () => {
    const fr: Record<string, string> = {
        NextUp: 'À suivre',
        LatestFromLibrary: 'Ajouts récents dans {0}'
    };
    const en: Record<string, string> = {
        NextUp: 'Next up',
        LatestFromLibrary: 'Recently Added in {0}',
        HeaderUpcoming: 'Upcoming'
    };
    const nl: Record<string, string> = { NextUp: 'Volgende' };
    const dictionaries: Record<string, Record<string, string>> = {
        fr,
        'fr-ca': fr,
        nl
    };
    const fill = (text: string, args: unknown[]) =>
        args.reduce<string>(
            (out, value, i) => out.split(`{${i}}`).join(String(value)),
            text
        );
    const api = {
        getCurrentLocale: () => state.culture,
        translate: (key: string, ...args: unknown[]) =>
            fill(dictionaries[state.culture]?.[key] ?? en[key] ?? key, args),
        translateWithLocale: (key: string, ...args: unknown[]) => {
            const own = dictionaries[state.culture]?.[key];
            return {
                text: fill(own ?? en[key] ?? key, args),
                lang: own ? state.culture : 'en-us'
            };
        }
    };
    return { ...api, default: api };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    state.culture = 'fr';
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        root = createRoot(container);
    });
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const Probe: React.FC<{
    slot: Parameters<typeof useSlotText>[0];
    textKey: string;
    variables?: Record<string, string>;
}> = ({ slot, textKey, variables }) => {
    const result = useSlotText(slot, textKey, variables);
    return <output lang={result.langAttribute}>{result.text}</output>;
};

function render(
    node: React.ReactNode,
    local?: ThemeTextSlots,
    theme?: ThemeTextSlots
) {
    act(() => {
        root.render(
            <PresentationProvider
                value={{
                    presentation: PLATFORM_DEFAULT_PRESENTATION,
                    fallbacks: [],
                    activatable: true,
                    text: [local, theme]
                }}
            >
                {node}
            </PresentationProvider>
        );
    });
}

const output = () => container.querySelector('output');

describe('useSlotText (THEME-A2 §5, §6)', () => {
    it('falls back to the application translation, in the interface language', () => {
        render(<Probe slot='home.nextUp.title' textKey='NextUp' />);
        expect(output()?.textContent).toBe('À suivre');
        expect(output()?.hasAttribute('lang')).toBe(false);
    });

    it('marks an English application fallback in a French interface with lang', () => {
        render(
            <Probe
                slot='library.suggestions.upcomingEpisodes.title'
                textKey='HeaderUpcoming'
            />
        );
        expect(output()?.textContent).toBe('Upcoming');
        expect(output()?.getAttribute('lang')).toBe('en-us');
    });

    it('shows the French override in French, and never to a Dutch user', () => {
        const local = { 'home.nextUp.title': { fr: 'La suite de vos séries' } };
        render(<Probe slot='home.nextUp.title' textKey='NextUp' />, local);
        expect(output()?.textContent).toBe('La suite de vos séries');

        state.culture = 'nl';
        render(<Probe slot='home.nextUp.title' textKey='NextUp' />, {
            ...local
        });
        expect(output()?.textContent).toBe('Volgende');
    });

    it('shows a Dutch user the English application text, not a French override, when Dutch lacks it', () => {
        state.culture = 'nl';
        render(
            <Probe
                slot='library.suggestions.upcomingEpisodes.title'
                textKey='HeaderUpcoming'
            />,
            {
                'library.suggestions.upcomingEpisodes.title': {
                    fr: 'Prochains épisodes'
                }
            }
        );
        expect(output()?.textContent).toBe('Upcoming');
        expect(output()?.getAttribute('lang')).toBe('en-us');
    });

    it('applies the local draft before the theme', () => {
        render(
            <Probe slot='home.nextUp.title' textKey='NextUp' />,
            { 'home.nextUp.title': { fr: 'Local' } },
            { 'home.nextUp.title': { fr: 'Thème' } }
        );
        expect(output()?.textContent).toBe('Local');
    });

    it('fills variables for an override and for the application text alike', () => {
        const variables = { libraryName: 'Films' };
        render(
            <Probe
                slot='home.latestMedia.title'
                textKey='LatestFromLibrary'
                variables={variables}
            />
        );
        expect(output()?.textContent).toBe('Ajouts récents dans Films');
        render(
            <Probe
                slot='home.latestMedia.title'
                textKey='LatestFromLibrary'
                variables={variables}
            />,
            { 'home.latestMedia.title': { fr: 'Nouveautés · {libraryName}' } }
        );
        expect(output()?.textContent).toBe('Nouveautés · Films');
    });

    it('ignores an override missing its required variable, so shelves stay distinct', () => {
        render(
            <Probe
                slot='home.latestMedia.title'
                textKey='LatestFromLibrary'
                variables={{ libraryName: 'Films' }}
            />,
            { 'home.latestMedia.title': { fr: 'Nouveautés' } }
        );
        expect(output()?.textContent).toBe('Ajouts récents dans Films');
    });

    it('re-resolves when the interface language changes', () => {
        const local = { 'home.nextUp.title': { fr: 'La suite' } };
        render(<Probe slot='home.nextUp.title' textKey='NextUp' />, local);
        expect(output()?.textContent).toBe('La suite');
        state.culture = 'nl';
        render(<Probe slot='home.nextUp.title' textKey='NextUp' />, local);
        expect(output()?.textContent).toBe('Volgende');
    });

    it('gives a shelf heading the resolved words and their language, and names the region by them', () => {
        const Shelf = () => {
            const title = useSlotText(
                'library.suggestions.upcomingEpisodes.title',
                'HeaderUpcoming'
            );
            return (
                <MediaShelf
                    id='upcoming'
                    title={title.text}
                    titleLang={title.langAttribute}
                >
                    <span />
                </MediaShelf>
            );
        };
        render(<Shelf />);
        const heading = container.querySelector('h2');
        expect(heading?.textContent).toBe('Upcoming');
        expect(heading?.getAttribute('lang')).toBe('en-us');
        expect(
            container.querySelector('[aria-labelledby="upcoming-heading"]')
        ).not.toBeNull();
    });
});
