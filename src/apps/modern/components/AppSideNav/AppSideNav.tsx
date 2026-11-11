import React, { type FC } from 'react';

import globalize from 'lib/globalize';
import { usePresentation } from 'ui';

import UserViewNav from '../AppToolbar/userViews/UserViewNav';

import './AppSideNav.scss';

interface AppSideNavProps {
    /** Height of the fixed application bar above it, so the column starts under it and stays put. */
    offsetTop: number;
}

/**
 * The persistent navigation column the `sidebar` and `rail` shells ask for (THEME-IDENTITY-1).
 *
 * It holds exactly the destinations the application bar holds — `UserViewNav`, unchanged in what
 * it lists — laid out one per row. The shell, the label policy and the side it stands on arrive as
 * the resolved `presentation.navigation` and are projected as `data-rf-nav-*`, so the stylesheet
 * keys on the published vocabulary and this component never learns a theme's name.
 *
 * Mounted by `AppLayout` on wide screens only. On a phone every shell uses the menu drawer: a
 * persistent column there would cost the content it is meant to organise.
 */
const AppSideNav: FC<AppSideNavProps> = ({ offsetTop }) => {
    const { shell, labels, position } = usePresentation().navigation;

    return (
        <nav
            className='rf-app-sidenav'
            data-rf-slot='app-sidenav'
            data-rf-nav-shell={shell}
            data-rf-nav-labels={labels}
            data-rf-nav-position={position}
            aria-label={globalize.translate('HeaderNavigation')}
            style={{
                top: offsetTop,
                maxHeight: `calc(100vh - ${offsetTop}px)`
            }}
        >
            <UserViewNav orientation='vertical' />
        </nav>
    );
};

export default AppSideNav;
