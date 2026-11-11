import { describe, expect, it } from 'vitest';

import { validate } from '../scripts/validate-schema.mjs';

/** THEME-A2 added two keywords to the dependency-free validator; each must actually reject. */
describe('validate-schema: maxLength and propertyNames', () => {
    it('counts maxLength in Unicode code points, not UTF-16 units', () => {
        const schema = { type: 'string', maxLength: 3 };
        expect(validate(schema, '🎬🎬🎬')).toEqual([]);
        expect(validate(schema, '🎬🎬🎬🎬')).toEqual([
            '$: length 4 is above maxLength 3'
        ]);
    });

    it('validates every key against propertyNames', () => {
        const schema = {
            type: 'object',
            propertyNames: { enum: ['fr', 'nl'] },
            additionalProperties: { type: 'string' }
        };
        expect(validate(schema, { fr: 'a', nl: 'b' })).toEqual([]);
        expect(validate(schema, { en: 'a' })).toEqual([
            '$.en: value "en" is not one of ["fr","nl"]'
        ]);
    });
});
