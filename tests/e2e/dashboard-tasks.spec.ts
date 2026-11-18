import { expect, type Page, type Request, test } from '@playwright/test';

import { signIn } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard scheduled tasks pages and the dashboard home's
 * running-tasks widget call the generated Tesserafin SDK (`lib/tesserafin-sdk`) through
 * `useApi().reefinApi` instead of `@jellyfin/sdk`. These cases drive them against a real server and
 * assert that every call the migrated code makes reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

async function expectAuthenticatedOk(
    page: Page,
    pattern: RegExp,
    method: string,
    action: () => Promise<unknown>
) {
    const responsePromise = page.waitForResponse(
        (res) => matches(pattern, method)(res.request()),
        { timeout: 15_000 }
    );
    await action();
    const response = await responsePromise;
    const auth = await response.request().headerValue('authorization');
    expect(auth, `${method} ${pattern} must carry the session token`).toMatch(
        /^MediaBrowser .*Token="[^"]+"/
    );
    expect(
        response.status(),
        `${method} ${response.url()} must succeed`
    ).toBeLessThan(300);
    return response;
}

async function openDashboardRoute(page: Page, route: string) {
    // Same document: a hash-only navigation keeps the authenticated session alive.
    await page.evaluate((hash) => {
        window.location.hash = hash;
    }, `#/dashboard/${route}`);
}

interface Task {
    Id: string;
    Name: string;
    Key: string;
    Triggers?: unknown[];
}

/** A short, harmless task every server registers. */
const SAFE_TASK_KEY = 'CleanActivityLog';

test.describe('dashboard scheduled tasks on the generated SDK', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('tasks: list and start one', async ({ page }) => {
        const listed = await expectAuthenticatedOk(
            page,
            /\/ScheduledTasks$/i,
            'GET',
            () => openDashboardRoute(page, 'tasks')
        );
        const tasks = (await listed.json()) as Task[];
        const task = tasks.find((t) => t.Key === SAFE_TASK_KEY);
        expect(task, `${SAFE_TASK_KEY} task`).toBeDefined();

        const item = page.getByRole('listitem').filter({ hasText: task!.Name });
        await expect(item).toBeVisible({ timeout: 15_000 });
        await expectAuthenticatedOk(
            page,
            new RegExp(`/ScheduledTasks/Running/${task!.Id}$`, 'i'),
            'POST',
            () => item.getByRole('button').last().click()
        );
    });

    test('task: add and remove a trigger', async ({ page }) => {
        const listed = await expectAuthenticatedOk(
            page,
            /\/ScheduledTasks$/i,
            'GET',
            () => openDashboardRoute(page, 'tasks')
        );
        const task = ((await listed.json()) as Task[]).find(
            (t) => t.Key === SAFE_TASK_KEY
        )!;

        const opened = await expectAuthenticatedOk(
            page,
            new RegExp(`/ScheduledTasks/${task.Id}$`, 'i'),
            'GET',
            () => openDashboardRoute(page, `tasks/${task.Id}`)
        );
        const before = ((await opened.json()) as Task).Triggers?.length ?? 0;

        await page.getByRole('button', { name: 'Add Trigger' }).click();
        const added = await expectAuthenticatedOk(
            page,
            new RegExp(`/ScheduledTasks/${task.Id}/Triggers$`, 'i'),
            'POST',
            () =>
                page
                    .getByRole('dialog')
                    .getByRole('button', { name: 'Add', exact: true })
                    .click()
        );
        const addedBody = JSON.parse(added.request().postData() ?? '[]');
        expect(addedBody).toHaveLength(before + 1);

        const removeButtons = page.getByRole('button', { name: 'Remove' });
        await expect(removeButtons).toHaveCount(before + 1, {
            timeout: 15_000
        });
        await removeButtons.last().click();
        const removed = await expectAuthenticatedOk(
            page,
            new RegExp(`/ScheduledTasks/${task.Id}/Triggers$`, 'i'),
            'POST',
            () =>
                page
                    .getByRole('dialog')
                    .getByRole('button', { name: 'Remove' })
                    .click()
        );
        expect(JSON.parse(removed.request().postData() ?? '[]')).toHaveLength(
            before
        );
    });

    test('dashboard home: running-tasks widget loads tasks', async ({
        page
    }) => {
        await expectAuthenticatedOk(page, /\/ScheduledTasks$/i, 'GET', () =>
            openDashboardRoute(page, '')
        );
    });
});
