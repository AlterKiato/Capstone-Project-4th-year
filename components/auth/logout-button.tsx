"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { logoutAction } from "@/lib/actions/auth.action";
import { logoutWithResearchPushCleanup } from "@/lib/pwa/research-push-client";
import { clearResearchDemoDrafts } from "@/lib/ai/research-demo-draft";

/**
 * Displays a button that logs out the current user.
 */
export default function LogoutButton({ icon, labelClassName, className }: { icon?: React.ReactNode; labelClassName?: string; className?: string }) {
    const router = useRouter();

    const [isPending, startTransition] = useTransition();

    /**
     * Deletes the current user's session and redirects
     * them to the login page.
     */
    function handleLogout() {
        startTransition(async () => {
            // Document capture draft protection has already accepted this click before onClick runs.
            clearResearchDemoDrafts();
            await logoutWithResearchPushCleanup(logoutAction);

            router.push("/login");
            router.refresh();
        });
    }

    return (
        <button
            type="button"
            className={className}
            aria-label={isPending ? "Logging out..." : "Logout"}
            title="Logout"
            onClick={handleLogout}
            disabled={isPending}
        >
            {icon}<span className={labelClassName}>{isPending ? "Logging out..." : "Logout"}</span>
        </button>
    );
}
