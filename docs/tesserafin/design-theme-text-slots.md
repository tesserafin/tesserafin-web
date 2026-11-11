# Theme text slots (THEME-A2) — contract proposal

- **Status**: Accepted for implementation (decisions of 2026-11-11 folded in, §9)
- **Date**: 2026-11-11
- **Scope**: lot A2 of the 2026-11-11 component and text customisation review
- **Builds on**: RFC-0007 (Theme Platform v2), THEME-A1 (#273)
- **Language**: English, like RFC-0007 and every contract text for theme authors

This document fixes the contract for customising the **wording** of a few section titles and labels,
per language, before anything is implemented. A1 made the *appearance* of section titles themeable.
A2 does the same for their *words*, without becoming a translation system and without touching data.

---

## 1. What A2 is, and what it is not

A **text slot** is one named place in the interface whose visible words a theme may replace, in a
given language. A theme that sets the slot `library.suggestions.upcomingEpisodes.title` to
"Prochains épisodes" for French changes that one title, in French, in that one context. Nothing
else changes.

A2 is **not**:

- **A translation mechanism.** The interface must be correctly translated without any slot set.
  Missing translations are fixed in `src/strings/` (as #272 did), never papered over by a theme.
- **A way to rename data.** Film, series, library, person and channel names come from the server and
  are never slots. In `home.latestMedia.title` the library name is a *variable*, not editable text.
- **Rich text.** A slot holds plain text. No HTML, no Markdown, no expressions, no conditionals.
- **Plural, number or date formatting.** Counts, durations and dates stay with the application's
  localisation. A slot that would need a plural form is not offered (see §4.3).
- **A change of meaning.** A slot on an action keeps that action's purpose. "Show more" can become
  "Read the full synopsis", not "Play".
- **Server-side state.** Slots live in the theme document and in the locally applied draft. Sharing
  or syncing between devices is a separate decision (§9, Q3).

## 2. The slot registry

The registry is **closed**, like every vocabulary in RFC-0007: an unknown slot id is a validation
error, not an ignored extension. A slot is listed only once a surface really reads it. The Studio
never offers a slot that the Web renderer does not draw.

Each entry declares:

| Field | Meaning |
| --- | --- |
| `id` | Stable, semantic, cross-platform: `<page>.<context>.<role>`. Never a component name, a DOM id or a translation key. |
| `context` | Where it appears, in words an author recognises. |
| `defaultKey` | The application translation key used when nothing overrides the slot. |
| `kind` | `title` (a heading) or `action` (a control's visible label). |
| `variables` | Named variables, each `required` or optional (§4). |
| `recommendedLength` | Advice shown in the Studio, never a rejection (§7). |
| `surfaces` | The renderers that read the slot (`web` today). |

### 2.1 Initial slots

Each key and call site below was checked against `main` at `7826db3b7c`. The two synopsis labels are one toggle (`Overview.tsx`) and are offered together, so an author never customises "expand" without seeing "collapse".

| Slot | Context | Default key | Kind | Variables | Recommended |
| --- | --- | --- | --- | --- | --- |
| `home.libraries.title` | Home, "My media" shelf | `HeaderMyMedia` | title | none | 40 |
| `home.continueWatching.title` | Home, resume shelf | `HeaderContinueWatching` | title | none | 40 |
| `home.nextUp.title` | Home, next episode shelf | `NextUp` | title | none | 40 |
| `home.latestMedia.title` | Home, one shelf per library | `LatestFromLibrary` ("Recently Added in {0}") | title | `libraryName` **required** | 60 |
| `library.suggestions.continueWatching.title` | A library's Suggestions tab | `HeaderContinueWatching` | title | none | 40 |
| `library.suggestions.nextUp.title` | A library's Suggestions tab | `NextUp` | title | none | 40 |
| `library.suggestions.upcomingEpisodes.title` | A library's Suggestions tab, announced episodes | `HeaderUpcoming` | title | none | 40 |
| `details.schedule.title` | Item Details, upcoming TV airings | `HeaderUpcomingOnTV` | title | none | 40 |
| `details.overview.expand.label` | Item Details, expand the synopsis | `ShowMore` | action | none | 30 |
| `details.overview.collapse.label` | Item Details, collapse it again | `ShowLess` | action | none | 30 |

Two keys are shared by Home and the library's Suggestions tab (`HeaderContinueWatching`, `NextUp`).
They are **two slots**, so renaming Home's "Next up" does not rename the Suggestions shelf, and the
reverse holds too. That separation is the reason slots exist: overriding a translation key would
change every place the key is used.

Not in the initial set:
- A "View all" label: no modern surface renders one today.
- The header and navigation: lot B.
- The loading, empty and error states: functional messages, see §9 Q4.

## 3. Where slot text lives

### 3.1 In the theme document

The manifest gets a new top-level `text` group. It sits outside `presentation` because wording is not
appearance, and it has its own capability:

```json
{
  "text": {
    "slots": {
      "library.suggestions.upcomingEpisodes.title": {
        "fr": "Prochains épisodes",
        "nl": "Komende afleveringen"
      },
      "home.latestMedia.title": {
        "fr": "Nouveautés · {libraryName}",
        "en-us": "New in {libraryName}"
      }
    }
  },
  "capabilities": { "optional": ["text.slots"] }
}
```

- The capability is `text.slots`. It is added to the closed vocabulary, and the Web renderer declares
  it only in the commit that first reads a slot.
- A language key is a locale from `src/lib/globalize/locales.ts`, normalised the way globalize
  normalises it: lower case, `_` read as `-`. The keys are exactly the supported ones: `fr`,
  `fr-ca`, `nl`, `en-us`, `en-gb`, `pt-br`, `es-419`… There is no bare `en`, because the
  application has none. An unknown locale is a validation error.
- A slot with no entry for a language says nothing for that language. There is no "default language"
  inside a theme (§5).

### 3.2 Applied locally, exported and imported

A theme's slots travel exactly like its presentation:
- The Studio edits them in the draft.
- **Apply** writes them, beside the applied presentation, to a local record the renderer reads.
- **Export** and **import** carry them in the manifest.

No server change is needed. A draft written before A2 has no `text` group and stays valid.

## 4. Variables

### 4.1 Syntax

- Named, in braces: `{libraryName}`. Names are the slot's declared variable names, ASCII letters
  only.
- A literal brace is written doubled: `{{` and `}}`.
- Positional placeholders (`{0}`) are not accepted in slot text. The adapter maps the translation
  key's `{0}` to the slot's named variable, so authors never see positions.

### 4.2 Rules

- **A required variable must appear in every override of the slot, in every language.** An override
  of `home.latestMedia.title` without `{libraryName}` is invalid. Otherwise one library's shelf
  could no longer be told from another's, and a theme would be hiding data the page is meant to show.
- A variable the slot does not declare is invalid.
- Each variable appears at most once.
- Values are inserted as **text**, never parsed as markup. They are data from the server (the library
  name) or values the application has already formatted.

### 4.3 What variables never do

No plural selection, no number or date formatting, no arithmetic. A slot whose sentence would depend
on a count ("1 episode" / "3 episodes") is not offered in A2. If one is needed later, it gets a
contract built on `Intl.PluralRules` with one form per plural category, not a free-text field.

## 5. Resolution, per slot and per language

Let **C** be the active interface culture as globalize computes it (`getCurrentLocale()`, e.g.
`fr-ca`), and **L** its language (`fr`). For one slot, the first value that exists **and is valid**
wins:

1. **The locally applied text**, for C, then for L.
2. **The active theme's text**, for C, then for L.
3. **The application's translation** of `defaultKey`, through globalize **unchanged**. Globalize loads
   one dictionary for the culture (the file for C if it exists, otherwise for L, otherwise `en-us`).
   It looks the key up there, then in `en-us`, then returns the key itself. It does **not** try C,
   then L, then `en-us` key by key, and A2 does not change that. The explicit C-then-L chain of steps
   1 and 2 belongs to overrides only.
4. **The documented fallback**: the slot id itself.

Step 4 is only reachable if the `en-us` key is missing. It is a defect, and a test catches it before
release.

**The resolver also reports the language of the text it returns:**
- an override's own locale key, for steps 1 and 2;
- for step 3, the culture of the dictionary that held the key, so `en-us` when globalize fell back.

That language is part of the result, not something to recompute (§6).

Three consequences are part of the contract, and each one is tested:

- **An override never crosses languages.** With Dutch selected, a French override is ignored
  completely. The Dutch user sees the theme's Dutch text, or the application's Dutch translation, or,
  if Dutch has none, the application's own English fallback. They never see the French override. The
  `en-us` fallback in step 3 applies to the application's strings only, never to a theme's
  overrides. An `en-us` override is an override like any other: it shows under `en-us`, not under
  `nl`.
- **Language reaches regions, not the reverse.** A `fr` override applies under `fr-ca`, and a more
  specific `fr-ca` override wins there. A `fr-ca` override never applies under plain `fr`.
- **Switching language switches the text.** Resolution runs on the current culture every time.
  Nothing resolved is cached across a language change.

Invalid values at run time (a hand-edited local record, a value from an older build) are skipped
**per slot and per language**. Resolution moves to the next step, nothing throws, and start-up is
never blocked. Examples: not a string, empty after trimming, over the technical ceiling, missing a required
variable, unknown variable. This is the same rule A1 applies to presentation values. The author gets
the real error from validation, on import or in the Studio.

## 6. Accessibility

- **One resolver feeds the visible text and the accessible name.** A heading's text is the resolved
  slot, and the region it names (`aria-labelledby`) reads that same heading. A screen reader never
  announces a default title the page no longer shows.
- **A label stays in the name.** Where an action's accessible name is longer than its visible label,
  the name must contain the resolved visible label (WCAG 2.5.3, Label in Name).
- **Language of parts.** The resolved text is *usually* in the interface language, but not always.
  An application fallback can show English inside a French interface: `HeaderUpcoming` was exactly
  that before #272. The element that renders a slot therefore sets `lang` to the reported language
  (§5) whenever it differs from the document's, so a screen reader pronounces it correctly. When the
  two match, no attribute is added.
- **Headings keep their level.** A slot changes words, never structure, as A1 does for appearance.

## 7. Validation

On import and in the Studio:
- The schema checks the slot id (closed list) and the locale (closed list), and that each value is a
  string.
- The validator checks the rest:
  - non-empty after trimming;
  - no control characters;
  - the **technical ceiling**: 120 Unicode code points for a title template, 80 for an action label.
    It is counted on the template **before interpolation**, so a long library name can never
    invalidate it;
  - required variables present, no unknown variable, no repeated variable;
  - braces balanced.

The recommended lengths (40, 60 and 30) are **advice**. The Studio shows a warning past them and
never rejects. The page lays out longer text by wrapping; headings are never truncated.

Errors name the slot, the language and the rule, for example:

> `home.latestMedia.title` (fr): `{libraryName}` is required.

Slot text is never parsed as HTML. A `<b>` in an override is shown as those three characters, and it
is not rejected.

## 8. Theme Studio

- A **Texts** section lists the slots by page, each with its context. The Studio offers only slots
  whose surface the renderer draws.
- Each slot shows the application's default **in the language being edited**, the theme's value if
  any, and where the current value comes from ("from the theme", "application default").
- A language selector defaults to the interface language. The languages that already have an
  override are listed, so an author can see "French and Dutch set, others use the application text".
- Variables are inserted as tokens, never typed by hand. A missing required variable is an error
  shown on the field before Apply.
- **Reset** works per slot and per language. It **removes** that language's entry from the slot, and
  removes the slot when no language is left, so the value is inherited again. An empty string is
  never a reset: it is invalid (§7), and the field shows the error instead.
- The preview shows the slot in the same primitive the page uses (`SectionTitle`, the synopsis
  toggle), with sample data for variables.

## 9. Decisions (review of 2026-11-11)

| Question | Decision |
| --- | --- |
| A user layer separate from the applied draft | **Out of A2.** The applied draft remains the local customisation. |
| Initial slot list | Accepted, **plus `details.overview.collapse.label`**, offered with `expand.label`. |
| Sharing and sync | Out of A2. |
| Loading, empty and error messages | Their wording stays the application's in A2. Their appearance is themeable (A1). |
| Length limits | 40 / 60 / 30 are **recommendations**. Hard ceiling: 120 code points per title template, 80 per action, before interpolation. |

Corrections made after review:
- Locale keys are the normalised supported ones (`en-us`, not `en`).
- Application text keeps globalize's own lookup; the region-then-language chain is for overrides.
- The resolver reports the displayed language, and `lang` is set when it differs.
- Reset removes the entry; an empty string is invalid.

## 10. Acceptance, when implemented

- Changing `library.suggestions.upcomingEpisodes.title` in French changes that title in French only.
  It does not change Home's shelves, the "Upcoming" tab, any other language, or any data.
- With a French override set and Dutch selected, the Dutch user sees the Dutch text, or the
  application's fallback when Dutch has none. They never see the French override.
- `fr` applies under `fr-ca`; `fr-ca` does not apply under `fr`.
- With French selected and a key missing from the French dictionary, the slot renders the `en-us`
  text with `lang="en-us"`. With the key present, no `lang` attribute is added.
- A 200-character library name in `home.latestMedia.title` renders, wrapped. The template stays valid.
- Reset removes the language's entry, and the next level shows. Saving an empty field is refused
  with a message.
- An override of `home.latestMedia.title` without `{libraryName}` is rejected on import and in the
  Studio, and ignored at run time with the next level shown. Each library's shelf stays distinct.
- An invalid local record degrades per slot and never blocks start-up.
- The accessible name of every overridden heading and action equals, or contains, the visible text.
- Export, then import, keeps every override with its language. A pre-A2 draft imports unchanged.
- Changing the interface language re-resolves every slot without a reload.
- Start-up cost is measured against the parent:
  - the registry and the run-time checks are the only additions to the start-up graph;
  - the validator and the Studio controls stay in their lazy chunks;
  - any start-up increase is paid for in the same change.
