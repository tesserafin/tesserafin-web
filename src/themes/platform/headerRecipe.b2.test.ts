import { describe, expect, it } from 'vitest';

import themeSchema from '../../../tesserafin-design/schema/theme.schema.json';

import {
    arrangeHeaderActions,
    effectiveHeader,
    type HeaderActionId,
    PLATFORM_DEFAULT_HEADER,
    resolveHeader
} from './headerRecipe';

const ALL: HeaderActionId[] = ['syncPlay', 'cast', 'search'];

describe('header recipe B2 keys (THEME-B2)', () => {
    it('defaults to the bar as it was: start, icons, inline, no overlap', () => {
        const header = resolveHeader({}, 'opaque');
        expect(header.layout).toBe('start');
        expect(header.actions).toEqual({ labels: 'icons', grouping: 'inline' });
        expect(header.overlap).toBe('none');
    });

    it('takes valid values and drops invalid ones key by key, keeping the sibling', () => {
        const header = resolveHeader(
            {
                layout: 'centered',
                overlap: 'everywhere',
                actions: { labels: 'iconsAndLabels', grouping: 'hidden' }
            },
            'opaque'
        );
        expect(header.layout).toBe('centered');
        expect(header.overlap).toBe('none');
        expect(header.actions).toEqual({
            labels: 'iconsAndLabels',
            grouping: 'inline'
        });
    });

    it('never throws on a hand-edited record', () => {
        for (const bad of [
            null,
            3,
            'x',
            { actions: 'overflow' },
            { actions: [] }
        ]) {
            expect(resolveHeader(bad, 'glass').actions).toEqual(
                PLATFORM_DEFAULT_HEADER.actions
            );
        }
    });

    it('has no B3 key in the schema yet', () => {
        const props = (
            themeSchema.$defs as unknown as Record<
                string,
                { properties: object }
            >
        ).headerVariant.properties;
        expect(Object.keys(props)).not.toContain('anchor');
    });
});

describe('arrangeHeaderActions (§3.5)', () => {
    it('inline keeps every action in the bar, in the product order', () => {
        expect(arrangeHeaderActions(ALL, 'inline', false)).toEqual({
            bar: ['syncPlay', 'cast', 'search'],
            more: []
        });
    });

    it('overflow moves SyncPlay and Cast into More, which stands where SyncPlay was', () => {
        expect(arrangeHeaderActions(ALL, 'overflow', false)).toEqual({
            bar: ['more', 'search'],
            more: ['syncPlay', 'cast']
        });
    });

    it('never moves Search', () => {
        for (const remote of [false, true]) {
            expect(arrangeHeaderActions(ALL, 'overflow', remote).bar).toContain(
                'search'
            );
            expect(
                arrangeHeaderActions(ALL, 'overflow', remote).more
            ).not.toContain('search');
        }
    });

    it('an active remote session brings Cast out of More, in its own place', () => {
        expect(arrangeHeaderActions(ALL, 'overflow', true)).toEqual({
            bar: ['more', 'cast', 'search'],
            more: ['syncPlay']
        });
        // ... and back once it ends.
        expect(arrangeHeaderActions(ALL, 'overflow', false).more).toContain(
            'cast'
        );
    });

    it('without SyncPlay (policy or plugin), More holds Cast alone, and vanishes with a session', () => {
        const noSync: HeaderActionId[] = ['cast', 'search'];
        expect(arrangeHeaderActions(noSync, 'overflow', false)).toEqual({
            bar: ['more', 'search'],
            more: ['cast']
        });
        expect(arrangeHeaderActions(noSync, 'overflow', true)).toEqual({
            bar: ['cast', 'search'],
            more: []
        });
    });

    it('never adds or drops an action: bar and More together are exactly the available set', () => {
        for (const available of [ALL, ['cast', 'search'] as HeaderActionId[]]) {
            for (const grouping of ['inline', 'overflow'] as const) {
                for (const remote of [false, true]) {
                    const { bar, more } = arrangeHeaderActions(
                        available,
                        grouping,
                        remote
                    );
                    expect(
                        [...bar.filter((id) => id !== 'more'), ...more].sort()
                    ).toEqual([...available].sort());
                }
            }
        }
    });
});

describe('effectiveHeader: compact fallbacks and the page’s say on overlap (§5.2, §3.6)', () => {
    const header = resolveHeader(
        {
            layout: 'centered',
            actions: { labels: 'iconsAndLabels' },
            overlap: 'hero'
        },
        'opaque'
    );

    it('a wide window draws what the theme asked', () => {
        expect(effectiveHeader(header, { compact: false, lead: true })).toEqual(
            { layout: 'centered', labels: 'iconsAndLabels', overlap: true }
        );
    });

    it('a compact window falls back to start, icons, and keeps the spacer', () => {
        expect(effectiveHeader(header, { compact: true, lead: true })).toEqual({
            layout: 'start',
            labels: 'icons',
            overlap: false
        });
    });

    it('a page without a compatible lead image keeps the spacer', () => {
        expect(
            effectiveHeader(header, { compact: false, lead: false }).overlap
        ).toBe(false);
    });

    it('a page with a lead image never overlaps unless the theme asks', () => {
        expect(
            effectiveHeader(resolveHeader({}, 'glass'), {
                compact: false,
                lead: true
            }).overlap
        ).toBe(false);
    });
});
