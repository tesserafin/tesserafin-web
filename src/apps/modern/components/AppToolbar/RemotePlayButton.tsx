import React, {
    useCallback,
    useEffect,
    useImperativeHandle,
    useState
} from 'react';
import CastConnected from '@mui/icons-material/CastConnected';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Cast from '@mui/icons-material/Cast';
import type {} from '@mui/material/themeCssVarsAugmentation';
import Tooltip from '@mui/material/Tooltip';

import { playbackManager } from 'components/playback/playbackmanager';
import HeaderActionButton from 'components/toolbar/HeaderActionButton';
import globalize from 'lib/globalize';
import Events from 'utils/events';

import RemotePlayMenu, { ID } from './menus/RemotePlayMenu';
import RemotePlayActiveMenu, {
    ID as ACTIVE_ID
} from './menus/RemotePlayActiveMenu';
import type { HeaderActionProps } from './headerAction';

/** The current player, kept current: a remote one means a remote session is active. */
export const usePlayerInfo = () => {
    const [playerInfo, setPlayerInfo] = useState(
        playbackManager.getPlayerInfo()
    );

    const updatePlayerInfo = useCallback(() => {
        setPlayerInfo(playbackManager.getPlayerInfo());
    }, [setPlayerInfo]);

    useEffect(() => {
        Events.on(playbackManager, 'playerchange', updatePlayerInfo);

        return () => {
            Events.off(playbackManager, 'playerchange', updatePlayerInfo);
        };
    }, [updatePlayerInfo]);

    return playerInfo;
};

export const isRemoteSession = (
    playerInfo: ReturnType<typeof playbackManager.getPlayerInfo>
) => Boolean(playerInfo && !playerInfo.isLocalPlayer);

/**
 * Cast. While a remote session is active it is the session's indicator — the device's name in the
 * bar — and that is drawn whatever `trigger` says: a live session is never hidden in "More"
 * (THEME-B2 §3.5). Its appearance moves no focus.
 */
const RemotePlayButton = ({
    labelled,
    trigger = true,
    opener
}: HeaderActionProps) => {
    const playerInfo = usePlayerInfo();

    const [remotePlayMenuAnchorEl, setRemotePlayMenuAnchorEl] =
        useState<null | HTMLElement>(null);
    const isRemotePlayMenuOpen = Boolean(remotePlayMenuAnchorEl);

    const [returnFocus, setReturnFocus] = useState(false);

    const onRemotePlayButtonClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setReturnFocus(false);
            setRemotePlayMenuAnchorEl(event.currentTarget);
        },
        [setRemotePlayMenuAnchorEl]
    );

    // THEME-B2: opened from the header's "More" menu, anchored on — and returning focus to — it.
    useImperativeHandle(
        opener,
        () => (anchor) => {
            setReturnFocus(true);
            setRemotePlayMenuAnchorEl(anchor);
        },
        []
    );

    const onRemotePlayMenuClose = useCallback(() => {
        const anchor = remotePlayMenuAnchorEl;
        setRemotePlayMenuAnchorEl(null);
        if (returnFocus) window.setTimeout(() => anchor?.focus());
    }, [returnFocus, remotePlayMenuAnchorEl]);

    const [remotePlayActiveMenuAnchorEl, setRemotePlayActiveMenuAnchorEl] =
        useState<null | HTMLElement>(null);
    const isRemotePlayActiveMenuOpen = Boolean(remotePlayActiveMenuAnchorEl);

    const onRemotePlayActiveButtonClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setRemotePlayActiveMenuAnchorEl(event.currentTarget);
        },
        [setRemotePlayActiveMenuAnchorEl]
    );

    const onRemotePlayActiveMenuClose = useCallback(() => {
        setRemotePlayActiveMenuAnchorEl(null);
    }, [setRemotePlayActiveMenuAnchorEl]);

    return (
        <>
            {playerInfo && isRemoteSession(playerInfo) ? (
                <Box
                    sx={{
                        alignSelf: 'center'
                    }}
                >
                    <Tooltip
                        slotProps={{ popper: { disablePortal: true } }}
                        title={globalize.translate('ButtonCast')}
                    >
                        <Button
                            variant='text'
                            size='large'
                            className='rf-header-remote-session'
                            startIcon={<CastConnected />}
                            aria-label={globalize.translate('ButtonCast')}
                            aria-controls={ACTIVE_ID}
                            aria-haspopup='true'
                            onClick={onRemotePlayActiveButtonClick}
                            color='inherit'
                            sx={(theme) => ({
                                color: theme.vars.palette.primary.main
                            })}
                        >
                            {playerInfo.deviceName || playerInfo.name}
                        </Button>
                    </Tooltip>
                </Box>
            ) : (
                trigger && (
                    <HeaderActionButton
                        label={globalize.translate('ButtonCast')}
                        labelled={labelled}
                        aria-controls={ID}
                        aria-haspopup='true'
                        onClick={onRemotePlayButtonClick}
                        icon={<Cast />}
                    />
                )
            )}

            <RemotePlayMenu
                open={isRemotePlayMenuOpen}
                anchorEl={remotePlayMenuAnchorEl}
                onMenuClose={onRemotePlayMenuClose}
            />

            <RemotePlayActiveMenu
                open={isRemotePlayActiveMenuOpen}
                anchorEl={remotePlayActiveMenuAnchorEl}
                onMenuClose={onRemotePlayActiveMenuClose}
                playerInfo={playerInfo}
            />
        </>
    );
};

export default RemotePlayButton;
