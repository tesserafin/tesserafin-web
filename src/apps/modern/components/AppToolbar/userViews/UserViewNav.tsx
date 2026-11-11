import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import Favorite from '@mui/icons-material/Favorite';
import HomeIcon from '@mui/icons-material/Home';
import Button from '@mui/material/Button/Button';
import Icon from '@mui/material/Icon';
import { Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import LibraryIcon from 'apps/modern/components/LibraryIcon';
import { MetaView } from 'apps/modern/constants/metaView';
import { ContentPackBrowsingPreference } from 'lib/tesserafin-sdk/generated/models/content-pack-browsing-preference';
import { useAncestors } from 'apps/modern/features/libraries/hooks/api/useAncestors';
import {
    isDetailsPath,
    isLibraryPath
} from 'apps/modern/features/libraries/utils/path';
import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import useCurrentTab from 'hooks/useCurrentTab';
import { useWebConfig } from 'hooks/useWebConfig';
import globalize from 'lib/globalize';

import UserViewsMenu from './UserViewsMenu';

const MAX_USER_VIEWS_MD = 3;
const MAX_USER_VIEWS_LG = 5;
const MAX_USER_VIEWS_XL = 8;

const OVERFLOW_MENU_ID = 'user-view-overflow-menu';

const HOME_PATH = '/home';
const LIST_PATH = '/list';

const getCurrentUserView = (
    userViews: BaseItemDto[] | undefined,
    pathname: string,
    libraryId: string | null,
    collectionType: string | null,
    tab: number
) => {
    const isUserViewPath =
        isDetailsPath(pathname) ||
        isLibraryPath(pathname) ||
        [HOME_PATH, LIST_PATH].includes(pathname);
    if (!isUserViewPath) return undefined;

    if (collectionType === CollectionType.Livetv) {
        return userViews?.find(
            ({ CollectionType: type }) => type === CollectionType.Livetv
        );
    }

    if (pathname === HOME_PATH && tab === 1) {
        return MetaView.Favorites;
    }

    return userViews?.find(({ Id: id }) => id === libraryId);
};

export interface UserViewNavProps {
    /**
     * `horizontal` is the application bar's row: a few destinations, the rest behind "More".
     * `vertical` is the persistent column the `sidebar` and `rail` shells draw
     * (THEME-IDENTITY-1): it has the height to list every destination, so nothing overflows, and
     * it leads with Home because the column, unlike the bar, has no server button standing in for
     * it. The DESTINATIONS are the same in both: which libraries exist is library and
     * authorization state, never a presentation choice.
     */
    orientation?: 'horizontal' | 'vertical';
}

const UserViewNav = ({ orientation = 'horizontal' }: UserViewNavProps) => {
    const isVertical = orientation === 'vertical';
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const itemId = searchParams.get('id') || undefined;
    const libraryId =
        searchParams.get('topParentId') || searchParams.get('parentId');
    const collectionType = searchParams.get('collectionType');
    const { activeTab } = useCurrentTab();
    const { menuLinks } = useWebConfig();

    const isExtraLargeScreen = useMediaQuery((t: Theme) =>
        t.breakpoints.up('xl')
    );
    const isLargeScreen = useMediaQuery((t: Theme) => t.breakpoints.up('lg'));
    const maxViews = useMemo(() => {
        if (isExtraLargeScreen) return MAX_USER_VIEWS_XL;
        if (isLargeScreen) return MAX_USER_VIEWS_LG;
        return MAX_USER_VIEWS_MD;
    }, [isExtraLargeScreen, isLargeScreen]);

    const { user } = useApi();
    const { data: userViews, isPending } = useUserViews({ userId: user?.Id });

    /**
     * #139 gate 4. Content-pack-first does not hide anything: it puts content packs at the head of
     * the primary navigation and leaves every media-family destination exactly where it was, in the
     * same order, on the same routes. Anything other than an explicit `ContentPackFirst` — absent,
     * `undefined`, or a value this build does not know — is media-family-first, which is today's
     * arrangement, so an installation that was never asked is not prompted and does not move.
     *
     * The comparison is written out here rather than delegated to
     * `features/contentPacks/adapters/browsingPreference`, whose `resolveBrowsingPreference` says
     * exactly this. This component is in `main.tesserafin.bundle.js`; pulling that module in cost
     * 166 B gzip against 45 B of measured start-up headroom. The enum still comes from the generated
     * model, so the wire value is never spelled as a literal.
     *
     * `useApi` still hands back `@jellyfin/sdk`'s `UserDto`, whose `UserConfiguration` predates this
     * field; the cast is on the *shape*, not on the value, and erases entirely at runtime.
     */
    const packsLead =
        (
            user?.Configuration as
                | { ContentPackBrowsingPreference?: string }
                | undefined
        )?.ContentPackBrowsingPreference ===
        ContentPackBrowsingPreference.ContentPackFirst;

    const navItems = useMemo(
        () => [...(menuLinks || []), ...(userViews?.Items || [])],
        [menuLinks, userViews]
    );

    const { data: ancestors } = useAncestors({ itemId });

    const ancestorLibraryId = useMemo(() => {
        return (
            ancestors?.find(
                (ancestor) => ancestor.Type === BaseItemKind.CollectionFolder
            )?.Id || null
        );
    }, [ancestors]);

    const primaryNavItems = useMemo(() => {
        // If the number of nav items exceeds the max + 1, we put the excess items in the overflow menu.
        // We add 1 to prevent the overflow menu from showing only one item.
        if (!isVertical && navItems.length > maxViews + 1) {
            return navItems.slice(0, maxViews);
        }

        return navItems;
    }, [isVertical, maxViews, navItems]);

    const overflowNavItems = useMemo(
        () => navItems.slice(primaryNavItems?.length || 0),
        [primaryNavItems, navItems]
    );

    const [overflowAnchorEl, setOverflowAnchorEl] =
        useState<null | HTMLElement>(null);
    const isOverflowMenuOpen = Boolean(overflowAnchorEl);

    const onOverflowButtonClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setOverflowAnchorEl(event.currentTarget);
        },
        []
    );

    const onOverflowMenuClose = useCallback(() => {
        setOverflowAnchorEl(null);
    }, []);

    const currentUserView = useMemo(
        () =>
            getCurrentUserView(
                userViews?.Items,
                location.pathname,
                libraryId || ancestorLibraryId,
                collectionType,
                activeTab
            ),
        [
            activeTab,
            collectionType,
            libraryId,
            ancestorLibraryId,
            location.pathname,
            userViews
        ]
    );

    if (isPending) return null;

    /*
     * The current destination is announced, not only coloured: `aria-current="page"` on the link
     * a reader is on. The bar never said it, so a screen reader heard every destination alike.
     */
    const current = (isCurrent: boolean) =>
        isCurrent ? ('page' as const) : undefined;
    const isHome = location.pathname === HOME_PATH && !currentUserView;

    return (
        <>
            {isVertical && (
                <Button
                    variant='text'
                    color={isHome ? 'primary' : 'inherit'}
                    aria-current={current(isHome)}
                    startIcon={<HomeIcon />}
                    component={Link}
                    to={HOME_PATH}
                >
                    <span className='rf-app-nav__label'>
                        {globalize.translate('Home')}
                    </span>
                </Button>
            )}

            {packsLead && (
                <Button
                    variant='text'
                    color='inherit'
                    startIcon={<Icon>widgets</Icon>}
                    component={Link}
                    to='contentpacks'
                >
                    <span className='rf-app-nav__label'>
                        {globalize.translate('ContentPacks')}
                    </span>
                </Button>
            )}

            <Button
                variant='text'
                color={
                    currentUserView?.Id === MetaView.Favorites.Id
                        ? 'primary'
                        : 'inherit'
                }
                aria-current={current(
                    currentUserView?.Id === MetaView.Favorites.Id
                )}
                startIcon={<Favorite />}
                component={Link}
                to='/home?tab=1'
            >
                <span className='rf-app-nav__label'>
                    {globalize.translate(MetaView.Favorites.Name)}
                </span>
            </Button>

            {primaryNavItems?.map((navItem) => {
                if ('url' in navItem) {
                    return (
                        <Button
                            key={navItem.name}
                            variant='text'
                            color='inherit'
                            startIcon={<Icon>{navItem.icon || 'link'}</Icon>}
                            component='a'
                            href={navItem.url}
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <span className='rf-app-nav__label'>
                                {navItem.name}
                            </span>
                        </Button>
                    );
                }

                return (
                    <Button
                        key={navItem.Id}
                        variant='text'
                        color={
                            navItem.Id === currentUserView?.Id
                                ? 'primary'
                                : 'inherit'
                        }
                        aria-current={current(
                            navItem.Id === currentUserView?.Id
                        )}
                        startIcon={<LibraryIcon item={navItem} />}
                        component={Link}
                        to={appRouter
                            .getRouteUrl(navItem, {
                                context: navItem.CollectionType
                            })
                            .substring(1)}
                    >
                        <span className='rf-app-nav__label'>
                            {navItem.Name}
                        </span>
                    </Button>
                );
            })}

            {overflowNavItems && overflowNavItems.length > 0 && (
                <>
                    <Button
                        variant='text'
                        color='inherit'
                        endIcon={<ArrowDropDown />}
                        aria-controls={OVERFLOW_MENU_ID}
                        aria-haspopup='true'
                        onClick={onOverflowButtonClick}
                    >
                        {globalize.translate('ButtonMore')}
                    </Button>

                    <UserViewsMenu
                        anchorEl={overflowAnchorEl}
                        id={OVERFLOW_MENU_ID}
                        open={isOverflowMenuOpen}
                        onMenuClose={onOverflowMenuClose}
                        userViews={overflowNavItems}
                        selectedId={currentUserView?.Id}
                    />
                </>
            )}
        </>
    );
};

export default UserViewNav;
