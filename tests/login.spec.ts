import { test, expect } from '../fixtures/test-fixtures.js';

test.describe.configure({ mode: 'default' });

test('registered customer can log in and see their account overview',
    async ({ page, loginPage, registeredCustomer }) => {
        await test.step('Log in as registered customer', async () => {
            await loginPage.login(registeredCustomer.username, registeredCustomer.password);

            await expect(
                page.getByRole(
                    'heading', { name: 'Accounts Overview' })
            ).toBeVisible();

            await expect(
                page.getByText(
                    `Welcome ${registeredCustomer.firstName} ${registeredCustomer.lastName}`
                )
            ).toBeVisible();
        });
    });

test('rejects incorrect password for registered customer',
    async ({ page, loginPage, registeredCustomer }) => {
        await test.step('Submit invalid credentials and verify the error message', async () => {
            await loginPage.login(registeredCustomer.username, `invalid_${registeredCustomer.password}`);

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

test('rejects empty credentials with validation error',
    async ({ page, loginPage }) => {
        await test.step('Submit empty credentials and verify the error message', async () => {
            await loginPage.goto();
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

