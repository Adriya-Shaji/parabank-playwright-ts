import { test, expect } from '@playwright/test';

function requireEnv(key: string): string {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }

    return value;
}

test.beforeEach(async ({ page }) => {
    await page.goto('index.htm');

    await expect(
        page.getByRole('heading', { name: 'Customer Login' })
    ).toBeVisible();
});


test('existing customer can log in and see their account overview', async ({ page }) => {

    const username = requireEnv('TEST_USERNAME');
    const password = requireEnv('TEST_PASSWORD');
    const firstName = requireEnv('TEST_FIRSTNAME');
    const lastName = requireEnv('TEST_LASTNAME');

    await test.step('Log in as existing customer', async () => {
        await page.locator('input[name="username"]').fill(username);
        await page.locator('input[name="password"]').fill(password);

        await page
            .getByRole('button', { name: 'Log In' })
            .click();

        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).toBeVisible();

        await expect(
            page.getByText(
                `Welcome ${firstName} ${lastName}`
            )
        ).toBeVisible();
    });
});

test('rejects invalid credentials with controlled error', async ({ page }) => {
    const username = requireEnv('TEST_USERNAME');
    const password = requireEnv('TEST_PASSWORD');

    await test.step('Submit invalid credentials and verify the error message', async () => {

        await page.locator('input[name="username"]').fill(username);
        await page.locator('input[name="password"]').fill(`invalid_${password}`);

        await page
            .getByRole('button', { name: 'Log In' })
            .click();

        await expect(
            page.locator('#rightPanel').getByText(
                'The username and password could not be verified.',
                { exact: true }
            )
        ).toBeVisible();
        
        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).not.toBeVisible();
    });
});

test('rejects empty credentials with validation error', async ({ page }) => {
    await test.step('Submit empty credentials and verify the error message', async () => {
        await page
            .getByRole('button', { name: 'Log In' })
            .click();

        await expect(
            page.locator('#rightPanel').getByText(
                'Please enter a username and password.',
                { exact: true }
            )
        ).toBeVisible();

        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).not.toBeVisible();
    });
});

