import { test, expect} from "@playwright/test"

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
}

test ('existing customer can log in and see their account overview', async ({page}) => {

    const username = requireEnv('TEST_USERNAME')
    const password = requireEnv('TEST_PASSWORD')
    const firstName = requireEnv('TEST_FIRSTNAME')
    const lastName = requireEnv('TEST_LASTNAME')

    await test.step('Open ParaBank home page', async () => {
        await page.goto("index.htm")
        await expect(page).toHaveTitle(/ParaBank/)
        await expect(page.getByRole('heading', {name: 'Customer Login'})).toBeVisible()
    })
    
    await test.step('Log in as existing customer', async () => {
        await page.locator('input[name="username"]').fill(username)
        await page.locator('input[name="password"]').fill(password)
        await page.getByRole('button', { name: 'Log In'}).click()
        await expect(page.getByRole('heading', { name: 'Accounts Overview' })).toBeVisible();
        await expect(page.getByText(`Welcome ${firstName} ${lastName}`)).toBeVisible()
    })

  

})




