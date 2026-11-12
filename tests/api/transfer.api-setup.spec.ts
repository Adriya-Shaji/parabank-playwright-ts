import { test, expect } from "../../fixtures/test-fixtures.js";
import { ParaBankApiClient } from "../../utils/parabankApiClient.js";
import { requireOk, openAccountAndConfirm, getStoredAccount } from "../../utils/accountSetup.js";

function toCents(amount: number): number {
    return Math.round(amount * 100)
}

test('API transfer updates the source and destination account balances', async ({
    request,
    registeredCustomer
}) => {
    const api = new ParaBankApiClient(request);
    
    // 1. Login with the freshly registered customer
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

    // 2. Get the customer's existing source account
    const accountResponse = await api.getCustomerAccounts(customerId);
    await requireOk(accountResponse, 'get customer accounts');

    const accounts:unknown = await accountResponse.json();

    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No source account available');
    }

    const firstAccount: unknown = accounts[0];

    if (
       typeof firstAccount !== 'object' ||
       firstAccount === null ||
       !('id' in firstAccount) ||
       typeof firstAccount.id !== 'number' ||
       !(Number.isInteger(firstAccount.id)) ||
       !('customerId' in firstAccount) || 
       firstAccount.customerId !== customerId
    ) {
        throw new Error(
            `Invalid source account: ${JSON.stringify(firstAccount)}`
        );
    }
  
    const sourceAccountId = firstAccount.id;

    //3. Create and confirm a SAVINGS account
    const newAccount = await openAccountAndConfirm(
        api,
        customerId,
        'SAVINGS',
        sourceAccountId
    );

    const destinationAccountId = newAccount.id;

    // 4. Read both balances immediately before transfer
    const sourceBefore = await getStoredAccount(
        api, customerId, sourceAccountId, 'CHECKING'
    );

    const destinationBefore = await getStoredAccount(
        api, customerId, destinationAccountId, 'SAVINGS'
    );

    // 5. Transfer $10 through the API
    const transferResponse = await api.transfer(
        sourceAccountId, destinationAccountId, 10
    );

    await requireOk(transferResponse, 'transfer $10');

    // 6. Read balances after transfer
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
});
