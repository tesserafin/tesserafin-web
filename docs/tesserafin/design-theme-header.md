# Theme header recipe (THEME-B) — contract proposal

- **Status**: Proposal, for review before any code
- **Date**: 2026-11-11
- **Scope**: lot B of the 2026-11-11 component and text customisation review: the application
  header and how navigation is drawn in it
- **Builds on**: RFC-0007, THEME-IDENTITY-1 (#271, which moves the destinations into the bar under
  `navigation.shell: topbar`), THEME-A1 (#273)
- **Language**: English, like RFC-0007 and every contract text for theme authors

The header is the only large surface of the modern shell that a theme cannot shape today. This
document fixes what a theme may decide about it, what stays the product's, and how the work is cut,
before anything is implemented.

---

## 1. The header today

Every fact below was checked on #271's head (`e4d9dae65b`).

| Aspect | Today | Where |
| --- | --- | --- |
| Anchoring | Always `position: fixed`, with a spacer the size of the measured bar | `components/OffsetAppBar.tsx` |
| Material | Transparent at rest. Once the window has scrolled (`useScrollTrigger`, threshold 0), MUI `color="default"` with elevation 4 | `OffsetAppBar.tsx`, `apps/modern/AppLayout.tsx` |
| Height | MUI `Toolbar variant="dense"` (48 px), always | `components/toolbar/AppToolbar.tsx` |
| Order | Drawer button, back button (native shell only), brand + destinations, then actions pushed to the end, then the account menu | `components/toolbar/AppToolbar.tsx`, `apps/modern/components/AppToolbar/index.tsx` |
| Brand | `ServerButton`: the embedded mark at 1.25 em plus the server name, falling back to "Tesserafin". It links to `/` | `components/toolbar/ServerButton.tsx` |
| Actions | SyncPlay (only with the user policy and the plugin), Cast (shows the remote device's name while a remote session is active), Search (a link to the search page) | `apps/modern/components/AppToolbar/*Button.tsx` |
| Destinations in the bar | `UserViewNav` inside `<nav aria-label="HeaderNavigation">`, when `navigation.shell` is `topbar` and the screen is wide | `AppToolbar/index.tsx` |
| Destination shape | Plain links under an opaque surface. A floating frosted **pill group with pill links** whenever `surface.variant` is `glass` | `AppToolbar/AppTopNav.scss` |
| Narrow screens | The destinations go to the drawer; the toolbar may wrap (`flexWrap: xs wrap`) | `AppToolbar.tsx`, `AppLayout.tsx` |
| Other users of the bar | The library toolbar is rendered inside the same bar on library paths. The **admin dashboard** reuses `OffsetAppBar` and the base toolbar with its own layout | `AppLayout.tsx`, `apps/dashboard/AppLayout.tsx` |
| Public paths | Login, server selection and the setup wizard hide user actions and the account menu (`PUBLIC_PATHS`) | `AppToolbar/index.tsx` |

Two couplings are what lot B exists to remove:
- **Material forces shape.** Choosing `glass` gives the destinations a pill group, and nothing else can.
- **The bar has no recipe of its own.** Anchoring, height, material at rest and on scroll, brand and
  action presentation are all fixed in code.

## 2. What lot B is not

The header recipe changes how the header **looks and is arranged**. It never decides:
- which actions exist: SyncPlay follows the user's policy and the plugin, Cast and Search are always
  offered on signed-in pages;
- which destinations exist: authorisation and library state, RFC-0007 §6.1;
- whether the account menu, the back button (native shell) or the drawer button (narrow screens) are
  present;
- what public paths show;
- whether the bar is shown at all (`/video` hides it).

Out of scope:
- **The admin dashboard header.** It reuses `OffsetAppBar`, but the recipe must not leak into it by
  that route.
- **Public paths.** See §9, Q2.
- **The legacy shells** (desktop-legacy, mobile-legacy, TV), which have their own header.
- **Imported logo files.** `assets.roles` is defined but not bound, and there is no package format
  to carry a file (#117). Brand modes in B use the embedded mark only, and the Studio does not
  promise a custom logo.
- **Custom brand wording.** That is an A2 text slot (`header.brand.label`, §6), not a header key.

## 3. The recipe: `presentation.header`

New capability `presentation.header`, a group of its own, independent of `navigation` and of
`surface.variant`. Every key is a closed enum. Every default reproduces the bar as it is drawn on
#271 (§7).

### 3.1 Bar

| Key | Values | Default (today) | Notes |
| --- | --- | --- | --- |
| `anchor` | `fixed`, `sticky`, `static` | `fixed` | `sticky` and `static` ship only once proven against the real scroll container: today's material change listens to window scroll, and a page that scrolls inside its own container must not leave the bar stuck in its resting material. |
| `density` | `compact`, `comfortable`, `spacious` | `compact` (48 px) | 48 / 56 / 64 px minimum heights, expressed in `rem`, so the bar grows with zoom and never clips. Every interactive target stays at least 44 × 44 px. |
| `shape` | `bar`, `floating` | `bar` | `floating` insets the bar from the window edges, with radius and margin. |
| `material.rest` | `transparent`, `surface`, `glass` | `transparent` | |
| `material.scrolled` | `surface`, `glass` | `surface` | |
| `separator` | `none`, `hairline`, `shadow` | `shadow` (when scrolled) | Applies in the scrolled state; at rest only `hairline` draws. |

The `reducedTransparency` and `lowPower` profiles turn any `glass` into `surface` after the theme's
choice, as they do for every other surface. Under `transparent`, legibility over artwork is the
renderer's job (§5.4), not the author's.

### 3.2 Arrangement

| Key | Values | Default |
| --- | --- | --- |
| `layout` | `start` (brand and destinations at the start, actions at the end), `centered` (brand at the start, destinations centred, actions at the end) | `start` |

Named compositions only, never free placement. **The DOM order is the visual order is the keyboard
order** under every value, so no CSS `order` and no visual reordering. On a compact window `centered`
falls back to `start` (§5.2).

### 3.3 Brand

| Key | Values | Default |
| --- | --- | --- |
| `brand.show` | `markAndName`, `mark`, `name` | `markAndName` |
| `brand.size` | `small`, `medium`, `large` | `medium` (1.25 em mark) |
| `brand.label` | `server`, `product` | `server` (falls back to "Tesserafin") |

Under `mark`, the link keeps an accessible name, the label it would have shown. `product` shows
"Tesserafin" and never changes server data.

### 3.4 Destinations in the bar (`navigation.shell: topbar`)

| Key | Values | Default |
| --- | --- | --- |
| `nav.style` | `plain`, `underline`, `segmented`, `floating` | **derived**: `floating` under a glass surface, `plain` otherwise |

The derived default is what decouples material and shape without changing any existing theme:
- A theme that says nothing renders exactly as #271 does.
- A Glass-based theme can now ask for `underline` and keep its glass bar.
- An opaque theme can ask for `floating`.

The active destination keeps `aria-current="page"` and a visible state under every style.

### 3.5 Actions

| Key | Values | Default |
| --- | --- | --- |
| `actions.labels` | `icons`, `iconsAndLabels` | `icons` |
| `actions.grouping` | `inline`, `overflow` | `inline` |

`overflow` may move **secondary** actions into one "More" menu. Search, the account menu and the
remote-session indicator are never moved: while a remote session is active, its device name stays
visible in the bar. SyncPlay and Cast under `overflow` keep their own menus, opened from the "More"
menu, with focus returned to "More" on close.

### 3.6 Relation to the page

| Key | Values | Default |
| --- | --- | --- |
| `overlap` | `none`, `hero` | `none` |

`hero` lets the page start under a transparent bar, but only on pages that declare a compatible lead
image: Home with its `hero` section, and Item Details with the `immersive` band. Every other page
keeps the spacer. The bar's measured height (already tracked by `OffsetAppBar`) is published as an
offset the hero reads, so no title or control ever sits under the bar. A scrim keeps the bar's text
at WCAG AA contrast over any artwork.

## 4. What is never themeable

These are tested, not merely stated:

- The set of actions, destinations and menus, and their labels, states and keyboard behaviour.
- One `banner` landmark. One `nav` labelled "Navigation" when the destinations are in the bar.
  Tooltips rendered inside the banner, as today.
- **Focus order equals visual order**, under every `layout`.
- **Reflow:**
  - at 320 CSS px wide, and at 400 % zoom on desktop, nothing is cut and no horizontal scroll appears;
  - the bar wraps or collapses, but never hides an action.
- Target size at least 44 × 44 px for every bar control.
- Contrast AA for every state of every control: rest, scrolled, hover, focus, active.
- `reducedMotion` removes material transitions. `reducedTransparency` and `lowPower` remove glass.

## 5. Responsive behaviour

### 5.1 Breakpoints

The breakpoints are the existing ones: compact below MUI `md`, where the drawer replaces the bar's
destinations; medium; expanded. No new breakpoint is introduced.

### 5.2 Fallbacks on a compact window

Deterministic and fixed in the renderer:

| Key | On a compact window |
| --- | --- |
| `layout: centered` | `start` |
| `actions.labels: iconsAndLabels` | `icons` (labels stay as accessible names) |
| `brand.show: markAndName` | unchanged (the name may wrap, never truncate the actions) |
| `shape: floating` | `bar` |
| `density` | kept |

### 5.3 Long content

Long server names, long translations (German, Finnish) and an active remote device name must fit
or wrap without pushing an action out of reach. The Studio preview shows all three (§8).

### 5.4 Transparent over artwork

When `material.rest` is `transparent` and the page draws artwork under the bar (`overlap: hero`), the
renderer adds a top scrim sized to the bar. The theme cannot turn it off.

## 6. Interaction with other lots

- **A1:**
  - `navigation.tabs` stays the in-page tab style.
  - `nav.style` is the style of the bar's destinations.
  - The two are independent.
- **A2:**
  - The brand's custom wording would be a text slot `header.brand.label`, resolved per language like
    every other slot.
  - Until A2 lands, `brand.label` offers only `server` and `product`.
- **#271:** `navigation.shell` decides whether the destinations are in the bar at all. The header
  recipe only styles them when they are.

## 7. Contract and compatibility

- The schema, `contract.ts` runtime lists, the resolver, the defaults, the parity test and the
  Studio move together, as in A1.
- **Default = #271's rendering**, checked by captures:
  - Classic and Glass desktop states are byte-identical to the #271 build;
  - the admin dashboard and public-path headers are unchanged.
- Hand-edited applied records are sanitised key by key and never block start-up.
- `nav.style` absent → derived (§3.4). An explicit value always wins.
- **Budget.** The header is on the start-up path, so lot B measures before and after. Any increase
  is paid for in the same change, and the ceiling is never raised. Variant styles that only one
  value needs should be built so they do not grow the initial CSS for users of the default.

## 8. Theme Studio

The current `AppToolbar` reads the network and the session (`useSystemInfo`, `useApi`, the plugin
manager), so the preview cannot mount it. Lot B therefore first splits a **presentational header
primitive** out of it:
- it is fed with data: server name, which actions exist, the remote session, the destinations;
- the application's container passes live data to it, and the Studio passes synthetic data.

The preview then uses the same primitive as the product, never a look-alike.

The preview covers:
- desktop and compact widths, at rest and scrolled;
- a menu open, a long server name, a long language and an active remote session;
- 200 % zoom.

Each control states its scope ("signed-in pages, modern layout"). A control that a compact window
overrides says so.

## 9. Open questions for review

1. **Slicing.** Proposal:
   - **B1:** the presentational primitive, material and separator, density, shape, brand, and
     `nav.style` decoupling, with the Studio preview.
   - **B2:** layout, action presentation and grouping, `overlap: hero`.
   - **B3:** `sticky` and `static` anchoring once the scroll container is settled, and an embedded
     search field if the search page can serve one.
2. **Public paths** (login, server selection, wizard). Proposal: keep the default bar in B, and
   declare them as a later surface once their own layout is reviewed.
3. **`floating` shape and `overlap: hero` together**: allowed, or one at a time in B?
4. **`spacious` density (64 px)**: useful on desktop, or only `compact` / `comfortable`?
5. **Library toolbar inside the bar** (library paths): it inherits the bar's material. Does it also
   follow `density`, or keep its own height?

## 10. Acceptance, when implemented

- Default: Classic and Glass captures are identical to the #271 build. The admin dashboard and
  public-path headers are unchanged.
- `glass` with `nav.style: underline` renders a glass bar with underlined destinations. An opaque
  surface with `floating` renders the pill group.
- Under every recipe value, every action that the user's policy and plugins allow is present and
  reachable by keyboard, in visual order. Search, the account menu and the remote-session indicator
  are never hidden in a menu.
- No horizontal scroll at 320 px or at 400 % zoom. Targets are at least 44 px. Axe is clean at rest,
  scrolled and with a menu open.
- `reducedTransparency` and `lowPower` remove glass. `reducedMotion` removes transitions.
- `overlap: hero` never puts a title or control under the bar. The measured offset follows a bar
  that wraps.
- Every setting acts in the preview and in the application, and survives Apply, reload and
  export/import. Pre-B drafts import unchanged.
- Start-up budget is measured against the parent and does not grow.
