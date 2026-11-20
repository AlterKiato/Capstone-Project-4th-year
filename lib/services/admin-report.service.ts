import "server-only";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS } from "@/lib/auth/roles";
import { findUserById } from "@/lib/repositories/user.repository";
import { readAdminReportSnapshot } from "@/lib/repositories/admin-report.repository";
import { adminReportRequestSchema, buildAdminReport, selectedReportSections } from "@/lib/reporting/admin-report";

export async function currentReportAdmin() {
    const session = await getSession();
    if (!session || session.roleId !== ROLE_IDS.ADMIN || !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    const account = await findUserById(session.userId);
    return account?.id === session.userId && account.isActive && account.roleId === ROLE_IDS.ADMIN ? session.userId : null;
}

export async function getAdminReport(input: unknown) {
    try {
        const actor = await currentReportAdmin();
        if (!actor) return { ok: false, status: 403, message: "Admin reporting access is required." } as const;
        const parsed = adminReportRequestSchema.safeParse(input);
        if (!parsed.success) return { ok: false, status: 400, message: "Choose Current Research Summary, a supported format and one or more report sections." } as const;
        const generatedAt = new Date();
        const snapshot = await readAdminReportSnapshot(selectedReportSections(parsed.data));
        if (await currentReportAdmin() !== actor) return { ok: false, status: 403, message: "Admin reporting access is required." } as const;
        return { ok: true, actor, format: parsed.data.format, report: buildAdminReport(parsed.data, snapshot, generatedAt) } as const;
    } catch {
        return { ok: false, status: 503, message: "Admin reporting is unavailable. Please try again." } as const;
    }
}
