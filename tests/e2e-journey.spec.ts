import { test, expect } from "../fixtures/test-fixtures.js";
import { AccountsOverviewPage } from "../pages/AccountsOverviewPage.js";
import { OpenAccountPage } from "../pages/OpenAccountPage.js";
import { TransferFundsPage } from "../pages/TransferFundsPage.js";
import { AccountActivityPage } from "../pages/AccountActivityPage.js";

// Transaction table columns: Date, Transaction, Debit (-), Credit (+)
const DEBIT_COLUMN = 2;
const CREDIT_COLUMN = 3;

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
            const transferFundsPage = new TransferFundsPage(page);

            await transferFundsPage.goto();

            await transferFundsPage.transferFunds(
                '10',
                sourceAccountNumber,
                destinationAccountNumber
            );

            await expect(
                transferFundsPage.transferCompleteHeading
            ).toBeVisible();

            await expect(
                transferFundsPage.amountResult
            ).toHaveText('$10.00');

            await expect(
                transferFundsPage.fromAccountResult
            ).toHaveText(sourceAccountNumber);

            await expect(
                transferFundsPage.toAccountResult
            ).toHaveText(destinationAccountNumber);
        });

        await test.step('Verify source account activity', async () => {
            const accountActivityPage = new AccountActivityPage(page);

            await accountsOverviewPage.goto();
            await accountsOverviewPage.openAccountActivity(sourceAccountNumber);

            await expect(accountActivityPage.accountNumber)
                .toHaveText(sourceAccountNumber);

            const sourceTransferRow = accountActivityPage
                .transactionRow('Funds Transfer Sent', '$10.00');

            await expect(sourceTransferRow).toHaveCount(1);

            await expect(
                sourceTransferRow.getByRole('cell').nth(DEBIT_COLUMN)
            ).toHaveText('$10.00');
        });

        await test.step('Verify destination account activity', async () => {
            const accountActivityPage = new AccountActivityPage(page);

            await accountsOverviewPage.goto();
            await accountsOverviewPage.openAccountActivity(
                destinationAccountNumber
            );

            await expect(accountActivityPage.accountNumber)
                .toHaveText(destinationAccountNumber);

            const destinationTransferRow = accountActivityPage
                .transactionRow('Funds Transfer Received', '$10.00');

            await expect(destinationTransferRow).toHaveCount(1);

            await expect(
                destinationTransferRow.getByRole('cell').nth(CREDIT_COLUMN)
            ).toHaveText('$10.00');
        });
    });
