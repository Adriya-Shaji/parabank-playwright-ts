import type { APIResponse } from "@playwright/test";
import type { ParaBankApiClient, AccountType } from "./parabankApiClient.js";

export interface Account {
    id: number;
    customerId: number;
    type: AccountType;
    balance: number;
}

// Stop immediately if HTTP request failed
export async function requireOk(
    response: APIResponse,
    action: string
): Promise<void> {
    if (!response.ok()) {
        const body = await response.text();
        throw new Error(
            `Setup failed: ${action} returned HTTP ${response.status()}: ${body}`
        );
    }
}

// Check that the API response contains valid account details
// for the expected customer and account type.
function isExpectedAccount(
    value: unknown,
    customerId: number,
    accountType: AccountType
): value is Account {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    if (
        !('id' in value) ||
        !('customerId' in value) ||
        !('type' in value) ||
        !('balance' in value)
    ) {
        return false;
    }

    return (
        typeof value.id === 'number' &&
        Number.isInteger(value.id) &&
        value.customerId === customerId &&
        value.type === accountType &&
        typeof value.balance === 'number' &&
        Number.isFinite(value.balance)
    );
}

// Create an account through the API, confirm it through an independent
// read-back, and return the stored account details.
export async function openAccountAndConfirm(
    api: ParaBankApiClient,
    customerId: number,
    accountType: AccountType,
    fromAccountId: number
): Promise<Account> {
    // 1. Create the account
    const response = await api.openAccount(
        customerId,
        accountType,
        fromAccountId
    );

    await requireOk(response, 'open account');

    // 2. Validate creation response
    const createdAccount: unknown = await response.json();

    if (!isExpectedAccount(createdAccount, customerId, accountType)) {
        throw new Error(
            `Invalid account creation response: ${JSON.stringify(createdAccount)}`
        );
    }

    // 3. Read accounts back
    const accountsResponse = await api.getCustomerAccounts(customerId);

    await requireOk(accountsResponse, 'get customer accounts');

    const accounts: unknown = await accountsResponse.json();

    if (!Array.isArray(accounts)) {
        throw new Error(
            `Customer accounts response is not an array: ${JSON.stringify(accounts)}`
        );
    }

    // 4. Find the newly created account
    const storedAccount: unknown = accounts.find(
        (account: unknown) =>
            typeof account === 'object' &&
            account !== null &&
            'id' in account &&
            account.id === createdAccount.id
    );

    if (storedAccount === undefined) {
        throw new Error(
            `Account ${createdAccount.id} was not found in the customer accounts list`
        );
    }

    // 5. Validate the stored account
    if (!isExpectedAccount(storedAccount, customerId, accountType)) {
        throw new Error(
            `Invalid stored account ${createdAccount.id}: ${JSON.stringify(storedAccount)}`
        );
    }

    // 6. Return the stored account
    return storedAccount;
}
