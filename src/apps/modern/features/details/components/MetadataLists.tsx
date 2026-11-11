import React, { type FC } from 'react';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';

import {
    getMetadataItems,
    getMetadataLabel,
    getMetadataLink
} from 'components/itemDetails/ItemDetailsMetadataList';
import LinkButton from 'elements/emby-button/LinkButton';
import type { ItemDetailsFacts } from 'themes/platform/contract';

import type { DetailItem } from '../adapters/itemDetailsApi';
import { inferContext } from '../utils/itemPredicates';

/** The six metadata lists, in the frozen order. */
const METADATA_TYPES = [
    PersonKind.Author,
    PersonKind.Creator,
    PersonKind.Director,
    PersonKind.Writer,
    BaseItemKind.Studio,
    BaseItemKind.Genre
];

/**
 * The six metadata lists — as ordinary React children of the application root.
 *
 * This is the reason #129 exists. The legacy route created a NESTED REACT ROOT per list, each with
 * its own provider stack and each therefore invisible to `PresentationContext`. Six roots per render
 * became zero.
 *
 * THEME-IDENTITY-1 lays them out as ONE definition list instead of six label/value boxes, so the
 * recipe's `facts` can group them: `table` gives each list a labelled row, `inline` runs the values
 * together under the title. Which lists exist, their order, their gates and their links come from
 * `ItemDetailsMetadataList`'s own rules, unchanged — the layout is the only thing `facts` reaches.
 *
 * The container is always rendered, even when every list is empty — the frozen fixture records
 * `itemDetailsGroup` as present for all 24 classes.
 */
const MetadataLists: FC<{ item: DetailItem; layout: ItemDetailsFacts }> = ({
    item,
    layout
}) => {
    const context = inferContext(item) ?? '';
    const groups = METADATA_TYPES.map((type) => ({
        type,
        entries: getMetadataItems(type, item as never) ?? []
    })).filter((group) => group.entries.length > 0);

    return (
        <dl className='rf-item-details__facts' data-rf-facts={layout}>
            {groups.map(({ type, entries }) => (
                <div key={type} className='rf-item-details__fact'>
                    <dt>{getMetadataLabel(type, entries.length)}</dt>
                    <dd>
                        {entries.map((entry, index) => (
                            <React.Fragment key={entry.Id ?? entry.Name}>
                                {index > 0 ? ', ' : ''}
                                <LinkButton
                                    href={getMetadataLink(
                                        type,
                                        item as never,
                                        context,
                                        entry
                                    )}
                                    className='button-link rf-item-details__fact-link'
                                >
                                    {entry.Name}
                                </LinkButton>
                            </React.Fragment>
                        ))}
                    </dd>
                </div>
            ))}
        </dl>
    );
};

export default MetadataLists;
