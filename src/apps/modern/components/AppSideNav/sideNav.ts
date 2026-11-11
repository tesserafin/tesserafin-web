import type { NavigationShell } from 'themes/platform/contract';

/**
 * Whether the destinations move from the application bar into the persistent column
 * (`navigation.shell`, THEME-IDENTITY-1).
 *
 * Only where the bar would have shown them: a signed-in user, on a route that has primary
 * navigation, on a screen wide enough for the bar's row (`md` and up). Narrower than that, every
 * shell uses the menu drawer — a persistent column on a phone costs the content it organises, and
 * no theme can overrule that. Exactly one of the two places holds the links at any width.
 */
export const isSideNavShown = (options: {
    shell: NavigationShell;
    isMediumScreen: boolean;
    isNavigationRoute: boolean;
    isSignedIn: boolean;
}): boolean =>
    options.shell !== 'topbar' &&
    options.isMediumScreen &&
    options.isNavigationRoute &&
    options.isSignedIn;
