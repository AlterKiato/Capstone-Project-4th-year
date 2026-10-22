import DashboardHeader from "@/components/dashboard/dashboard-header";
import LogoutButton from "@/components/auth/logout-button";
import ThemePreferences from "@/components/theme-preferences";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";
import { getRoleName, ROLE_IDS } from "@/lib/auth/roles";
import styles from "./settings.module.css";
import Link from "next/link";

export default async function SettingsPage() {
    const account = await getDashboardAccount();
    if (!account) return null; // The authenticated layout supplies the existing safe error state.
    if (!Object.values(ROLE_IDS).some(role => role === account.roleId)) {
        return <main className="dashboard-page"><h1>Settings unavailable</h1><p role="alert">Your account role does not support Settings.</p></main>;
    }

    return <main className="dashboard-page">
        <DashboardHeader title="Settings" email={account.email} />
        <p className="dashboard-context">View your account details and manage your application preferences.</p>
        <div className={styles.sections}>
            <section className="dashboard-panel" aria-labelledby="account-heading">
                <h2 id="account-heading">Account Information</h2>
                <dl className={styles.account}>
                    <div><dt>Name</dt><dd>Not provided</dd></div>
                    <div><dt>Email</dt><dd>{account.email}</dd></div>
                    <div><dt>Role</dt><dd>{getRoleName(account.roleId)}</dd></div>
                </dl>
                {account.roleId === ROLE_IDS.STUDENT && <p><Link href="/dashboard/student/verify-email">Email verification</Link></p>}
            </section>
            <section className="dashboard-panel" aria-labelledby="appearance-heading">
                <h2 id="appearance-heading">Appearance</h2>
                <p className="form-help">Choose a theme for this browser. System follows your device appearance.</p>
                <ThemePreferences />
            </section>
            <section className="dashboard-panel" aria-labelledby="about-heading">
                <h2 id="about-heading">About ThesiSHS AI</h2>
                <p>A research management system for Senior High School students, advisers, and school administrators, supporting research submissions, revisions, adviser feedback, and access to approved studies.</p>
            </section>
            <section className="dashboard-panel" aria-labelledby="sign-out-heading">
                <h2 id="sign-out-heading">Sign Out</h2>
                <p className="form-help">End your session on this browser and return to Login.</p>
                <LogoutButton />
            </section>
        </div>
    </main>;
}
