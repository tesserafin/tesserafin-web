// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAppliedPresentation } from 'themes/platform/localPresentation';
import { resolveHeader } from 'themes/platform/headerRecipe';
import { resolvePresentation } from 'themes/platform/resolvePresentation';

import { ThemeStudio } from './ThemeStudio';

/**
 * THEME-B2 in the Studio: layout, action labels, grouping and overlap act on the preview's bar —
 * drawn by the same `HeaderRow`, action buttons and "More" menu as the product — and survive Apply.
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

const preview = () =>
    container.querySelector<HTMLElement>(
        '[data-testid="theme-studio-preview-header"]'
    );
const bar = (state: 'rest' | 'scrolled') =>
    container.querySelector<HTMLElement>(`[data-rf-preview-header="${state}"]`);
const names = (state: 'rest' | 'scrolled') =>
    [...(bar(state)?.querySelectorAll<HTMLElement>('a, button') ?? [])].map(
        (el) => el.getAttribute('aria-label') ?? el.textContent?.trim()
    );

describe('Theme Studio — THEME-B2 header settings are real', () => {
    it(
        'centred layout keeps the order: brand, destinations, actions, account',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Classic');
            const before = names('rest');
            choose('presentation-header-layout', 'centered');
            expect(
                bar('rest')?.querySelector('[data-rf-header-layout="centered"]')
            ).not.toBeNull();
            expect(names('rest')).toEqual(before);
        },
        FLOW_TIMEOUT
    );

    it(
        'labels and overflow: More holds SyncPlay and Cast; a live session stays in the bar',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Glass');
            choose('presentation-action-labels', 'iconsAndLabels');
            expect(
                bar('rest')?.querySelector('.rf-header-action--labelled')
                    ?.textContent
            ).toBe('SyncPlay');
            choose('presentation-secondary-actions', 'overflow');
            expect(names('rest')).toContain('More');
            expect(names('rest')).not.toContain('SyncPlay');
            expect(names('rest')).not.toContain('Cast');
            expect(names('rest')).toContain('Search');
            // Scrolled preview: a remote session is active, so Cast is out of More.
            expect(names('scrolled')).toContain('Cast: Living room TV');
        },
        FLOW_TIMEOUT
    );

    it(
        'overlap draws the resting bar over a lead image, with the scrim hook',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Classic');
            expect(
                preview()?.querySelector('[data-rf-preview-lead]')
            ).toBeNull();
            choose('presentation-page-under-the-bar', 'hero');
            expect(
                preview()?.querySelector('[data-rf-preview-lead]')
            ).not.toBeNull();
            expect(bar('rest')?.dataset.rfHeaderOverlap).toBe('hero');
            expect(bar('scrolled')?.dataset.rfHeaderOverlap).toBeUndefined();
        },
        FLOW_TIMEOUT
    );

    it(
        'reaches the live record on Apply, siblings kept',
        () => {
            act(() => root.render(<ThemeStudio />));
            clickButtonLabelled('Copy Tesserafin Glass');
            choose('presentation-action-labels', 'iconsAndLabels');
            choose('presentation-secondary-actions', 'overflow');
            choose('presentation-header-layout', 'centered');
            choose('presentation-page-under-the-bar', 'hero');
            clickButtonLabelled('Apply to Tesserafin');
            const applied = loadAppliedPresentation();
            expect(applied?.header).toEqual({
                actions: { labels: 'iconsAndLabels', grouping: 'overflow' },
                layout: 'centered',
                overlap: 'hero'
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
                layout: 'centered',
                overlap: 'hero',
                actions: { labels: 'iconsAndLabels', grouping: 'overflow' }
            });
        },
        FLOW_TIMEOUT
    );
});
