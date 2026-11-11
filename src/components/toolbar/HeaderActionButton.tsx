import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, {
    type ElementType,
    forwardRef,
    type MouseEvent,
    type ReactNode
} from 'react';
import type { To } from 'react-router-dom';

export interface HeaderActionButtonProps {
    icon: ReactNode;
    /** The action's name: always its accessible name, and its visible label under `iconsAndLabels`. */
    label: string;
    /** `actions.labels: iconsAndLabels` (THEME-B2 §3.5), already folded to `false` on a compact window. */
    labelled?: boolean;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
    /** A router `Link` for Search, with its `to`. */
    component?: ElementType;
    to?: To;
    'aria-controls'?: string;
    'aria-haspopup'?: 'true';
    'aria-expanded'?: 'true';
    'data-rf-header-more'?: string;
}

/**
 * One action of the header, as an icon or as an icon with its label. Shared by the bar's own
 * actions, the "More" button and the Theme Studio preview, so every one of them is drawn alike.
 *
 * The label never replaces the accessible name: under `icons` it is the `aria-label`, under
 * `iconsAndLabels` it is the button's text, which is the same string. The tooltip stays in the
 * banner landmark, as every toolbar tooltip does.
 */
export const HeaderActionButton = forwardRef<
    HTMLButtonElement,
    HeaderActionButtonProps
>(({ icon, label, labelled = false, ...props }, ref) => (
    <Tooltip
        slotProps={{ popper: { disablePortal: true } }}
        title={label}
        // A visible label already says it; a tooltip repeating it is noise.
        disableHoverListener={labelled}
    >
        {labelled ? (
            <Button
                ref={ref}
                size='large'
                color='inherit'
                startIcon={icon}
                className='rf-header-action rf-header-action--labelled'
                {...props}
            >
                {label}
            </Button>
        ) : (
            <IconButton
                ref={ref}
                size='large'
                color='inherit'
                aria-label={label}
                {...props}
            >
                {icon}
            </IconButton>
        )}
    </Tooltip>
));

HeaderActionButton.displayName = 'HeaderActionButton';

export default HeaderActionButton;
