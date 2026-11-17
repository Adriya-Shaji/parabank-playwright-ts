import { test, expect } from "../../fixtures/test-fixtures.js";
import { randomUUID } from "node:crypto";
import { ParaBankApiClient } from "../../utils/parabankApiClient.js";
import {
    getStoredAccount,
    loginAndGetOnlyAccount,
    openAccountAndConfirm
} from "../../utils/accountSetup.js";

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

            // 1. Log in and get the new customer's only account
            const { customerId, accountId: sourceAccountId } = await loginAndGetOnlyAccount(
                api, registeredCustomer.username, registeredCustomer.password
            );

            // 2. Read and validate the balance before the transfer
            const sourceBefore = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );

            // 3. Attempt the transfer. No requireOk: rejection is the expected outcome.
            const response = await api.transfer(
                sourceAccountId, NON_EXISTENT_ACCOUNT_ID, 10
            );

            // 4. Read the balance after the attempt
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

    test('negative amount transfer is rejected and both balances are unchanged',
        async ({ request, registeredCustomer }) => {
            const api = new ParaBankApiClient(request);

            const { customerId, accountId: sourceAccountId } =
                await loginAndGetOnlyAccount(
                    api,
                    registeredCustomer.username,
                    registeredCustomer.password
                );

            const destination = await openAccountAndConfirm(
                api, customerId, 'SAVINGS', sourceAccountId
            );

            const sourceBefore = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );
            const destinationBefore = await getStoredAccount(
                api, customerId, destination.id, 'SAVINGS'
            );

            // Setup completed. The known defect is in negative transfer handling.
            test.fail(
                true,
                'Known defect: ParaBank accepts negative transfers and reverses money movement.'
            );

            const response = await api.transfer(
                sourceAccountId, destination.id, -10
            );

            const sourceAfter = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );
            const destinationAfter = await getStoredAccount(
                api, customerId, destination.id, 'SAVINGS'
            );

            // Neither account should change when the transfer is rejected.
            expect.soft(toCents(sourceAfter.balance))
                .toBe(toCents(sourceBefore.balance));

            expect.soft(toCents(destinationAfter.balance))
                .toBe(toCents(destinationBefore.balance));

            expect.soft(response.ok()).toBe(false);
        });

    test('non-numeric amount is rejected and both balances are unchanged',
        async ({ request, registeredCustomer }) => {
            const api = new ParaBankApiClient(request);

            const { customerId, accountId: sourceAccountId } =
                await loginAndGetOnlyAccount(
                    api,
                    registeredCustomer.username,
                    registeredCustomer.password
                );

            const destination = await openAccountAndConfirm(
                api, customerId, 'SAVINGS', sourceAccountId
            );

            const sourceBefore = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );
            const destinationBefore = await getStoredAccount(
                api, customerId, destination.id, 'SAVINGS'
            );

            // Bypass the typed API client to send malformed input deliberately.
            const response = await request.post(
                '/parabank/services/bank/transfer',
                {
                    headers: { Accept: 'application/json' },
                    params: {
                        fromAccountId: sourceAccountId,
                        toAccountId: destination.id,
                        amount: 'abc'
                    }
                }
            );

            const sourceAfter = await getStoredAccount(
                api, customerId, sourceAccountId, 'CHECKING'
            );
            const destinationAfter = await getStoredAccount(
                api, customerId, destination.id, 'SAVINGS'
            );

            // Primary business checks: no money moved.
            expect(toCents(sourceAfter.balance))
                .toBe(toCents(sourceBefore.balance));

            expect(toCents(destinationAfter.balance))
                .toBe(toCents(destinationBefore.balance));

            // Observed ParaBank behaviour: HTTP 404 with an empty response body.
            expect(response.status()).toBe(404);
            expect(await response.text()).toBe('');
        });
});
