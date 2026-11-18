import { expect, type Page, type Request, test } from '@playwright/test';

import { signIn } from './support/b2';

/**
 * Consolidation step 3 (#306): the dashboard user pages (add, profile, access, parental control,
 * delete) call the generated Tesserafin SDK (`lib/tesserafin-sdk`) through `useApi().reefinApi`
 * instead of `@jellyfin/sdk`. This drives one user's whole lifecycle against a real server and
 * asserts that every call the migrated code makes reaches the server authenticated and succeeds.
 *
 * Run against `ci/serve-e2e.sh` (server repository) with this repository's production bundle.
 * Hosted CI does not run this spec.
 */

const matches = (pattern: RegExp, method: string) => (req: Request) =>
    pattern.test(new URL(req.url()).pathname) && req.method() === method;

const waitAuthenticatedOk = (page: Page, pattern: RegExp, method: string) =>
    page
        .waitForResponse((res) => matches(pattern, method)(res.request()), {
            timeout: 15_000
        })
        .then(async (response) => {
            const auth = await response.request().headerValue('authorization');
            expect(
                auth,
                `${method} ${pattern} must carry the session token`
            ).toMatch(/^MediaBrowser .*Token="[^"]+"/);
            expect(
                response.status(),
                `${method} ${response.url()} must succeed`
            ).toBeLessThan(300);
            return response;
        });

async function openDashboardRoute(page: Page, route: string) {
    // Same document: a hash-only navigation keeps the authenticated session alive.
    await page.evaluate((hash) => {
        window.location.hash = hash;
    }, `#/dashboard/${route}`);
}

test('users: add, edit profile, access and parental control, then delete', async ({
    page
}) => {
    test.setTimeout(120_000);
    await signIn(page);
    const name = `step3-user-${Date.now()}`;

    // Add: the library folders and channels feed the access checklists.
    const folders = waitAuthenticatedOk(
        page,
        /\/Library\/MediaFolders$/i,
        'GET'
    );
    const channels = waitAuthenticatedOk(page, /\/Channels$/i, 'GET');
    await openDashboardRoute(page, 'users/add');
    await Promise.all([folders, channels]);

    await page.locator('#txtUsername').fill(name);
    const created = waitAuthenticatedOk(page, /\/Users\/New$/i, 'POST');
    const policy = waitAuthenticatedOk(
        page,
        /\/Users\/[^/]+\/Policy$/i,
        'POST'
    );
    await page.locator('#newUserPage button[type="submit"]').click();
    const userId = ((await (await created).json()) as { Id: string }).Id;
    await policy;
    await page.waitForURL(`**/dashboard/users/${userId}/profile`, {
        timeout: 15_000
    });

    // Profile: providers and the network configuration load; Save updates user then policy.
    const profileForm = page.locator('form').filter({
        has: page.locator('button[type="submit"]')
    });
    await expect(profileForm.first()).toBeVisible({ timeout: 15_000 });
    // updateUser is `POST /Users?userId=…`.
    const updated = waitAuthenticatedOk(page, /\/Users$/i, 'POST');
    const profilePolicy = waitAuthenticatedOk(
        page,
        new RegExp(`/Users/${userId}/Policy$`, 'i'),
        'POST'
    );
    await profileForm.first().locator('button[type="submit"]').click();
    await Promise.all([updated, profilePolicy]);

    // Access: library folders and channels load again; Save updates the policy.
    const accessFolders = waitAuthenticatedOk(
        page,
        /\/Library\/MediaFolders$/i,
        'GET'
    );
    await openDashboardRoute(page, `users/${userId}/access`);
    await accessFolders;
    const accessPolicy = waitAuthenticatedOk(
        page,
        new RegExp(`/Users/${userId}/Policy$`, 'i'),
        'POST'
    );
    await page.locator('button[type="submit"]:visible').first().click();
    await accessPolicy;

    // Parental control: Save updates the policy.
    await openDashboardRoute(page, `users/${userId}/parentalcontrol`);
    const parentalSubmit = page
        .locator('button[type="submit"]:visible')
        .first();
    await expect(parentalSubmit).toBeVisible({ timeout: 15_000 });
    const parentalPolicy = waitAuthenticatedOk(
        page,
        new RegExp(`/Users/${userId}/Policy$`, 'i'),
        'POST'
    );
    await parentalSubmit.click();
    await parentalPolicy;

    // Delete from the users list.
    await openDashboardRoute(page, 'users');
    const card = page.locator(`.card[data-userid="${userId}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator('.btnUserMenu').click();
    await page
        .locator('.actionSheetMenuItem')
        .filter({ hasText: 'Delete' })
        .click();
    const deleted = waitAuthenticatedOk(
        page,
        new RegExp(`/Users/${userId}$`, 'i'),
        'DELETE'
    );
    await page.locator('.dialog button').filter({ hasText: 'Delete' }).click();
    await deleted;
    await expect(card).toHaveCount(0, { timeout: 15_000 });
});
