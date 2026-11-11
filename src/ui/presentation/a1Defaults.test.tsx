// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MediaCard } from 'ui/components/MediaCard/MediaCard';
import { MediaGrid } from 'ui/components/MediaGrid/MediaGrid';
import { MediaShelf } from 'ui/components/MediaShelf/MediaShelf';
import { SectionTitle } from 'ui/components/SectionTitle/SectionTitle';
import { Tabs } from 'ui/components/Tabs/Tabs';
import type { ThemePresentation } from 'themes/platform/contract';
import { resolvePresentation } from 'themes/platform/resolvePresentation';

import { PresentationProvider } from './PresentationContext';

/**
 * THEME-A1 at the primitives: the theme supplies a DEFAULT, a call site that states its own value
 * keeps it, and a heading keeps its level and its words under every recipe.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        root = createRoot(container);
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    window.localStorage.removeItem(APPLIED_KEY);
});

const APPLIED_KEY = 'tesserafin.themeStudio.appliedPresentation';

function renderWith(presentation: ThemePresentation, node: ReactNode) {
    const resolution = resolvePresentation({ presentation });
    act(() => {
        root.render(
            <PresentationProvider
                value={{
                    presentation: resolution.presentation,
                    fallbacks: resolution.fallbacks,
                    activatable: resolution.activatable
                }}
            >
                {node}
            </PresentationProvider>
        );
    });
}

const noop = () => undefined;

describe('SectionTitle', () => {
    it('is an h2 carrying the recipe, with no provider at all', () => {
        act(() => {
            root.render(<SectionTitle id='x'>Continue watching</SectionTitle>);
        });
        const heading = container.querySelector('h2');
        expect(heading?.id).toBe('x');
        expect(heading?.className).toBe('rf-section-title');
        expect(heading?.dataset.rfTitleSize).toBe('auto');
        expect(heading?.dataset.rfTitleWeight).toBe('auto');
    });

    it('keeps its level and its text under every recipe value', () => {
        renderWith(
            {
                sectionTitle: {
                    size: 'small',
                    weight: 'regular',
                    align: 'center',
                    case: 'uppercase',
                    spacing: 'loose'
                }
            },
            <SectionTitle className='page-title' data-detail-heading='cast'>
                Cast
            </SectionTitle>
        );
        const heading = container.querySelector('h2');
        expect(heading?.textContent).toBe('Cast');
        expect(heading?.className).toBe('rf-section-title page-title');
        expect(heading?.dataset.detailHeading).toBe('cast');
        expect({ ...heading?.dataset }).toMatchObject({
            rfTitleSize: 'small',
            rfTitleWeight: 'regular',
            rfTitleAlign: 'center',
            rfTitleCase: 'uppercase',
            rfTitleSpacing: 'loose'
        });
    });

    it('renders the level a caller asks for', () => {
        act(() => {
            root.render(<SectionTitle level={3}>Albums</SectionTitle>);
        });
        expect(container.querySelector('h3')?.textContent).toBe('Albums');
    });

    it('is what MediaShelf titles itself with', () => {
        renderWith(
            { sectionTitle: { size: 'large' } },
            <MediaShelf title='Next up' id='next'>
                <span />
            </MediaShelf>
        );
        const heading = container.querySelector('h2');
        expect(heading?.id).toBe('next-heading');
        expect(heading?.classList.contains('rf-media-shelf__title')).toBe(true);
        expect(heading?.dataset.rfTitleSize).toBe('large');
    });

    it('follows an applied Studio draft after a reload', () => {
        // Apply writes this record; a reload is a fresh provider reading it back.
        window.localStorage.setItem(
            APPLIED_KEY,
            JSON.stringify({ sectionTitle: { size: 'small' } })
        );
        act(() => {
            root.render(
                <PresentationProvider themeId='official.classic'>
                    <SectionTitle>Next up</SectionTitle>
                </PresentationProvider>
            );
        });
        expect(container.querySelector('h2')?.dataset.rfTitleSize).toBe(
            'small'
        );
    });
});

describe('MediaCard title lines', () => {
    const card = (titleLines?: 1 | 2 | 3) => (
        <MediaCard
            title='A long title'
            imageAspect='poster'
            titleLines={titleLines}
        />
    );
    const classes = () =>
        container.querySelector('[data-rf-slot="media-card"]')?.className ?? '';

    it('takes the theme default when the caller says nothing', () => {
        renderWith({ mediaCard: { titleLines: 3 } }, card());
        expect(classes()).toContain('rf-media-card--title-3');
    });

    it('keeps the caller value over the theme default, in both directions', () => {
        renderWith({ mediaCard: { titleLines: 3 } }, card(1));
        expect(classes()).not.toContain('rf-media-card--title-');
        renderWith({}, card(2));
        expect(classes()).toContain('rf-media-card--title-2');
    });

    it('draws one line by default, as before', () => {
        renderWith({}, card());
        expect(classes()).not.toContain('rf-media-card--title-');
    });
});

describe('Tabs style', () => {
    const tabs = (variant?: 'underline' | 'pills') => (
        <Tabs
            items={[{ id: 'a', label: 'A' }]}
            value={0}
            onChange={noop}
            variant={variant}
        />
    );
    const classes = () =>
        container.querySelector('[data-rf-slot="tabs"]')?.className ?? '';

    it('takes the theme default when the caller says nothing', () => {
        renderWith({ navigation: { tabs: 'pills' } }, tabs());
        expect(classes()).toContain('rf-tabs--pills');
    });

    it('keeps a stated variant', () => {
        renderWith({ navigation: { tabs: 'pills' } }, tabs('underline'));
        expect(classes()).toContain('rf-tabs--underline');
    });

    it('keeps the tablist contract under both', () => {
        renderWith({ navigation: { tabs: 'pills' } }, tabs());
        expect(container.querySelector('[role="tablist"]')).not.toBeNull();
        expect(
            container
                .querySelector('[role="tab"]')
                ?.getAttribute('aria-selected')
        ).toBe('true');
    });
});

describe('MediaGrid context sizes', () => {
    const grid = (context?: 'library' | 'people') => (
        <MediaGrid context={context} density='compact'>
            <span />
        </MediaGrid>
    );
    const size = () =>
        container.querySelector<HTMLElement>('[data-rf-slot="media-grid"]')
            ?.dataset.rfGridSize;

    it('sizes a grid by its context only', () => {
        renderWith(
            { grid: { people: 'large', library: 'small' } },
            grid('people')
        );
        expect(size()).toBe('large');
        renderWith(
            { grid: { people: 'large', library: 'small' } },
            grid('library')
        );
        expect(size()).toBe('small');
    });

    it('adds nothing at medium or without a context, so the layout is as before', () => {
        renderWith({}, grid('library'));
        expect(size()).toBeUndefined();
        renderWith({ grid: { library: 'large' } }, grid());
        expect(size()).toBeUndefined();
    });

    it('keeps the density the caller (the user toggle) chose', () => {
        renderWith({ grid: { library: 'large' } }, grid('library'));
        expect(
            container.querySelector('[data-rf-slot="media-grid"]')?.className
        ).toContain('rf-media-grid--compact');
    });
});
