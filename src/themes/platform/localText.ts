/**
 * The applied draft's text slots (THEME-A2), beside the applied presentation record and announced
 * through the same subscription, but in a module of its own: only `useSlotText` (in the routes'
 * chunks) and the Theme Studio read or write it, so none of it ships in the start-up bundle.
 *
 * Same trust model as `localPresentation.ts`: the slots were validated with the draft, the reader
 * checks only the shape, and `useSlotText` checks each template it uses.
 */

import type { ThemeTextSlots } from './contract';
import { notifyAppliedPresentation } from './localPresentation';

const KEY = 'tesserafin.themeStudio.appliedText';

let cachedRaw: string | null | undefined;
let cachedValue: ThemeTextSlots | null = null;

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/** Records the text slots of the draft just applied; an absent group removes the record. */
export function saveAppliedText(slots: ThemeTextSlots | undefined): void {
    const store = storage();
    if (!store) return;
    try {
        if (slots) store.setItem(KEY, JSON.stringify(slots));
        else store.removeItem(KEY);
    } catch {
        // Quota: the application's own wording stays, which is always a correct interface.
    }
    notifyAppliedPresentation();
}

/** Forgets it, with the overlay. */
export function clearAppliedText(): void {
    storage()?.removeItem(KEY);
    notifyAppliedPresentation();
}

/** The applied text slots, or `null`. Stable identity between changes, for `useSyncExternalStore`. */
export function loadAppliedText(): ThemeTextSlots | null {
    const raw = storage()?.getItem(KEY) ?? null;
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        cachedValue =
            parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as ThemeTextSlots)
                : null;
    } catch {
        cachedValue = null;
    }
    return cachedValue;
}
