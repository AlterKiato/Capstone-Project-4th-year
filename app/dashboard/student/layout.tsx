import { redirect } from "next/navigation";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
    // A segment layout runs outside this segment's loading.tsx Suspense boundary.
    const account = await getDashboardAccount();
    if (!account) return null; // The shared layout renders the account-access error.
    if (account.roleId !== ROLE_IDS.STUDENT) redirect("/dashboard");
    return children;
}
