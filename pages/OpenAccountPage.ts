import type { Locator, Page } from "@playwright/test";

export class OpenAccountPage {
    private readonly page: Page;

    private readonly accountTypeDropdown: Locator;
    private readonly fromAccountDropdown: Locator;
    private readonly openNewAccountButton: Locator;
    public readonly newAccountId: Locator;

    constructor(page: Page) {
        this.page = page;
        this.accountTypeDropdown = page.locator('#type');
        this.fromAccountDropdown = page.locator('#fromAccountId');
        this.openNewAccountButton = page
            .locator('#openAccountForm')
            .getByRole('button', { name: 'Open New Account' });
        this.newAccountId = page.locator('#newAccountId');
    }

    async goto(): Promise<void> {
        await this.page.goto('openaccount.htm');
    }

    async openAccount(
        accountType: 'SAVINGS' | 'CHECKING', sourceAccountNumber: string
    ): Promise<void> {
        await this.accountTypeDropdown
            .selectOption({ label: accountType });

        await this.fromAccountDropdown
            .selectOption(sourceAccountNumber);

        await this.openNewAccountButton.click();
    }
}
