#!/usr/bin/env node
/**
 * Consolidation step 0 / step 3 ratchet (tesserafin#129, #306): the files that import the two legacy
 * API clients - `@jellyfin/sdk` and `jellyfin-apiclient` - may only become fewer.
 *
 * Every source file under `src/` that imports either package (static `import ... from`, `export ...
 * from`, dynamic `import()` or `require()`) is measured and compared with
 * `scripts/legacy-sdk-imports-baseline.json`, the named list of existing exceptions:
 *
 *   - a file that is not in the baseline fails (new coupling to a client being removed);
 *   - a baseline entry that no longer imports either package fails too, so the baseline is edited in
 *     the same change and can only shrink.
 *
 * New code reaches the server through the generated Tesserafin SDK (`lib/tesserafin-sdk`) configured
 * from a `TesserafinApi`. Never add an entry to the baseline to make this pass.
 *
 * `--write` prints the measured list instead of checking it (for writing a baseline that only
 * removes entries).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'scripts', 'legacy-sdk-imports-baseline.json');
const LEGACY = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"](?:@jellyfin\/sdk|jellyfin-apiclient)(?:\/[^'"]*)?['"]/m;
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

export function measure(sourceRoot = path.join(root, 'src')) {
    const found = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) {
                if (name !== 'node_modules') walk(full);
            } else if (EXTENSIONS.has(path.extname(name)) && LEGACY.test(readFileSync(full, 'utf8'))) {
                found.push(path.relative(root, full).split(path.sep).join('/'));
            }
        }
    };
    walk(sourceRoot);
    return found.sort();
}

export function compare(measured, baseline) {
    const allowed = new Set(baseline);
    const current = new Set(measured);
    return [
        ...measured.filter((file) => !allowed.has(file)).map((file) => `NEW  ${file} - import the generated Tesserafin SDK instead; the baseline only shrinks.`),
        ...baseline.filter((file) => !current.has(file)).map((file) => `GONE ${file} - delete it from scripts/legacy-sdk-imports-baseline.json in this change.`)
    ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const measured = measure();
    if (process.argv.includes('--write')) {
        process.stdout.write(JSON.stringify({ files: measured }, null, 4) + '\n');
        process.exit(0);
    }
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).files;
    const failures = compare(measured, baseline);
    if (failures.length > 0) {
        console.error(`verify:legacy-sdk-imports - FAIL (${failures.length})\n${failures.join('\n')}`);
        process.exit(1);
    }
    console.log(`verify:legacy-sdk-imports - OK: ${measured.length} file(s) import a legacy API client, all named in the baseline.`);
}
