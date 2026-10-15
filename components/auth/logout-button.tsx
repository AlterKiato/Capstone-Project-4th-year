"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { logoutAction } from "@/lib/actions/auth.action";

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
            await logoutAction();

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
