import React, { type FC } from 'react';
import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import type {} from '@mui/material/themeCssVarsAugmentation';

import { useApi } from 'hooks/useApi';
import type { UserDto } from 'lib/tesserafin-sdk';

interface UserAvatarProps extends AvatarProps {
    user?: UserDto;
    size?: number;
}

const UserAvatar: FC<UserAvatarProps> = ({ user, size }) => {
    const { reefinApi: api } = useApi();

    return user ? (
        <Avatar
            alt={user.Name ?? undefined}
            src={
                api && user.Id && user.PrimaryImageTag
                    ? `${api.basePath}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}`
                    : undefined
            }
            sx={(theme) => ({
                bgcolor:
                    api && user.Id && user.PrimaryImageTag
                        ? theme.vars.palette.background.paper
                        : theme.vars.palette.primary.dark,
                color: 'inherit',
                width: size,
                height: size
            })}
        />
    ) : null;
};

export default UserAvatar;
