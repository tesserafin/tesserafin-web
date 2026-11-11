/**
 * THEME-B2 browser checks (ad hoc, not committed). Copied into tests/itemDetailsBrowser to run.
 *
 * Real production build, server-free fixture, with artwork and a LONG Home (hero + four shelves)
 * and a long Item Details (long synopsis, 24 similar items), so scrolling is real.
 *
 *   B2_OUT=<dir> B2_ART=<dir with backdrop.jpg, poster.jpg> [B2_ONLY=<variant id>] [B2_BASE=1]
 *
 * B2_BASE=1 runs only the default variants (for the parent build), whose header must measure the same.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

import classicManifest from '../../tesserafin-design/themes/classic/theme.json';
import glassManifest from '../../tesserafin-design/themes/glass/theme.json';
import { formatViolations, scanPage } from '../e2e/support/axe';
import { MOVIE, SERVER_ID, USER_ID, installFixtureApi } from './support/fixtureApi';

const DIST = resolve(__dirname, '../../dist');
const OUT = resolve(process.env.B2_OUT as string);
const ART = resolve(process.env.B2_ART as string);
mkdirSync(OUT, { recursive: true });
const BACKDROP = readFileSync(join(ART, 'backdrop.jpg'));
const POSTER = readFileSync(join(ART, 'poster.jpg'));
const APPLIED_KEY = 'tesserafin.themeStudio.appliedPresentation';
const LONG_SERVER = 'Médiathèque familiale du grand salon de Marguerite et Jean-Baptiste';
const LONG_DEVICE = 'Téléviseur OLED du salon principal (rez-de-chaussée)';

(MOVIE as Record<string, unknown>).ImageTags = { Primary: 'p' };
(MOVIE as Record<string, unknown>).BackdropImageTags = ['b'];
(MOVIE as Record<string, unknown>).Overview = Array.from(
    { length: 6 },
    () =>
        'Une famille découvre, au fil d’un été qui n’en finit pas, que la maison héritée garde la mémoire de chacun de ceux qui y ont vécu.'
).join(' ');

type P = Record<string, unknown>;
const glass = glassManifest.presentation as P;
const classic = classicManifest.presentation as P;
const withHeader = (p: P, header: P) => ({ ...p, header });
const immersive = (p: P) => ({
    ...p,
    page: {
        ...(p.page as P),
        itemDetails: { ...((p.page as P).itemDetails as P), hero: 'immersive' },
        home: { ...((p.page as P).home as P), sections: ['hero', 'continueWatching', 'nextUp', 'latestMedia', 'libraries'] }
    }
});

const ALL = [
    { id: 'classic', theme: 'official.classic', p: classic, base: true },
    { id: 'glass', theme: 'official.glass', p: glass, base: true },
    { id: 'classic-centered-labels', theme: 'official.classic', p: withHeader(classic, { layout: 'centered', actions: { labels: 'iconsAndLabels' } }) },
    { id: 'glass-centered-labels-overflow', theme: 'official.glass', p: withHeader(glass, { layout: 'centered', actions: { labels: 'iconsAndLabels', grouping: 'overflow' }, overlap: 'hero', shape: 'floating' }) },
    { id: 'glass-centered', theme: 'official.glass', p: withHeader(glass, { layout: 'centered', nav: { style: 'underline' } }) },
    { id: 'glass-overflow', theme: 'official.glass', p: withHeader(glass, { actions: { grouping: 'overflow' } }) },
    { id: 'glass-overlap', theme: 'official.glass', p: withHeader(glass, { overlap: 'hero' }) },
    {
        id: 'classic-everything',
        theme: 'official.classic',
        p: withHeader(immersive(classic), {
            shape: 'floating',
            density: 'comfortable',
            overlap: 'hero',
            layout: 'centered',
            actions: { labels: 'iconsAndLabels', grouping: 'overflow' }
        })
    }
];
const VARIANTS = ALL.filter(
    (v) => (process.env.B2_BASE ? v.base : true) && (!process.env.B2_ONLY || v.id === process.env.B2_ONLY)
);
const VIEWPORTS = [
    { id: 'desktop', width: 1440, height: 900 },
    { id: 'narrow', width: 1000, height: 800 }, // md..lg: the toolbar may wrap
    { id: 'phone', width: 390, height: 844 },
    { id: 'w320', width: 320, height: 640 },
    { id: 'zoom400', width: 320, height: 256 } // 1280×1024 at 400 %: the same CSS viewport
];

async function extend(page: Page, opts: { german: boolean; longNames: boolean }) {
    await page.route('**/Items/*/Images/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'image/jpeg',
            body: /\/Images\/Backdrop/i.test(route.request().url()) ? BACKDROP : POSTER
        })
    );
    const items = Array.from({ length: 24 }, (_, i) => ({
        ...MOVIE,
        Id: i === 0 ? MOVIE.Id : `b2-${i}`,
        Name: i === 0 ? MOVIE.Name : `Film ${i}`,
        ImageTags: { Primary: 'p' },
        BackdropImageTags: ['b'],
        UserData: { ...MOVIE.UserData, PlaybackPositionTicks: i < 12 ? 3_000_000_000 : 0, PlayedPercentage: 30 }
    }));
    const views = ['Films', 'Séries', 'Musique', 'Livres audio'].map((Name, i) => ({
        Id: `view-${i}`,
        Name,
        CollectionType: ['movies', 'tvshows', 'music', 'books'][i],
        Type: 'CollectionFolder',
        ServerId: SERVER_ID
    }));
    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.toLowerCase();
        const json = (body: unknown) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        const list = (Items: unknown[]) => json({ Items, TotalRecordCount: Items.length, StartIndex: 0 });
        if (route.request().method() !== 'GET') return route.fallback();
        if (opts.longNames && (path === '/system/info/public' || path === '/system/info'))
            return json({ Id: SERVER_ID, ServerName: LONG_SERVER, Version: '1.0.0', ProductName: 'Reefin', StartupWizardCompleted: true });
        if (path === '/userviews') return list(views);
        if (path === '/items/latest') return json(items.slice(12));
        if (path === '/useritems/resume' || path === '/items/resume') return list(items.slice(0, 12));
        if (path === '/shows/nextup') return list(items.slice(6, 18));
        if (/\/items\/[^/]+\/similar$/.test(path)) return list(items.slice(1));
        return route.fallback();
    });
    await page.addInitScript(
        ([user, german]) => {
            if (german) localStorage.setItem(`${user}-language`, 'de');
            localStorage.setItem(`${user}-detailsBanner`, 'true');
        },
        [USER_ID, opts.german] as const
    );
}

async function open(page: Page, v: (typeof ALL)[number], where: 'home' | 'details', opts = { german: false, longNames: false }) {
    await page.addInitScript(
        ([id, key, value]) => {
            localStorage.setItem(key as string, value as string);
            document.documentElement.setAttribute('data-rf-theme', id as string);
        },
        [v.theme, APPLIED_KEY, JSON.stringify(v.p)] as const
    );
    await installFixtureApi(page, process.env.B2_ORIGIN as string, DIST);
    await extend(page, opts);
    if (where === 'home') {
        await page.goto('/#/home');
        await page.waitForSelector('.rf-home-composition [data-rf-slot="media-card"]', { timeout: 30_000 });
    } else {
        await page.goto(`/#/details?id=${MOVIE.Id}&serverId=${SERVER_ID}`);
        await page.waitForSelector('.rf-item-details [data-detail-section="nameContainer"] h1', { timeout: 30_000 });
    }
    if (v.theme !== 'official.classic') {
        const tier = readdirSync(DIST).find((n) => n.startsWith('theme-colorscheme-official-glass.') && n.endsWith('.css'));
        await page.addStyleTag({ content: readFileSync(join(DIST, tier as string), 'utf8') });
        await page.evaluate((id) => document.documentElement.setAttribute('data-rf-theme', id), v.theme);
    }
    await page.waitForTimeout(900);
}

const measure = (page: Page) =>
    page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('header.MuiAppBar-root');
        const r = bar?.getBoundingClientRect();
        const cs = bar ? getComputedStyle(bar) : null;
        const controls = [...(bar?.querySelectorAll<HTMLElement>('a[href], button') ?? [])]
            .filter((e) => e.getClientRects().length > 0)
            .map((e) => {
                const b = e.getBoundingClientRect();
                return {
                    name: e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 40),
                    x: Math.round(b.left),
                    y: Math.round(b.top),
                    w: Math.round(b.width),
                    h: Math.round(b.height),
                    inView: b.right <= window.innerWidth + 0.5 && b.left >= -0.5
                };
            });
        // Anything readable or operable in the PAGE that sits under the header's box.
        const under = r
            ? [...document.querySelectorAll<HTMLElement>('main h1, main h2, main a[href], main button, main p')]
                  .filter((e) => !bar?.contains(e) && e.getClientRects().length > 0)
                  .filter((e) => {
                      const b = e.getBoundingClientRect();
                      return b.width > 0 && b.height > 0 && b.top < r.bottom - 0.5 && b.bottom > r.top + 0.5 && b.left < r.right && b.right > r.left;
                  })
                  .map((e) => `${e.tagName.toLowerCase()} "${e.textContent?.trim().slice(0, 30)}"`)
            : [];
        const lead = document.querySelector<HTMLElement>('.rf-item-details__backdrop, .rf-home-hero');
        return {
            attrs: { ...bar?.dataset },
            htmlOverlap: document.documentElement.getAttribute('data-rf-header-overlap'),
            footprintVar: document.documentElement.style.getPropertyValue('--rf-header-footprint'),
            box: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) },
            background: cs?.backgroundColor,
            shadow: cs?.boxShadow !== 'none',
            layout: bar?.querySelector<HTMLElement>('[data-rf-header-layout]')?.dataset.rfHeaderLayout ?? 'start',
            controls,
            smallestTarget: Math.min(...controls.map((c) => Math.min(c.w, c.h))),
            hiddenControls: controls.filter((c) => !c.inView).map((c) => c.name),
            underHeader: under,
            leadTop: lead ? Math.round(lead.getBoundingClientRect().top) : null,
            scrollY: Math.round(window.scrollY || document.scrollingElement?.scrollTop || 0),
            scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
            overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
    });

/** Focus order through the header vs its visual order (rows top to bottom, then left to right). */
async function keyboardOrder(page: Page) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab'); // skip link or first control
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
        const info = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            const bar = document.querySelector('header.MuiAppBar-root');
            if (!el || !bar?.contains(el)) return null;
            const b = el.getBoundingClientRect();
            return { name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '', y: Math.round(b.top), b: Math.round(b.bottom), x: Math.round(b.left) };
        });
        if (info) seen.push(JSON.stringify(info));
        else if (seen.length) break;
        await page.keyboard.press('Tab');
    }
    const focus = seen.map((s) => JSON.parse(s) as { name: string; y: number; b: number; x: number });
    // Same line when the two boxes share any vertical band; then left to right.
    const visual = [...focus].sort((a, c) => (a.b <= c.y || c.b <= a.y ? a.y - c.y : a.x - c.x));
    return { focus: focus.map((f) => f.name), visual: visual.map((f) => f.name) };
}

for (const v of VARIANTS) {
    for (const vp of VIEWPORTS) {
        for (const where of ['home', 'details'] as const) {
            test(`${v.id} ${vp.id} ${where}`, async ({ page }) => {
                await page.setViewportSize(vp);
                await open(page, v, where);
                const tag = `${v.id}-${vp.id}-${where}`;
                const rest = await measure(page);
                await page.screenshot({ path: join(OUT, `${tag}-rest.png`) });
                // A REAL scroll: the page must be long enough, and the window must have moved.
                await page.mouse.move(vp.width / 2, vp.height / 2);
                await page.mouse.wheel(0, Math.min(1400, vp.height * 2));
                await page.waitForTimeout(600);
                const scrolled = await measure(page);
                await page.screenshot({ path: join(OUT, `${tag}-scrolled.png`) });
                const keys = vp.id === 'desktop' || vp.id === 'narrow' ? await keyboardOrder(page) : null;
                writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ rest, scrolled, keys }, null, 1));

                expect(rest.overflowX, 'horizontal scroll').toBe(false);
                expect(rest.hiddenControls, 'controls out of view').toEqual([]);
                expect(rest.underHeader, 'page content under the header').toEqual([]);
                expect(scrolled.scrollY, 'the page really scrolled').toBeGreaterThan(200);
                expect(rest.smallestTarget, 'target size').toBeGreaterThanOrEqual(44);
                if (keys) expect(keys.focus).toEqual(keys.visual);
                const wantsOverlap = (v.p as { header?: { overlap?: string } }).header?.overlap === 'hero';
                const wide = vp.width >= 900;
                // Only Item Details with the immersive band is a compatible page; Home keeps its spacer.
                const overlapping = wantsOverlap && wide && where === 'details';
                expect(rest.htmlOverlap, 'overlap applied').toBe(overlapping ? 'hero' : null);
                if (overlapping) expect(rest.leadTop, 'artwork starts under the bar').toBeLessThanOrEqual(0);
            });
        }
    }
}

test.describe('long content', () => {
    for (const v of VARIANTS) {
        for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[3]]) {
            test(`${v.id} ${vp.id} German + long server name`, async ({ page }) => {
                await page.setViewportSize(vp);
                await open(page, v, 'details', { german: true, longNames: true });
                const rest = await measure(page);
                await page.screenshot({ path: join(OUT, `${v.id}-${vp.id}-long.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 320) } });
                writeFileSync(join(OUT, `${v.id}-${vp.id}-long.json`), JSON.stringify(rest, null, 1));
                expect(rest.overflowX).toBe(false);
                expect(rest.hiddenControls).toEqual([]);
                expect(rest.underHeader).toEqual([]);
            });
        }
    }
});

test.describe('menus by keyboard, axe on the header', () => {
    for (const v of VARIANTS) {
        test(`${v.id} desktop`, async ({ page }) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await open(page, v, 'details');
            const log: string[] = [];
            const axe: string[] = [];
            // Scope: the header, which is what B2 changes; the page under it is other lots' gate.
            // Open menus are portalled to <body>, so they are scanned with it.
            const scan = async (state: string) => {
                const open = await page.locator('[role="menu"]:visible').count();
                const result = await scanPage(page, open ? ['header.MuiAppBar-root', '.MuiPopover-root'] : ['header.MuiAppBar-root']);
                axe.push(`${state}: ${result.violations.length} violation(s), ${result.passCount} passes\n${formatViolations(result)}`);
                return result.violations.length;
            };
            expect(await scan('rest')).toBe(0);

            for (const name of ['User Menu', 'More']) {
                const button = page.locator(`header button[aria-label="${name}"], header button:has-text("${name}")`).first();
                if (!(await button.count())) continue;
                await button.focus();
                await page.keyboard.press('Enter');
                await page.locator('[role="menu"]:visible').first().waitFor({ timeout: 5000 });
                log.push(`${name}: opened, focus on ${await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30))}`);
                expect(await scan(`${name} open`)).toBe(0);
                if (name !== 'User Menu') {
                    // Choose the first item: the action's own menu opens; Escape gives focus back to More.
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(400);
                    const own = await page.locator('[role="menu"]:visible').count();
                    log.push(`${name}: item chosen, visible menus = ${own}, focus on ${await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30))}`);
                    expect(own, 'the action’s own menu opened').toBe(1);
                }
                await page.keyboard.press('Escape');
                await page.waitForTimeout(400);
                const back = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim());
                log.push(`${name}: closed, focus back on ${back}`);
                expect(back).toBe(await button.evaluate((b) => b.getAttribute('aria-label') ?? b.textContent?.trim()));
            }
            await page.mouse.wheel(0, 1200);
            await page.waitForTimeout(500);
            expect(await scan('scrolled')).toBe(0);
            writeFileSync(join(OUT, `${v.id}-menus.txt`), `${log.join('\n')}\n\n${axe.join('\n')}`);
        });
    }
});
