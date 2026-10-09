import type { Locator, Page } from "@playwright/test";

export class AccountsOverviewPage {
    private readonly page: Page;

    private readonly accountTable: Locator;

    constructor(page: Page) {
        this.page = page;

        this.accountTable = page.locator('#accountTable');
    }

    async goto(): Promise<void> {
        await this.page.goto('overview.htm');
    }

    getAccountLinks(): Locator {
        return this.accountTable
            .locator('tbody')
            .getByRole('link');
    }

    getAccountRow(accountNumber: string): Locator {
        return this.accountTable
            .getByRole('row')
            .filter({
                has: this.page.getByRole('link', {
                    name: accountNumber,
                    exact: true
                })
            });
    }

    getAccountBalance(accountNumber: string): Locator {
        // Row is already identified by account number.
        // <thead> defines Balance as the second column.
        return this.getAccountRow(accountNumber)
            .getByRole('cell')
            .nth(1);
    }
}
