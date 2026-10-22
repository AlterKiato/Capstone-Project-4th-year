// Server business rules with explicit I/O boundaries for isolated tests and future secured API reuse.
import { createHash, randomUUID } from "node:crypto";
import { UploadFailure, UPLOAD_LIFETIME_MS, nextUploadVersion, safeUploadFileName, stagingPathFor,
    uploadIdSchema, uploadInputSchema, validIntentPaths } from "./contract";
import type { UploadContext, UploadIntent, UploadRepository, UploadResult, UploadStorage, UploadTransaction } from "./contract";

const unavailable = (): UploadResult => ({ success: false, code: "unavailable", message: "The upload could not be confirmed. Check its status before retrying." });
const failure = (error: unknown): UploadResult => {
    const code = error instanceof UploadFailure ? error.kind : "unavailable";
    return code === "unavailable" ? unavailable() : { success: false, code, message: code === "invalid"
        ? "Check the PDF type, contents and 10 MiB size limit. Choose a new upload if the file was rejected."
        : code === "closed" ? "This upload is closed or expired. Start a new upload if needed."
            : "The project or upload state changed. Refresh its status before continuing." };
};
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function authorize(context: UploadContext) {
    if (!context.account?.isActive || context.account.roleId !== 3 || !context.paper || !context.group ||
        context.group.status !== "active" || context.paper.groupId !== context.group.id || !context.member)
        throw new UploadFailure("unavailable");
}
function pending(intent: UploadIntent, now: Date) {
    if (intent.state !== "pending" || intent.expiresAt.getTime() <= now.getTime()) throw new UploadFailure("closed");
    if (!validIntentPaths(intent)) throw new UploadFailure("unavailable");
}
function completed(intent: UploadIntent, context: UploadContext): UploadResult {
    const row = context.submissions.find(row => row.id === intent.submissionId && row.paperId === intent.paperId &&
        row.submittedBy === intent.studentId && row.fileUrl === intent.finalPath);
    if (!row) throw new UploadFailure("unavailable");
    return { success: true, code: "completed", message: "Research submitted successfully.", intentId: intent.id, submissionId: row.id, version: row.version };
}
const summary = (intent: UploadIntent, uploaded = false): UploadResult => ({ success: true, code: uploaded ? "ready" : "pending",
    message: uploaded ? "PDF uploaded. Select Submit research to create the submission." : "Upload prepared. No research submission has been created.",
    intentId: intent.id, expiresAt: intent.expiresAt.toISOString(), fileName: intent.fileName, size: intent.declaredSize, uploaded });

export function createSubmissionUploadWorkflow(dependencies: {
    repository: UploadRepository; storage: UploadStorage; actor(): Promise<number | null>;
    notify(adviserId: number, version: string, title: string): Promise<unknown>;
}) {
    const { repository, storage } = dependencies;
    let finalizations = 0, issuances = 0;
    async function actor() {
        const student = await dependencies.actor();
        if (!student || !Number.isSafeInteger(student) || student <= 0) throw new UploadFailure("unavailable");
        return student;
    }
    async function owned(value: unknown, studentId: number) {
        const parsed = uploadIdSchema.safeParse(value);
        if (!parsed.success) throw new UploadFailure("invalid");
        const intent = await repository.owned(parsed.data, studentId);
        if (!intent || !validIntentPaths(intent)) throw new UploadFailure("unavailable");
        return intent;
    }
    async function locked<T>(intent: UploadIntent, operation: (tx: UploadTransaction, current: UploadIntent) => Promise<T>, signal?: AbortSignal) {
        return repository.locked(intent.studentId, intent.paperId, async tx => {
            authorize(tx.context);
            const current = await tx.intent(intent.id);
            if (!current || !validIntentPaths(current)) throw new UploadFailure("unavailable");
            return operation(tx, current);
        }, signal);
    }
    async function capability(intent: UploadIntent): Promise<UploadResult> {
        if (issuances >= 2) return unavailable();
        issuances++;
        const signal = AbortSignal.timeout(20000);
        try {
            const initial = await locked(intent, async (tx, current) => {
                if (current.state === "completed") return completed(current, tx.context);
                pending(current, await tx.now()); nextUploadVersion(tx.context.submissions); return null;
            }, signal);
            if (initial) return initial;
            if (await storage.exists(intent.stagingPath, signal)) return summary(intent, true);
            const signed = await storage.issue(intent.stagingPath, signal);
            // Do not expose a token before its expiration bound has durably committed.
            const persisted = await locked(intent, async (tx, current) => {
                pending(current, await tx.now()); nextUploadVersion(tx.context.submissions);
                const expiry = current.capabilityExpiresAt && current.capabilityExpiresAt > signed.expiresAt ? current.capabilityExpiresAt : signed.expiresAt;
                return tx.patch(current.id, { capabilityExpiresAt: expiry });
            }, signal);
            return { ...summary(persisted), capability: { url: signed.url, publishableKey: signed.publishableKey, expiresAt: signed.expiresAt.toISOString() } };
        } finally { issuances--; }
    }
    async function initiate(input: unknown): Promise<UploadResult> {
        let created: UploadIntent | undefined;
        try {
            const parsed = uploadInputSchema.safeParse(input);
            if (!parsed.success) throw new UploadFailure("invalid");
            const data = parsed.data, studentId = await actor(), signal = AbortSignal.timeout(20000);
            const intent = await repository.locked(studentId, data.paperId, async tx => {
                authorize(tx.context);
                const existing = await tx.byRequest(data.requestKey), fileName = safeUploadFileName(data.fileName), remarks = data.remarks || null;
                if (existing) {
                    if (existing.paperId !== data.paperId || existing.fileName !== fileName || existing.declaredSize !== data.size || existing.remarks !== remarks)
                        throw new UploadFailure("conflict");
                    return existing;
                }
                nextUploadVersion(tx.context.submissions);
                const now = await tx.now(), recent = await tx.recent();
                const live = recent.filter(row => row.state === "pending" && row.expiresAt > now);
                if (recent.length >= 10 || live.length >= 2 || live.some(row => row.paperId === data.paperId)) throw new UploadFailure("conflict");
                const id = randomUUID();
                return tx.insert({ id, studentId, paperId: data.paperId, requestKey: data.requestKey,
                    stagingPath: stagingPathFor(id), fileName, declaredSize: data.size, remarks,
                    createdAt: now, expiresAt: new Date(now.getTime() + UPLOAD_LIFETIME_MS), capabilityExpiresAt: null,
                    state: "pending", submissionId: null, finalPath: null, contentSha256: null });
            }, signal);
            created = intent;
            return await capability(intent);
        } catch (error) { return { ...failure(error), ...(created ? { intentId: created.id, expiresAt: created.expiresAt.toISOString(), fileName: created.fileName, size: created.declaredSize } : {}) }; }
    }
    async function renew(id: unknown): Promise<UploadResult> {
        try { return await capability(await owned(id, await actor())); } catch (error) { return failure(error); }
    }
    async function status(id: unknown): Promise<UploadResult> {
        try {
            const intent = await owned(id, await actor()), signal = AbortSignal.timeout(10000);
            const result = await locked(intent, async (tx, current) => {
                if (current.state === "completed") return completed(current, tx.context);
                pending(current, await tx.now()); return summary(current);
            }, signal);
            if (result.code === "completed") return result;
            return { ...result, uploaded: await storage.exists(intent.stagingPath, signal), code: "pending" };
        } catch (error) { return failure(error); }
    }
    async function cancel(id: unknown): Promise<UploadResult> {
        try {
            const intent = await owned(id, await actor());
            return await locked(intent, async (tx, current) => {
                if (current.state === "completed") return completed(current, tx.context);
                if (current.state === "pending") await tx.patch(current.id, { state: "cancelled" });
                return { success: true, code: "closed", intentId: current.id, message: "Upload cancelled. No submission was created. A transfer already in flight may still reach private staging." };
            }, AbortSignal.timeout(10000));
        } catch (error) { return failure(error); }
    }
    async function finalize(id: unknown): Promise<UploadResult> {
        if (finalizations >= 2) return unavailable();
        finalizations++;
        const signal = AbortSignal.timeout(55000);
        let intent: UploadIntent | undefined;
        try {
            intent = await owned(id, await actor());
            const initial = await locked(intent, async (tx, current) => {
                if (current.state === "completed") return completed(current, tx.context);
                pending(current, await tx.now()); nextUploadVersion(tx.context.submissions); return null;
            }, signal);
            if (initial) return initial;
            const bytes = await storage.read(intent.stagingPath, intent.declaredSize, signal), hash = digest(bytes);
            const plan = await locked(intent, async (tx, current) => {
                if (current.state === "completed") return { result: completed(current, tx.context) };
                pending(current, await tx.now());
                const version = nextUploadVersion(tx.context.submissions), path = `research/${current.paperId}/${version}/${current.id}-${current.fileName}`;
                if (current.finalPath && (current.finalPath !== path || current.contentSha256 !== hash)) throw new UploadFailure("conflict");
                const prepared = current.finalPath ? current : await tx.patch(current.id, { finalPath: path, contentSha256: hash });
                return { prepared, version };
            }, signal);
            if (plan.result) return plan.result;
            if (!plan.prepared?.finalPath || !plan.version) throw new UploadFailure("unavailable");
            await storage.writeOrReconcile(plan.prepared.finalPath, bytes, hash, signal);
            const committed = await locked(plan.prepared, async (tx, current) => {
                if (current.state === "completed") return { result: completed(current, tx.context), fresh: false, adviserId: 0, title: "" };
                pending(current, await tx.now());
                const version = nextUploadVersion(tx.context.submissions);
                if (version !== plan.version || current.finalPath !== plan.prepared!.finalPath || current.contentSha256 !== hash) throw new UploadFailure("conflict");
                const submission = await tx.submit(current, version);
                const saved = await tx.patch(current.id, { state: "completed", submissionId: submission.id });
                return { result: completed(saved, { ...tx.context, submissions: [...tx.context.submissions, submission] }), fresh: true,
                    adviserId: tx.context.group!.adviserId, title: tx.context.paper!.title };
            }, signal);
            if (committed.fresh) {
                try { await dependencies.notify(committed.adviserId, committed.result.version!, committed.title); } catch { /* Best effort; never undo a committed submission. */ }
            }
            return committed.result;
        } catch (error) {
            // Reconcile uncertain commit acknowledgements. Never delete a final object in this error path.
            if (intent) {
                try {
                    const resolved = await locked(intent, async (tx, current) => {
                        if (current.state === "completed") return completed(current, tx.context);
                        if (error instanceof UploadFailure && error.kind === "invalid" && current.state === "pending") await tx.patch(current.id, { state: "rejected" });
                        return null;
                    }, AbortSignal.timeout(5000));
                    if (resolved) return resolved;
                } catch { /* Preserve durable intent and objects until database state can be established. */ }
            }
            return failure(error);
        } finally { finalizations--; }
    }
    return { initiate, renew, status, cancel, finalize };
}
