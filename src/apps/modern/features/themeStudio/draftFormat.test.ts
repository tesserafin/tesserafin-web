import { describe, expect, it } from 'vitest';

import {
    DRAFT_FORMAT_VERSION,
    parseDraft,
    serialiseDraft
} from './draftFormat';
import { createDraft } from './draftState';
import { getOfficialSource } from './officialSources';

/** Narrowed at the boundary, so every use below is typed rather than repeatedly guarded. */
function requireSource(id: string) {
    const source = getOfficialSource(id);
    if (!source) throw new Error(`${id} must be a startable source`);
    return source;
}

const classic = requireSource('official.classic');

const draft = createDraft(classic, 'Round trip', 'Local author');
const validText = serialiseDraft(draft);

function mutate(change: (envelope: Record<string, unknown>) => void): string {
    const envelope = JSON.parse(validText) as Record<string, unknown>;
    change(envelope);
    return JSON.stringify(envelope);
}

describe('export / import round trip', () => {
    it('re-imports an exported draft unchanged', () => {
        const result = parseDraft(validText);
        expect(result.issues).toEqual([]);
        expect(result.valid && serialiseDraft(result.draft)).toBe(validText);
    });

    it('exports a manifest that is a real v2 theme, not a Studio dialect', () => {
        expect(JSON.parse(validText).manifest.contractVersion).toBe(2);
    });

    it('is stable — re-exporting an unchanged draft produces identical bytes', () => {
        expect(serialiseDraft(draft)).toBe(validText);
    });
});

/*
 * THEME-IDENTITY-1 added `itemDetails.facts` and the `immersive` hero, and made `navigation.shell`
 * a layout input. A Glass-based draft carries all three; export/import must keep them, and an old
 * draft that never heard of them must still import (backward compatibility).
 */
describe('export / import keeps the THEME-IDENTITY-1 keys', () => {
    const glassDraft = createDraft(
        requireSource('official.glass'),
        'Glass copy',
        'Local author'
    );

    it('round-trips immersive, inline facts and the topbar shell', () => {
        const result = parseDraft(serialiseDraft(glassDraft));
        expect(result.issues).toEqual([]);
        const presentation = result.valid
            ? result.draft.manifest.presentation
            : undefined;
        expect(presentation?.page?.itemDetails?.hero).toBe('immersive');
        expect(presentation?.page?.itemDetails?.facts).toBe('inline');
        expect(presentation?.navigation?.shell).toBe('topbar');
        expect(presentation?.page?.itemDetails?.controls).toBe('pill');
        expect(presentation?.page?.itemDetails?.people).toBe('portraits');
    });

    it('still imports a draft written before facts existed', () => {
        const legacy = mutate((envelope) => {
            const manifest = envelope.manifest as {
                presentation?: {
                    page?: { itemDetails?: Record<string, unknown> };
                };
            };
            delete manifest.presentation?.page?.itemDetails?.facts;
        });
        expect(parseDraft(legacy).issues).toEqual([]);
    });

    it('rejects an unknown facts value rather than importing it', () => {
        const hostile = mutate((envelope) => {
            const manifest = envelope.manifest as {
                presentation: {
                    page: { itemDetails: Record<string, unknown> };
                };
            };
            manifest.presentation.page.itemDetails.facts = 'chips';
        });
        expect(parseDraft(hostile).valid).toBe(false);
    });
});

describe('export / import keeps the THEME-A1 keys', () => {
    it('round-trips section titles, title lines, tabs and grid sizes', () => {
        const edited = mutate((envelope) => {
            const manifest = envelope.manifest as {
                presentation: Record<string, Record<string, unknown>>;
            };
            manifest.presentation.sectionTitle = {
                size: 'small',
                align: 'center',
                case: 'uppercase'
            };
            manifest.presentation.grid = { people: 'large', library: 'small' };
            manifest.presentation.mediaCard.titleLines = 2;
            manifest.presentation.navigation.tabs = 'pills';
        });
        const first = parseDraft(edited);
        expect(first.issues).toEqual([]);
        if (!first.valid) throw new Error('must import');
        const again = parseDraft(serialiseDraft(first.draft));
        expect(again.issues).toEqual([]);
        const presentation = again.valid
            ? again.draft.manifest.presentation
            : undefined;
        expect(presentation?.sectionTitle).toEqual({
            size: 'small',
            align: 'center',
            case: 'uppercase'
        });
        expect(presentation?.grid).toEqual({
            people: 'large',
            library: 'small'
        });
        expect(presentation?.mediaCard?.titleLines).toBe(2);
        expect(presentation?.navigation?.tabs).toBe('pills');
    });

    it('still imports a draft written before any of them existed', () => {
        // `validText` is a Classic copy, and Classic declares none of the four.
        const presentation = JSON.parse(validText).manifest.presentation;
        expect(presentation.sectionTitle).toBeUndefined();
        expect(presentation.grid).toBeUndefined();
        expect(parseDraft(validText).issues).toEqual([]);
    });

    it.each([
        ['an unknown title size', { sectionTitle: { size: 'huge' } }],
        ['an unknown grid context', { grid: { posters: 'large' } }],
        ['a title-line count as a string', { mediaCard: { titleLines: '2' } }],
        ['four title lines', { mediaCard: { titleLines: 4 } }],
        ['an unknown tab style', { navigation: { tabs: 'ribbon' } }]
    ])('rejects %s rather than importing it', (_name, change) => {
        const hostile = mutate((envelope) => {
            const manifest = envelope.manifest as {
                presentation: Record<string, Record<string, unknown>>;
            };
            for (const [group, values] of Object.entries(change)) {
                manifest.presentation[group] = {
                    ...manifest.presentation[group],
                    ...values
                };
            }
        });
        expect(parseDraft(hostile).valid).toBe(false);
    });
});

describe('malformed and hostile input is rejected, never partially accepted', () => {
    it('rejects truncated JSON', () => {
        expect(parseDraft(validText.slice(0, 80)).issues[0].code).toBe(
            'malformed-json'
        );
    });

    it('rejects an empty file', () => {
        expect(parseDraft('').issues[0].code).toBe('malformed-json');
    });

    it('rejects a JSON array', () => {
        expect(parseDraft('[]').issues[0].code).toBe('not-an-object');
    });

    it('rejects a file that is not a theme draft at all', () => {
        const result = parseDraft(JSON.stringify({ hello: 'world' }));
        expect(result.valid).toBe(false);
        expect(result.issues[0].message).toContain(
            'not a Tesserafin theme draft'
        );
    });

    it('rejects an unknown draft format version', () => {
        const result = parseDraft(
            mutate((envelope) => {
                envelope.formatVersion = DRAFT_FORMAT_VERSION + 99;
            })
        );
        expect(result.issues[0].code).toBe('unsupported-contract-version');
    });

    it('rejects a draft with no provenance', () => {
        const result = parseDraft(
            mutate((envelope) => {
                delete envelope.basedOn;
            })
        );
        expect(result.valid).toBe(false);
        expect(result.issues[0].path).toBe('$.basedOn');
    });

    it('rejects a v1 manifest inside a draft envelope', () => {
        const result = parseDraft(
            mutate((envelope) => {
                const manifest = envelope.manifest as Record<string, unknown>;
                delete manifest.contractVersion;
            })
        );
        expect(
            result.issues.some(
                (issue) => issue.code === 'unsupported-contract-version'
            )
        ).toBe(true);
    });

    it('rejects an invalid token value', () => {
        const result = parseDraft(
            mutate((envelope) => {
                const tokens = envelope.tokens as {
                    spacing: Record<string, string>;
                };
                tokens.spacing.md = '16'; // no unit
            })
        );
        expect(result.valid).toBe(false);
        expect(
            result.issues.some((issue) => issue.message.includes('spacing.md'))
        ).toBe(true);
    });

    it.each([
        [
            'a <script> element',
            '{"kind":"tesserafin-theme-draft","x":"<script>a()</script>"}'
        ],
        [
            'a javascript: URL',
            '{"kind":"tesserafin-theme-draft","x":"javascript:alert(1)"}'
        ],
        [
            'a network URL',
            '{"kind":"tesserafin-theme-draft","x":"https://example.invalid"}'
        ],
        ['an eval() call', '{"kind":"tesserafin-theme-draft","x":"eval(y)"}']
    ])('rejects %s before parsing', (_what, raw) => {
        expect(parseDraft(raw).issues[0].code).toBe('executable-surface');
    });

    it('rejects an unknown key smuggled into the manifest', () => {
        const result = parseDraft(
            mutate((envelope) => {
                (envelope.manifest as Record<string, unknown>).hooks = {
                    onApply: 'x'
                };
            })
        );
        expect(result.valid).toBe(false);
    });
});
