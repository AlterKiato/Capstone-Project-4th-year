import "server-only";

export interface VerificationDelivery {
    assertAvailable(): void;
    sendVerificationLink(email: string, token: string): Promise<void>;
}

export interface VerificationCodeDelivery {
    assertAvailable(): void;
    sendVerificationCode(email: string, code: string): Promise<void>;
}

export interface VerificationMessage { to: string; subject: string; text: string; }

/** Internal test/local adapter seam. No default sender, SDK, logging or network calls. */
export function createDevelopmentVerificationDelivery(
    verificationPageUrl: string,
    send: (message: VerificationMessage) => Promise<void>,
): VerificationCodeDelivery {
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
        async sendVerificationCode(email, code) {
            assertAvailable();
            if (!/^[0-9]{6}$/.test(code)) throw new Error("Email verification is unavailable.");
            await send({
                to: email,
                subject: "Verify your ThesiSHS AI email",
                text: `Your ThesiSHS AI email verification code is ${code}. It expires in five minutes. Only the newest code works.`,
            });
        },
    };
}
