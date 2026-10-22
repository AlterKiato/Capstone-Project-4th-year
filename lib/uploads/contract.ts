import { z } from "zod";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_LIFETIME_MS = 15 * 60 * 1000;
export const UPLOAD_CLEANUP_GRACE_MS = 10 * 60 * 1000;
export const UPLOAD_BUCKET = "research-submissions";
export const uploadIdSchema = z.uuid().transform(value => value.toLowerCase());
export const uploadInputSchema = z.strictObject({
    requestKey: uploadIdSchema,
    paperId: z.number().int().positive().max(2147483647),
    fileName: z.string().min(1).max(255),
    size: z.number().int().positive().max(UPLOAD_MAX_BYTES),
    contentType: z.literal("application/pdf"),
    remarks: z.string().trim().max(500).optional(),
});
export type UploadInput = z.infer<typeof uploadInputSchema>;
export type UploadState = "pending" | "completed" | "cancelled" | "rejected";
export type UploadIntent = {
    id: string; studentId: number; paperId: number; requestKey: string;
    stagingPath: string; fileName: string; declaredSize: number; remarks: string | null;
    createdAt: Date; expiresAt: Date; capabilityExpiresAt: Date | null;
    state: UploadState; submissionId: number | null; finalPath: string | null; contentSha256: string | null;
};
export type UploadSubmission = { id: number; paperId: number; submittedBy: number; version: string; fileUrl: string; status: string };
export type UploadContext = {
    account?: { roleId: number; isActive: boolean };
    paper?: { id: number; groupId: number; title: string };
    group?: { id: number; status: string; adviserId: number };
    member: boolean; submissions: UploadSubmission[];
};
export interface UploadTransaction {
    context: UploadContext;
    now(): Promise<Date>;
    intent(id: string): Promise<UploadIntent | undefined>;
    byRequest(key: string): Promise<UploadIntent | undefined>;
    recent(): Promise<UploadIntent[]>;
    insert(intent: UploadIntent): Promise<UploadIntent>;
    patch(id: string, data: Partial<Pick<UploadIntent, "state" | "capabilityExpiresAt" | "finalPath" | "contentSha256" | "submissionId">>): Promise<UploadIntent>;
    submit(intent: UploadIntent, version: string): Promise<UploadSubmission>;
}
export interface UploadRepository {
    owned(id: string, studentId: number): Promise<UploadIntent | undefined>;
    locked<T>(studentId: number, paperId: number, operation: (tx: UploadTransaction) => Promise<T>, signal?: AbortSignal): Promise<T>;
}
export interface UploadStorage {
    issue(path: string, signal: AbortSignal): Promise<{ url: string; publishableKey: string; expiresAt: Date }>;
    exists(path: string, signal: AbortSignal): Promise<boolean>;
    read(path: string, declaredSize: number, signal: AbortSignal): Promise<Uint8Array>;
    writeOrReconcile(path: string, bytes: Uint8Array, digest: string, signal: AbortSignal): Promise<void>;
}
export type UploadResult = {
    success: boolean; message: string; code: "ready" | "pending" | "completed" | "closed" | "invalid" | "unavailable" | "conflict";
    intentId?: string; expiresAt?: string; uploaded?: boolean;
    fileName?: string; size?: number;
    submissionId?: number; version?: string;
    capability?: { url: string; publishableKey: string; expiresAt: string };
};
export function safeUploadFileName(name: string) {
    const base = (name.split(/[\\/]/).pop() ?? "").replace(/\.pdf$/i, "").trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
    return `${base || "research-document"}.pdf`;
}
export const stagingPathFor = (id: string) => `staging/submissions/${id}/upload.pdf`;
export function validIntentPaths(intent: UploadIntent) {
    return Number.isSafeInteger(intent.paperId) && intent.paperId > 0 && uploadIdSchema.safeParse(intent.id).success && intent.stagingPath === stagingPathFor(intent.id) &&
        /^[a-zA-Z0-9_-]+\.pdf$/.test(intent.fileName) && intent.fileName.length <= 144 &&
        (intent.finalPath === null || new RegExp(`^research/${intent.paperId}/v[1-9][0-9]*/${intent.id}-[a-zA-Z0-9_-]+\\.pdf$`).test(intent.finalPath));
}
export class UploadFailure extends Error {
    constructor(public readonly kind: "invalid" | "conflict" | "closed" | "unavailable") { super("Upload operation unavailable."); }
}
export function nextUploadVersion(rows: UploadSubmission[]) {
    let highest = 0, latest: UploadSubmission | undefined;
    for (const row of rows) {
        const match = /^v(\d+)$/.exec(row.version);
        if (match && Number(match[1]) > highest) { highest = Number(match[1]); latest = row; }
    }
    if (latest && latest.status !== "Revision Required") throw new UploadFailure("conflict");
    const next = highest + 1;
    if (!Number.isSafeInteger(next) || `v${next}`.length > 20) throw new UploadFailure("unavailable");
    return `v${next}`;
}
