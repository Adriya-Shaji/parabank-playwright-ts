import type { Locator, Page } from "@playwright/test";
import type { Customer } from "../utils/customerFactory.js";

export class RegisterPage {
    private readonly page: Page;
    
    private readonly firstNameInput: Locator;
    private readonly lastNameInput: Locator;
    private readonly streetInput: Locator;
    private readonly cityInput: Locator;
    private readonly stateInput: Locator;
    private readonly zipCodeInput: Locator;
    private readonly phoneNumberInput: Locator;
    private readonly ssnInput: Locator;
    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly confirmPasswordInput: Locator;

    private readonly registerButton: Locator;

    public readonly usernameError: Locator;

    constructor(page: Page){
        this.page = page;

        this.firstNameInput = page.locator('input[name="customer.firstName"]');
        this.lastNameInput = page.locator('input[name="customer.lastName"]');
        this.streetInput = page.locator('input[name="customer.address.street"]');
        this.cityInput = page.locator('input[name="customer.address.city"]');
        this.stateInput = page.locator('input[name="customer.address.state"]');
        this.zipCodeInput = page.locator('input[name="customer.address.zipCode"]');
        this.phoneNumberInput = page.locator('input[name="customer.phoneNumber"]');
        this.ssnInput = page.locator('input[name="customer.ssn"]');
        this.usernameInput = page.locator('input[name="customer.username"]');
        this.passwordInput = page.locator('input[name="customer.password"]');
        this.confirmPasswordInput = page.locator('input[name="repeatedPassword"]');

        this.registerButton = page.getByRole('button', { name: 'Register' });

        this.usernameError = page.locator(
            '[id="customer.username.errors"]'
        );
    }

    async goto(): Promise<void> {
        await this.page.goto('register.htm');
    }

    async registerCustomer(customer: Customer): Promise<void> {
        await this.firstNameInput.fill(customer.firstName);
        await this.lastNameInput.fill(customer.lastName);
        await this.streetInput.fill(customer.address.street);
        await this.cityInput.fill(customer.address.city);
        await this.stateInput.fill(customer.address.state);
        await this.zipCodeInput.fill(customer.address.zipCode);
        await this.phoneNumberInput.fill(customer.phoneNumber);
        await this.ssnInput.fill(customer.ssn);
        await this.usernameInput.fill(customer.username);
        await this.passwordInput.fill(customer.password);
        await this.confirmPasswordInput.fill(customer.password);
        
        await this.registerButton.click();
    }
}