import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => key }
}));
vi.mock('components/layoutManager', () => ({
    default: { tv: false, mobile: false, desktop: true }
}));
vi.mock('../utils/itemPredicates', () => ({ inferContext: () => 'movies' }));
vi.mock('components/router/appRouter', () => ({
    appRouter: {
        getRouteUrl: (item: { Type: string; Id: string }) =>
            `#/${item.Type.toLowerCase()}?id=${item.Id}`
    }
}));

// The real LinkButton's TV/app-host click handling is not under test here; its href is.
vi.mock('elements/emby-button/LinkButton', () => ({
    default: ({
        href,
        children
    }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href}>{children}</a>
}));

import type { DetailItem } from '../adapters/itemDetailsApi';
import MetadataLists from './MetadataLists';

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const movie = {
    Id: 'movie-1',
    Type: 'Movie',
    ServerId: 'srv',
    People: [
        { Id: 'p1', Name: 'Agnès V.', Type: 'Director' },
        { Id: 'p2', Name: 'Acteur', Type: 'Actor' }
    ],
    Studios: [{ Id: 's1', Name: 'Ciné-Tamaris' }],
    GenreItems: [
        { Id: 'g1', Name: 'Drame' },
        { Id: 'g2', Name: 'Romance' }
    ]
} as unknown as DetailItem;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const render = (layout: 'table' | 'inline') => {
    act(() => root.render(<MetadataLists item={movie} layout={layout} />));
    const list = container.querySelector('dl');
    return {
        layout: list?.getAttribute('data-rf-facts'),
        terms: [...container.querySelectorAll('dt')].map(
            (dt) => dt.textContent
        ),
        links: [...container.querySelectorAll('dd a')].map((a) => [
            a.textContent,
            a.getAttribute('href')
        ])
    };
};

/*
 * THEME-IDENTITY-1: `facts` regroups the people/studio/genre lists. It must never change WHICH
 * facts are shown, their labels or where they lead — only how they are laid out.
 */
describe('MetadataLists — the facts recipe changes layout only', () => {
    it('emits the same labelled lists and links under table and inline', () => {
        const table = render('table');
        const inline = render('inline');

        expect(table.layout).toBe('table');
        expect(inline.layout).toBe('inline');
        expect(inline.terms).toEqual(table.terms);
        expect(inline.links).toEqual(table.links);
    });

    it('keeps the frozen list order and skips the empty lists', () => {
        const { terms, links } = render('inline');
        // Director, then Studio, then Genres; the Actor is not a metadata list, and Author,
        // Creator and Writer have no entries.
        expect(terms).toEqual(['Director', 'Studio', 'Genres']);
        expect(links).toEqual([
            ['Agnès V.', '#/person?id=p1'],
            ['Ciné-Tamaris', '#/studio?id=s1'],
            ['Drame', '#/genre?id=g1'],
            ['Romance', '#/genre?id=g2']
        ]);
    });

    it('still renders the container when the item has no facts', () => {
        act(() =>
            root.render(
                <MetadataLists
                    item={{ Id: 'x', Type: 'Movie' } as unknown as DetailItem}
                    layout='table'
                />
            )
        );
        expect(
            container.querySelector('dl[data-rf-facts="table"]')
        ).not.toBeNull();
        expect(container.querySelectorAll('dt')).toHaveLength(0);
    });
});
