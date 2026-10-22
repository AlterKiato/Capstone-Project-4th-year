import "server-only";
import nodemailer from "nodemailer";
import { createDevelopmentVerificationDelivery, type VerificationDelivery } from "./verification-delivery";

/** Opt-in local capture only. No generic SMTP URL, auth, external host or fallback. */
export function createMailpitVerificationDelivery(): VerificationDelivery {
    const assertAvailable = () => {
        if (process.env.NODE_ENV !== "development" || process.env.THESISHS_LOCAL_MAILPIT !== "enabled")
            throw new Error("Local verification delivery is unavailable.");
    };
    assertAvailable();
    const origin = new URL(process.env.THESISHS_VERIFICATION_ORIGIN ?? "");
    if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
        origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/")
        throw new Error("A local verification origin is required.");
    const smtp = nodemailer.createTransport({
        host: "127.0.0.1", port: 1025, secure: false, ignoreTLS: true,
        connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
        disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
    });
    const delivery = createDevelopmentVerificationDelivery(new URL("/verify-email", origin).href, async message => {
        assertAvailable();
        // Until production delivery is separately approved, even local capture is synthetic-only.
        if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.invalid$/i.test(message.to))
            throw new Error("Local delivery requires a synthetic recipient.");
        await smtp.sendMail({ from: "ThesiSHS AI <verification@thesishs.invalid>", ...message });
    });
    return { assertAvailable, sendVerificationLink: (email, token) => delivery.sendVerificationLink(email, token) };
}
