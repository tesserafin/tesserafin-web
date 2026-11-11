import React, { type FC } from 'react';

import { MediaCard, MediaGrid } from 'ui';

import type { ItemDetailsPeople } from 'themes/platform/contract';

import type { DetailItem } from '../adapters/itemDetailsApi';

interface PeopleGridProps {
    people: DetailItem[];
    serverId?: string;
    /** `presentation.page.itemDetails.people` (THEME-IDENTITY-1). */
    layout?: ItemDetailsPeople;
}

/** Up to two initials, by code point — a portrait with no picture still names its person. */
const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => Array.from(word)[0])
        .join('')
        .toUpperCase();

/**
 * Cast and guest cast.
 *
 * Replaces `components/cardbuilder/peoplecardbuilder`, which invariant 11 forbids; the person's
 * role is the card subtitle, exactly as the people cards showed it.
 *
 * `layout` only dresses the list: `cards` are poster cards, `portraits` round head-shots (square
 * artwork the stylesheet rounds) with the initials standing in for a missing picture and a
 * narrower column. The people, their order, names, roles and links are the same under both.
 */
const PeopleGrid: FC<PeopleGridProps> = ({
    people,
    serverId,
    layout = 'cards'
}) => (
    <div className='rf-item-details__people' data-rf-people={layout}>
        <MediaGrid minItemWidth={layout === 'portraits' ? '7.5rem' : undefined}>
            {people.map((person) => (
                <MediaCard
                    key={person.Id ?? person.Name}
                    title={person.Name ?? ''}
                    subtitle={(person.Role as string) ?? undefined}
                    imageAspect={layout === 'portraits' ? 'square' : 'poster'}
                    placeholderIcon={
                        layout === 'portraits' ? (
                            <span className='rf-item-details__initials'>
                                {initials(person.Name ?? '')}
                            </span>
                        ) : undefined
                    }
                    href={`#/details?id=${person.Id ?? ''}&serverId=${serverId ?? ''}`}
                    className='itemDetailsPersonCard'
                />
            ))}
        </MediaGrid>
    </div>
);

export default PeopleGrid;
