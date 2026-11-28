import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu, { type MenuProps } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React, { FC, useEffect, useState } from 'react';

import globalize from 'lib/globalize';
import { playbackManager } from 'components/playback/playbackmanager';
import type { PlayTarget } from 'types/playTarget';

import PlayTargetIcon from '../../PlayTargetIcon';

interface RemotePlayMenuProps extends MenuProps {
    onMenuClose: () => void;
}

export const ID = 'app-remote-play-menu';

const RemotePlayMenu: FC<RemotePlayMenuProps> = ({
    anchorEl,
    open,
    onMenuClose
}) => {
    const [playbackTargets, setPlaybackTargets] = useState<PlayTarget[]>([]);

    const onPlayTargetClick = (target: PlayTarget) => {
        playbackManager.trySetActivePlayer(target.playerName, target);
        onMenuClose();
    };

    useEffect(() => {
        const fetchPlaybackTargets = async () => {
            setPlaybackTargets(
                await playbackManager.getTargets({ enableDiscovery: true })
            );
        };

        if (open) {
            fetchPlaybackTargets().catch((err) => {
                console.error(
                    '[AppRemotePlayMenu] unable to get playback targets',
                    err
                );
            });
        }
    }, [open, setPlaybackTargets]);

    return (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
            }}
            id={ID}
            keepMounted
            open={open}
            onClose={onMenuClose}
        >
            {playbackTargets.map((target) => (
                <MenuItem
                    key={target.id}
                    // Since we are looping over targets there is no good way to avoid creating a new function here
                    onClick={() => onPlayTargetClick(target)}
                >
                    <ListItemIcon>
                        <PlayTargetIcon target={target} />
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            target.appName
                                ? `${target.name} - ${target.appName}`
                                : target.name
                        }
                        secondary={target.user?.Name}
                    />
                </MenuItem>
            ))}

            {playbackTargets.length === 0 && (
                <MenuItem disabled>
                    <ListItemText>
                        {globalize.translate('NoCastTargets')}
                    </ListItemText>
                </MenuItem>
            )}
        </Menu>
    );
};

export default RemotePlayMenu;
