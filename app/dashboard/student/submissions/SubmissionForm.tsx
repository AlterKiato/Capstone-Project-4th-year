"use client";

import { useActionState } from "react";
import { submitResearchAction, type SubmissionActionResult } from "@/lib/actions/submission.action";

const initialState: SubmissionActionResult = { success: false, message: "" };

export default function SubmissionForm({ projects }: { projects: Array<{ id: number; title: string }> }) {
    const [state, formAction, pending] = useActionState(
        async (_previous: SubmissionActionResult, formData: FormData) => submitResearchAction(formData),
        initialState
    );
    return (
        <form action={formAction} className="dashboard-form" aria-busy={pending} aria-describedby="submission-message">
            <p className="form-help">Research Project and Research PDF are required. Remarks are optional.</p>
            <div>
                <label htmlFor="paperId">Research Project</label>
                <select id="paperId" name="paperId" required defaultValue="" disabled={pending}>
                    <option value="" disabled>Select a research project</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="file">Research PDF</label>
                <input id="file" name="file" type="file" accept="application/pdf,.pdf" required aria-describedby="file-requirements" disabled={pending} />
                <p id="file-requirements" className="form-help">PDF files only. Maximum file size: 10 MB.</p>
            </div>
            <div>
                <label htmlFor="remarks">Remarks (optional)</label>
                <textarea id="remarks" name="remarks" rows={4} maxLength={500} aria-describedby="remarks-help" disabled={pending} />
                <p id="remarks-help" className="form-help">Add context for your Adviser, up to 500 characters.</p>
            </div>
            <p id="submission-message" aria-live="polite" aria-atomic="true"
                className={state.message ? (state.success ? "research-notice" : "form-message") : undefined}>{state.message}</p>
            <button type="submit" disabled={pending}>{pending ? "Submitting PDF..." : "Submit Research PDF"}</button>
            <p className="form-help">A successful submission appears in Submission History below. Earlier versions and their feedback are retained.</p>
        </form>
    );
}
