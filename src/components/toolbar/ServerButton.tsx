import React, { FC } from 'react';

import { useSystemInfo } from 'hooks/useSystemInfo';

import { type Brand, HeaderBrand } from './HeaderBrand';

/** The server's name, or the product's — never a change to server data. */
const ServerButton: FC<{ brand?: Brand }> = ({ brand }) => {
    const { data: systemInfo, isPending } = useSystemInfo();
    let name = '';
    if (!isPending) {
        name =
            brand?.label === 'product'
                ? 'Tesserafin'
                : systemInfo?.ServerName || 'Tesserafin';
    }
    return <HeaderBrand name={name} brand={brand} />;
};

export default ServerButton;
