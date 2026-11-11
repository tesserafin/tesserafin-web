import type { Ref } from 'react';

/** What the modern header passes each of its actions (THEME-B2 §3.5). */
export interface HeaderActionProps {
    /** Draw the label beside the icon (`actions.labels: iconsAndLabels`, wide windows only). */
    labelled?: boolean;
    /**
     * `false` while the action sits in the "More" menu: its own button is not drawn, but its own
     * menu stays mounted here, so it opens from "More" and keeps its state.
     */
    trigger?: boolean;
    /** Filled with a function opening the action's own menu on an anchor, focus returning to it. */
    opener?: Ref<(anchor: HTMLElement) => void>;
}
