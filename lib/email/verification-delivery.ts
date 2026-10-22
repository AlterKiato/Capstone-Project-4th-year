import "server-only";

export interface VerificationDelivery {
    assertAvailable(): void;
    sendVerificationLink(email: string, token: string): Promise<void>;
}

export interface VerificationMessage { to: string; subject: string; text: string; }

/** Internal test/local adapter seam. No default sender, SDK, logging or network calls. */
export function createDevelopmentVerificationDelivery(
    verificationPageUrl: string,
    send: (message: VerificationMessage) => Promise<void>,
): VerificationDelivery {
    function assertAvailable() {
        if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test")
            throw new Error("Development verification delivery is unavailable.");
    }
    assertAvailable();
    const page = new URL(verificationPageUrl);
    if (page.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(page.hostname) ||
        page.username || page.password || page.search || page.hash)
        throw new Error("A loopback verification page is required.");

    return {
        assertAvailable,
        async sendVerificationLink(email, token) {
            assertAvailable();
            const link = new URL(page);
            // Fragments are never sent in HTTP requests or access-log URLs.
            link.hash = new URLSearchParams({ token }).toString();
            await send({
                to: email,
                subject: "Verify your ThesiSHS AI email",
                text: `Confirm your email by opening this link and explicitly submitting the confirmation. The link expires in 60 minutes.\n${link.href}`,
            });
        },
    };
}
