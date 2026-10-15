import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { createUniqueCustomer } from '../utils/customerFactory.js';
import type { Customer } from '../utils/customerFactory.js';

test.describe.configure({ mode: 'default' });

let loginPage: LoginPage;
let customer: Customer;

test.beforeEach(async ({ page }) => {
    const registerPage = new RegisterPage(page);

    loginPage = new LoginPage(page);
    customer = createUniqueCustomer();

    // 1. Register a new customer
    await registerPage.goto();
    await registerPage.registerCustomer(customer);

    const rightPanel = page.locator('#rightPanel');

    await expect(
        rightPanel.getByText(
            'Your account was created successfully. You are now logged in.',
            { exact: true }
        )
    ).toBeVisible();

    // 2. End the session created by registration
    await loginPage.logout();

    // 3. Confirm user is returned to the login page
    await expect(
        page.getByRole('heading', { name: 'Customer Login' })
    ).toBeVisible();

});


test('registered customer can log in and see their account overview', async ({ page }) => {
    await test.step('Log in as registered customer', async () => {
        await loginPage.login(customer.username, customer.password);

        await expect(
            page.getByRole(
                'heading', { name: 'Accounts Overview' })
        ).toBeVisible();

        await expect(
            page.getByText(
                `Welcome ${customer.firstName} ${customer.lastName}`
            )
        ).toBeVisible();
    });
});

test('rejects incorrect password for registered customer', async ({ page }) => {
    await test.step('Submit invalid credentials and verify the error message', async () => {
        await loginPage.login(customer.username, `invalid_${customer.password}`);

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

