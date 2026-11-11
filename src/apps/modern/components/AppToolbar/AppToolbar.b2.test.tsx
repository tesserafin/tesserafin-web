// @vitest-environment jsdom
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * THEME-B2 §3.2 / §3.5 on the real modern toolbar: the session, the plugins and the menus are
 * stubbed, the arrangement, the "More" menu and the focus behaviour are the product's.
 */

const state = vi.hoisted(() => ({
    header: {} as Record<string, unknown>,
    wide: true,
    playerInfo: null as null | { isLocalPlayer: boolean; deviceName: string },
    playerChange: [] as Array<() => void>
}));

vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => key }
}));
vi.mock('hooks/useApi', () => ({
    useApi: () => ({
        user: { Policy: { SyncPlayAccess: 'CreateAndJoinGroups' } },
        __legacyApiClient__: {}
    })
}));
vi.mock('hooks/useItem', () => ({ useItem: () => ({ data: undefined }) }));
vi.mock('components/pluginManager', () => ({
    pluginManager: { ofType: () => [{}] }
}));
vi.mock('apps/modern/features/syncPlay/hooks/useSyncPlay', () => ({
    useSyncPlay: () => ({ isActive: false })
}));
vi.mock('apps/modern/features/syncPlay/hooks/api/useSyncPlayGroups', () => ({
    QUERY_KEY: ['syncPlay'],
    useSyncPlayGroups: () => ({ data: [] })
}));
vi.mock('utils/query/queryClient', () => ({
    queryClient: { invalidateQueries: () => Promise.resolve() }
}));
vi.mock('components/playback/playbackmanager', () => ({
    playbackManager: { getPlayerInfo: () => state.playerInfo }
}));
vi.mock('utils/events', () => ({
    default: {
        on: (_: unknown, __: string, fn: () => void) =>
            state.playerChange.push(fn),
        off: (_: unknown, __: string, fn: () => void) => {
            state.playerChange = state.playerChange.filter((f) => f !== fn);
        }
    }
}));
vi.mock('ui/presentation/PresentationContext', () => ({
    usePresentation: () => ({
        header: state.header,
        surface: { variant: 'opaque' }
    })
}));
vi.mock('components/router/appRouter', () => ({
    appRouter: { canGoBack: () => false },
    PUBLIC_PATHS: ['/login']
}));
vi.mock('components/toolbar/ServerButton', () => ({
    default: () => <a href='#/'>Brand</a>
}));
vi.mock('components/toolbar/UserMenuButton', () => ({
    default: () => <button type='button'>UserMenu</button>
}));
vi.mock('./userViews/UserViewNav', () => ({
    default: () => <a href='#/films'>Films</a>
}));
const { stubMenu } = vi.hoisted(() => ({
    stubMenu: async (label: string) => {
        const { default: Menu } = await import('@mui/material/Menu');
        const { default: MenuItem } = await import('@mui/material/MenuItem');
        return {
            ID: `${label}-menu`,
            default: ({
                open,
                anchorEl,
                onMenuClose
            }: {
                open: boolean;
                anchorEl: HTMLElement | null;
                onMenuClose: () => void;
            }) => (
                <Menu open={open} anchorEl={anchorEl} onClose={onMenuClose}>
                    <MenuItem onClick={onMenuClose}>{label} item</MenuItem>
                </Menu>
            )
        };
    }
}));
vi.mock('./menus/SyncPlayMenu', () => stubMenu('SyncPlay'));
vi.mock('./menus/RemotePlayMenu', () => stubMenu('RemotePlay'));
vi.mock('./menus/RemotePlayActiveMenu', () => stubMenu('RemotePlayActive'));

import AppToolbar from './index';

const THEME = createTheme({ cssVariables: true });
let host: HTMLDivElement;
let root: Root;

const render = (isViewNavInBar = true) =>
    act(() => {
        root.render(
            <ThemeProvider theme={THEME}>
                <MemoryRouter initialEntries={['/home']}>
                    <AppToolbar
                        isDrawerAvailable={false}
                        isDrawerOpen={false}
                        isViewNavInBar={isViewNavInBar}
                        onDrawerButtonClick={() => undefined}
                    />
                </MemoryRouter>
            </ThemeProvider>
        );
    });

/** The bar's controls in DOM order, by accessible name (or text). */
const barOrder = () =>
    [
        ...host.querySelectorAll<HTMLElement>(
            '.MuiToolbar-root a, .MuiToolbar-root button'
        )
    ].map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim());
const byName = (name: string) =>
    [
        ...document.querySelectorAll<HTMLElement>('a, button, [role=menuitem]')
    ].find(
        (el) =>
            (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
    );
const flush = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

beforeEach(() => {
    state.header = {};
    state.wide = true;
    state.playerInfo = null;
    state.playerChange = [];
    window.matchMedia = ((query: string) => ({
        matches: state.wide,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('modern header arrangement (THEME-B2)', () => {
    it('default: brand, destinations, SyncPlay, Cast, Search, account — the bar as it was', () => {
        render();
        expect(barOrder()).toEqual([
            'Brand',
            'Films',
            'ButtonSyncPlay',
            'ButtonCast',
            'Search',
            'UserMenu'
        ]);
        expect(host.querySelector('[data-rf-header-layout]')).toBeNull();
    });

    it('centered keeps the same DOM (= keyboard) order, with no CSS order', () => {
        state.header = { layout: 'centered' };
        render();
        expect(
            host.querySelector('[data-rf-header-layout="centered"]')
        ).not.toBeNull();
        expect(barOrder()).toEqual([
            'Brand',
            'Films',
            'ButtonSyncPlay',
            'ButtonCast',
            'Search',
            'UserMenu'
        ]);
        for (const el of host.querySelectorAll<HTMLElement>('*')) {
            expect(el.style.order).toBe('');
        }
    });

    it('centered with no destinations in the bar (sidebar shell) is start: nothing to centre', () => {
        state.header = { layout: 'centered' };
        render(false);
        expect(host.querySelector('[data-rf-header-layout]')).toBeNull();
    });

    it('iconsAndLabels shows each label as the button text, its accessible name', () => {
        state.header = { actions: { labels: 'iconsAndLabels' } };
        render();
        const search = byName('Search');
        expect(search?.textContent).toBe('Search');
        expect(search?.classList).toContain('rf-header-action--labelled');
    });

    it('a compact window draws start and icons whatever the theme asked', () => {
        state.wide = false;
        state.header = {
            layout: 'centered',
            actions: { labels: 'iconsAndLabels' }
        };
        render();
        expect(host.querySelector('[data-rf-header-layout]')).toBeNull();
        expect(byName('Search')?.getAttribute('aria-label')).toBe('Search');
        expect(byName('Search')?.textContent).toBe('');
    });

    it('overflow gathers SyncPlay and Cast in More; Search and the account stay', () => {
        state.header = { actions: { grouping: 'overflow' } };
        render();
        expect(barOrder()).toEqual([
            'Brand',
            'Films',
            'ButtonMore',
            'Search',
            'UserMenu'
        ]);
    });

    it('an action chosen in More opens its own menu, and focus returns to More on close', async () => {
        state.header = { actions: { grouping: 'overflow' } };
        render();
        const more = byName('ButtonMore') as HTMLElement;
        act(() => more.click());
        const syncItem = byName('ButtonSyncPlay') as HTMLElement;
        expect(syncItem.getAttribute('role')).toBe('menuitem');
        act(() => syncItem.click());
        await flush();
        const own = byName('SyncPlay item') as HTMLElement;
        expect(own).toBeTruthy();
        act(() => own.click());
        await flush();
        expect(document.activeElement).toBe(byName('ButtonMore'));
    });

    it('a remote session that starts surfaces its indicator in the bar at once, moving no focus', () => {
        state.header = { actions: { grouping: 'overflow' } };
        render();
        const more = byName('ButtonMore') as HTMLElement;
        more.focus();
        expect(document.activeElement).toBe(more);

        state.playerInfo = {
            isLocalPlayer: false,
            deviceName: 'Living room TV'
        };
        act(() => {
            for (const fn of state.playerChange) fn();
        });

        expect(barOrder()).toEqual([
            'Brand',
            'Films',
            'ButtonMore',
            'ButtonCast',
            'Search',
            'UserMenu'
        ]);
        expect(host.textContent).toContain('Living room TV');
        expect(document.activeElement).toBe(more);

        // More now holds SyncPlay only; the session's Cast is not offered twice.
        act(() => more.click());
        expect(
            [
                ...document.querySelectorAll(
                    '#app-header-more-menu [role=menuitem]'
                )
            ].map((el) => el.textContent)
        ).toEqual(['ButtonSyncPlay']);
    });

    it('the session ending puts Cast back into More', () => {
        state.header = { actions: { grouping: 'overflow' } };
        state.playerInfo = { isLocalPlayer: false, deviceName: 'TV' };
        render();
        expect(barOrder()).toContain('ButtonCast');
        state.playerInfo = null;
        act(() => {
            for (const fn of state.playerChange) fn();
        });
        expect(barOrder()).not.toContain('ButtonCast');
    });
});
