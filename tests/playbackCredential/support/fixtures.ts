/**
 * Web-owned media fixtures for the #153-A1 browser matrix.
 *
 * WHY THE WEB REPOSITORY SEEDS THESE. `ci/serve-e2e.sh` (server repository) seeds four video
 * fixtures. Direct audio, universal audio, attachments and fonts have none, so half the families
 * A1 migrated could not be exercised at all. Editing the rig means a SERVER branch and the whole
 * server gate set for what is purely test scaffolding — and it is unnecessary: the rig and the
 * browser share a host, and the server exposes library creation and encoding configuration through
 * its public API. Zero server files change.
 *
 * Everything here is synthesized with ffmpeg into a throwaway directory, added through
 * `POST /Library/VirtualFolders`, and removed again afterwards.
 */
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from '@playwright/test';

import type { Admin } from './rig';

/** A font that exists on any Debian-family host with `fonts-dejavu-core`. */
const SYSTEM_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

function ffmpeg(args: string[]): void {
    const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        // ffmpeg's stderr names the failure; it contains no credential.
        throw new Error(`ffmpeg failed: ${result.stderr?.slice(0, 400)}`);
    }
}

export interface SeededLibrary {
    /** The directory the server was pointed at. */
    root: string;
    /** Item names the library should expose once the scan settles. */
    itemNames: string[];
    /**
     * Remove the temporary media AND the virtual folder.
     *
     * Deleting only the directory is what every version of these fixtures used to do, and it is
     * why a rig that has run one spec twice starts failing: the folder survives, the scan still
     * lists the DISPOSED item, `mediaItemIdByName` resolves it, and playback answers 404 on a
     * file that is not there any more. Async because removing the folder is a server call.
     */
    dispose: () => Promise<void>;
}

/** Remove a virtual folder, ignoring the case where it is already gone. */
async function removeLibrary(a: Admin, name: string): Promise<void> {
    await a.api
        .delete('/Library/VirtualFolders', {
            headers: authed(a),
            params: { name, refreshLibrary: 'false' }
        })
        .catch(() => undefined);
}

function authed(a: Admin) {
    return {
        Authorization: `MediaBrowser Client="Tesserafin Web", Device="a1-fixtures", DeviceId="a1-fixtures", Version="0.0.0", Token="${a.token}"`
    };
}

async function addLibrary(
    a: Admin,
    name: string,
    collectionType: string,
    path: string
): Promise<void> {
    const res = await a.api.post('/Library/VirtualFolders', {
        headers: { ...authed(a), 'Content-Type': 'application/json' },
        params: {
            name,
            collectionType,
            paths: path,
            refreshLibrary: 'true'
        },
        data: {
            LibraryOptions: {
                EnableRealtimeMonitor: false,
                EnableChapterImageExtraction: false,
                ExtractChapterImagesDuringLibraryScan: false
            }
        }
    });
    expect(res.ok(), `library "${name}" must be created`).toBe(true);
}

/**
 * The id of the seeded MEDIA item, never the folder.
 *
 * Each fixture lives in a directory named after it, so the scan produces BOTH a folder and the item
 * inside it. `itemIdByName` takes the first match, which was the folder — whose detail page has no
 * play control, and the matrix then waited ten minutes for a button that was never coming.
 */
export async function mediaItemIdByName(
    a: Admin,
    name: string,
    includeItemTypes: 'Video' | 'Audio' | 'AudioBook'
): Promise<string> {
    const res = await a.api.get(`/Users/${a.userId}/Items`, {
        headers: authed(a),
        params: {
            searchTerm: name,
            recursive: 'true',
            includeItemTypes,
            limit: '10'
        }
    });
    expect(res.ok(), `media lookup for ${name}`).toBe(true);
    const items = (await res.json()).Items as Array<{
        Id: string;
        Name: string;
        Type: string;
    }>;
    const match = items.find((i) => i.Name.includes(name));
    expect(
        match,
        `a ${includeItemTypes} item named "${name}" must exist; found ${items
            .map((i) => `${i.Name}:${i.Type}`)
            .join(', ')}`
    ).toBeTruthy();
    return match!.Id;
}

/** Poll `/Items` until every expected name has indexed. The scan is asynchronous. */
async function waitForItems(
    a: Admin,
    names: string[],
    timeoutMs = 90_000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const missing = new Set(names);
    while (Date.now() < deadline && missing.size > 0) {
        for (const name of [...missing]) {
            const res = await a.api.get(`/Users/${a.userId}/Items`, {
                headers: authed(a),
                params: { searchTerm: name, recursive: 'true', limit: '10' }
            });
            if (res.ok()) {
                const items = (await res.json()).Items as Array<{
                    Name: string;
                }>;
                if (items.some((i) => i.Name.includes(name)))
                    missing.delete(name);
            }
        }
        if (missing.size > 0) await new Promise((r) => setTimeout(r, 1_500));
    }
    expect(
        [...missing],
        'every seeded fixture must index before the matrix runs'
    ).toEqual([]);
}

/**
 * A music library with one real audio file.
 *
 * Exercises BOTH audio families: the web plays music through `/Audio/{id}/universal` (built before
 * any PlaybackInfo call, with a client-invented play session and no media source named), and falls
 * back to `/Audio/{id}/stream` when it direct-plays.
 *
 * `label` NAMES THE LIBRARY, and two callers in one server run must not share one. `dispose()`
 * deletes the temp directory but leaves the library registered, so a second caller reusing the same
 * name re-seeds a library whose old item still resolves - and that dead item answers 404 for its
 * media. Measured: adding a second audio-seeding spec made `matrix.spec.ts` fail with a 404 on
 * `/Audio/{id}/universal` while the spec that ran first passed.
 */
export async function seedAudioLibrary(
    a: Admin,
    label = 'A1 Audio',
    /**
     * `mp3` is played as it is, from the session's file route. `wma` (WMA v2 in ASF) is decoded by
     * no browser, so the server transcodes it to AAC on the session's HLS route. `mka` (AAC in
     * Matroska) only needs its container changed: an audio remux on the same route.
     */
    format: 'mp3' | 'wma' | 'mka' = 'mp3',
    /**
     * `music` seeds an `Audio` track, which plays through `Playback/Sessions`. `books` seeds an
     * `AudioBook`, which the session journey does not own: it still reaches `/Audio/{id}/universal`.
     */
    collectionType: 'music' | 'books' = 'music'
): Promise<SeededLibrary> {
    const root = mkdtempSync(join(tmpdir(), 'a1-audio-'));
    const name = `${label} Probe`;
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    ffmpeg([
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=8',
        '-c:a',
        { mp3: 'libmp3lame', wma: 'wmav2', mka: 'aac' }[format],
        '-b:a',
        '128k',
        '-metadata',
        `title=${name}`,
        join(dir, `${name}.${format}`)
    ]);
    await addLibrary(a, label, collectionType, root);
    await waitForItems(a, [name]);
    return {
        root,
        itemNames: [name],
        dispose: async () => {
            await removeLibrary(a, label);
            rmSync(root, { recursive: true, force: true });
        }
    };
}

/**
 * A video with an ASS subtitle track AND an attached font.
 *
 * Both the attachment family and the fallback-font family are reached ONLY through
 * `htmlVideoPlayer.renderSsaAss`, which runs only when an ASS/SSA track actually renders through
 * libass. A font file on disk alone exercises nothing — one ASS fixture with an attachment unlocks
 * both.
 */
export async function seedAssLibrary(
    a: Admin,
    label = 'A1 Subtitles'
): Promise<SeededLibrary> {
    if (!existsSync(SYSTEM_FONT)) {
        throw new Error(
            `the ASS fixture needs a system TTF at ${SYSTEM_FONT}; install fonts-dejavu-core`
        );
    }
    const root = mkdtempSync(join(tmpdir(), 'a1-ass-'));
    // The NAME is derived from the label, not fixed: two specs sharing one name made whichever
    // ran second resolve the first one's disposed item and time out on a video that can never
    // load. Same defect `seedAudioLibrary` already carries a note about.
    const name = `${label} Probe`;
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });

    const ass = join(root, 'probe.ass');
    writeFileSync(
        ass,
        [
            '[Script Info]',
            'ScriptType: v4.00+',
            '',
            '[V4+ Styles]',
            'Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, Alignment, MarginL, MarginR, MarginV, Encoding',
            'Style: Default,DejaVu Sans,28,&H00FFFFFF,0,0,2,10,10,10,1',
            '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            'Dialogue: 0,0:00:00.50,0:00:07.00,Default,,0,0,0,,A1 capability probe',
            ''
        ].join('\n'),
        'utf8'
    );

    ffmpeg([
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=320x240:rate=24:duration=8',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=8',
        '-i',
        ass,
        '-attach',
        SYSTEM_FONT,
        '-metadata:s:t:0',
        'mimetype=application/x-truetype-font',
        '-metadata:s:t:0',
        'filename=DejaVuSans.ttf',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-c:s',
        'ass',
        '-metadata',
        `title=${name}`,
        join(dir, `${name}.mkv`)
    ]);

    await addLibrary(a, label, 'homevideos', root);
    await waitForItems(a, [name]);
    return {
        root,
        itemNames: [name],
        dispose: async () => {
            await removeLibrary(a, label);
            rmSync(root, { recursive: true, force: true });
        }
    };
}

/**
 * A video long enough for trickplay, in a library that asks for trickplay extraction.
 *
 * Two details are load-bearing.
 *
 *   * The RUNTIME. `TrickplayManager.CanGenerateTrickplay` refuses anything shorter than the
 *     configured interval, which is 10 s by default; a 60 s fixture clears it with room to spare
 *     and yields six tiles.
 *   * The LIBRARY NAME is unique per call, and the virtual folder is removed on dispose. Every
 *     other fixture here leaves its folder behind, and a repeat run then resolves the PREVIOUS
 *     run's item — whose files were deleted — so playback never starts and the spec fails on a
 *     timeout that says nothing about trickplay. Measured three times before this was fixed.
 */
export interface SeededTrickplayLibrary {
    root: string;
    label: string;
    itemName: string;
    dispose: () => Promise<void>;
}

export async function seedTrickplayLibrary(
    a: Admin,
    prefix = 'A1 Trickplay'
): Promise<SeededTrickplayLibrary> {
    const label = `${prefix} ${Math.random().toString(36).slice(2, 8)}`;
    const itemName = `${label} Probe`;
    const root = mkdtempSync(join(tmpdir(), 'a1-trick-'));
    const dir = join(root, itemName);
    mkdirSync(dir, { recursive: true });
    ffmpeg([
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=640x360:rate=24:duration=60',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=60',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-metadata',
        `title=${itemName}`,
        join(dir, `${itemName}.mp4`)
    ]);

    const res = await a.api.post('/Library/VirtualFolders', {
        headers: { ...authed(a), 'Content-Type': 'application/json' },
        params: {
            name: label,
            collectionType: 'homevideos',
            paths: root,
            refreshLibrary: 'true'
        },
        data: {
            LibraryOptions: {
                EnableRealtimeMonitor: false,
                EnableTrickplayImageExtraction: true,
                ExtractTrickplayImagesDuringLibraryScan: true,
                SaveTrickplayWithMedia: false
            }
        }
    });
    expect(res.ok(), `trickplay library "${label}" must be created`).toBe(true);
    await waitForItems(a, [itemName]);

    return {
        root,
        label,
        itemName,
        dispose: async () => {
            await a.api
                .delete('/Library/VirtualFolders', {
                    headers: authed(a),
                    params: { name: label, refreshLibrary: 'false' }
                })
                .catch(() => undefined);
            rmSync(root, { recursive: true, force: true });
        }
    };
}

/** Run the server's REAL trickplay task and wait until the item reports tiles. */
export async function generateTrickplay(
    a: Admin,
    itemId: string
): Promise<Record<string, unknown>> {
    const tasks = await a.api.get('/ScheduledTasks', { headers: authed(a) });
    expect(tasks.ok(), 'the scheduled task list must be readable').toBe(true);
    const task = (
        (await tasks.json()) as Array<{ Id: string; Key: string }>
    ).find((t) => t.Key === 'RefreshTrickplayImages');
    expect(
        task,
        'the server must expose the RefreshTrickplayImages task'
    ).toBeTruthy();
    const started = await a.api.post(`/ScheduledTasks/Running/${task!.Id}`, {
        headers: authed(a)
    });
    expect(started.ok(), 'the trickplay task must start').toBe(true);

    let resolutions: Record<string, unknown> = {};
    await expect
        .poll(
            async () => {
                const res = await a.api.get(
                    `/Users/${a.userId}/Items/${itemId}`,
                    {
                        headers: authed(a)
                    }
                );
                if (!res.ok()) return 0;
                const body = await res.json();
                resolutions = (body.Trickplay ?? {}) as Record<string, unknown>;
                return Object.keys(resolutions).length;
            },
            {
                timeout: 300_000,
                intervals: [5000],
                message: 'the trickplay task must produce tiles for the fixture'
            }
        )
        .toBeGreaterThan(0);
    return resolutions;
}

/**
 * Turn on the fallback font list and point it at a real directory.
 *
 * `htmlVideoPlayer` only fetches `/FallbackFont/Fonts` when the encoding configuration says
 * `EnableFallbackFont`, so without this the Fonts capability is never minted and the family cannot
 * be proven.
 */
export async function enableFallbackFont(
    a: Admin
): Promise<{ dispose: () => Promise<void> }> {
    const fontDir = mkdtempSync(join(tmpdir(), 'a1-fonts-'));
    copyFileSync(SYSTEM_FONT, join(fontDir, 'DejaVuSans.ttf'));

    const current = await a.api.get('/System/Configuration/encoding', {
        headers: authed(a)
    });
    expect(current.ok(), 'the encoding configuration must be readable').toBe(
        true
    );
    const before = await current.json();

    const res = await a.api.post('/System/Configuration/encoding', {
        headers: { ...authed(a), 'Content-Type': 'application/json' },
        data: { ...before, EnableFallbackFont: true, FallbackFontPath: fontDir }
    });
    expect(res.ok(), 'the fallback font must be enabled').toBe(true);

    return {
        dispose: async () => {
            await a.api.post('/System/Configuration/encoding', {
                headers: { ...authed(a), 'Content-Type': 'application/json' },
                data: before
            });
            rmSync(fontDir, { recursive: true, force: true });
        }
    };
}

export interface SoftwareTuner {
    /** The Live TV channel the tuner's playlist names, as the server indexed it. */
    channelId: string;
    /** Channel streams the server is reading from the tuner right now. */
    openStreams: () => number;
    /** Channel streams the server asked the tuner for so far. */
    streamsOpened: () => number;
    /**
     * The XMLTV guide the tuner serves when started with `guideTitle`: one programme on its channel,
     * airing from a few minutes ago to an hour from now.
     */
    guideUrl: string;
    /** Unregister the tuner host, stop the tuner and remove its fixture. */
    dispose: () => Promise<void>;
}

/**
 * An M3U software tuner on loopback, registered with the rig's server. The channel body is paced
 * at its own bitrate with no Content-Length, which is what a real tuner looks like: served at
 * loopback speed, the server's shared stream reaches the end in milliseconds and deletes what it
 * had just written (scripts/livetv-rig/tuner-server.py says why at length).
 */
export async function startSoftwareTuner(
    a: Admin,
    channelName = 'A1 Live One',
    durationSeconds = 120,
    guideTitle?: string
): Promise<SoftwareTuner> {
    const root = mkdtempSync(join(tmpdir(), 'a1-tuner-'));
    const body = join(root, 'channel1.ts');
    ffmpeg([
        '-f',
        'lavfi',
        '-i',
        `testsrc=size=640x360:rate=25:duration=${durationSeconds}`,
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=440:duration=${durationSeconds}`,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-g',
        '25',
        '-c:a',
        'aac',
        '-shortest',
        '-f',
        'mpegts',
        body
    ]);
    const bytes = readFileSync(body);
    const perTick = Math.max(
        188,
        Math.floor(bytes.length / durationSeconds / 10 / 188) * 188
    );
    let open = 0;
    let opened = 0;
    const sockets = new Set<Socket>();
    const server = createServer((req, res) => {
        if (req.url === '/playlist.m3u') {
            res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
            res.end(
                `#EXTM3U\n#EXTINF:-1 tvg-id="a1-live-1" tvg-name="${channelName}",${channelName}\nhttp://127.0.0.1:${port}/channel1.ts\n`
            );
            return;
        }
        if (req.url === '/guide.xml' && guideTitle) {
            const at = (offsetMinutes: number) =>
                `${new Date(Date.now() + offsetMinutes * 60_000)
                    .toISOString()
                    .replace(/[-:T]/g, '')
                    .slice(0, 14)} +0000`;
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(
                `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n` +
                    `<channel id="a1-live-1"><display-name>${channelName}</display-name></channel>\n` +
                    `<programme start="${at(-5)}" stop="${at(60)}" channel="a1-live-1"><title>${guideTitle}</title></programme>\n` +
                    `</tv>\n`
            );
            return;
        }
        if (req.url !== '/channel1.ts') {
            res.writeHead(404).end();
            return;
        }
        opened += 1;
        open += 1;
        res.writeHead(200, {
            'Content-Type': 'video/mp2t',
            Connection: 'close'
        });
        let offset = 0;
        const timer = setInterval(() => {
            if (offset >= bytes.length) {
                clearInterval(timer);
                res.end();
                return;
            }
            res.write(bytes.subarray(offset, offset + perTick));
            offset += perTick;
        }, 100);
        res.on('close', () => {
            clearInterval(timer);
            open -= 1;
        });
    });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
    );
    const port = (server.address() as AddressInfo).port;

    const added = await a.api.post('/LiveTv/TunerHosts', {
        headers: { ...authed(a), 'Content-Type': 'application/json' },
        data: {
            Url: `http://127.0.0.1:${port}/playlist.m3u`,
            Type: 'm3u',
            FriendlyName: `${channelName} Tuner`,
            ImportFavoritesOnly: false,
            AllowHWTranscoding: false,
            AllowStreamSharing: true,
            EnableStreamLooping: false,
            TunerCount: 3,
            IgnoreDts: true,
            ReadAtNativeFramerate: false
        }
    });
    expect(added.ok(), 'the software tuner must register').toBe(true);
    const tunerHostId = String((await added.json()).Id);

    let channelId = '';
    await expect
        .poll(
            async () => {
                const res = await a.api.get('/LiveTv/Channels', {
                    headers: authed(a),
                    params: { userId: a.userId }
                });
                const items = (await res.json()).Items as Array<{
                    Id: string;
                    Name: string;
                }>;
                channelId = items.find((i) => i.Name === channelName)?.Id ?? '';
                return channelId;
            },
            {
                timeout: 60_000,
                message: `the channel "${channelName}" must be indexed`
            }
        )
        .not.toBe('');

    return {
        channelId,
        openStreams: () => open,
        streamsOpened: () => opened,
        guideUrl: `http://127.0.0.1:${port}/guide.xml`,
        dispose: async () => {
            await a.api
                .delete('/LiveTv/TunerHosts', {
                    headers: authed(a),
                    params: { id: tunerHostId }
                })
                .catch(() => undefined);
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve) => server.close(() => resolve()));
            rmSync(root, { recursive: true, force: true });
        }
    };
}

export interface StrmLibrary extends SeededLibrary {
    /** A `.strm` naming an MP4 the server reads over HTTP: played from the session. */
    playable: string;
    /** A `.strm` naming an endless stream with no known length: refused by the server. */
    unreadable: string;
}

/**
 * A home-videos library of two `.strm` items, whose targets a loopback HTTP server serves
 * (tesserafin#129 audit W1: keep a `.strm` case in the browser validation). One names a finished
 * MP4 the server reads as a remote file; the other names an endless MPEG-TS body with no
 * Content-Length, which no session provider reads - the server refuses it and says why.
 */
export async function seedStrmLibrary(
    a: Admin,
    label = 'W1 Strm'
): Promise<StrmLibrary> {
    const root = mkdtempSync(join(tmpdir(), 'w1-strm-'));
    const media = join(root, 'media');
    mkdirSync(media);
    const film = join(media, 'film.mp4');
    ffmpeg([
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=640x360:rate=25:duration=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=30',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-shortest',
        film
    ]);
    const bytes = readFileSync(film);
    const sockets = new Set<Socket>();
    const server = createServer((req, res) => {
        if (req.url === '/film.mp4') {
            const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
            if (range) {
                const start = Number(range[1]);
                const end = range[2] ? Number(range[2]) : bytes.length - 1;
                res.writeHead(206, {
                    'Content-Type': 'video/mp4',
                    'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
                    'Content-Length': end - start + 1
                });
                res.end(bytes.subarray(start, end + 1));
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Content-Length': bytes.length
            });
            res.end(bytes);
            return;
        }
        if (req.url === '/endless.ts') {
            // No Content-Length, never ends: a live body with no known length.
            res.writeHead(200, { 'Content-Type': 'video/mp2t' });
            const timer = setInterval(
                () => res.write(Buffer.alloc(188 * 10)),
                100
            );
            res.on('close', () => clearInterval(timer));
            return;
        }
        res.writeHead(404).end();
    });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
    );
    const port = (server.address() as AddressInfo).port;

    const library = join(root, 'library');
    const playable = `${label} Playable`;
    const unreadable = `${label} Endless`;
    for (const [name, target] of [
        [playable, `http://127.0.0.1:${port}/film.mp4`],
        [unreadable, `http://127.0.0.1:${port}/endless.ts`]
    ]) {
        mkdirSync(join(library, name), { recursive: true });
        writeFileSync(join(library, name, `${name}.strm`), target + '\n');
    }

    const name = `${label} Library`;
    await removeLibrary(a, name);
    await addLibrary(a, name, 'homevideos', library);
    await waitForItems(a, [playable, unreadable]);

    return {
        root,
        itemNames: [playable, unreadable],
        playable,
        unreadable,
        dispose: async () => {
            await removeLibrary(a, name);
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve) => server.close(() => resolve()));
            rmSync(root, { recursive: true, force: true });
        }
    };
}
