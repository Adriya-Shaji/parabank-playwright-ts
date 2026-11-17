import { test, expect } from "../../fixtures/test-fixtures.js";
import { randomUUID } from "node:crypto";
import { ParaBankApiClient } from "../../utils/parabankApiClient.js";
import { requireOk, getStoredAccount } from "../../utils/accountSetup.js";

const NON_EXISTENT_ACCOUNT_ID = 999999999;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid username and/or password';

function unknownUsername(): string {
    return `unknown_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function toCents(amount: number): number {
    return Math.round(amount * 100);
}

test.describe('Negative API paths: authentication', () => {
    test('unknown username is rejected without returning customer data',
        async ({ request }) => {
            const api = new ParaBankApiClient(request);

            const response = await api.login(unknownUsername(), 'wrongpassword');

            // Observed behaviour: 400 with text/plain. Swagger documents neither
            // the status nor the error format. Pinned deliberately, see DECISIONS.md.
            expect(response.status()).toBe(400);
            expect(response.headers()['content-type']).toContain('text/plain');
            expect(await response.text()).toBe(INVALID_CREDENTIALS_MESSAGE);
        });

    test('wrong password for an existing user returns the same status and message as an unknown user',
        async ({ request }) => {
            const api = new ParaBankApiClient(request);

            const unknownUser = await api.login(unknownUsername(), 'wrongpassword');
            const knownUserWrongPassword = await api.login('john', 'wrongpassword');

            // Status, content type and message do not reveal whether the username exists.
            // Timing and other side channels are not covered by this test.
            expect(knownUserWrongPassword.status()).toBe(400);
            expect(knownUserWrongPassword.status()).toBe(unknownUser.status());
            expect(knownUserWrongPassword.headers()['content-type'])
                .toBe(unknownUser.headers()['content-type']);
            expect(await knownUserWrongPassword.text()).toBe(await unknownUser.text());
        });
});

test.describe('Negative API paths: customer lookup', () => {
    test('unknown customer id returns an error and no customer data', async ({ request }) => {
        const api = new ParaBankApiClient(request);
        const unknownCustomerId = 999999999;

        const response = await api.getCustomer(unknownCustomerId);

        expect(response.status()).toBe(400);
        expect(response.headers()['content-type']).toContain('text/plain');
        expect(await response.text()).toBe(`Could not find customer #${unknownCustomerId}`);
    });
});

test.describe('Negative API paths: transfers', () => {
    test('transfer to a non-existent account is rejected and the source balance is unchanged',
        async ({ request, registeredCustomer }) => {
            const api = new ParaBankApiClient(request);

            // 1. Log in as the fresh customer
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
                throw new Error(`Invalid login response: ${JSON.stringify(customer)}`);
            }
            const customerId = customer.id;

            // 2. A new customer should have exactly one account
            const accountsResponse = await api.getCustomerAccounts(customerId);
            await requireOk(accountsResponse, 'get customer accounts');

            const accounts: unknown = await accountsResponse.json();
            if (!Array.isArray(accounts) || accounts.length !== 1) {
                throw new Error(
                    `Expected exactly one account for a new customer: ${JSON.stringify(accounts)}`
                );
            }

            const onlyAccount: unknown = accounts[0];
            if (
                typeof onlyAccount !== 'object' ||
                onlyAccount === null ||
                !('id' in onlyAccount) ||
                typeof onlyAccount.id !== 'number'
            ) {
                throw new Error(`Invalid account: ${JSON.stringify(onlyAccount)}`);
            }
            const sourceAccountId = onlyAccount.id;

            // 3. Read and validate the balance before the transfer
            const sourceBefore = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );

            // 4. Attempt the transfer. No requireOk: rejection is the expected outcome.
            const response = await api.transfer(
                sourceAccountId, NON_EXISTENT_ACCOUNT_ID, 10
            );

            // 5. Read the balance after the attempt
            const sourceAfter = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );

            // Most important check first: no money left the source account.
            expect(toCents(sourceAfter.balance)).toBe(toCents(sourceBefore.balance));

            expect(response.status()).toBe(400);
            expect(response.headers()['content-type']).toContain('text/plain');
            expect(await response.text()).toBe(
                `Could not find account number ${sourceAccountId} and/or ${NON_EXISTENT_ACCOUNT_ID}`
            );
        });
});
