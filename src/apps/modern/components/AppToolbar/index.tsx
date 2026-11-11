import Cast from '@mui/icons-material/Cast';
import Groups from '@mui/icons-material/Groups';
import Stack from '@mui/material/Stack';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { type FC, type ReactNode, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { appRouter, PUBLIC_PATHS } from 'components/router/appRouter';
import BaseToolbar from 'components/toolbar/AppToolbar';
import { HeaderActionTooltip } from 'components/toolbar/HeaderActionButton';
import HeaderMoreMenu, {
    type HeaderMoreItem
} from 'components/toolbar/HeaderMoreMenu';
import HeaderTooltip from 'components/toolbar/HeaderTooltip';
import ServerButton from 'components/toolbar/ServerButton';
import globalize from 'lib/globalize';
import {
    arrangeHeaderActions,
    effectiveHeader,
    type HeaderActionId,
    resolveHeader
} from 'themes/platform/headerRecipe';
import { usePresentation } from 'ui/presentation/PresentationContext';

import RemotePlayButton, {
    isRemoteSession,
    usePlayerInfo
} from './RemotePlayButton';
import SyncPlayButton, { useIsSyncPlayOffered } from './SyncPlayButton';
import SearchButton from './SearchButton';
import UserViewNav from './userViews/UserViewNav';

import './AppTopNav.scss';

interface AppToolbarProps {
    isDrawerAvailable: boolean;
    isDrawerOpen: boolean;
    onDrawerButtonClick: (event: React.MouseEvent<HTMLElement>) => void;
    /**
     * `false` when the destinations live in the persistent column instead (`navigation.shell`
     * `sidebar` / `rail`). They are never in both places: two copies of the same links is two tab
     * stops per destination and two landmarks claiming to be the navigation.
     */
    isViewNavInBar?: boolean;
}

const AppToolbar: FC<AppToolbarProps> = ({
    isDrawerAvailable,
    isDrawerOpen,
    onDrawerButtonClick,
    isViewNavInBar = true
}) => {
    const location = useLocation();
    const presentation = usePresentation();
    const header = resolveHeader(
        presentation.header,
        presentation.surface.variant
    );
    const compact = !useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const { layout, labels } = effectiveHeader(header, {
        compact,
        lead: false
    });
    const labelled = labels === 'iconsAndLabels';

    const isSyncPlayOffered = useIsSyncPlayOffered();
    const remoteActive = isRemoteSession(usePlayerInfo());
    const syncPlayOpener = useRef<(anchor: HTMLElement) => void>(null);
    const castOpener = useRef<(anchor: HTMLElement) => void>(null);

    // The video osd does not show the standard toolbar
    if (location.pathname === '/video') return null;

    // Only show the back button in apps when appropriate
    const isBackButtonAvailable =
        window.NativeShell && appRouter.canGoBack(location.pathname);

    // Check if the current path is a public path to hide user content
    const isPublicPath = PUBLIC_PATHS.includes(location.pathname);

    const available: HeaderActionId[] = isSyncPlayOffered
        ? ['syncPlay', 'cast', 'search']
        : ['cast', 'search'];
    const { bar, more } = arrangeHeaderActions(
        available,
        header.actions.grouping,
        remoteActive
    );
    const moreItems: HeaderMoreItem[] = more.map((id) =>
        id === 'syncPlay'
            ? {
                  id,
                  label: globalize.translate('ButtonSyncPlay'),
                  icon: <Groups />,
                  onSelect: (anchor) => syncPlayOpener.current?.(anchor)
              }
            : {
                  id,
                  label: globalize.translate('ButtonCast'),
                  icon: <Cast />,
                  onSelect: (anchor) => castOpener.current?.(anchor)
              }
    );
    /*
     * SyncPlay and Cast stay mounted wherever they are arranged: in "More" only their button is
     * not drawn, their own menu still lives here. A session that starts while Cast is in "More"
     * draws its indicator in the bar on the next render, where Cast was; no focus is moved.
     */
    const actions: Record<HeaderActionId | 'more', ReactNode> = {
        syncPlay: (
            <SyncPlayButton
                key='syncPlay'
                labelled={labelled}
                trigger={!more.includes('syncPlay')}
                opener={syncPlayOpener}
            />
        ),
        cast: (
            <RemotePlayButton
                key='cast'
                labelled={labelled}
                trigger={!more.includes('cast')}
                opener={castOpener}
            />
        ),
        search: <SearchButton key='search' labelled={labelled} />,
        more: (
            <HeaderMoreMenu key='more' items={moreItems} labelled={labelled} />
        )
    };
    // Every available action is rendered once, in the product's order; "More" stands where the
    // first moved action was. Those in "More" render only their menus.
    const slots: ReactNode[] = [];
    for (const id of available) {
        if (bar.includes('more') && id === more[0]) slots.push(actions.more);
        slots.push(actions[id]);
    }

    const destinations = !isPublicPath && isViewNavInBar && (
        <nav
            className='rf-app-topnav'
            data-rf-slot='app-topnav'
            data-rf-nav-style={header.nav.style}
            aria-label={globalize.translate('HeaderNavigation')}
        >
            <UserViewNav />
        </nav>
    );
    const centered = layout === 'centered' && !isDrawerAvailable;

    return (
        <BaseToolbar
            buttons={
                !isPublicPath && (
                    <HeaderActionTooltip.Provider value={HeaderTooltip}>
                        {slots}
                    </HeaderActionTooltip.Provider>
                )
            }
            isDrawerAvailable={isDrawerAvailable}
            isDrawerOpen={isDrawerOpen}
            onDrawerButtonClick={onDrawerButtonClick}
            isBackButtonAvailable={isBackButtonAvailable}
            isUserMenuAvailable={!isPublicPath}
            className='padded-left padded-right'
            layout={centered ? 'centered' : undefined}
            center={centered ? destinations : undefined}
        >
            {!isDrawerAvailable &&
                (centered ? (
                    <ServerButton brand={header.brand} />
                ) : (
                    <Stack direction='row' spacing={0.5}>
                        <ServerButton brand={header.brand} />
                        {destinations}
                    </Stack>
                ))}
        </BaseToolbar>
    );
};

export default AppToolbar;
