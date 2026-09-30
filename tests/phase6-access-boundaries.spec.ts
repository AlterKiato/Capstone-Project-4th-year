import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";

async function signInAsStudent(page: Page) {
    await signInAsRole(page, "PHASE6_STUDENT_EMAIL", "PHASE6_STUDENT_PASSWORD", 3);
}

async function signInAsRole(
    page: Page,
    emailVariable: string,
    passwordVariable: string,
    roleId: number
) {
    const email = process.env[emailVariable];
    const password = process.env[passwordVariable];
    expect(email, "Test account email supplied at runtime").toBeTruthy();
    expect(password, "Test account password supplied at runtime").toBeTruthy();

    await page.goto(baseUrl + "/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL((url) => url.origin === baseUrl && url.pathname === "/dashboard");
    await expect(page.locator("main")).toContainText("Role ID: " + roleId);
}

test("A — unauthenticated direct repository access redirects to login", async ({ page }) => {
    await page.goto(baseUrl + "/dashboard/repository");

    await expect(page).toHaveURL(baseUrl + "/login");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Research Repository" })).toHaveCount(0);
});

test("B — authenticated Student can browse and search repository records", async ({ page }) => {
    await signInAsStudent(page);
    await page.goto(baseUrl + "/dashboard/repository");

    await expect(page.getByRole("heading", { name: "Research Repository" })).toBeVisible();
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.locator("main ul li")).toHaveCount(10);

    await page.locator('input[name="search"]').fill("P6TITLE");
    await page.getByRole("button", { name: "Search and filter" }).click();
    await expect(page.locator("main ul li").first()).toBeVisible();
    await expect(page.locator("main ul li h2").first()).toContainText("P6TITLE");
});

test("C — authenticated Adviser can access the published repository", async ({ page }) => {
    await signInAsRole(page, "PHASE6_ADVISER_EMAIL", "PHASE6_ADVISER_PASSWORD", 2);
    await page.goto(baseUrl + "/dashboard/repository");

    await expect(page.getByRole("heading", { name: "Research Repository" })).toBeVisible();
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.locator("main ul li")).toHaveCount(10);
});

test("D — authenticated Admin can access the published repository", async ({ page }) => {
    await signInAsRole(page, "PHASE6_ADMIN_EMAIL", "PHASE6_ADMIN_PASSWORD", 1);
    await page.goto(baseUrl + "/dashboard/repository");

    await expect(page.getByRole("heading", { name: "Research Repository" })).toBeVisible();
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.locator("main ul li")).toHaveCount(10);
});

test("F — query parameter tampering cannot change the eligible repository result set", async ({ page }) => {
    await signInAsStudent(page);
    await page.goto(baseUrl + "/dashboard/repository");
    const baselineTitles = await page.locator("main ul li h2").allTextContents();
    expect(baselineTitles).toHaveLength(10);
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");

    await page.goto(
        baseUrl + "/dashboard/repository?sort=unsupported&page=0&status=unpublished&publicationStatus=draft&researchStatus=Pending&submissionStatus=Revision%20Required&limit=999"
    );

    await expect(page.getByRole("heading", { name: "Research Repository" })).toBeVisible();
    await expect(page.locator('select[name="sort"]')).toHaveValue("newest");
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.locator("main ul li h2").allTextContents()).resolves.toEqual(baselineTitles);
});
