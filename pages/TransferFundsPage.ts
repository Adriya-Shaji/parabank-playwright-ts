import type { Locator, Page } from "@playwright/test";

export class TransferFundsPage {
    private readonly page: Page;
    private readonly transferAmountInput: Locator;
    private readonly fromAccount: Locator;
    private readonly toAccount: Locator;
    private readonly transferButton: Locator;

    public readonly transferCompleteHeading: Locator;
    public readonly amountResult: Locator;
    public readonly fromAccountResult: Locator;
    public readonly toAccountResult: Locator;

    constructor(page: Page) {
        this.page = page;
        this.transferAmountInput = page.locator('#amount');
        this.fromAccount = page.locator('#fromAccountId');
        this.toAccount = page.locator('#toAccountId');
        this.transferButton = page
            .locator('#transferForm')
            .getByRole('button', { name: 'Transfer' }
            );

        this.transferCompleteHeading = page.getByRole(
            'heading', { name: "Transfer Complete!", exact: true }
        );
        this.amountResult = page.locator('#amountResult');
        this.fromAccountResult = page.locator('#fromAccountIdResult');
        this.toAccountResult = page.locator('#toAccountIdResult');
    }

    async goto(): Promise<void> {
        await this.page.goto('transfer.htm');
    }

    async transferFunds(
        amount: string,
        fromAccountNumber: string,
        toAccountNumber: string
    ): Promise<void> {
        await this.transferAmountInput.fill(amount);
        await this.fromAccount.selectOption(fromAccountNumber);
        await this.toAccount.selectOption(toAccountNumber);
        await this.transferButton.click();
    }
}
