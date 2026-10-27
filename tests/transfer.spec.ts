import { test, expect } from "../fixtures/test-fixtures.js";
import { AccountsOverviewPage } from '../pages/AccountsOverviewPage.js';
import { OpenAccountPage } from '../pages/OpenAccountPage.js';
import { TransferFundsPage } from "../pages/TransferFundsPage.js";

test.describe.configure({ mode: 'default' });

test('transfers funds between two accounts',
    async ({ authenticatedPage }) => {
        const accountsOverviewPage = new AccountsOverviewPage(authenticatedPage);
        const openAccountPage = new OpenAccountPage(authenticatedPage);
        const transferFundsPage = new TransferFundsPage(authenticatedPage);

        // 1. Read source account
        await accountsOverviewPage.goto();

        const accountLinks = accountsOverviewPage.getAccountLinks();

        await expect(accountLinks).toHaveCount(1);
        await expect(accountLinks).toHaveText(/^\d+$/);

        // 2. Open second account, read new account ID
        const sourceAccountNumber = await accountLinks.innerText();

        await openAccountPage.goto();

        await openAccountPage.openAccount('SAVINGS', sourceAccountNumber);

        await expect(openAccountPage.newAccountId).toHaveText(/^\d+$/);

        const destinationAccountNumber =
            await openAccountPage.newAccountId.innerText();

        // 3. Transfer funds
        await transferFundsPage.goto();

        await transferFundsPage.transferFunds(
            '10',
            sourceAccountNumber,
            destinationAccountNumber
        );

        // 4. Verify the transfer result
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
    }
);
