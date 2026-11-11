# #271 THEME-IDENTITY-1: visual review captures

Build: head of #271, `e4d9dae65b`. Real production bundle in Chromium, server-free fixture API. Each page wears both halves of a theme: its token stylesheet and its presentation recipe.

Classic: library column (sidebar), `backdrop` hero, facts as a table, `form` controls, people as cards.

Glass: floating top bar, `immersive` hero, inline facts, `pill` controls, people as portraits, overlay card titles, ambient backdrop.

## With artwork loaded (added after review)

The fixture items above carry no image tags, so the `immersive` band fell back to the poster layout.
These captures give the film and the series a backdrop and a poster (synthetic artwork, served by the
capture script). They also add the modern library at 390 px. Measured values are in
`with-artwork/measurements.json`: hero mode, a backdrop actually painted, titles, grids.

| Variant | movie desktop | series desktop | library desktop | movie mobile | series mobile | library mobile |
| --- | --- | --- | --- | --- | --- | --- |
| `glass` | ![](with-artwork/glass-movie-desktop.png) | ![](with-artwork/glass-series-desktop.png) | ![](with-artwork/glass-library-desktop.png) | <img src="with-artwork/glass-movie-mobile.png" width="180"> | <img src="with-artwork/glass-series-mobile.png" width="180"> | <img src="with-artwork/glass-library-mobile.png" width="180"> |
| `classic` | ![](with-artwork/classic-movie-desktop.png) | ![](with-artwork/classic-series-desktop.png) | ![](with-artwork/classic-library-desktop.png) | <img src="with-artwork/classic-movie-mobile.png" width="180"> | <img src="with-artwork/classic-series-mobile.png" width="180"> | <img src="with-artwork/classic-library-mobile.png" width="180"> |

Observation for this PR: under `immersive`, the first content section (here "Seasons") starts below
the poster column. This leaves a tall empty band under a short synopsis on desktop. A1 does not
change it.

## Item Details, desktop (1440 wide, full page)

| | Classic | Glass |
| --- | --- | --- |
| movie | ![classic movie](item-details/classic-movie-desktop.png) | ![glass movie](item-details/glass-movie-desktop.png) |
| series | ![classic series](item-details/classic-series-desktop.png) | ![glass series](item-details/glass-series-desktop.png) |
| season | ![classic season](item-details/classic-season-desktop.png) | ![glass season](item-details/glass-season-desktop.png) |
| episode | ![classic episode](item-details/classic-episode-desktop.png) | ![glass episode](item-details/glass-episode-desktop.png) |
| music-album | ![classic music-album](item-details/classic-music-album-desktop.png) | ![glass music-album](item-details/glass-music-album-desktop.png) |
| person | ![classic person](item-details/classic-person-desktop.png) | ![glass person](item-details/glass-person-desktop.png) |
| series-timer | ![classic series-timer](item-details/classic-series-timer-desktop.png) | ![glass series-timer](item-details/glass-series-timer-desktop.png) |

## Item Details, mobile (390 wide, full page)

| | Classic | Glass |
| --- | --- | --- |
| movie | <img src="item-details/classic-movie-mobile.png" width="260"> | <img src="item-details/glass-movie-mobile.png" width="260"> |
| series | <img src="item-details/classic-series-mobile.png" width="260"> | <img src="item-details/glass-series-mobile.png" width="260"> |
| season | <img src="item-details/classic-season-mobile.png" width="260"> | <img src="item-details/glass-season-mobile.png" width="260"> |
| episode | <img src="item-details/classic-episode-mobile.png" width="260"> | <img src="item-details/glass-episode-mobile.png" width="260"> |
| music-album | <img src="item-details/classic-music-album-mobile.png" width="260"> | <img src="item-details/glass-music-album-mobile.png" width="260"> |
| person | <img src="item-details/classic-person-mobile.png" width="260"> | <img src="item-details/glass-person-mobile.png" width="260"> |
| series-timer | <img src="item-details/classic-series-timer-mobile.png" width="260"> | <img src="item-details/glass-series-timer-mobile.png" width="260"> |

## Home, library and onboarding, desktop (1440 × 900)

| State | Classic | Glass |
| --- | --- | --- |
| `nav-media-family-first` | ![classic nav-media-family-first](desktop/desktop-classic-nav-media-family-first.png) | ![glass nav-media-family-first](desktop/desktop-glass-nav-media-family-first.png) |
| `library-grid` | ![classic library-grid](desktop/desktop-classic-library-grid.png) | ![glass library-grid](desktop/desktop-glass-library-grid.png) |
| `toolbar-scrolled` | ![classic toolbar-scrolled](desktop/desktop-classic-toolbar-scrolled.png) | ![glass toolbar-scrolled](desktop/desktop-glass-toolbar-scrolled.png) |
| `settings-display` | ![classic settings-display](desktop/desktop-classic-settings-display.png) | ![glass settings-display](desktop/desktop-glass-settings-display.png) |
| `packs-none` | ![classic packs-none](desktop/desktop-classic-packs-none.png) | ![glass packs-none](desktop/desktop-glass-packs-none.png) |
| `packs-populated` | ![classic packs-populated](desktop/desktop-classic-packs-populated.png) | ![glass packs-populated](desktop/desktop-glass-packs-populated.png) |
| `packs-arrangement` | ![classic packs-arrangement](desktop/desktop-classic-packs-arrangement.png) | ![glass packs-arrangement](desktop/desktop-glass-packs-arrangement.png) |
| `packs-error` | ![classic packs-error](desktop/desktop-classic-packs-error.png) | ![glass packs-error](desktop/desktop-glass-packs-error.png) |
| `nav-content-pack-first` | ![classic nav-content-pack-first](desktop/desktop-classic-nav-content-pack-first.png) | ![glass nav-content-pack-first](desktop/desktop-glass-nav-content-pack-first.png) |

Produced by `npm run test:item-details-browser` (`itemDetails.recipe.browser.spec.ts`) and `playwright.m3.config.ts` (`m3.captures.spec.ts`, desktop project) against a build of this commit.
