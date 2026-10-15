import LogoutButton from "@/components/auth/logout-button";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { dashboardLinks } from "@/lib/constants/dashboard-navigation";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const account = await getDashboardAccount();
    if (!account) return <main className="dashboard-page">
        <h1>Workspace unavailable</h1>
        <p role="alert">Your account access could not be verified. Log out and sign in again, or contact your Admin.</p>
        <LogoutButton />
    </main>;
    return <DashboardShell links={dashboardLinks(account.roleId)}>{children}
        <div className="dashboard-page">
            <section className="installation-help" aria-labelledby="installation-heading">
                <h2 id="installation-heading">Use ThesiSHS AI as an app</h2>
                <p>Installation is optional. You can keep using your browser. An internet connection is required for research work, even after installation.</p>
                <details>
                    <summary>Installation instructions</summary>
                    <p><strong>Android Chrome:</strong> Open the browser menu and look for Install, Install and create shortcut, or Add to Home screen. Follow the available option.</p>
                    <p><strong>iPhone Safari:</strong> Open Share, then Add to Home Screen. Depending on your Safari version, Share may be inside the page menu. If Open as Web App is shown, turn it on, then tap Add.</p>
                    <p><strong>Desktop Chrome / Edge:</strong> Use the install control in the address bar when available. In Chrome, look under Cast, save, and share for Install page as app. In Edge, look under More tools and Apps for Install this site as an app.</p>
                    <p className="form-help">Menu names and availability vary by browser version and device. If no install option appears, continue in your browser. Opening the app uses the same dashboard and sign-in flow.</p>
                </details>
            </section>
        </div>
    </DashboardShell>;
}
