import { ROLE_IDS } from "./roles";

/** Grandfathered Students retain access without claiming verified email ownership. */
export function isStudentVerificationPending(account: {
    roleId: number; emailVerificationRequired: boolean; emailVerifiedAt: Date | null;
}) {
    return account.roleId === ROLE_IDS.STUDENT && account.emailVerificationRequired && account.emailVerifiedAt === null;
}
