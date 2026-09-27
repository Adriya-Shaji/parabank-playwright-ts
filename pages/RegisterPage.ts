import type { Locator, Page } from "@playwright/test";
import type { Customer } from "../utils/customerFactory.js";

export class RegisterPage {
    readonly page: Page;
    
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly streetInput: Locator;
    readonly cityInput: Locator;
    readonly stateInput: Locator;
    readonly zipCodeInput: Locator;
    readonly phoneNumberInput: Locator;
    readonly ssnInput: Locator;
    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly confirmPasswordInput: Locator;

    readonly registerButton: Locator;

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