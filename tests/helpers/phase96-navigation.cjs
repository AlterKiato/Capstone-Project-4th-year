async function navigation(page) {
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
    const toggle = page.getByRole('button', { name: 'Open navigation menu', exact: true });
    if (await toggle.isVisible() && !await drawer.isVisible()) await toggle.click();
    return await drawer.isVisible() ? drawer : page.getByRole('complementary', { name: 'Workspace sidebar' });
}
module.exports = { navigation };
