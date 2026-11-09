import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { ROLE_IDS } from "@/lib/auth/roles";
import { findCurrentMainAdviserId } from "@/lib/repositories/research-supervision.repository";

/** Uncached current identity and designation, never caller/JWT designation claims. */
export async function getCurrentMainAdviser(expectedUserId?: number) {
    try {
        const account = await getCurrentAccount();
        if (!account || account.roleId !== ROLE_IDS.ADVISER ||
            (expectedUserId !== undefined && account.userId !== expectedUserId)) return null;
        return await findCurrentMainAdviserId() === account.userId ? account : null;
    } catch { return null; }
}

/** Notification failure or an unconfigured designation must not undo a Student submission. */
export async function getMainAdviserNotificationRecipient() {
    try { return await findCurrentMainAdviserId(); }
    catch { return null; }
}
