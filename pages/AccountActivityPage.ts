import type { Page, Locator } from "@playwright/test";

export class AccountActivityPage{
    private readonly page: Page;
    
    public readonly accountNumber: Locator;

    constructor(page: Page) {
        this.page = page;

        this.accountNumber = page
        .locator('#accountId');
    }
}