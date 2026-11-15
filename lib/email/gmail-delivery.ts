import "server-only";
import nodemailer from "nodemailer";
import { emailOtpDeliveryMode } from "@/lib/auth/email-otp-config";
import { verificationEmailSchema, verificationOtpSchema } from "@/lib/validations/email-verification";
import type { VerificationCodeDelivery } from "./verification-delivery";

/** One awaited send, no pooling/retries, no provider response details escape this adapter. */
export function createGmailVerificationDelivery(): VerificationCodeDelivery {
    function configuration() {
        if (emailOtpDeliveryMode() !== "gmail") throw new Error("Email delivery is unavailable.");
        const user = verificationEmailSchema.safeParse(process.env.THESISHS_GMAIL_USER);
        const password = process.env.THESISHS_GMAIL_APP_PASSWORD?.replaceAll(" ", "");
        if (!user.success || !password || !/^[A-Za-z0-9]{16}$/.test(password)) throw new Error("Email delivery is unavailable.");
        return { user: user.data, pass: password };
    }
    return {
        assertAvailable() { configuration(); },
        async sendVerificationCode(email, code) {
            try {
                const auth = configuration();
                if (!verificationEmailSchema.safeParse(email).success || !verificationOtpSchema.safeParse(code).success)
                    throw new Error("Invalid delivery input.");
                const smtp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth,
                    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
                    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
                try {
                    const info = await smtp.sendMail({ from: `ThesiSHS AI <${auth.user}>`, to: email,
                        subject: "Verify your ThesiSHS AI email",
                        text: `Your ThesiSHS AI email verification code is ${code}. It expires in five minutes. Only the newest code works.` });
                    if (!info.accepted.includes(email)) throw new Error("Email not accepted.");
                } finally { smtp.close(); }
            } catch { throw new Error("Email delivery could not be confirmed. Wait a minute before requesting another code."); }
        },
    };
}
