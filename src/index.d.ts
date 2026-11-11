declare module '*.png' {
    const value: any;
    export = value;
}

declare module '*.svg' {
    const url: string;
    export default url;
}

declare module '*.scss' {
    // style imports are handled by the bundler
    const value: string;
    export default value;
}

declare module '*.css' {
    // style imports are handled by the bundler
    const value: string;
    export default value;
}

// Side-effect only CSS package (no type declarations, resolved by the bundler).
declare module 'material-design-icons-iconfont';

/*
 * A theme manifest imported as the whole DOCUMENT (the Theme Studio's copy). The query makes it a
 * module of its own, so the start-up bundle's import of the same file can keep only the keys it
 * reads: see `themes/platform/manifests.ts`.
 */
declare module '*theme.json?document' {
    const manifest: unknown;
    export default manifest;
}
