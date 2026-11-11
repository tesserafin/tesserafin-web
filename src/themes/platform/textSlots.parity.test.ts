import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import themeSchema from '../../../tesserafin-design/schema/theme.schema.json';
import classicManifest from '../../../tesserafin-design/themes/classic/theme.json';
import glassManifest from '../../../tesserafin-design/themes/glass/theme.json';
import enUs from '../../strings/en-us.json';
import locales from '../../lib/globalize/locales';

import { validateManifest } from './validateManifest';
import {
    slotTemplateError,
    slotTemplateWarning,
    TEXT_SLOT_IDS,
    TEXT_SLOTS
} from './textSlots';

const defs = themeSchema.$defs as Record<string, Record<string, unknown>>;
const SRC = resolve(__dirname, '../..');

/** Every non-test source file, read once. */
const sources = (() => {
    const files: { path: string; text: string }[] = [];
    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
                files.push({ path, text: readFileSync(path, 'utf8') });
            }
        }
    };
    walk(join(SRC, 'apps'));
    return files;
})();

describe('text slots: registry, schema and call sites agree (THEME-A2)', () => {
    it('lists exactly the registry slots in the schema, with the same kind', () => {
        const schemaSlots = defs.textSlots.properties as Record<
            string,
            { $ref: string }
        >;
        expect(Object.keys(schemaSlots).sort()).toEqual(
            [...TEXT_SLOT_IDS].sort()
        );
        for (const slot of TEXT_SLOT_IDS) {
            expect(schemaSlots[slot].$ref, slot).toBe(
                TEXT_SLOTS[slot].kind === 'title'
                    ? '#/$defs/textTitle'
                    : '#/$defs/textAction'
            );
        }
    });

    it('accepts exactly the locales the application ships, normalised', () => {
        const shipped = locales.map((entry) =>
            entry.lang.replace('_', '-').toLowerCase()
        );
        expect((defs.textLocale as { enum: string[] }).enum).toEqual(shipped);
        expect(shipped).toContain('en-us');
        expect(shipped).not.toContain('en');
    });

    it('defaults every slot to a key the English dictionary has', () => {
        for (const slot of TEXT_SLOT_IDS) {
            expect(
                (enUs as Record<string, string>)[TEXT_SLOTS[slot].key],
                slot
            ).toBeTruthy();
        }
    });

    it('declares a variable for every placeholder of the default key', () => {
        for (const slot of TEXT_SLOT_IDS) {
            const placeholders =
                (enUs as Record<string, string>)[TEXT_SLOTS[slot].key].match(
                    /\{\d+\}/g
                ) ?? [];
            expect(placeholders.length, slot).toBe(
                TEXT_SLOTS[slot].variables?.length ?? 0
            );
        }
    });

    it('is read by a real surface, with its own key, for every slot', () => {
        for (const slot of TEXT_SLOT_IDS) {
            const readers = sources.filter(
                (file) =>
                    file.text.includes(`'${slot}'`) &&
                    file.text.includes(`'${TEXT_SLOTS[slot].key}'`) &&
                    !file.path.includes('themeStudio')
            );
            expect(
                readers.length,
                `${slot} is offered but no page reads it`
            ).toBeGreaterThan(0);
        }
    });

    it('ships official themes without text, which is why no theme layer is read at run time', () => {
        // `useSlotText` reads the applied draft only: an official manifest is not on that path.
        // The day an official theme carries text, `manifests.ts` and the hook must read it.
        expect('text' in classicManifest).toBe(false);
        expect('text' in glassManifest).toBe(false);
    });

    it('offers expand and collapse together', () => {
        expect(TEXT_SLOT_IDS).toContain('details.overview.expand.label');
        expect(TEXT_SLOT_IDS).toContain('details.overview.collapse.label');
    });
});

describe('text slot validation (THEME-A2 §7)', () => {
    it('names the rule a template breaks', () => {
        expect(
            slotTemplateError('home.latestMedia.title', 'Nouveautés')
        ).toMatch('{libraryName} is required');
        expect(
            slotTemplateError('home.latestMedia.title', '{library}')
        ).toMatch('not a variable of this text');
        expect(slotTemplateError('home.nextUp.title', 'À suivre {x}')).toMatch(
            'this text takes none'
        );
        expect(slotTemplateError('home.nextUp.title', '')).toBe(
            'The text is empty.'
        );
        expect(slotTemplateError('home.nextUp.title', 'a }')).toMatch('brace');
        expect(
            slotTemplateError('details.overview.expand.label', 'x'.repeat(81))
        ).toMatch('longer than 80');
        expect(
            slotTemplateError(
                'home.latestMedia.title',
                'Nouveautés · {libraryName}'
            )
        ).toBeNull();
    });

    it('only advises past the recommended length', () => {
        const long = 'x'.repeat(50);
        expect(slotTemplateError('home.nextUp.title', long)).toBeNull();
        expect(slotTemplateWarning('home.nextUp.title', long)).toMatch(
            'recommended 40'
        );
    });

    const manifest = (text: unknown) => ({
        contractVersion: 2,
        id: 'local.test',
        version: '1.0.0',
        name: 'Test',
        author: 'Test',
        license: 'MIT',
        compatibility: { web: '>=0.1.0' },
        modes: ['dark'],
        text
    });

    it('accepts a valid text group and rejects each kind of bad one, on import', () => {
        expect(
            validateManifest(
                manifest({
                    slots: {
                        'home.nextUp.title': {
                            fr: 'À suivre',
                            'fr-ca': 'À suivre!'
                        }
                    }
                })
            ).issues
        ).toEqual([]);
        for (const bad of [
            { slots: { 'home.unknown.title': { fr: 'x' } } },
            { slots: { 'home.nextUp.title': { en: 'Next' } } },
            { slots: { 'home.nextUp.title': {} } },
            { slots: { 'home.nextUp.title': { fr: '' } } },
            { slots: { 'home.latestMedia.title': { fr: 'Nouveautés' } } },
            {
                slots: {
                    'details.overview.expand.label': { fr: 'x'.repeat(81) }
                }
            },
            { other: true }
        ]) {
            expect(
                validateManifest(manifest(bad)).valid,
                JSON.stringify(bad)
            ).toBe(false);
        }
    });

    it('tells the author which slot and language failed, and why', () => {
        const result = validateManifest(
            manifest({ slots: { 'home.latestMedia.title': { nl: 'Nieuw' } } })
        );
        expect(result.issues[0]).toMatchObject({
            code: 'invalid-text-slot',
            path: '$.text.slots.home.latestMedia.title.nl'
        });
        expect(result.issues[0].message).toMatch('home.latestMedia.title (nl)');
    });
});
