import Stack from '@mui/material/Stack';
import React, { type FC } from 'react';
import { useLocation } from 'react-router-dom';

import { appRouter, PUBLIC_PATHS } from 'components/router/appRouter';
import BaseToolbar from 'components/toolbar/AppToolbar';
import ServerButton from 'components/toolbar/ServerButton';
import globalize from 'lib/globalize';
import { resolveHeader } from 'themes/platform/headerRecipe';
import { usePresentation } from 'ui/presentation/PresentationContext';

import RemotePlayButton from './RemotePlayButton';
import SyncPlayButton from './SyncPlayButton';
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

    // The video osd does not show the standard toolbar
    if (location.pathname === '/video') return null;

    // Only show the back button in apps when appropriate
    const isBackButtonAvailable =
        window.NativeShell && appRouter.canGoBack(location.pathname);

    // Check if the current path is a public path to hide user content
    const isPublicPath = PUBLIC_PATHS.includes(location.pathname);

    return (
        <BaseToolbar
            buttons={
                !isPublicPath && (
                    <>
                        <SyncPlayButton />
                        <RemotePlayButton />
                        <SearchButton />
                    </>
                )
            }
            isDrawerAvailable={isDrawerAvailable}
            isDrawerOpen={isDrawerOpen}
            onDrawerButtonClick={onDrawerButtonClick}
            isBackButtonAvailable={isBackButtonAvailable}
            isUserMenuAvailable={!isPublicPath}
            className='padded-left padded-right'
        >
            {!isDrawerAvailable && (
                <Stack direction='row' spacing={0.5}>
                    <ServerButton brand={header.brand} />

                    {!isPublicPath && isViewNavInBar && (
                        <nav
                            className='rf-app-topnav'
                            data-rf-slot='app-topnav'
                            data-rf-nav-style={header.nav.style}
                            aria-label={globalize.translate('HeaderNavigation')}
                        >
                            <UserViewNav />
                        </nav>
                    )}
                </Stack>
            )}
        </BaseToolbar>
    );
};

export default AppToolbar;
