"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManagedAccountAction } from "@/lib/actions/user.action";
import { EligibilityDialog } from "@/components/dashboard/ai-governance-dialogs";
export default function AdminAccountCreation() {
    const form = useRef<HTMLFormElement>(null);
    const router = useRouter();
    const [created, setCreated] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const [pending, start] = useTransition();
    return <section aria-label="Create Admin or Adviser account" className="dashboard-panel">
        <h2>Create Admin / Adviser account</h2>
        <p className="form-help">All fields are required. This form creates Admin and Adviser accounts.</p>
        <form ref={form} className="dashboard-form managed-account-form" aria-busy={pending} onSubmit={event => {
            event.preventDefault(); const fields = new FormData(event.currentTarget); setCreated(null);
            start(async () => { try {
                const result = await createManagedAccountAction({ firstName: fields.get("firstName"), lastName: fields.get("lastName"), email: fields.get("email"), password: fields.get("password"), confirmPassword: fields.get("confirmPassword"), roleId: Number(fields.get("roleId")) });
                setMessage(result.message);
                if (result.success && result.data) { form.current?.reset(); setCreated(result.data.id); router.refresh(); }
            } catch { setMessage("Account creation unavailable."); } });
        }}>
            <label>First name <input name="firstName" autoComplete="given-name" required minLength={2} maxLength={100} /></label>
            <label>Last name <input name="lastName" autoComplete="family-name" required minLength={2} maxLength={100} /></label>
            <label>Email <input name="email" type="email" autoComplete="email" required /></label>
            <label>Password <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} /></label>
            <label>Confirm password <input name="confirmPassword" type="password" autoComplete="new-password" required /></label>
            <label>Role <select name="roleId" defaultValue="2"><option value="1">Admin</option><option value="2">Adviser</option></select></label>
            <p className="form-help">Passwords require 8–100 characters. Enter the same password in both fields.</p>
            <button disabled={pending} type="submit">{pending ? "Creating account..." : "Create account"}</button>
        </form>
        <p role="status">{message}</p>
        {created !== null && <><p>Account created. AI eligibility defaults to Pending Verification.</p><EligibilityDialog key={created} userId={created} initiallyOpen /></>}
    </section>;
}
