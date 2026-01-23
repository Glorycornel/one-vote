import { expect, test } from "@playwright/test";

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

const ensureSignedIn = async (page: import("@playwright/test").Page) => {
  const email = `user-${Date.now()}-${randomSuffix()}@example.com`;
  const password = `Pass-${randomSuffix()}!`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create a poll" })).toBeVisible();

  const createAccountButton = page.getByRole("button", { name: "Create account" });
  if (await createAccountButton.isVisible().catch(() => false)) {
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await createAccountButton.click();
    await expect(page.getByText("Signed in as")).toBeVisible();
    return { email, password };
  }

  return null;
};

const createPoll = async (
  page: import("@playwright/test").Page,
  question: string,
  options: string[],
) => {
  await page.getByPlaceholder("What should we build next?").fill(question);
  await page.getByPlaceholder("Option 1").fill(options[0]);
  await page.getByPlaceholder("Option 2").fill(options[1]);
  await page.getByRole("button", { name: "Create poll" }).click();

  await page.waitForURL(/\/poll\//);
  await expect(page.getByRole("heading", { name: question })).toBeVisible();

  const url = new URL(page.url());
  const pollId = url.pathname.split("/").pop();
  if (!pollId) throw new Error("Poll ID missing from URL.");
  return pollId;
};

const openSidebar = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Open sidebar" }).click();
};

test("user can sign up and create a poll", async ({ page }) => {
  const creds = await ensureSignedIn(page);

  const question = `Best snack ${randomSuffix()}`;
  await createPoll(page, question, ["Chips", "Cookies"]);

  await page.goto("/");
  if (creds) {
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByPlaceholder("Email").fill(creds.email);
    await page.getByPlaceholder("Password").fill(creds.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Signed in as")).toBeVisible();
  }

  await openSidebar(page);
  await page.getByRole("button", { name: "My polls" }).click();

  await expect(page.getByText("Poll history")).toBeVisible();
  await expect(page.getByText(question)).toBeVisible();
});

test("vote updates totals and shows up in joined polls", async ({ page }) => {
  await ensureSignedIn(page);

  const question = `Choose a color ${randomSuffix()}`;
  await createPoll(page, question, ["Cyan", "Amber"]);

  await page.getByLabel("Cyan").check();
  await page.getByRole("button", { name: "Vote" }).click();

  await expect(page.getByText("1 total votes")).toBeVisible();

  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: "Polls joined" }).click();

  await expect(page.getByText("Participation history")).toBeVisible();
  await expect(page.getByText(question)).toBeVisible();
});
