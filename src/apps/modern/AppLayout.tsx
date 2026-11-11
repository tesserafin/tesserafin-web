import React, { StrictMode, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import CustomCss from 'components/CustomCss';
import OffsetAppBar from 'components/OffsetAppBar';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';
import { usePresentation } from 'ui';

import AppSideNav from './components/AppSideNav/AppSideNav';
import { isSideNavShown } from './components/AppSideNav/sideNav';
import AppToolbar from './components/AppToolbar';
import AppDrawer, { isDrawerPath } from './components/drawers/AppDrawer';
import LibraryToolbar from './features/libraries/components/LibraryToolbar';
import { LibraryProvider } from './features/libraries/hooks/useLibrary';
import { isLibraryPath } from './features/libraries/utils/path';

import './AppOverrides.scss';
import './surfaceMaterial.scss';

export const Component = () => {
    const [isDrawerActive, setIsDrawerActive] = useState(false);
    const [appBarHeight, setAppBarHeight] = useState(48);
    const navigationShell = usePresentation().navigation.shell;
    const { user } = useApi();
    const location = useLocation();

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isDrawerAvailable =
        isDrawerPath(location.pathname) && Boolean(user) && !isMediumScreen;
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;
    /*
     * `navigation.shell` (THEME-IDENTITY-1): `sidebar` and `rail` move the destinations out of the
     * bar into a persistent column — on the same routes and wide screens where the bar would show
     * them, and nowhere else. Narrower than `md` the drawer serves every shell.
     */
    const sideNav = isSideNavShown({
        shell: navigationShell,
        isMediumScreen,
        isNavigationRoute: isDrawerPath(location.pathname),
        isSignedIn: Boolean(user)
    });

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [isDrawerActive, setIsDrawerActive]);

    return (
        <LibraryProvider>
            <Box
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}
            >
                <StrictMode>
                    <OffsetAppBar
                        dense
                        elevation={4}
                        onHeightChange={setAppBarHeight}
                    >
                        <AppToolbar
                            isViewNavInBar={!sideNav}
                            isDrawerAvailable={
                                !isMediumScreen && isDrawerAvailable
                            }
                            isDrawerOpen={isDrawerOpen}
                            onDrawerButtonClick={onToggleDrawer}
                        />
                        {isLibraryPath(location.pathname) && <LibraryToolbar />}
                    </OffsetAppBar>

                    {isDrawerAvailable && (
                        <AppDrawer
                            open={isDrawerOpen}
                            onClose={onToggleDrawer}
                            onOpen={onToggleDrawer}
                        />
                    )}
                </StrictMode>

                <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
                    {sideNav && <AppSideNav offsetTop={appBarHeight} />}
                    <Box
                        component='main'
                        sx={{
                            position: 'relative',
                            minWidth: 0,
                            flexGrow: 1
                        }}
                    >
                        <AppBody>
                            <Outlet />
                        </AppBody>
                    </Box>
                </Box>
            </Box>
            <ThemeCss />
            <CustomCss />
        </LibraryProvider>
    );
};
