import { test, expect } from "../../fixtures/test-fixtures.js";
import { randomUUID } from "node:crypto";
import { ParaBankApiClient } from "../../utils/parabankApiClient.js";

const INVALID_CREDENTIALS_MESSAGE = 'Invalid username and/or password';

function unknownUsername(): string {
    return `unknown_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
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
