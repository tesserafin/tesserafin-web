import Tooltip from '@mui/material/Tooltip';
import React, { type FC, type ReactElement } from 'react';

/**
 * The application bar's tooltip for its actions: rendered inside the banner landmark, not in a
 * `<body>` portal (axe `region`), as every toolbar tooltip is. Off while a visible label says it.
 */
export const HeaderTooltip: FC<{
    title: string;
    hidden: boolean;
    children: ReactElement;
}> = ({ title, hidden, children }) => (
    <Tooltip
        slotProps={{ popper: { disablePortal: true } }}
        title={title}
        disableHoverListener={hidden}
    >
        {children}
    </Tooltip>
);

export default HeaderTooltip;
