import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";

test("Phase 6 empty results and Clear filters acceptance", async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);
    await page.goto(`${baseUrl}/login`);
    const email = process.env.PHASE6_STUDENT_EMAIL;
    const password = process.env.PHASE6_STUDENT_PASSWORD;
    expect(email, "Student test account email supplied at runtime").toBeTruthy();
    expect(password, "Student test account password supplied at runtime").toBeTruthy();
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(
        (url) => url.origin === baseUrl && url.pathname.startsWith("/dashboard"),
        { timeout: 5 * 60 * 1000 }
    );
    await expect(page.locator("main")).toContainText("Role ID: 3");

    await page.goto(`${baseUrl}/dashboard/repository`);
    await expect(page.getByRole("heading", { name: "Research Repository" })).toBeVisible();
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");

    const cards: Array<{ title: string; metadata: string; category: string }> = [];
    const readCards = async () => {
        const nodes = await page.locator("main ul li").all();
        for (const node of nodes) {
            const paragraphs = await node.locator("p").allTextContents();
            cards.push({
                title: (await node.locator("h2").innerText()).trim(),
                metadata: (paragraphs[0] ?? "").trim(),
                category: (paragraphs.find((text) => text.trim().startsWith("Category:")) ?? "")
                    .replace(/^\s*Category:\s*/, "")
                    .trim(),
            });
        }
    };
    await readCards();
    const categories = await page.locator('select[name="category"] option').evaluateAll(
        (options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
    );
    const schoolYears = await page.locator('select[name="schoolYear"] option').evaluateAll(
        (options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
    );
    const strands = await page.locator('select[name="strand"] option').evaluateAll(
        (options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
    );
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await readCards();
    expect(cards).toHaveLength(11);
    await page.getByRole("link", { name: "Previous", exact: true }).click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    const emptyFilterCombination = categories
        .flatMap((category) => schoolYears.flatMap((schoolYear) => strands.map((strand) => ({ category, schoolYear, strand }))))
        .find(({ category, schoolYear, strand }) => !cards.some((card) =>
            card.category === category && card.metadata.includes(schoolYear) && card.metadata.includes(strand)
        ));
    expect(emptyFilterCombination, "a valid filter combination with zero matching papers").toBeTruthy();

    const expectEmpty = async () => {
        await expect(page.getByText("No results match your search and filters.", { exact: true })).toBeVisible();
        await expect(page.locator("main ul li")).toHaveCount(0);
        await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("0");
        await expect(page.getByRole("navigation", { name: "Repository result pages" })).toHaveCount(0);
    };

    // A: an unmatched search must show only the empty state.
    await page.locator('input[name="search"]').fill("P6_EMPTY_NO_MATCH_20260930_X7Q");
    await page.getByRole("button", { name: "Search and filter" }).click();
    await expectEmpty();
    console.log("PASS A — empty search results; no unrelated papers or pagination.");

    // B: every selected value exists, but this combination has no matching paper.
    await page.goto(`${baseUrl}/dashboard/repository`);
    await page.locator('select[name="category"]').selectOption(emptyFilterCombination!.category);
    await page.locator('select[name="schoolYear"]').selectOption(emptyFilterCombination!.schoolYear);
    await page.locator('select[name="strand"]').selectOption(emptyFilterCombination!.strand);
    await page.getByRole("button", { name: "Search and filter" }).click();
    await expectEmpty();
    console.log("PASS B — valid zero-result filter combination; no misleading pagination.");

    // C: clear combined search/filter criteria and confirm the default listing and URL.
    await page.locator('input[name="search"]').fill("P6_EMPTY_NO_MATCH_20260930_X7Q");
    await page.getByRole("button", { name: "Search and filter" }).click();
    await expectEmpty();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard/repository" && url.searchParams.size === 0);
    await expect(page.locator('input[name="search"]')).toHaveValue("");
    await expect(page.locator('select[name="category"]')).toHaveValue("");
    await expect(page.locator('select[name="schoolYear"]')).toHaveValue("");
    await expect(page.locator('select[name="strand"]')).toHaveValue("");
    await expect(page.locator('select[name="sort"]')).toHaveValue("newest");
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.locator("main ul li")).toHaveCount(10);
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    console.log("PASS C — Clear filters removes the query string, resets controls, and restores page 1 of the default listing.");

    // D: clear partial criteria after a search/filter combination returns no papers.
    const titlePaper = cards.find((card) => card.title.includes("P6TITLE"));
    expect(titlePaper, "the synthetic paper with the P6TITLE search marker").toBeTruthy();
    const otherCategory = categories.find((category) => category !== titlePaper!.category);
    expect(otherCategory, "a valid category not belonging to the P6TITLE paper").toBeTruthy();
    await page.locator('input[name="search"]').fill("P6TITLE");
    await page.locator('select[name="category"]').selectOption(otherCategory!);
    await page.getByRole("button", { name: "Search and filter" }).click();
    await expectEmpty();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard/repository" && url.searchParams.size === 0);
    await expect(page.locator('input[name="search"]')).toHaveValue("");
    await expect(page.locator('select[name="category"]')).toHaveValue("");
    await expect(page.locator('select[name="schoolYear"]')).toHaveValue("");
    await expect(page.locator('select[name="strand"]')).toHaveValue("");
    await expect(page.locator('select[name="sort"]')).toHaveValue("newest");
    await expect(page.locator('main p[aria-live="polite"]').first()).toContainText("of 11 research papers");
    await expect(page.locator("main ul li")).toHaveCount(10);
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    console.log("PASS D — clearing partial criteria resets controls and restores the default listing.");
});
