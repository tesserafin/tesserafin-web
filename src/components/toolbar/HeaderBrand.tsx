import icon from 'assets/branding/mark.svg';
import Button from '@mui/material/Button/Button';
import React, { FC } from 'react';
import visuallyHidden from '@mui/utils/visuallyHidden';
import { Link } from 'react-router-dom';

import type { ResolvedHeader } from 'themes/platform/headerRecipe';

export type Brand = ResolvedHeader['brand'];

const MARK_SIZE: Record<Brand['size'], string> = {
    small: '1em',
    medium: '1.25em',
    large: '1.6em'
};

/**
 * The brand link, drawn from data (THEME-B1): the header renders it with the server's name, the
 * Theme Studio preview with a sample one. `brand` absent is the bar as it always was — the mark at
 * 1.25 em and the name.
 */
export const HeaderBrand: FC<{
    name: string;
    brand?: Brand;
    /** `false` in the Theme Studio preview: drawn as the bar draws it, but going nowhere. */
    routed?: boolean;
}> = ({ name, brand, routed = true }) => {
    const show = brand?.show ?? 'markAndName';
    const size = MARK_SIZE[brand?.size ?? 'medium'];
    return (
        <Button
            variant='text'
            size='large'
            color='inherit'
            startIcon={
                show === 'name' ? undefined : (
                    <img
                        src={icon}
                        alt=''
                        aria-hidden
                        style={{ height: size, width: size }}
                    />
                )
            }
            {...(routed ? { component: Link, to: '/' } : { href: '#' })}
            data-rf-header-brand={brand && show}
            sx={brand?.size === 'large' ? { fontSize: '1.0625rem' } : undefined}
        >
            {show === 'mark' ? (
                <span style={visuallyHidden}>{name}</span>
            ) : (
                name
            )}
        </Button>
    );
};

export default HeaderBrand;
