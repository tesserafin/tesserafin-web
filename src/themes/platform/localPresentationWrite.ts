/**
 * The WRITE side of the applied-presentation record: what Apply and Revert call. Only the Theme
 * Studio (and tests) load it, so it stays out of the start-up bundle, where `localPresentation.ts`
 * keeps the read side the app root needs. Moved here when THEME-A2 had to pay for its own bytes.
 *
 * No cache to reset: the reader compares the raw stored string on every read and re-parses when it
 * changed, so a write is picked up by the next read; `notify` makes that read happen now.
 */

import type { ThemePresentation } from './contract';
import { KEY, notifyAppliedPresentation } from './localPresentation';

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        // Private-browsing modes expose `localStorage` and throw on access.
        return null;
    }
}

/** Records the presentation of the draft the user just applied. */
export function saveAppliedPresentation(
    presentation: ThemePresentation | undefined
): void {
    const store = storage();
    if (!store) return;
    try {
        store.setItem(KEY, JSON.stringify(presentation ?? {}));
        notifyAppliedPresentation();
    } catch {
        // Quota. The overlay's tokens are what matter most; losing the presentation record
        // degrades to the theme's own presentation rather than breaking the apply.
    }
}

/** Forgets it. Called when the overlay is cleared, so the two can never disagree. */
export function clearAppliedPresentation(): void {
    storage()?.removeItem(KEY);
    notifyAppliedPresentation();
}
