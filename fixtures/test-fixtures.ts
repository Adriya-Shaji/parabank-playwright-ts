import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { createUniqueCustomer, type Customer } from '../utils/customerFactory.js';

type TestFixtures = {
    loginPage: LoginPage;
    registerPage: RegisterPage;
    customer: Customer;
    registeredCustomer: Customer;
    authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
    loginPage: async ({ page }, use) => {
        const loginPage = new LoginPage(page);
        await use(loginPage);
    },

    registerPage: async ({ page }, use) => {
        const registerPage = new RegisterPage(page);
        await use(registerPage);
    },

    customer: async ({ }, use) => {
        const customer = createUniqueCustomer();
        await use(customer);
    },

    registeredCustomer: async ({ loginPage, registerPage, customer, page },
        use) => {
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

            // 4. Give the registered, logged-out customer to the test
            await use(customer);
    },
    authenticatedPage: async ({ page, loginPage, registeredCustomer },
        use) => {
        await loginPage.login(
            registeredCustomer.username,
            registeredCustomer.password
        );

        await expect(
            page.getByRole('heading', { name: 'Accounts Overview' })
        ).toBeVisible();

        await use(page);
    }
});

export { expect };
