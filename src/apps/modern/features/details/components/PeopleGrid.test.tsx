import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DetailItem } from '../adapters/itemDetailsApi';
import PeopleGrid from './PeopleGrid';

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const people = [
    { Id: 'p1', Name: 'Agnès Varda', Role: 'Réalisatrice' },
    { Id: 'p2', Name: 'Corinne Marchand', Role: 'Cléo' }
] as unknown as DetailItem[];

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

const render = (layout: 'cards' | 'portraits') => {
    act(() =>
        root.render(
            <PeopleGrid people={people} serverId='srv' layout={layout} />
        )
    );
    return {
        cards: [...container.querySelectorAll('a.rf-media-card')].map((a) => [
            a.getAttribute('href'),
            a.querySelector('.rf-media-card__title')?.textContent,
            a.querySelector('.rf-media-card__subtitle')?.textContent
        ]),
        square: container.querySelectorAll('.rf-media-card--square').length,
        initials: [
            ...container.querySelectorAll('.rf-item-details__initials')
        ].map((node) => node.textContent)
    };
};

// THEME-IDENTITY-1: `people` dresses the cast list; it never changes who is listed or where they lead.
describe('PeopleGrid — the people recipe changes the dress only', () => {
    it('lists the same people, roles and links as cards and as portraits', () => {
        const cards = render('cards');
        const portraits = render('portraits');
        expect(portraits.cards).toEqual(cards.cards);
        expect(cards.cards).toEqual([
            ['#/details?id=p1&serverId=srv', 'Agnès Varda', 'Réalisatrice'],
            ['#/details?id=p2&serverId=srv', 'Corinne Marchand', 'Cléo']
        ]);
    });

    it('draws portraits as square artwork with initials for a missing picture', () => {
        const portraits = render('portraits');
        expect(portraits.square).toBe(2);
        expect(portraits.initials).toEqual(['AV', 'CM']);
        expect(render('cards').initials).toEqual([]);
    });
});
