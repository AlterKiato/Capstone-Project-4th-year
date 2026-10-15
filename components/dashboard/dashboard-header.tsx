import Link from "next/link";
import ThemeSelector from "@/components/theme-selector";
import styles from "./dashboard-header.module.css";

export default function DashboardHeader({ title, email }: { title: string; email: string }) {
    return (
        <header className={styles.header}>
            <div className={styles.details}>
                <Link className={styles.brand} href="/dashboard">ThesiSHS AI</Link>
                <h1>{title}</h1>
                <p className="dashboard-welcome">Welcome, {email}</p>
            </div>
            <ThemeSelector />
        </header>
    );
}
