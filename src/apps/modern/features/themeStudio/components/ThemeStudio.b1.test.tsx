// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAppliedPresentation } from 'themes/platform/localPresentation';
import { resolveHeader } from 'themes/platform/headerRecipe';
import { resolvePresentation } from 'themes/platform/resolvePresentation';

import { ThemeStudio } from './ThemeStudio';

/**
 * THEME-B1 in the Studio: the header controls act on the preview's real bar (both states), keep
 * sibling keys of a nested group, offer "auto" for the destinations, and reach the live record.
 */

/* The real module's import chain needs the app host; the English dictionary stands in. */
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

/** Flows drive the whole Studio through real MUI selects: an explicit budget under suite load. */
const FLOW_TIMEOUT = 15_000;

function clickButtonLabelled(text: string) {
    const button = [...container.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes(text)
    );
    if (!button) throw new Error(`No button labelled "${text}"`);
    act(() => button.click());
}

function choose(labelId: string, value: string) {
    const combobox = container.querySelector(
        `[role="combobox"][aria-labelledby~="${labelId}"]`
    );
    if (!combobox) throw new Error(`No select labelled "${labelId}"`);
    act(() => {
        combobox.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, button: 0 })
        );
    });
    // Scoped to THIS select's listbox: MUI keeps a closing menu mounted for its exit transition,
    // and an unscoped query clicked "large" in the previous select's list instead.
    const option = document.querySelector<HTMLElement>(
        `[role="listbox"][aria-labelledby~="${labelId}"] [role="option"][data-value="${value}"]`
    );
    if (!option) throw new Error(`No option "${value}" for "${labelId}"`);
    act(() => {
        option.click();
    });
}

const bar = (state: 'rest' | 'scrolled') =>
    container.querySelector<HTMLElement>(`[data-rf-preview-header="${state}"]`);
const nav = () =>
    container.querySelector<HTMLElement>(
        '[data-testid="theme-studio-preview-header"] nav'
    );

describe('Theme Studio — THEME-B1 header settings are real', () => {
    it(
        'acts on the preview bar, at rest and scrolled',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Classic');
            expect(bar('rest')?.dataset.rfHeaderMaterial).toBe('transparent');
            expect(bar('scrolled')?.dataset.rfHeaderMaterial).toBe('surface');

            choose('presentation-header-material-when-scrolled', 'glass');
            choose('presentation-header-material-at-rest', 'glass');
            choose('presentation-header-density', 'spacious');
            expect(bar('rest')?.dataset.rfHeaderMaterial).toBe('glass');
            expect(bar('rest')?.dataset.rfHeaderDensity).toBe('spacious');
            // The sibling set first is kept, not reset to the default it would fall back to.
            expect(bar('scrolled')?.dataset.rfHeaderMaterial).toBe('glass');
        },
        FLOW_TIMEOUT
    );

    it(
        'derives the destinations style until one is chosen, and "auto" goes back to deriving',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Glass');
            expect(nav()?.dataset.rfNavStyle).toBe('floating');
            choose('presentation-destinations-in-the-bar', 'underline');
            expect(nav()?.dataset.rfNavStyle).toBe('underline');
            choose('presentation-destinations-in-the-bar', 'auto');
            expect(nav()?.dataset.rfNavStyle).toBe('floating');
        },
        FLOW_TIMEOUT
    );

    it(
        'hides the brand name visually but keeps it as the link name',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Classic');
            choose('presentation-brand', 'mark');
            const brand = container.querySelector(
                '[data-rf-header-brand="mark"]'
            );
            expect(brand?.textContent).toContain('Médiathèque');
            expect(brand?.querySelector('img')).not.toBeNull();
        },
        FLOW_TIMEOUT
    );

    it(
        'reaches the live record on Apply',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Glass');
            choose('presentation-header-shape', 'floating');
            choose('presentation-header-separator', 'hairline');
            clickButtonLabelled('Apply to Tesserafin');
            const applied = loadAppliedPresentation();
            expect(applied?.header).toEqual({
                shape: 'floating',
                separator: 'hairline'
            });
            const resolved = resolvePresentation({
                presentation: applied ?? {}
            });
            expect(resolved.fallbacks).toEqual([]);
            expect(
                resolveHeader(
                    resolved.presentation.header,
                    resolved.presentation.surface.variant
                )
            ).toMatchObject({
                shape: 'floating',
                separator: 'hairline',
                nav: { style: 'floating' }
            });
        },
        FLOW_TIMEOUT
    );
});
