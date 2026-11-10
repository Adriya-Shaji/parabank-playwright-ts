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

    if (
        typeof createdAccount !== 'object' ||
        createdAccount === null ||
        !('id' in createdAccount) ||
        typeof createdAccount.id !== 'number' ||
        !Number.isInteger(createdAccount.id) ||
        !('customerId' in createdAccount) ||
        createdAccount.customerId !== customerId ||
        !('type' in createdAccount) ||
        createdAccount.type !== accountType
    ) {
        throw new Error(
            'Account creation returned invalid account details'
        );
    }

    const createdAccountId = createdAccount.id;

    // 3. Read accounts back
    const accountsResponse = await api.getCustomerAccounts(customerId);

    await requireOk(accountsResponse, 'get customer accounts');

    const accounts: unknown = await accountsResponse.json();

    if (!Array.isArray(accounts)) {
        throw new Error(
            'Customer accounts response is not an array'
        );
    }

    // 4. Find the newly created account
    const storedAccount: unknown = accounts.find(
        (account: unknown) =>
            typeof account === 'object' &&
            account !== null &&
            'id' in account &&
            account.id === createdAccountId
    );

    // 5. Validate the stored account
    if (
        typeof storedAccount !== 'object' ||
        storedAccount === null ||
        !('customerId' in storedAccount) ||
        storedAccount.customerId !== customerId ||
        !('type' in storedAccount) ||
        storedAccount.type !== accountType ||
        !('id' in storedAccount) ||
        typeof storedAccount.id !== 'number' ||
        !Number.isInteger(storedAccount.id) ||
        !('balance' in storedAccount) ||
        typeof storedAccount.balance !== 'number' ||
        !Number.isFinite(storedAccount.balance)
    ) {
        throw new Error(
            `Account ${createdAccountId} was not found or had invalid details during read-back`
        );
    }

    // 6. Return the stored account
    return {
        id: storedAccount.id,
        customerId: storedAccount.customerId,
        type: accountType,
        balance: storedAccount.balance
    };
}
