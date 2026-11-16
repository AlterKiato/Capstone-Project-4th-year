import Link from "next/link";
import Image from "next/image";
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
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header} id="top">
        <Link href="/" className={styles.brand} aria-label="ThesiSHS AI home">
          <Image className={styles.brandSymbol} src="/branding/thesishs-mark.svg" width={64} height={64} alt="" />
          <span><span className={styles.wordmark}>ThesiSHS <span>AI</span></span><span className={styles.brandDescription}>Research Management System</span></span>
        </Link>
        <nav aria-label="Page sections" className={styles.sectionNavigation}>
          <a href="#workflow">Research workflow</a>
          <a href="#roles">Who it supports</a>
          <a href="#affiliation">CASAP affiliation</a>
        </nav>
        <div className={styles.headerActions}>
          <nav aria-label="Account" className={styles.navigation}>
            <Link href="/login" className={styles.secondaryAction}>Log In</Link>
          </nav>
          <ThemeSelector />
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="landing-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Senior High School research</p>
            <h1 id="landing-heading">A clear place for every research draft.</h1>
            <p className={styles.description}>
              Submit your work, follow adviser feedback and keep revisions organized.
              ThesiSHS AI brings your group&apos;s research into one shared workspace.
            </p>
            <div className={styles.actions}>
              <Link href="/register" className={styles.primaryAction}>Create a Student account</Link>
              <a href="#workflow" className={styles.textAction}>See the research workflow</a>
            </div>
            <p className={styles.accountNote}>Student registration includes email verification. Adviser and Admin accounts are managed by the institution.</p>
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

        <section id="workflow" className={styles.features} aria-labelledby="features-heading">
          <div className={styles.workflowLead}>
            <Image className={styles.workflowPhoto} src="/images/landing/research-study.jpg" width={1400} height={2488} sizes="(max-width: 900px) 100vw, 92vw" alt="Research books, handwritten notes, an open notebook and a laptop on a study desk." />
            <div className={`${styles.sectionIntro} ${styles.glassPane}`}>
              <p className={styles.eyebrow}>The research workflow</p>
              <h2 id="features-heading">Keep the work and the feedback together.</h2>
              <p>A workspace for submissions, research progress and group organization, with a clear record of each revision.</p>
            </div>
          </div>
          <p className={styles.photoCredit}>Illustrative study workspace. Photo by <a href="https://unsplash.com/photos/desk-with-open-book-laptop-and-study-materials-HNjWq8WPyoY">Yen Vu on Unsplash</a>.</p>
          <dl>
            <div>
              <dt>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
                  <path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M12 18v-7m-3 3 3-3 3 3" />
                </svg>
                Submit and revise
              </dt>
              <dd>Submit research PDFs, preserve earlier versions and return to your group&apos;s work when revisions are needed.</dd>
            </div>
            <div>
              <dt>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 4h16v12H9l-5 4Z" /><path d="M8 8h8M8 12h5" />
                </svg>
                Review and organize
              </dt>
              <dd>Read adviser feedback, track revision items and organize group tasks. Research milestones require Main Adviser verification.</dd>
            </div>
            <div>
              <dt><BookSymbol />Find published research</dt>
              <dd>Sign in to search the research repository. Approved work becomes discoverable after an Admin publishes it.</dd>
            </div>
          </dl>
        </section>

        <section id="roles" className={styles.roles} aria-labelledby="roles-heading">
          <div className={styles.roleContext}>
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>People behind the research</p>
              <h2 id="roles-heading">Different responsibilities. One research record.</h2>
              <p>Each role works within its assigned access, keeping student work and academic decisions in the right hands.</p>
            </div>
            <figure className={styles.rolePhoto}>
              <Image src="/images/landing/library-study.jpg" width={1200} height={1797} sizes="(max-width: 900px) 92vw, 42vw" alt="Empty study tables and chairs beside bookshelves in a library." />
              <figcaption className={styles.photoCredit}>Illustrative library, not a CASAP facility. Photo by <a href="https://unsplash.com/photos/library-tables-and-chairs-7o7DqXJArf4">Tuyen Vo on Unsplash</a>.</figcaption>
            </figure>
          </div>
          <dl className={styles.roleList}>
            <div><dt>Students</dt><dd>Work within your assigned group, submit and revise research, review feedback and follow project progress.</dd></div>
            <div><dt>Advisers</dt><dd>Main Advisers manage their groups, review submissions and make official decisions. Assigned Co-Advisers provide recommendations within their delegated scope.</dd></div>
            <div><dt>Administrators</dt><dd>Oversee accounts, groups and research records, and manage publication of approved work in the repository.</dd></div>
          </dl>
        </section>

        <section id="affiliation" className={styles.affiliation} aria-labelledby="affiliation-heading">
          <div className={styles.institution}>
            <div className={styles.institutionSeal}><Image src="/branding/casap-official.png" width={447} height={387} unoptimized alt="College of Arts & Sciences of Asia & the Pacific (CASAP) logo" /></div>
            <div><p className={styles.eyebrow}>Institutional affiliation</p><h2 id="affiliation-heading">For CASAP Rodriguez Campus.</h2><p>ThesiSHS AI is a research management system for Senior High School work at the College of Arts &amp; Sciences of Asia &amp; the Pacific.</p></div>
          </div>
          <div className={styles.closing}>
            <div><h3>Keep your next draft connected.</h3><p>Create a Student account, verify your email and sign in. Group access is assigned by your Adviser.</p></div>
            <Link href="/register" className={styles.primaryAction}>Create a Student account</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p><strong>ThesiSHS AI</strong><span>Senior High School research management</span></p>
        <nav aria-label="Quick Links">
          <ul>
            <li><a href="#top">Back to top</a></li>
            <li><Link href="/login">Log In</Link></li>
            <li><a href="https://casap.edu.ph/">CASAP website</a></li>
          </ul>
        </nav>
      </footer>
    </div>
  );
}
