import type { APIRequestContext } from '@playwright/test';

export type AccountType = 'CHECKING' | 'SAVINGS';

const ACCOUNT_TYPE_CODES: Record<AccountType, number> = {
    CHECKING: 0,
    SAVINGS: 1,
};

export class ParaBankApiClient {
    private readonly headers = { Accept: 'application/json' };

    constructor(private readonly request: APIRequestContext) { }

    async login(username: string, password: string) {
        return this.request.get(
            `/parabank/services/bank/login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`, {
            headers: this.headers,
        });
    }

    async getCustomer(customerId: number) {
        return this.request.get(
            `/parabank/services/bank/customers/${customerId}`, {
            headers: this.headers
        });
    }

    async getCustomerAccounts(customerId: number) {
        return this.request.get(
            `/parabank/services/bank/customers/${customerId}/accounts`, {
            headers: this.headers
        });
    }

    async openAccount(
        customerId: number,
        accountType: AccountType,
        fromAccountId: number
    ) {
        return this.request.post(
            `/parabank/services/bank/createAccount`, {
            headers: this.headers,
            params: {
                customerId,
                newAccountType: ACCOUNT_TYPE_CODES[accountType],
                fromAccountId
            }
        });
    }

    async transfer(
        fromAccountId: number,
        toAccountId: number,
        amount: number
    ) {
        return this.request.post(
            `/parabank/services/bank/transfer`, {
            headers: this.headers,
            params: {
                fromAccountId,
                toAccountId,
                amount
            },
        });
    }
}
