import ArrowBack from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC, type PropsWithChildren, ReactNode } from 'react';

import { appRouter } from 'components/router/appRouter';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import HeaderRow from './HeaderRow';
import UserMenuButton from './UserMenuButton';

interface AppToolbarProps {
    buttons?: ReactNode;
    isDrawerAvailable: boolean;
    isDrawerOpen: boolean;
    onDrawerButtonClick?: (event: React.MouseEvent<HTMLElement>) => void;
    isBackButtonAvailable?: boolean;
    isUserMenuAvailable?: boolean;
    className?: string;
    /** THEME-B2: the effective layout of the modern header. Absent (the dashboard): `start`. */
    layout?: 'start' | 'centered';
    /** THEME-B2, `centered` only: the destinations, drawn between the brand and the actions. */
    center?: ReactNode;
}

const onBackButtonClick = () => {
    appRouter.back().catch((err) => {
        console.error('[AppToolbar] error calling appRouter.back', err);
    });
};

const AppToolbar: FC<PropsWithChildren<AppToolbarProps>> = ({
    buttons,
    children,
    isDrawerAvailable,
    isDrawerOpen,
    onDrawerButtonClick = () => {
        /* no-op */
    },
    isBackButtonAvailable = false,
    isUserMenuAvailable = true,
    className,
    layout,
    center
}) => {
    const { user } = useApi();
    const isUserLoggedIn = Boolean(user);

    return (
        <HeaderRow
            className={className}
            layout={layout}
            center={center}
            actions={buttons}
            account={
                isUserLoggedIn && isUserMenuAvailable && <UserMenuButton />
            }
            lead={
                <>
                    {/* Toolbar tooltips render inside the banner landmark, not in a <body> portal (axe `region`). */}
                    {isUserLoggedIn && isDrawerAvailable && (
                        <Tooltip
                            slotProps={{ popper: { disablePortal: true } }}
                            title={globalize.translate(
                                isDrawerOpen ? 'MenuClose' : 'MenuOpen'
                            )}
                        >
                            <IconButton
                                size='large'
                                color='inherit'
                                aria-label={globalize.translate(
                                    isDrawerOpen ? 'MenuClose' : 'MenuOpen'
                                )}
                                onClick={onDrawerButtonClick}
                            >
                                <MenuIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    {isBackButtonAvailable && (
                        <Tooltip
                            slotProps={{ popper: { disablePortal: true } }}
                            title={globalize.translate('ButtonBack')}
                        >
                            <IconButton
                                size='large'
                                color='inherit'
                                aria-label={globalize.translate('ButtonBack')}
                                onClick={onBackButtonClick}
                            >
                                <ArrowBack />
                            </IconButton>
                        </Tooltip>
                    )}
                </>
            }
        >
            {children}
        </HeaderRow>
    );
};

export default AppToolbar;
