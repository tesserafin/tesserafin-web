import React, { type ComponentPropsWithoutRef, type FC } from 'react';

import { usePresentation } from '../../presentation/PresentationContext';

import './SectionTitle.scss';

export interface SectionTitleProps extends ComponentPropsWithoutRef<'h2'> {
    /**
     * The level the page outline needs. A theme never changes it: the recipe changes how a heading
     * looks, and an `h2` drawn small is still an `h2`.
     */
    level?: 2 | 3;
}

/**
 * The one section heading of Home, Library and Item Details (THEME-A1), drawn from the theme's
 * `presentation.sectionTitle` recipe. The page keeps its own class for its own layout; the recipe's
 * choices travel as data attributes and reach the type through `--rf-section-title-*` custom
 * properties, which the page's rule reads with its own value as the fallback. That is what makes
 * `auto` reproduce each page exactly — the Item Details hero's heading scale included — while any
 * explicit choice wins over it whatever the selectors' specificity.
 */
export const SectionTitle: FC<SectionTitleProps> = ({
    level = 2,
    className,
    ...rest
}) => {
    const {
        size,
        weight,
        align,
        case: letterCase,
        spacing
    } = usePresentation().sectionTitle;
    const Heading = level === 3 ? 'h3' : 'h2';

    return (
        <Heading
            {...rest}
            className={
                className ? `rf-section-title ${className}` : 'rf-section-title'
            }
            data-rf-title-size={size}
            data-rf-title-weight={weight}
            data-rf-title-align={align}
            data-rf-title-case={letterCase}
            data-rf-title-spacing={spacing}
        />
    );
};

export default SectionTitle;
