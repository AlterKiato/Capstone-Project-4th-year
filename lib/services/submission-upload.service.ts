import "server-only";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getActiveResearchActor } from "@/lib/auth/research-mutation-account";
import { createSubmissionUploadRepository } from "@/lib/repositories/submission-upload.repository";
import { createSubmissionUploadStorage } from "./submission-upload-storage.service";
import { createSubmissionUploadWorkflow } from "@/lib/uploads/submission-upload-workflow";
import { notifyAdviserNewSubmission } from "./notification.service";

export const submissionUploads = createSubmissionUploadWorkflow({
    repository: createSubmissionUploadRepository(db), storage: createSubmissionUploadStorage(),
    actor: async () => {
        const session = await getSession();
        return session ? getActiveResearchActor(3, session.userId) : null;
    },
    notify: notifyAdviserNewSubmission,
});
