import { useLayoutEffect, useSyncExternalStore } from 'react';

/**
 * Which page, right now, opens on a lead image the header may overlap (THEME-B2 §3.6).
 *
 * `overlap: hero` is a header key, but whether it can apply is the PAGE's to say: only Home with
 * its `hero` section first and Item Details with the `immersive` band declare a compatible lead
 * image. Every other page — and these two whenever they draw no such image — keeps the spacer.
 *
 * A counter, not a flag, so a page that unmounts after the next one mounted cannot clear the
 * newcomer's declaration.
 */
let declared = 0;
const listeners = new Set<() => void>();
const emit = () => {
    for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const snapshot = () => declared > 0;

/** Called by a page while it draws a lead image the header may overlap. */
export function useDeclareHeaderLead(active: boolean) {
    useLayoutEffect(() => {
        if (!active) return;
        declared += 1;
        emit();
        return () => {
            declared -= 1;
            emit();
        };
    }, [active]);
}

/** Read by the header: does the current page open on a compatible lead image? */
export const useHeaderLead = () =>
    useSyncExternalStore(subscribe, snapshot, snapshot);
