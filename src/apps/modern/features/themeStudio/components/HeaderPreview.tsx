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
import Toolbar from '@mui/material/Toolbar';
import React, { type FC } from 'react';

import { headerBarProps } from 'components/OffsetAppBar';
import { HeaderBrand } from 'components/toolbar/HeaderBrand';
import type { ResolvedHeader } from 'themes/platform/headerRecipe';

/** Long on purpose: the bar must hold a real household's server name without losing an action. */
const SAMPLE_SERVER = 'Médiathèque du salon de Marguerite';
const SAMPLE_DESTINATIONS = ['Films', 'Séries', 'Musique'];
const SAMPLE_REMOTE_DEVICE = 'Living room TV';

const noop = () => undefined;

/**
 * The application header, drawn by the Theme Studio from the product's own pieces (THEME-B1 §8):
 * the same MUI `AppBar` and dense `Toolbar`, the same `headerBarProps` the live bar takes its
 * material from, the same `HeaderBrand`, the same `rf-app-topnav` destinations and the same action
 * icons — fed with sample data instead of the session. Static, not fixed: it sits in the preview.
 *
 * Drawn twice, at rest and scrolled, because material and separator differ between the two, and
 * with an active remote session so the device name's room in the bar is visible.
 */
export const HeaderPreview: FC<{ header: ResolvedHeader }> = ({ header }) => (
    <Stack spacing={1} data-testid='theme-studio-preview-header'>
        {(['rest', 'scrolled'] as const).map((state) => (
            <Box key={state}>
                <Box
                    component='span'
                    sx={{ fontSize: '0.75rem', opacity: 0.7 }}
                >
                    {state === 'rest' ? 'At rest' : 'Scrolled'}
                </Box>
                <AppBar
                    position='static'
                    {...headerBarProps(header, state === 'scrolled', 4)}
                    data-rf-preview-header={state}
                >
                    <Toolbar variant='dense' sx={{ flexWrap: 'wrap' }}>
                        <Stack
                            direction='row'
                            spacing={0.5}
                            sx={{ minWidth: 0 }}
                        >
                            <HeaderBrand
                                name={SAMPLE_SERVER}
                                brand={header.brand}
                                routed={false}
                            />
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
                        </Stack>
                        <Box
                            sx={{
                                display: 'flex',
                                flexGrow: 1,
                                justifyContent: 'flex-end'
                            }}
                        >
                            <IconButton
                                size='large'
                                color='inherit'
                                aria-label='SyncPlay'
                            >
                                <Groups />
                            </IconButton>
                            <Button
                                color='inherit'
                                startIcon={<CastConnected />}
                                aria-label={`Cast: ${SAMPLE_REMOTE_DEVICE}`}
                            >
                                {SAMPLE_REMOTE_DEVICE}
                            </Button>
                            <IconButton
                                size='large'
                                color='inherit'
                                aria-label='Search'
                            >
                                <SearchIcon />
                            </IconButton>
                        </Box>
                        <IconButton
                            size='large'
                            color='inherit'
                            aria-label='User menu'
                            className='rf-user-menu-button'
                            sx={{ padding: 0 }}
                        >
                            <Avatar sx={{ width: 40, height: 40 }}>M</Avatar>
                        </IconButton>
                    </Toolbar>
                </AppBar>
            </Box>
        ))}
    </Stack>
);

export default HeaderPreview;
