// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PLATFORM_DEFAULT_HEADER } from 'themes/platform/headerRecipe';

import OffsetAppBar, { headerBarProps } from './OffsetAppBar';
import { HeaderBrand } from './toolbar/HeaderBrand';

const DEFAULT = PLATFORM_DEFAULT_HEADER;

describe('headerBarProps (THEME-B1)', () => {
    it('keeps MUI’s own path for the default recipe, identical to no recipe at all', () => {
        for (const scrolled of [false, true]) {
            const none = headerBarProps(undefined, scrolled, 4);
            const theme = headerBarProps(DEFAULT, scrolled, 4);
            expect([theme.color, theme.elevation]).toEqual([
                none.color,
                none.elevation
            ]);
        }
        expect(headerBarProps(DEFAULT, false, 4)).toMatchObject({
            color: 'transparent',
            elevation: 0
        });
        expect(headerBarProps(DEFAULT, true, 4)).toMatchObject({
            color: 'default',
            elevation: 4
        });
    });

    it('draws glass through the stylesheet, not MUI, at rest and scrolled', () => {
        const glass = {
            ...DEFAULT,
            material: { rest: 'glass', scrolled: 'glass' }
        } as const;
        expect(headerBarProps(glass, false, 4)).toMatchObject({
            color: 'transparent',
            'data-rf-header-material': 'glass'
        });
        expect(headerBarProps(glass, true, 4)['data-rf-header-material']).toBe(
            'glass'
        );
    });

    it('drops the elevation shadow for any other separator', () => {
        expect(
            headerBarProps({ ...DEFAULT, separator: 'hairline' }, true, 4)
                .elevation
        ).toBe(0);
        expect(
            headerBarProps({ ...DEFAULT, separator: 'none' }, true, 4).elevation
        ).toBe(0);
    });

    it('can give the bar a surface at rest', () => {
        const props = headerBarProps(
            { ...DEFAULT, material: { rest: 'surface', scrolled: 'surface' } },
            false,
            4
        );
        expect(props).toMatchObject({ color: 'default', elevation: 0 });
    });

    it('marks nothing for the admin dashboard, which passes no recipe', () => {
        const props = headerBarProps(undefined, true, 4);
        expect(props['data-rf-header-material']).toBeUndefined();
        expect(props['data-rf-header-density']).toBeUndefined();
    });
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
    // jsdom has no ResizeObserver; the bar only needs one to exist to measure itself.
    globalThis.ResizeObserver ??= class {
        observe() {
            /* measuring is not under test here */
        }
        unobserve() {
            /* nothing observed */
        }
        disconnect() {
            /* nothing observed */
        }
    } as unknown as typeof ResizeObserver;
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

describe('OffsetAppBar with a recipe', () => {
    it('carries the recipe on the bar, and nothing without one', () => {
        act(() =>
            root.render(
                <>
                    <OffsetAppBar
                        recipe={{
                            ...DEFAULT,
                            density: 'spacious',
                            shape: 'floating'
                        }}
                    >
                        <span />
                    </OffsetAppBar>
                    <OffsetAppBar>
                        <span />
                    </OffsetAppBar>
                </>
            )
        );
        const [themed, plain] =
            container.querySelectorAll<HTMLElement>('.MuiAppBar-root');
        expect(themed.dataset).toMatchObject({
            rfHeaderDensity: 'spacious',
            rfHeaderShape: 'floating'
        });
        expect(plain.dataset.rfHeaderDensity).toBeUndefined();
    });
});

describe('HeaderBrand', () => {
    const render = (brand: Parameters<typeof HeaderBrand>[0]['brand']) =>
        act(() =>
            root.render(
                <MemoryRouter>
                    <HeaderBrand name='Médiathèque' brand={brand} />
                </MemoryRouter>
            )
        );
    const link = () => container.querySelector('a');

    it('draws the mark and the name by default', () => {
        render(undefined);
        expect(link()?.querySelector('img')).not.toBeNull();
        expect(link()?.textContent).toBe('Médiathèque');
    });

    it('keeps the name as the accessible name when only the mark shows', () => {
        render({ ...DEFAULT.brand, show: 'mark' });
        expect(link()?.querySelector('img')).not.toBeNull();
        expect(link()?.textContent).toBe('Médiathèque');
        expect(link()?.querySelector('span[style]')).not.toBeNull();
    });

    it('drops the mark when only the name shows', () => {
        render({ ...DEFAULT.brand, show: 'name' });
        expect(link()?.querySelector('img')).toBeNull();
        expect(link()?.textContent).toBe('Médiathèque');
    });
});
