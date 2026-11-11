// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadAppliedPresentation } from 'themes/platform/localPresentation';
import { resolvePresentation } from 'themes/platform/resolvePresentation';

import { parseDraft, serialiseDraft } from '../draftFormat';
import { loadDraft } from '../draftStorage';

import { ThemeStudio } from './ThemeStudio';

/**
 * THEME-A1 in the Studio, held to the standard of the composition controls: a setting must act in
 * the PREVIEW (through the same primitives the app uses), reach the record the LIVE renderer reads
 * on Apply, survive a reload of the Studio, and round-trip through the exported document.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    window.localStorage.clear();
    document.getElementById('tesserafin-local-theme-overlay')?.remove();
    document.documentElement.removeAttribute('data-rf-local-theme');
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
    window.localStorage.clear();
});

function render() {
    act(() => {
        root.render(<ThemeStudio />);
    });
}

function clickButtonLabelled(text: string) {
    const button = [...container.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes(text)
    );
    if (!button) throw new Error(`No button labelled "${text}"`);
    act(() => {
        button.click();
    });
}

/** Opens the MUI select labelled by `labelId` and picks `value`, as a pointer user would. */
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
        '[data-testid="theme-studio-preview"]'
    );

describe('Theme Studio — THEME-A1 settings are real', () => {
    it('acts in the preview through the real primitives', () => {
        render();
        clickButtonLabelled('Copy Tesserafin Classic');

        choose('presentation-title-size', 'small');
        choose('presentation-title-lines', '3');
        // Home: the shelves' headings and cards.
        expect(
            preview()
                ?.querySelector('h2.rf-section-title')
                ?.getAttribute('data-rf-title-size')
        ).toBe('small');
        expect(
            preview()?.querySelector('[data-rf-slot="media-card"]')?.className
        ).toContain('rf-media-card--title-3');

        choose('presentation-tabs', 'pills');
        choose('studio-surface', 'library');
        expect(
            preview()?.querySelector('[data-rf-slot="tabs"]')?.className
        ).toContain('rf-tabs--pills');

        choose('presentation-people-grid', 'large');
        choose('studio-surface', 'itemDetails');
        expect(
            preview()
                ?.querySelector('[aria-label="Preview cast"]')
                ?.getAttribute('data-rf-grid-size')
        ).toBe('large');
    });

    it('previews the DRAFT, not the applied theme', () => {
        // The applied record asks for pills; the Classic draft being edited does not. Before
        // THEME-A1 the preview's primitives read the applied record and showed pills anyway.
        window.localStorage.setItem(
            'tesserafin.themeStudio.appliedPresentation',
            JSON.stringify({ navigation: { tabs: 'pills' } })
        );
        render();
        clickButtonLabelled('Copy Tesserafin Classic');
        choose('studio-surface', 'library');
        expect(
            preview()?.querySelector('[data-rf-slot="tabs"]')?.className
        ).toContain('rf-tabs--underline');
    });

    it('reaches the live record on Apply, survives a reload, and round-trips on export', () => {
        render();
        clickButtonLabelled('Copy Tesserafin Glass');
        choose('presentation-title-alignment', 'center');
        choose('presentation-library-grid', 'small');
        clickButtonLabelled('Apply to Tesserafin');

        const applied = loadAppliedPresentation();
        // The edited keys, and Glass's own A1 keys kept beside them.
        expect(applied?.sectionTitle).toEqual({
            size: 'large',
            weight: 'bold',
            align: 'center'
        });
        expect(applied?.grid).toEqual({ library: 'small' });
        expect(applied?.navigation?.tabs).toBe('pills');
        const resolved = resolvePresentation({ presentation: applied ?? {} });
        expect(resolved.fallbacks).toEqual([]);
        expect(resolved.presentation.sectionTitle.align).toBe('center');
        expect(resolved.presentation.grid.library).toBe('small');

        // A reload of the Studio reads the persisted draft back into the controls.
        act(() => {
            root.unmount();
            root = createRoot(container);
        });
        render();
        const combobox = container.querySelector(
            '[role="combobox"][aria-labelledby~="presentation-title-alignment"]'
        );
        expect(combobox?.textContent).toBe('center');

        const stored = loadDraft();
        if (!stored) throw new Error('the draft must be persisted');
        const reimported = parseDraft(serialiseDraft(stored));
        expect(reimported.issues).toEqual([]);
        expect(
            reimported.valid && reimported.draft.manifest.presentation?.grid
        ).toEqual({ library: 'small' });
    });
});
