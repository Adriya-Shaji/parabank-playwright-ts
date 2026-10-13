import type { Locator, Page } from "@playwright/test";

export class LoginPage {
    private readonly page: Page;

    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly loginButton: Locator;
    private readonly logoutLink: Locator;

    public readonly errorMessage: Locator;

    constructor(page: Page){
        this.page = page;

        this.usernameInput = page.locator('input[name="username"]');
        this.passwordInput = page.locator('input[name="password"]');
        this.loginButton = page.getByRole('button', { name: 'Log In' });
        this.logoutLink = page.getByRole('link', { name: 'Log Out' });

        this.errorMessage = page.locator('#rightPanel p.error');
    }

    async goto(): Promise<void> {
        await this.page.goto('index.htm');
    }

    async login(username: string, password: string): Promise<void> {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    async logout(): Promise<void> {
        await this.logoutLink.click();
    }
}
