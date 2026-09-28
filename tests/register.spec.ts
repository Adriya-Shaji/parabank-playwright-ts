import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage.js';
import { createUniqueCustomer } from '../utils/customerFactory.js';
import { LoginPage } from '../pages/LoginPage.js';

test.describe.configure({ mode: 'default' });

let registerPage: RegisterPage;

test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);

    await registerPage.goto();
});


test('new customer can register and is logged in', async ({ page }) => {
    const customer = createUniqueCustomer();

    await registerPage.registerCustomer(customer);

    const rightPanel = page.locator('#rightPanel');
    const leftPanel = page.locator('#leftPanel');

    await expect(
        rightPanel.getByRole('heading', {
            name: `Welcome ${customer.username}`,
            exact: true
        })
    ).toBeVisible();

    await expect(
        rightPanel.getByText(
            'Your account was created successfully. You are now logged in.',
            { exact: true }
        )
    ).toBeVisible();

    await expect(
        leftPanel.getByRole('link', { name: 'Log Out' })
    ).toBeVisible();
});

test('registered customer persists and can log in again', async ({ page }) => {
    const customer = createUniqueCustomer();
    const loginPage = new LoginPage(page);

    // 1. Register a new customer
    await registerPage.registerCustomer(customer);

    const rightPanel = page.locator('#rightPanel');
    const leftPanel = page.locator('#leftPanel');

    // Minimal prerequisite check: registration actually succeeded
    await expect(
        rightPanel.getByText(
            'Your account was created successfully. You are now logged in.',
            { exact: true }
        )
    ).toBeVisible();

    // 2. End the session created by registration
    await leftPanel
        .getByRole('link', { name: 'Log Out' })
        .click();

    // 3. Confirm logout already returned us to the login page
    await expect(
        page.getByRole('heading', { name: 'Customer Login' })
    ).toBeVisible();

    // 4. Start a new authenticated session using the generated customer
    await loginPage.login(customer.username, customer.password);

    await expect(
        page.getByText(
            `Welcome ${customer.firstName} ${customer.lastName}`
        )
    ).toBeVisible();
});

test('rejects registration with duplicate username', async ({ page }) => {
    const customer = createUniqueCustomer();

    // Create the customer first
    await registerPage.registerCustomer(customer);

    const rightPanel = page.locator('#rightPanel');
    const leftPanel = page.locator('#leftPanel');

    // Minimal prerequisite check: registration actually succeeded
    await expect(
        rightPanel.getByText(
            'Your account was created successfully. You are now logged in.',
            { exact: true }
        )
    ).toBeVisible();

    await leftPanel
        .getByRole('link', { name: 'Log Out' })
        .click();

    await registerPage.goto();

    // Try to register the same customer again.
    await registerPage.registerCustomer(customer);

    await expect(registerPage.usernameError)
        .toHaveText('This username already exists.');
});
