import MoreHoriz from '@mui/icons-material/MoreHoriz';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React, {
    type FC,
    type ReactNode,
    useCallback,
    useRef,
    useState
} from 'react';

import globalize from 'lib/globalize';

import HeaderActionButton from './HeaderActionButton';

export interface HeaderMoreItem {
    id: string;
    label: string;
    icon: ReactNode;
    /** Opens the action's OWN menu on the "More" button; that menu gives focus back to it. */
    onSelect: (anchor: HTMLElement) => void;
}

export const MORE_MENU_ID = 'app-header-more-menu';

/**
 * `actions.grouping: overflow` (THEME-B2 §3.5): one "More" button holding the bar's secondary
 * actions. Choosing one closes "More" and opens that action's own menu, anchored on this button,
 * so SyncPlay and Cast behave exactly as they do from the bar. Shared with the Theme Studio.
 */
export const HeaderMoreMenu: FC<{
    items: readonly HeaderMoreItem[];
    labelled?: boolean;
}> = ({ items, labelled }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const onOpen = useCallback(() => setOpen(true), []);
    const onClose = useCallback(() => setOpen(false), []);
    if (items.length === 0) return null;
    return (
        <>
            <HeaderActionButton
                ref={buttonRef}
                label={globalize.translate('ButtonMore')}
                labelled={labelled}
                icon={<MoreHoriz />}
                aria-controls={open ? MORE_MENU_ID : undefined}
                aria-haspopup='true'
                aria-expanded={open ? 'true' : undefined}
                onClick={onOpen}
                data-rf-header-more=''
            />
            <Menu
                id={MORE_MENU_ID}
                anchorEl={buttonRef.current}
                open={open}
                onClose={onClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {items.map((item) => (
                    <MenuItem
                        key={item.id}
                        onClick={() => {
                            setOpen(false);
                            const anchor = buttonRef.current;
                            if (anchor) item.onSelect(anchor);
                        }}
                    >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText>{item.label}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

export default HeaderMoreMenu;
