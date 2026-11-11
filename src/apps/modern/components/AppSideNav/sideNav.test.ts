import { describe, expect, it } from 'vitest';

import { NAVIGATION_SHELLS } from 'themes/platform/contract';

import { isSideNavShown } from './sideNav';

const everywhere = {
    isMediumScreen: true,
    isNavigationRoute: true,
    isSignedIn: true
};

describe('isSideNavShown — where the destinations live (THEME-IDENTITY-1)', () => {
    it('keeps them in the bar under topbar, whatever the screen', () => {
        expect(isSideNavShown({ shell: 'topbar', ...everywhere })).toBe(false);
    });

    it('moves them into the column under sidebar and rail on a wide screen', () => {
        expect(isSideNavShown({ shell: 'sidebar', ...everywhere })).toBe(true);
        expect(isSideNavShown({ shell: 'rail', ...everywhere })).toBe(true);
    });

    // The bar shows no destinations below `md` (the drawer does), on routes without primary
    // navigation, or signed out. The column must not appear where the bar would not have: a theme
    // changes where the links are, never whether a screen has them.
    it.each([
        ['on a phone', { isMediumScreen: false }],
        ['on a route without primary navigation', { isNavigationRoute: false }],
        ['when signed out', { isSignedIn: false }]
    ])('never shows the column %s', (_, override) => {
        for (const shell of NAVIGATION_SHELLS) {
            expect(
                isSideNavShown({ shell, ...everywhere, ...override }),
                shell
            ).toBe(false);
        }
    });
});
