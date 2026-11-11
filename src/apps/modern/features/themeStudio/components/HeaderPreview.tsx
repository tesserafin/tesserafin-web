import Cast from '@mui/icons-material/Cast';
import CastConnected from '@mui/icons-material/CastConnected';
import Groups from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import React, { type FC, type ReactNode } from 'react';

import { headerBarProps } from 'components/OffsetAppBar';
import HeaderActionButton from 'components/toolbar/HeaderActionButton';
import { HeaderBrand } from 'components/toolbar/HeaderBrand';
import HeaderMoreMenu from 'components/toolbar/HeaderMoreMenu';
import HeaderRow from 'components/toolbar/HeaderRow';
import {
    arrangeHeaderActions,
    effectiveHeader,
    type HeaderActionId,
    type ResolvedHeader
} from 'themes/platform/headerRecipe';

/** Long on purpose: the bar must hold a real household's server name without losing an action. */
const SAMPLE_SERVER = 'Médiathèque du salon de Marguerite';
const SAMPLE_DESTINATIONS = ['Films', 'Séries', 'Musique'];
const SAMPLE_REMOTE_DEVICE = 'Living room TV';
const AVAILABLE: HeaderActionId[] = ['syncPlay', 'cast', 'search'];

const noop = () => undefined;

/** One bar of the preview, in one state. */
const PreviewBar: FC<{
    header: ResolvedHeader;
    state: 'rest' | 'scrolled';
    labelled: boolean;
    centered: boolean;
    overlap: boolean;
}> = ({ header, state, labelled, centered, overlap }) => {
    const remoteActive = state === 'scrolled';
    const { bar, more } = arrangeHeaderActions(
        AVAILABLE,
        header.actions.grouping,
        remoteActive
    );
    const slot: Record<string, ReactNode> = {
        syncPlay: (
            <HeaderActionButton
                key='syncPlay'
                label='SyncPlay'
                labelled={labelled}
                icon={<Groups />}
            />
        ),
        cast: remoteActive ? (
            <Button
                key='cast'
                color='inherit'
                className='rf-header-remote-session'
                startIcon={<CastConnected />}
                aria-label={`Cast: ${SAMPLE_REMOTE_DEVICE}`}
            >
                {SAMPLE_REMOTE_DEVICE}
            </Button>
        ) : (
            <HeaderActionButton
                key='cast'
                label='Cast'
                labelled={labelled}
                icon={<Cast />}
            />
        ),
        search: (
            <HeaderActionButton
                key='search'
                label='Search'
                labelled={labelled}
                icon={<SearchIcon />}
            />
        ),
        more: (
            <HeaderMoreMenu
                key='more'
                labelled={labelled}
                items={more.map((id) => ({
                    id,
                    label: id === 'syncPlay' ? 'SyncPlay' : 'Cast',
                    icon: id === 'syncPlay' ? <Groups /> : <Cast />,
                    onSelect: noop
                }))}
            />
        )
    };
    const destinations = (
        <nav
            className='rf-app-topnav'
            data-rf-nav-style={header.nav.style}
            aria-label={`Preview navigation, ${state}`}
        >
            <Button
                variant='text'
                color='primary'
                aria-current='page'
                startIcon={<HomeIcon />}
                href='#'
                onClick={noop}
            >
                Home
            </Button>
            {SAMPLE_DESTINATIONS.map((name) => (
                <Button
                    key={name}
                    variant='text'
                    color='inherit'
                    href='#'
                    onClick={noop}
                >
                    {name}
                </Button>
            ))}
        </nav>
    );
    const brand = (
        <HeaderBrand name={SAMPLE_SERVER} brand={header.brand} routed={false} />
    );
    const overlapping = overlap && state === 'rest';
    return (
        <Box>
            <Box component='span' sx={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {state === 'rest'
                    ? `At rest${overlapping ? ', over a lead image' : ''}`
                    : 'Scrolled, remote session active'}
            </Box>
            <Box
                sx={
                    overlapping
                        ? {
                              position: 'relative',
                              pb: 6,
                              // A sample artwork: bright and busy, the worst case for the scrim.
                              background:
                                  'linear-gradient(120deg, #f5e6a8, #e86f4a 40%, #1d3b6f 70%, #fafafa)'
                          }
                        : undefined
                }
                data-rf-preview-lead={overlapping ? '' : undefined}
            >
                <AppBar
                    position='static'
                    {...headerBarProps(header, state === 'scrolled', 4)}
                    data-rf-header-overlap={overlapping ? 'hero' : undefined}
                    data-rf-preview-header={state}
                    sx={{ position: 'relative' }}
                >
                    <HeaderRow
                        alwaysWrap
                        layout={centered ? 'centered' : 'start'}
                        center={centered ? destinations : undefined}
                        actions={bar.map((id) => slot[id])}
                        account={
                            <IconButton
                                size='large'
                                color='inherit'
                                aria-label='User menu'
                                className='rf-user-menu-button'
                                sx={{ padding: 0 }}
                            >
                                <Avatar sx={{ width: 40, height: 40 }}>
                                    M
                                </Avatar>
                            </IconButton>
                        }
                    >
                        {centered ? (
                            brand
                        ) : (
                            <Stack
                                direction='row'
                                spacing={0.5}
                                sx={{ minWidth: 0 }}
                            >
                                {brand}
                                {destinations}
                            </Stack>
                        )}
                    </HeaderRow>
                </AppBar>
            </Box>
        </Box>
    );
};

/**
 * The application header, drawn by the Theme Studio from the product's own pieces (THEME-B1/B2
 * §8): the same `HeaderRow` arranging it, the same `headerBarProps` material, `HeaderBrand`,
 * `rf-app-topnav` destinations, `HeaderActionButton`s and "More" menu, and the same
 * `arrangeHeaderActions` / `effectiveHeader` rules — fed with sample data instead of the session.
 *
 * Drawn at rest and scrolled, as a wide window. The resting bar shows no remote session, so
 * `overflow` gathers SyncPlay and Cast; the scrolled one shows an active session, which stays in the
 * bar. Under `overlap: hero` the resting bar stands over a sample artwork with the renderer's scrim.
 */
export const HeaderPreview: FC<{ header: ResolvedHeader }> = ({ header }) => {
    const { layout, labels, overlap } = effectiveHeader(header, {
        compact: false,
        lead: true
    });
    return (
        <Stack spacing={1} data-testid='theme-studio-preview-header'>
            {(['rest', 'scrolled'] as const).map((state) => (
                <PreviewBar
                    key={state}
                    header={header}
                    state={state}
                    labelled={labels === 'iconsAndLabels'}
                    centered={layout === 'centered'}
                    overlap={overlap}
                />
            ))}
        </Stack>
    );
};

export default HeaderPreview;
