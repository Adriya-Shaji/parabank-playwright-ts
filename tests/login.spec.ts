import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';

test.describe.configure({ mode: 'default' });

function requireEnv(key: string): string {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }

    return value;
}

let loginPage: LoginPage;

test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);

    await loginPage.goto();

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
        await loginPage.login(username, password);

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
        await loginPage.login(username, `invalid_${password}`);

        await expect(loginPage.errorMessage).toBeVisible();

        await expect(loginPage.errorMessage).toHaveText(
            'The username and password could not be verified.'
        );

        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).not.toBeVisible();
    });
});

test('rejects empty credentials with validation error', async ({ page }) => {
    await test.step('Submit empty credentials and verify the error message', async () => {
        await loginPage.login('', '');

        await expect(loginPage.errorMessage).toBeVisible();

        await expect(loginPage.errorMessage).toHaveText(
            'Please enter a username and password.'
        );

        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).not.toBeVisible();
    });
});

