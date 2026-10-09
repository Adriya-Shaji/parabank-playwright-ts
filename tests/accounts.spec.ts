import { test, expect } from '@playwright/test';
import { AccountsOverviewPage } from '../pages/AccountsOverviewPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { createUniqueCustomer } from '../utils/customerFactory.js';
import { OpenAccountPage } from '../pages/OpenAccountPage.js';

test.describe.configure({ mode: 'default' });

const positiveMoneyPattern =
    /^\$(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}$/;

// The Open New Account form deposits $100.00 into the new account.
const OPENING_DEPOSIT_CENTS = 10000;

function positiveBalanceToCents(balanceText: string): number {
    if (!positiveMoneyPattern.test(balanceText)) {
        throw new Error(
            `Unsupported balance format: '${balanceText}'`
        );
    }

    const centsText = balanceText.replace(/[$,.]/g, '');

    return Number(centsText);
}

// Formatting intentionally omits thousands separators because
// this test only uses balances below $1,000.
function centsToBalanceText(cents: number): string {
    if (!Number.isInteger(cents) || cents < 0) {
        throw new Error(
            `Unsupported cents value: ${cents}`
        );
    }

    const dollars = Math.floor(cents / 100);
    const remainingCents = cents % 100;

    const centsText = remainingCents
        .toString()
        .padStart(2, '0');

    return `$${dollars}.${centsText}`;
}

test('opens a savings account and updates account balances', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const accountsOverviewPage = new AccountsOverviewPage(page);

    await registerPage.goto();

    const rightPanel = page.locator('#rightPanel');

    const customer = createUniqueCustomer();
    await registerPage.registerCustomer(customer);

    // Minimal prerequisite check: registration actually succeeded
    await expect(
        rightPanel.getByText(
            'Your account was created successfully. You are now logged in.',
            { exact: true }
        )
    ).toBeVisible();

    await accountsOverviewPage.goto();

    const accountLinks = accountsOverviewPage.getAccountLinks();

    await expect(accountLinks).toHaveCount(1);
    await expect(accountLinks).toHaveText(/^\d+$/);

    const sourceAccountNumber = await accountLinks.innerText();

    // Precondition: the source account must hold at least $100.00.
    const sourceBalance =
        accountsOverviewPage.getAccountBalance(sourceAccountNumber);

    await expect(sourceBalance)
        .toHaveText(positiveMoneyPattern);

    const sourceBalanceText = await sourceBalance.innerText();

    const sourceBalanceCents =
        positiveBalanceToCents(sourceBalanceText);

    const expectedSourceBalanceText =
        centsToBalanceText(
            sourceBalanceCents - OPENING_DEPOSIT_CENTS
        );

    const openAccountPage = new OpenAccountPage(page);

    await openAccountPage.goto();

    await openAccountPage.openAccount(
        'SAVINGS',
        sourceAccountNumber
    );

    await expect(openAccountPage.newAccountId)
        .toHaveText(/^\d+$/);

    const newAccount =
        await openAccountPage.newAccountId.innerText();

    await accountsOverviewPage.goto();

    await expect(
        accountsOverviewPage.getAccountRow(newAccount)
    ).toBeVisible();

    await expect(
        accountsOverviewPage.getAccountBalance(newAccount)
    ).toHaveText('$100.00');

    await expect(
        accountsOverviewPage.getAccountBalance(sourceAccountNumber)
    ).toHaveText(expectedSourceBalanceText);
});
