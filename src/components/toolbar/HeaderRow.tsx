import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import React, { type FC, type ReactNode } from 'react';

export interface HeaderRowProps {
    /** The drawer and back buttons, when the shell offers them. */
    lead?: ReactNode;
    /** Under `start`, the brand and the destinations together; under `centered`, the brand only. */
    children?: ReactNode;
    /** `centered` only: the destinations, centred between the brand and the actions. */
    center?: ReactNode;
    actions?: ReactNode;
    account?: ReactNode;
    /** The EFFECTIVE layout, after the compact-window fallback (`effectiveHeader`). */
    layout?: 'start' | 'centered';
    className?: string;
    /** The Studio preview sits in a narrow column whatever the window: it always wraps. */
    alwaysWrap?: boolean;
}

const WRAP = { xs: 'wrap', lg: 'nowrap' } as const;

/**
 * The header's main row, fed with data (THEME-B2 §3.2, §8): the application passes live controls,
 * the Theme Studio passes sample ones, and both are arranged by this one component.
 *
 * `start` is the row as it has always been drawn — the same elements, in the same order, with the
 * same styles — so the default and the admin dashboard are unchanged.
 *
 * `centered` keeps that DOM order (lead, brand, destinations, actions, account): the brand side and
 * the actions side each take an equal share of the room left, so the destinations sit in the
 * middle without any CSS `order`. DOM order, visual order and keyboard order stay one order.
 */
export const HeaderRow: FC<HeaderRowProps> = ({
    lead,
    children,
    center,
    actions,
    account,
    layout = 'start',
    className,
    alwaysWrap = false
}) => {
    const flexWrap = alwaysWrap ? 'wrap' : WRAP;
    if (layout === 'centered') {
        return (
            <Toolbar
                variant='dense'
                className={className}
                data-rf-header-layout='centered'
                sx={{ flexWrap, columnGap: 1 }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: '1 1 0',
                        minWidth: 0
                    }}
                >
                    {lead}
                    {children}
                </Box>
                {center}
                <Box
                    sx={{
                        display: 'flex',
                        flex: '1 1 0',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        minWidth: 0
                    }}
                >
                    {actions}
                    {account}
                </Box>
            </Toolbar>
        );
    }

    return (
        <Toolbar variant='dense' className={className} sx={{ flexWrap }}>
            {lead}
            {children}
            <Box
                sx={{
                    display: 'flex',
                    flexGrow: 1,
                    justifyContent: 'flex-end'
                }}
            >
                {actions}
            </Box>
            {account && <Box sx={{ flexGrow: 0 }}>{account}</Box>}
        </Toolbar>
    );
};

export default HeaderRow;
