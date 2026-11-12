
import { test, expect } from '../fixtures/test-fixtures.js';
import { ParaBankApiClient } from '../utils/parabankApiClient.js';
import {
    requireOk,
    openAccountAndConfirm,
    getStoredAccount
} from '../utils/accountSetup.js';
import { TransferFundsPage } from '../pages/TransferFundsPage.js';
import { AccountsOverviewPage } from '../pages/AccountsOverviewPage.js';

function toCents(amount: number): number {
    return Math.round(amount * 100);
}

test('UI transfer updates balances for an API-created account', async ({
    request,
    registeredCustomer,
    authenticatedPage
}) => {
    const api = new ParaBankApiClient(request);

    // 1. Login through API to get the customer ID
    const loginResponse = await api.login(
        registeredCustomer.username,
        registeredCustomer.password
    );
    await requireOk(loginResponse, 'login');

    const customer: unknown = await loginResponse.json();

    if (
        typeof customer !== 'object' ||
        customer === null ||
        !('id' in customer) ||
        typeof customer.id !== 'number' ||
        !Number.isInteger(customer.id)
    ) {
        throw new Error(
            `Invalid login response: ${JSON.stringify(customer)}`
        );
    }

    const customerId = customer.id;

    // 2. Find the customer's existing source account
    const accountsResponse = await api.getCustomerAccounts(customerId);
    await requireOk(accountsResponse, 'get customer accounts');

    const accounts: unknown = await accountsResponse.json();

    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error(
            `No source account available: ${JSON.stringify(accounts)}`
        );
    }

    const firstAccount: unknown = accounts[0];

    if (
        typeof firstAccount !== 'object' ||
        firstAccount === null ||
        !('id' in firstAccount) ||
        typeof firstAccount.id !== 'number' ||
        !Number.isInteger(firstAccount.id) ||
        !('customerId' in firstAccount) ||
        firstAccount.customerId !== customerId
    ) {
        throw new Error(
            `Invalid source account: ${JSON.stringify(firstAccount)}`
        );
    }

    const sourceAccountId = firstAccount.id;

    // 3. Create and confirm a SAVINGS account through API
    const newAccount = await openAccountAndConfirm(
        api,
        customerId,
        'SAVINGS',
        sourceAccountId
    );

    const destinationAccountId = newAccount.id;

    // 4. Read both balances before transfer
    const sourceBefore = await getStoredAccount(
        api, customerId, sourceAccountId, 'CHECKING'
    );

    const destinationBefore = await getStoredAccount(
        api, customerId, destinationAccountId, 'SAVINGS'
    );

    // 5. Perform $10 transfer through the UI
    const transfer = new TransferFundsPage(authenticatedPage);
    await transfer.goto();

    await transfer.transferFunds(
        '10',
        String(sourceAccountId),
        String(destinationAccountId)
    );

    await expect(transfer.transferCompleteHeading).toBeVisible();

    // 6. Read both balances after transfer through API
    const sourceAfter = await getStoredAccount(
        api, customerId, sourceAccountId, 'CHECKING'
    );

    const destinationAfter = await getStoredAccount(
        api, customerId, destinationAccountId, 'SAVINGS'
    );

    expect(toCents(sourceAfter.balance))
        .toBe(toCents(sourceBefore.balance) - 1000);

    expect(toCents(destinationAfter.balance))
        .toBe(toCents(destinationBefore.balance) + 1000);

    // 7. Verify the destination balance in the UI
    const overview = new AccountsOverviewPage(authenticatedPage);
    await overview.goto();

    const expectedDestinationBalance =
        (toCents(destinationBefore.balance) + 1000) / 100;

    await expect(
        overview.getAccountBalance(String(destinationAccountId))
    ).toHaveText(`$${expectedDestinationBalance.toFixed(2)}`);
});
