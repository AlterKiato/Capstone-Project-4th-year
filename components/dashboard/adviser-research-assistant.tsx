"use client";
import { useEffect, useId, useRef, useState } from "react";
import { analyzeResearchDemoAction, getResearchDemoAvailabilityAction } from "@/lib/actions/adviser-research-assistant.action";
import { RESEARCH_DEMO_EXCERPT, RESEARCH_DEMO_FOLLOWUPS, RESEARCH_DEMO_LABEL, RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_TASK_LABELS, RESEARCH_DEMO_TASKS, type ResearchDemoTask } from "@/lib/ai/adviser-research-demo";
import type { ResearchDemoAnswer } from "@/lib/validations/adviser-research-assistant";
import styles from "./adviser-research-assistant.module.css";

type Exchange = { question: string; answer: ResearchDemoAnswer };
// The keyed inner component also resets if a caller reuses this component for another submission.
export default function AdviserResearchAssistant({ submissionId, active = true }: { submissionId: number; active?: boolean }) {
    return <ResearchDemo key={submissionId} submissionId={submissionId} active={active} />;
}
function ResearchDemo({ submissionId, active }: { submissionId: number; active: boolean }) {
    const id = useId();
    const [task, setTask] = useState<ResearchDemoTask>("writing");
    const [excerpt, setExcerpt] = useState("");
    const [question, setQuestion] = useState("");
    const [exchanges, setExchanges] = useState<Exchange[]>([]);
    const [access, setAccess] = useState<"checking" | "ready" | "denied">("checking");
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const request = useRef(0), check = useRef(0), busy = useRef(false);

    function clear() {
        request.current++; busy.current = false;
        setPending(false); setExcerpt(""); setQuestion(""); setExchanges([]); setMessage("");
    }
    useEffect(() => {
        if (!active) return;
        let mounted = true;
        async function verify() {
            if (busy.current) return;
            const sequence = ++check.current;
            setAccess("checking");
            try {
                const result = await getResearchDemoAvailabilityAction({ submissionId });
                if (!mounted || sequence !== check.current) return;
                if (result.success) { setAccess("ready"); return; }
            } catch { /* Missing authority/context is never treated as permission. */ }
            if (!mounted || sequence !== check.current) return;
            request.current++; busy.current = false;
            setPending(false); setExcerpt(""); setQuestion(""); setExchanges([]);
            setAccess("denied"); setMessage("Main Adviser access is unavailable. Temporary AI content has been cleared. Reload to verify access.");
        }
        void verify();
        const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
        window.addEventListener("focus", onVisible);
        document.addEventListener("visibilitychange", onVisible);
        return () => { mounted = false; window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
    }, [submissionId, active]);
    useEffect(() => () => { request.current++; check.current++; }, []);

    async function analyze(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current || access !== "ready") return;
        busy.current = true; const sequence = ++request.current;
        setPending(true); setMessage("");
        try {
            const result = await analyzeResearchDemoAction({ submissionId, task, excerpt, question,
                history: exchanges.flatMap(exchange => [{ role: "user" as const, content: exchange.question }, { role: "assistant" as const, content: JSON.stringify(exchange.answer) }]) });
            if (sequence !== request.current) return;
            if (result.success) {
                setExchanges(previous => [...previous, { question: question.trim(), answer: result.answer }].slice(-4));
                setQuestion("");
            } else if (result.mode === "denied" || result.mode === "unavailable") {
                check.current++; setAccess("denied"); setExcerpt(""); setQuestion(""); setExchanges([]); setMessage(result.message);
            } else setMessage(result.message);
        } catch {
            if (sequence !== request.current) return;
            check.current++; setAccess("denied"); setExcerpt(""); setQuestion(""); setExchanges([]);
            setMessage("The request could not be confirmed. Temporary AI content has been cleared. Reload to verify access.");
        } finally {
            if (sequence === request.current) { busy.current = false; setPending(false); }
        }
    }
    const disabled = access !== "ready" || pending;
    return <section className={styles.assistant} aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`}>Research assistance demonstration</h3>
        <p className={styles.notice}>{RESEARCH_DEMO_LABEL}</p>
        <p className="form-help">Synthetic testing only. Use fictional text; do not enter real manuscripts, names or feedback. Manual entry is not verified as synthetic. Only the bundled example and suggested questions receive prepared responses.</p>
        <p className="form-help">Live research AI is disabled. This demonstration grants no provider-processing permission and does not use aggregate-only consent.</p>
        <form onSubmit={analyze} aria-busy={pending} autoComplete="off">
            <label htmlFor={`${id}-task`}>Research-assistance task</label>
            <select id={`${id}-task`} value={task} disabled={disabled} onChange={event => {
                const next = event.target.value as ResearchDemoTask;
                setTask(next); setQuestion(RESEARCH_DEMO_QUESTIONS[next]); setExchanges([]); setMessage("");
            }}>{RESEARCH_DEMO_TASKS.map(value => <option key={value} value={value}>{RESEARCH_DEMO_TASK_LABELS[value]}</option>)}</select>
            <button type="button" disabled={disabled} onClick={() => { setExcerpt(RESEARCH_DEMO_EXCERPT); setQuestion(RESEARCH_DEMO_QUESTIONS[task]); setExchanges([]); setMessage(""); }}>Load fictional example</button>
            <label htmlFor={`${id}-excerpt`}>Synthetic research excerpt</label>
            <textarea id={`${id}-excerpt`} rows={7} value={excerpt} maxLength={6000} required disabled={disabled} aria-describedby={`${id}-excerpt-limit`}
                onChange={event => { setExcerpt(event.target.value); setExchanges([]); setMessage(""); }} />
            <p id={`${id}-excerpt-limit`} className="form-help">{excerpt.length.toLocaleString()} / 6,000 characters. Edited excerpts receive no analysis.</p>
            <label htmlFor={`${id}-question`}>Question</label>
            <textarea id={`${id}-question`} rows={2} value={question} maxLength={1000} required disabled={disabled}
                onChange={event => setQuestion(event.target.value)} />
            <div className={styles.actions}>
                <button type="button" disabled={disabled} onClick={() => setQuestion(RESEARCH_DEMO_QUESTIONS[task])}>Use suggested question</button>
                {RESEARCH_DEMO_FOLLOWUPS.map((value, index) => <button key={value} type="button" disabled={disabled || !exchanges.length} onClick={() => setQuestion(value)}>{index === 0 ? "Explain suggestion" : "What to verify"}</button>)}
            </div>
            <div className={styles.actions}>
                <button type="submit" disabled={disabled || !excerpt.trim() || !question.trim()}>{pending ? "Preparing demonstration…" : "Analyze fictional example"}</button>
                <button type="button" onClick={clear}>Clear conversation</button>
            </div>
        </form>
        <div role="status" aria-live="polite">{access === "checking" ? "Checking Main Adviser access…" : message}</div>
        <p className="form-help">Up to four exchanges remain in this tab only. Clear, submission changes, reload or loss of verified access remove them. Nothing is saved.</p>
        <div aria-label="Synthetic conversation" className={styles.conversation}>
            {exchanges.map((exchange, index) => <article key={index} className={styles.exchange}>
                <h4>Question {index + 1}</h4><p>{exchange.question}</p>
                <p className={styles.notice}>{exchange.answer.label}</p>
                <dl>{([['Observation', exchange.answer.observation], ['Explanation', exchange.answer.explanation], ['Suggested improvement', exchange.answer.suggestion], ['Limitation / verification note', exchange.answer.limitation]] as const)
                    .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            </article>)}
        </div>
        <p className="form-help">Advisory examples may be incomplete. Verify all suggestions yourself. No citations or sources are verified; no grades, decisions or official feedback are created.</p>
    </section>;
}
