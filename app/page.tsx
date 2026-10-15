import Link from "next/link";
import styles from "./page.module.css";
import ThemeSelector from "@/components/theme-selector";

function BookSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}><BookSymbol />ThesiSHS AI</p>
        <div className={styles.headerActions}>
          <nav aria-label="Account" className={styles.navigation}>
            <Link href="/login" className={styles.secondaryAction}>Log In</Link>
            <Link href="/register" className={styles.primaryAction}>Register</Link>
          </nav>
          <ThemeSelector />
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="landing-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Research management for Senior High School</p>
            <h1 id="landing-heading">From research drafts to approved studies.</h1>
            <p className={styles.description}>
              Manage research submissions, track revisions, receive adviser feedback,
              and discover approved studies.
            </p>
            <div className={styles.actions}>
              <Link href="/register" className={styles.primaryAction}>Get Started</Link>
              <Link href="/login" className={styles.secondaryAction}>Log In</Link>
            </div>
          </div>

          <figure className={styles.preview} aria-labelledby="preview-caption">
            <div className={styles.previewHeader}>Student Workspace</div>
            <div className={styles.previewBody}>
              <div className={styles.previewRail} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M9 12h6M9 16h6" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4h16v12H9l-5 4Z" /><path d="M8 8h8M8 12h5" />
                </svg>
              </div>
              <div className={styles.previewContent}>
                <h2>Research Overview</h2>
                <div className={styles.previewEntry}>
                  <p className={styles.entryTitle}>Submission v2</p>
                  <p className={styles.revisionStatus}>Revision Required</p>
                </div>
                <div className={styles.previewEntry}>
                  <p className={`${styles.entryTitle} ${styles.feedbackTitle}`}>Adviser Feedback</p>
                  <p>Review latest comments</p>
                </div>
              </div>
            </div>
            <figcaption id="preview-caption">Illustrative interface preview. Sample content only.</figcaption>
          </figure>
        </section>

        <section className={styles.features} aria-labelledby="features-heading">
          <h2 id="features-heading">From submission to discovery</h2>
          <dl>
            <div>
              <dt>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
                  <path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M12 18v-7m-3 3 3-3 3 3" />
                </svg>
                Submit
              </dt>
              <dd>Organize research PDFs and preserve submission versions.</dd>
            </div>
            <div>
              <dt>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 4h16v12H9l-5 4Z" /><path d="M8 8h8M8 12h5" />
                </svg>
                Review
              </dt>
              <dd>Receive adviser feedback and track revisions.</dd>
            </div>
            <div>
              <dt><BookSymbol />Discover</dt>
              <dd>Browse approved and published research.</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className={styles.footer}>
        <section aria-labelledby="about-heading">
          <h2 id="about-heading">About ThesiSHS AI</h2>
          <p>Research submissions, adviser feedback and a repository of approved studies for Senior High School.</p>
          <p className={styles.footerNote}>Temporary branding for ThesiSHS AI.</p>
        </section>
        <nav aria-labelledby="quick-links-heading">
          <h2 id="quick-links-heading">Quick Links</h2>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/login">Log In</Link></li>
            <li><Link href="/register">Register</Link></li>
          </ul>
        </nav>
        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact &amp; Support</h2>
          <p>Email: support@example.com</p>
          <p>Phone: To be announced</p>
          <p>Organization/contact details: To be confirmed</p>
          <p className={styles.footerNote}>Contact information is provisional and not yet an active support channel.</p>
        </section>
      </footer>
    </div>
  );
}
