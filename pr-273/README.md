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

## Theme Studio

A Glass draft with "Title size: small" and "People grid: large", showing the new **Section titles** and **Grids** controls beside the preview. The preview now reads the draft, not the applied theme.

![Theme Studio](studio/studio-glass-controls.png)

Not captured: the library at phone width, and TV. The mobile library would need a library fixture this capture script did not install.
