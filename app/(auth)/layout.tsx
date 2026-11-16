import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import ThemeSelector from "@/components/theme-selector";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className={styles.shell}>
            <header className={styles.header}>
                <Link href="/" className={styles.brand} aria-label="ThesiSHS AI home">
                    <Image src="/branding/thesishs-mark.svg" width={52} height={52} alt="" />
                    <span>
                        <span className={styles.wordmark}>ThesiSHS <span>AI</span></span>
                        <span className={styles.description}>Research Management System</span>
                    </span>
                </Link>
                <ThemeSelector />
            </header>
            {children}
            <footer className={styles.affiliation}>For CASAP Rodriguez Campus</footer>
        </div>
    );
}
