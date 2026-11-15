import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** Existing Students use the same OTP interface through their current session. */
export default async function VerificationStatusPage() {
    await requireRole([ROLE_IDS.STUDENT]);
    redirect("/verify-email");
}
