// @vitest-environment jsdom
import { resolve } from 'node:path';
import postcss from 'postcss';
import { compile } from 'sass';
import { afterEach, describe, expect, it } from 'vitest';

// Exercise the selectors emitted from both production sheets. Checking only MUI elevation
// misses global surface rules that put the outline/shadow back on a scrolled header.
const styles = postcss.parse(
    ['src/apps/modern/surfaceMaterial.scss', 'src/components/OffsetAppBar.scss']
        .map((path) => compile(resolve(path)).css)
        .join('\n')
);

function declarations(bar: HTMLElement, property: string) {
    const values: string[] = [];
    styles.walkRules((rule) => {
        if (bar.matches(rule.selector)) {
            rule.walkDecls(property, (decl) => {
                values.push(decl.value);
            });
        }
    });
    return values;
}

afterEach(() => {
    document.body.replaceChildren();
    delete document.documentElement.dataset.rfSurfaceBorder;
    delete document.documentElement.dataset.rfSurfaceElevation;
});

describe.each(['level0', 'level1', 'level2', 'level3'])(
    'header separators under global %s and hairline',
    (level) => {
        it.each([
            { separator: 'none', elevation: 0, legacy: false, hairline: false },
            {
                separator: 'hairline',
                elevation: 0,
                legacy: false,
                hairline: true
            },
            {
                separator: 'shadow',
                elevation: 4,
                legacy: true,
                hairline: false
            },
            // A surface at rest also uses colorDefault, but has no scrolled shadow.
            {
                separator: 'shadow',
                elevation: 0,
                legacy: false,
                hairline: false
            },
            {
                separator: undefined,
                elevation: 4,
                legacy: true,
                hairline: false
            },
            {
                separator: undefined,
                elevation: 0,
                legacy: true,
                hairline: false
            }
        ])(
            '$separator with MUI elevation $elevation',
            ({ separator, elevation, legacy, hairline }) => {
                document.documentElement.dataset.rfSurfaceBorder = 'hairline';
                document.documentElement.dataset.rfSurfaceElevation = level;
                const bar = document.createElement('header');
                bar.className = `MuiAppBar-root MuiAppBar-colorDefault MuiPaper-elevation${elevation}`;
                if (separator) bar.dataset.rfHeaderSeparator = separator;
                document.body.appendChild(bar);

                expect(declarations(bar, 'box-shadow')).toEqual(
                    legacy ? [`var(--rf-elevation-${level}, none)`] : []
                );
                expect(declarations(bar, 'outline')).toHaveLength(
                    legacy ? 1 : 0
                );
                expect(declarations(bar, 'border-bottom')).toHaveLength(
                    hairline ? 1 : 0
                );
            }
        );
    }
);
