import AppBar, { type AppBarProps } from '@mui/material/AppBar';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import React, {
    useLayoutEffect,
    useRef,
    useState,
    type FC,
    type PropsWithChildren
} from 'react';

import type { ResolvedHeader } from 'themes/platform/headerRecipe';

import './OffsetAppBar.scss';

/** The default height of an AppBar. */
const DEFAULT_APP_BAR_HEIGHT = 64;
/** The height of a dense AppBar. */
const DENSE_APP_BAR_HEIGHT = 48;

interface OffsetAppBarProps extends AppBarProps {
    /** Use the dense variant of the AppBar, which has a smaller default height. */
    dense?: boolean;
    /** The elevation to apply when the user has scrolled. Defaults to 1. */
    elevation?: number;
    /** Told the bar's measured height, for content that must sit under it (a sticky column). */
    onHeightChange?: (height: number) => void;
    /**
     * The theme's header recipe (THEME-B1), for the modern shell only. Absent — the dashboard —
     * the bar is exactly what it always was.
     */
    recipe?: ResolvedHeader;
    /**
     * THEME-B2 `overlap: hero`, already decided by the shell (recipe, wide window, a page that
     * declares a compatible lead image): no spacer, and the header's whole footprint published as
     * `--rf-header-footprint` on `<html>`, with `data-rf-header-overlap`, for that page to clear.
     */
    overlap?: boolean;
}

/**
 * MUI colour, elevation and data attributes for a header in a given scroll state. The default
 * recipe keeps MUI's own path (transparent at rest; `default` with the given elevation once
 * scrolled), so a theme that says nothing renders byte for byte as before; every other value is
 * drawn by `OffsetAppBar.scss` from the attributes. Shared with the Theme Studio preview, which
 * draws the same bar unscrolled and scrolled side by side.
 */
export function headerBarProps(
    recipe: ResolvedHeader | undefined,
    scrolled: boolean,
    elevation: number
) {
    let material: string = scrolled ? 'surface' : 'transparent';
    if (recipe) material = recipe.material[scrolled ? 'scrolled' : 'rest'];
    return {
        color:
            material === 'surface'
                ? ('default' as const)
                : ('transparent' as const),
        elevation:
            scrolled && (recipe?.separator ?? 'shadow') === 'shadow'
                ? elevation
                : 0,
        'data-rf-header-material': recipe && material,
        'data-rf-header-separator': recipe?.separator,
        'data-rf-header-shape': recipe?.shape,
        'data-rf-header-density': recipe?.density
    };
}

/**
 * AppBar wrapper with a fixed position and a spacer to prevent content from rendering underneath.
 */
const OffsetAppBar: FC<PropsWithChildren<OffsetAppBarProps>> = ({
    children,
    dense = false,
    elevation = 1,
    onHeightChange,
    recipe,
    overlap = false,
    ...props
}) => {
    const appBarRef = useRef<HTMLHtmlElement>(null);
    const [height, setHeight] = useState(
        dense ? DENSE_APP_BAR_HEIGHT : DEFAULT_APP_BAR_HEIGHT
    );

    useLayoutEffect(() => {
        onHeightChange?.(height);
    }, [height, onHeightChange]);

    const scrollTrigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0
    });

    useLayoutEffect(() => {
        const el = appBarRef.current;
        if (!el) return;

        // The bar's BOTTOM edge, not its height: a floating bar (THEME-B1) is inset from the top,
        // and the spacer must clear the whole of it. For a bar at the top the two are equal.
        const updateHeight = () => {
            setHeight(Math.ceil(el.getBoundingClientRect().bottom || 0));
        };

        updateHeight();

        // Use ResizeObserver for dynamic changes
        const observer = new ResizeObserver((entries) => {
            // Use requestAnimationFrame to batch DOM writes
            window.requestAnimationFrame(() => {
                for (const entry of entries) {
                    setHeight(
                        Math.ceil(
                            entry.target.getBoundingClientRect().bottom || 0
                        )
                    );
                }
            });
        });
        observer.observe(el);
        // Update on window resize as a fallback
        window.addEventListener('resize', updateHeight);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    /*
     * The footprint is the measured bottom edge of the outermost fixed element: the main row, any
     * row the toolbar wrapped onto, the library toolbar and a floating bar's inset — kept current by
     * the observer above. The page reads it; it never guesses the main row's height.
     */
    useLayoutEffect(() => {
        if (!overlap) return;
        const root = document.documentElement;
        root.style.setProperty('--rf-header-footprint', `${height}px`);
        root.setAttribute('data-rf-header-overlap', 'hero');
        return () => {
            root.style.removeProperty('--rf-header-footprint');
            root.removeAttribute('data-rf-header-overlap');
        };
    }, [overlap, height]);

    return (
        <>
            <AppBar
                {...props}
                ref={appBarRef}
                position='fixed'
                {...headerBarProps(recipe, scrollTrigger, elevation)}
                data-rf-header-overlap={overlap ? 'hero' : undefined}
            >
                {children}
            </AppBar>
            {/* Spacer to prevent content rendering under the AppBar */}
            <div
                aria-hidden='true'
                style={{
                    height: overlap ? 0 : height,
                    width: '100%',
                    flexShrink: 0
                }}
            />
        </>
    );
};

export default OffsetAppBar;
