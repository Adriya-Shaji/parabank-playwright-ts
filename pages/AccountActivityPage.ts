import type { Page, Locator } from "@playwright/test";

export class AccountActivityPage {
    private readonly page: Page;

    public readonly accountNumber: Locator;

    constructor(page: Page) {
        this.page = page;

        this.accountNumber = page
            .locator('#accountId');
    }

    transactionRow(
        description: string,
        amount: string): Locator {
        return this.page
            .locator('#transactionTable tbody tr')
            .filter({ hasText: description })
            .filter({
                has: this.page.getByRole('cell', {
                    name: amount,
                    exact: true
                })
            });
    }
}