
import { test, expect} from "@playwright/test"

test('ParaBank home page loads', async ({ page }) => {
  await page.goto('index.htm');

  await expect(page).toHaveTitle(/ParaBank/);
  await expect(
    page.getByRole('heading', { name: 'Customer Login' })
  ).toBeVisible();
});

