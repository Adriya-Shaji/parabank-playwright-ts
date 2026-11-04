import { test, expect } from '@playwright/test';
import { ParaBankApiClient } from '../../utils/parabankApiClient.js';

test('login returns the customer details as JSON', async ({ request }) => {
    const api = new ParaBankApiClient(request);

    const response = await api.login('john', 'demo');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(typeof body.id).toBe('number');
    expect(body.firstName).toBe('John');
});

test('customer details match the logged-in customer', async ({ request }) => {
    // Step 1: Login
    const api = new ParaBankApiClient(request);

    const loginResponse = await api.login('john', 'demo');

    expect(loginResponse.status()).toBe(200);
    expect(loginResponse.headers()['content-type'])
        .toContain('application/json');

    const customer = await loginResponse.json();

    // Step 2: Get customer details
    const customerResponse = await api.getCustomer(customer.id);

    expect(customerResponse.status()).toBe(200);
    expect(customerResponse.headers()['content-type'])
        .toContain('application/json');

    const customerBody = await customerResponse.json();
    expect(customerBody.id).toBe(customer.id);
    expect(customerBody.firstName).toBe(customer.firstName);
    expect(customerBody.lastName).toBe(customer.lastName);
});

test('customer accounts belong to the logged-in customer and have valid fields',
    async ({ request }) => {
        // Step 1: Login
        const api = new ParaBankApiClient(request);

        const loginResponse = await api.login('john', 'demo');

        expect(loginResponse.status()).toBe(200);
        expect(loginResponse.headers()['content-type'])
            .toContain('application/json');

        const customer = await loginResponse.json();

        // Step 2: Get customer accounts
        const accountResponse = await
            api.getCustomerAccounts(customer.id);

        expect(accountResponse.status()).toBe(200);
        expect(accountResponse.headers()['content-type'])
            .toContain('application/json');

        const accountBody = await accountResponse.json();
        expect(Array.isArray(accountBody)).toBe(true);
        expect(accountBody.length).toBeGreaterThan(0);

        for (const account of accountBody) {
            expect(typeof account.id).toBe('number');
            expect(account.customerId).toBe(customer.id);
            expect(['CHECKING', 'SAVINGS']).toContain(account.type);
            expect(typeof account.balance).toBe('number');
        }
    });
