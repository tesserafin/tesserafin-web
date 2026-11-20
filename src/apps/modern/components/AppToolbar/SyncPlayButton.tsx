import { SyncPlayUserAccessType } from '@jellyfin/sdk/lib/generated-client/models/sync-play-user-access-type';
import Badge from '@mui/material/Badge';
import Groups from '@mui/icons-material/Groups';
import React, { useCallback, useImperativeHandle, useState } from 'react';

import {
    QUERY_KEY,
    useSyncPlayGroups
} from 'apps/modern/features/syncPlay/hooks/api/useSyncPlayGroups';
import { useSyncPlay } from 'apps/modern/features/syncPlay/hooks/useSyncPlay';
import { pluginManager } from 'components/pluginManager';
import HeaderActionButton from 'components/toolbar/HeaderActionButton';
import { PluginType } from 'constants/pluginType';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import AppSyncPlayMenu, { ID } from './menus/SyncPlayMenu';
import type { HeaderActionProps } from './headerAction';

/** Whether SyncPlay is offered at all: the user's policy and the plugin, never the theme. */
export const useIsSyncPlayOffered = () => {
    const { user } = useApi();
    return !(
        (user?.Policy &&
            user.Policy.SyncPlayAccess === SyncPlayUserAccessType.None) ||
        pluginManager.ofType(PluginType.SyncPlay).length === 0
    );
};

const SyncPlayButton = ({
    labelled,
    trigger = true,
    opener
}: HeaderActionProps) => {
    const isOffered = useIsSyncPlayOffered();
    const { isActive } = useSyncPlay();
    const { data: groups } = useSyncPlayGroups();
    const isAvailable = Boolean(groups && groups.length > 0);

    const [syncPlayMenuAnchorEl, setSyncPlayMenuAnchorEl] =
        useState<null | HTMLElement>(null);
    const isSyncPlayMenuOpen = Boolean(syncPlayMenuAnchorEl);

    const [returnFocus, setReturnFocus] = useState(false);

    const openFrom = useCallback(
        (anchor: HTMLElement, fromElsewhere = false) => {
            // Refresh SyncPlay groups when opening the menu
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            setReturnFocus(fromElsewhere);
            setSyncPlayMenuAnchorEl(anchor);
        },
        [setSyncPlayMenuAnchorEl]
    );

    const onSyncPlayButtonClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            openFrom(event.currentTarget);
        },
        [openFrom]
    );

    // THEME-B2: opened from the header's "More" menu, anchored on — and returning focus to — it.
    useImperativeHandle(opener, () => (anchor) => openFrom(anchor, true), [
        openFrom
    ]);

    const onSyncPlayMenuClose = useCallback(() => {
        const anchor = syncPlayMenuAnchorEl;
        setSyncPlayMenuAnchorEl(null);
        if (returnFocus) window.setTimeout(() => anchor?.focus());
    }, [returnFocus, syncPlayMenuAnchorEl]);

    if (!isOffered) return null;

    return (
        <>
            {trigger && (
                <HeaderActionButton
                    label={globalize.translate('ButtonSyncPlay')}
                    labelled={labelled}
                    aria-controls={ID}
                    aria-haspopup='true'
                    onClick={onSyncPlayButtonClick}
                    icon={
                        <Badge
                            color={isActive ? 'primary' : 'success'}
                            badgeContent={1} // Use visibility of badge to indicate status
                            invisible={!isActive && !isAvailable}
                            variant='dot'
                        >
                            <Groups />
                        </Badge>
                    }
                />
            )}

            <AppSyncPlayMenu
                open={isSyncPlayMenuOpen}
                anchorEl={syncPlayMenuAnchorEl}
                onMenuClose={onSyncPlayMenuClose}
            />
        </>
    );
};

export default SyncPlayButton;
