// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React, { type FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLATFORM_DEFAULT_HEADER } from 'themes/platform/headerRecipe';

import OffsetAppBar from './OffsetAppBar';
import { useDeclareHeaderLead, useHeaderLead } from './toolbar/headerLead';

/*
 * THEME-B2 §3.6. The offset a page clears is the WHOLE fixed header's footprint — its measured
 * bottom edge, so wrapped rows, the library row and a floating inset are in it — and it follows the
 * header when it grows.
 */

let host: HTMLDivElement;
let root: Root;
let bottom = 48;
let observed: (() => void) | undefined;

beforeEach(() => {
    bottom = 48;
    globalThis.ResizeObserver = class {
        private target?: Element;
        constructor(callback: (entries: { target: Element }[]) => void) {
            observed = () =>
                callback(this.target ? [{ target: this.target }] : []);
        }
        observe(target: Element) {
            this.target = target;
        }
        disconnect() {
            /* nothing to release */
        }
    } as unknown as typeof ResizeObserver;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
        fn(0);
        return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        () => ({ bottom }) as DOMRect
    );
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
});

const spacer = () =>
    host.querySelector<HTMLElement>('header + [aria-hidden="true"]');
const html = document.documentElement;

describe('OffsetAppBar overlap (THEME-B2)', () => {
    it('without overlap: spacer the header’s height, nothing published', () => {
        act(() =>
            root.render(<OffsetAppBar dense recipe={PLATFORM_DEFAULT_HEADER} />)
        );
        expect(spacer()?.style.height).toBe('48px');
        expect(html.hasAttribute('data-rf-header-overlap')).toBe(false);
        expect(html.style.getPropertyValue('--rf-header-footprint')).toBe('');
    });

    it('with overlap: no spacer, the footprint published, and withdrawn on unmount', () => {
        act(() =>
            root.render(
                <OffsetAppBar dense recipe={PLATFORM_DEFAULT_HEADER} overlap />
            )
        );
        expect(spacer()?.style.height).toBe('0px');
        expect(html.getAttribute('data-rf-header-overlap')).toBe('hero');
        expect(html.style.getPropertyValue('--rf-header-footprint')).toBe(
            '48px'
        );
        expect(
            host.querySelector('header')?.getAttribute('data-rf-header-overlap')
        ).toBe('hero');

        act(() =>
            root.render(<OffsetAppBar dense recipe={PLATFORM_DEFAULT_HEADER} />)
        );
        expect(html.hasAttribute('data-rf-header-overlap')).toBe(false);
        expect(html.style.getPropertyValue('--rf-header-footprint')).toBe('');
    });

    it('follows the header when it wraps or gains its library row', () => {
        act(() =>
            root.render(
                <OffsetAppBar dense recipe={PLATFORM_DEFAULT_HEADER} overlap />
            )
        );
        bottom = 152; // main row wrapped onto a second line, plus the library toolbar
        act(() => observed?.());
        expect(html.style.getPropertyValue('--rf-header-footprint')).toBe(
            '152px'
        );
    });
});

describe('header lead declaration', () => {
    const Probe: FC<{ onRead: (lead: boolean) => void }> = ({ onRead }) => {
        onRead(useHeaderLead());
        return null;
    };
    const Page: FC<{ lead: boolean }> = ({ lead }) => {
        useDeclareHeaderLead(lead);
        return null;
    };

    it('is true only while a page declares a lead image, and survives a late unmount', () => {
        let lead = false;
        const read = (value: boolean) => {
            lead = value;
        };
        act(() => root.render(<Probe onRead={read} />));
        expect(lead).toBe(false);

        act(() =>
            root.render(
                <>
                    <Probe onRead={read} />
                    <Page key='a' lead />
                </>
            )
        );
        expect(lead).toBe(true);

        // The next page declares before the previous one is gone.
        act(() =>
            root.render(
                <>
                    <Probe onRead={read} />
                    <Page key='b' lead />
                </>
            )
        );
        expect(lead).toBe(true);

        act(() =>
            root.render(
                <>
                    <Probe onRead={read} />
                    <Page key='b' lead={false} />
                </>
            )
        );
        expect(lead).toBe(false);
    });
});
