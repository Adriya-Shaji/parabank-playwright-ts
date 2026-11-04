import type { APIRequestContext } from '@playwright/test';

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
            `/parabank/services/bank/customers/${customerId}`,
            { headers: this.headers }
        );
    }

    async getCustomerAccounts(customerId: number) {
        return this.request.get(
            `/parabank/services/bank/customers/${customerId}/accounts`, { headers: this.headers }
        );
    }
}
