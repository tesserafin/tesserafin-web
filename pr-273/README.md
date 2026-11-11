# #273 THEME-A1: visual review captures

Before is #271 (`e4d9dae65b`); after is #273 (`092c65f5a4`). Same fixture, same worktree; only the build changes. In the diff column, changed pixels are magenta over the dimmed after-image.

## Desktop states, compared pixel by pixel

- **Classic:** 9 of 9 states unchanged. Eight are byte-identical. Home differs by 3 pixels of anti-aliasing at the sidebar edge, with a maximum channel delta of 1/255; it was identical on the previous run.
- **Glass, Home:** pill tabs aligned on the 16 px gutter, and a large, bold "My Media".
- **Glass, library:** pill tabs. The underline rule goes, so everything below moves up about 11 px.
- **Glass, other states:** unchanged, one of them by 3 px of noise.

| | Before (#271) | After (#273) | Diff |
| --- | --- | --- | --- |
| Glass · Home | ![](before-after/glass-home-before.png) | ![](before-after/glass-home-after.png) | ![](before-after/glass-home-diff.png) |
| Glass · library | ![](before-after/glass-library-before.png) | ![](before-after/glass-library-after.png) | ![](before-after/glass-library-diff.png) |
| Classic · Home | ![](before-after/classic-home-before.png) | ![](before-after/classic-home-after.png) | ![](before-after/classic-home-diff.png) |
| Classic · library | ![](before-after/classic-library-before.png) | ![](before-after/classic-library-after.png) | ![](before-after/classic-library-diff.png) |

## Item Details with the new keys

Recipes applied on top of the official ones. Measured values come from `item-details/measurements.json`: the first section title, then the people or episodes grid.

| Variant | What it sets | Title measured | Grid measured |
| --- | --- | --- | --- |
| `glass` | Glass as shipped (`sectionTitle` large, bold) | 22.3 px / 700 | people: medium, 11 columns |
| `glass-small-titles` | + `sectionTitle: { size: small, weight: regular }`. The review's "immersive page with small section titles". | **14.9 px / 400**: wins over the immersive hero | unchanged |
| `classic` | Classic as shipped | 17.3 px / 500 | people: medium, 6 columns |
| `classic-a1` | + `sectionTitle: large, center, uppercase, loose`; `grid: people large, episodes small`; `titleLines: 2`; `tabs: pills` | **22.3 px / 500, centred, uppercase** | people **large → 5 columns**; episodes **small → 7 columns**; at 390 wide both stay at 2 |

No horizontal overflow at either width in any variant.

| Variant | Movie, desktop | Series, desktop | Movie, mobile |
| --- | --- | --- | --- |
| `glass` | ![](item-details/glass-movie-desktop.png) | ![](item-details/glass-series-desktop.png) | <img src="item-details/glass-movie-mobile.png" width="200"> |
| `glass-small-titles` | ![](item-details/glass-small-titles-movie-desktop.png) | ![](item-details/glass-small-titles-series-desktop.png) | <img src="item-details/glass-small-titles-movie-mobile.png" width="200"> |
| `classic` | ![](item-details/classic-movie-desktop.png) | ![](item-details/classic-series-desktop.png) | <img src="item-details/classic-movie-mobile.png" width="200"> |
| `classic-a1` | ![](item-details/classic-a1-movie-desktop.png) | ![](item-details/classic-a1-series-desktop.png) | <img src="item-details/classic-a1-movie-mobile.png" width="200"> |

## With artwork loaded, and the library at phone width (added after review)

The film and the series now have a real backdrop, so `immersive` actually renders. These rows show
the A1 keys on that render and the modern library at 390 px. Values are from
`with-artwork/measurements.json`:

| Variant | Section title | Grids (columns, desktop / mobile) | Tabs |
| --- | --- | --- | --- |
| `glass` | 22.3 px / 700 | people 11 / 2; library (backdrop cards) 5 / 1 | pills |
| `glass-small-titles` | **14.9 px / 400 over the immersive band** | unchanged | pills |
| `classic` | 17.3 px / 500 | people 6 / 2; episodes 6 / 2; library 6 / 2 | underline |
| `classic-a1` | 22.3 px / 500, centred, uppercase | people **large 5** / 2; episodes **small 7** / 2; library **small 7** / 2 | **pills** |

No horizontal overflow in any capture.

| Variant | movie desktop | series desktop | library desktop | movie mobile | series mobile | library mobile |
| --- | --- | --- | --- | --- | --- | --- |
| `glass` | ![](with-artwork/glass-movie-desktop.png) | ![](with-artwork/glass-series-desktop.png) | ![](with-artwork/glass-library-desktop.png) | <img src="with-artwork/glass-movie-mobile.png" width="180"> | <img src="with-artwork/glass-series-mobile.png" width="180"> | <img src="with-artwork/glass-library-mobile.png" width="180"> |
| `glass-small-titles` | ![](with-artwork/glass-small-titles-movie-desktop.png) | ![](with-artwork/glass-small-titles-series-desktop.png) | ![](with-artwork/glass-small-titles-library-desktop.png) | <img src="with-artwork/glass-small-titles-movie-mobile.png" width="180"> | <img src="with-artwork/glass-small-titles-series-mobile.png" width="180"> | <img src="with-artwork/glass-small-titles-library-mobile.png" width="180"> |
| `classic` | ![](with-artwork/classic-movie-desktop.png) | ![](with-artwork/classic-series-desktop.png) | ![](with-artwork/classic-library-desktop.png) | <img src="with-artwork/classic-movie-mobile.png" width="180"> | <img src="with-artwork/classic-series-mobile.png" width="180"> | <img src="with-artwork/classic-library-mobile.png" width="180"> |
| `classic-a1` | ![](with-artwork/classic-a1-movie-desktop.png) | ![](with-artwork/classic-a1-series-desktop.png) | ![](with-artwork/classic-a1-library-desktop.png) | <img src="with-artwork/classic-a1-movie-mobile.png" width="180"> | <img src="with-artwork/classic-a1-series-mobile.png" width="180"> | <img src="with-artwork/classic-a1-library-mobile.png" width="180"> |

## Theme Studio

A Glass draft with "Title size: small" and "People grid: large", showing the new **Section titles** and **Grids** controls beside the preview. The preview now reads the draft, not the applied theme.

![Theme Studio](studio/studio-glass-controls.png)

Not captured: TV.
