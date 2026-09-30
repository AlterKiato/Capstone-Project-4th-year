import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const baseUrl = "http://localhost:3000";
const researchTitle = "SPRINT3I8_FIXVERIFY_20261001";

async function signInAsAdviser(page: Page) {
    const email = process.env.PHASE4_ADVISER_EMAIL;
    const password = process.env.PHASE4_ADVISER_PASSWORD;
    expect(email, "Adviser test email supplied at runtime").toBeTruthy();
    expect(password, "Adviser test password supplied at runtime").toBeTruthy();

    await page.goto(baseUrl + "/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL((url) => url.origin === baseUrl && url.pathname === "/dashboard");
}

test("Adviser submission details display the current status for every review outcome", async ({ page }) => {
    await signInAsAdviser(page);
    await page.goto(baseUrl + "/dashboard/adviser/submissions");

    const rows = page.locator("tbody tr").filter({ hasText: researchTitle });
    await expect(rows).toHaveCount(2);

    for (const [version, status] of [["v1", "Revision Required"], ["v2", "Approved"]]) {
        const matchingRows = await rows.all();
        let row = matchingRows[0];
        for (const candidate of matchingRows) {
            if ((await candidate.locator("td").nth(3).innerText()).trim() === version) {
                row = candidate;
                break;
            }
        }
        await row.getByRole("link", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Submission Details" })).toBeVisible();
        await expect(page.getByText(status, { exact: true })).toBeVisible();

        if (version === "v2") {
            const pdfResponsePromise = page.waitForResponse((response) =>
                response.url().includes("/storage/v1/object/sign/")
            );
            await page.getByRole("button", { name: "View / Download" }).click();
            const pdfResponse = await pdfResponsePromise;
            const signedUrl = pdfResponse.url();
            expect(signedUrl).toContain("/storage/v1/object/sign/");
            expect(pdfResponse.status()).toBe(200);
            expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
            expect(signedUrl).toContain("/research/16/v2/");
        }

        if (version !== "v2") {
            await page.goto(baseUrl + "/dashboard/adviser/submissions");
        }
    }
});
