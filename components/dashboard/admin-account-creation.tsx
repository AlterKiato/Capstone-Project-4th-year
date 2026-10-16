"use client";
import { useState } from "react";
import { createManagedAccountAction } from "@/lib/actions/user.action";
import ResearchDialog from "./research-dialog";

export default function AdminAccountCreation({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
    const [uncertain, setUncertain] = useState(false);
    return <ResearchDialog title="Create Account" submitLabel="Create account" showCancel submitDisabled={uncertain} onClose={onClose}
        action={async fields => {
            try {
                const result = await createManagedAccountAction({ firstName: fields.get("firstName"), lastName: fields.get("lastName"), email: fields.get("email"), password: fields.get("password"), confirmPassword: fields.get("confirmPassword"), roleId: Number(fields.get("roleId")) });
                if ("uncertain" in result && result.uncertain) setUncertain(true);
                return { ...result, projectId: result.success && "data" in result ? result.data.id : undefined };
            } catch {
                setUncertain(true);
                return { success: false, message: "Account creation could not be confirmed. Close, refresh and verify the directory before retrying." };
            }
        }} onSuccess={id => { if (id) onCreated(id); }}>
        <p className="form-help">All fields are required. Create an Admin or Adviser account. AI eligibility starts as Pending Verification.</p>
        <label>First name <input name="firstName" autoComplete="given-name" required minLength={2} maxLength={100} /></label>
        <label>Last name <input name="lastName" autoComplete="family-name" required minLength={2} maxLength={100} /></label>
        <label>Email <input name="email" type="email" autoComplete="email" required /></label>
        <label>Password <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} /></label>
        <label>Confirm password <input name="confirmPassword" type="password" autoComplete="new-password" required /></label>
        <label>Role <select name="roleId" aria-label="Role" defaultValue="2"><option value="1">Admin</option><option value="2">Adviser</option></select></label>
        <p className="form-help">Passwords require 8–100 characters. Enter the same password in both fields.</p>
        {uncertain && <p role="alert">Submission is paused to avoid creating a duplicate account. Close and refresh the directory before retrying.</p>}
    </ResearchDialog>;
}
