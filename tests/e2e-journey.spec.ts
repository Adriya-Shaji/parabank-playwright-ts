import { test, expect } from "../fixtures/test-fixtures.js";
import { AccountsOverviewPage } from "../pages/AccountsOverviewPage.js";
import { OpenAccountPage } from "../pages/OpenAccountPage.js";

test('customer completes end-to-end banking journey @e2e',
    async ({ page, customer, registerPage }) => {
        const accountsOverviewPage = new AccountsOverviewPage(page);

        await test.step('Register customer', async () => {
            await registerPage.goto();
            await registerPage.registerCustomer(customer);

            await expect(
                page.locator('#rightPanel').getByText(
                    'Your account was created successfully. You are now logged in.',
                    { exact: true }
                )
            ).toBeVisible();
        });

        const sourceAccountNumber = await test.step(
            'Capture original account', async () => {
                await accountsOverviewPage.goto();

                const accountLinks = accountsOverviewPage.getAccountLinks();

                await expect(accountLinks).toHaveCount(1);
                await expect(accountLinks).toHaveText(/^\d+$/);

                return await accountLinks.innerText();
            });

        const destinationAccountNumber = await test.step(
            'Open savings account', async () => {
                const openAccountPage = new OpenAccountPage(page);

                await openAccountPage.goto();
                await openAccountPage.openAccount('SAVINGS', sourceAccountNumber);

                await expect(
                    page.locator('#rightPanel').getByText(
                        'Congratulations, your account is now open.',
                        { exact: true }
                    )
                ).toBeVisible();

                await expect(
                    openAccountPage.newAccountId).toHaveText(/^\d+$/
                    );

                const newAccountNumber =
                    await openAccountPage.newAccountId.innerText();

                expect(newAccountNumber).not.toBe(sourceAccountNumber);

                return newAccountNumber;
            });

        await test.step('Transfer funds', async () => {
        });

        await test.step('Verify source account activity', async () => {
        });

        await test.step('Verify destination account activity', async () => {
        });
    });