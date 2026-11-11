import styles from "./revisions.module.css";

export default function ReloadControl({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
    return <button type="button" className={styles.helpButton} aria-label={label} title={loading ? `${label} (loading)` : label} aria-busy={loading} disabled={loading} onClick={onClick}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg>
    </button>;
}
