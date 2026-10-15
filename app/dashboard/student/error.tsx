"use client";
export default function StudentError({ reset }: { reset: () => void }) {
    return <main className="dashboard-page"><h1>Research information unavailable</h1><p role="alert">We could not retrieve your research information.</p><button type="button" onClick={reset}>Try again</button></main>;
}
