"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { analyzeResearchDemoAction, getResearchDemoAvailabilityAction } from "@/lib/actions/adviser-research-assistant.action";
import { RESEARCH_DEMO_EXCERPT, RESEARCH_DEMO_FOLLOWUPS, RESEARCH_DEMO_LABEL, RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_TASKS, type ResearchDemoTask } from "@/lib/ai/adviser-research-demo";
import type { ResearchDemoAnswer } from "@/lib/validations/adviser-research-assistant";
import NavigationIcon from "./navigation-icon";
import styles from "./adviser-research-assistant.module.css";

type Exchange = { question: string; answer: ResearchDemoAnswer };
type Props = { submissionId: number; assignmentId?: number; enabled?: boolean; children?: ReactNode };
const starters = ["Review academic writing", "Check research consistency", "Suggest methodology improvements"];
const mobileQuery = "(max-width: 767px)";
const subscribe = (notify: () => void) => { const media = window.matchMedia(mobileQuery); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };
const isMobile = () => window.matchMedia(mobileQuery).matches;
type Position = { x: number; y: number };

function useFloatingWindow(mobile: boolean, open: boolean) {
    const panel = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointerId: number; start: Position; origin: Position } | null>(null);
    const [position, setPosition] = useState<Position | null>(null), [dragging, setDragging] = useState(false);
    function clamp(point: Position): Position {
        const bounds = panel.current?.getBoundingClientRect();
        if (!bounds) return point;
        return { x: Math.max(12, Math.min(point.x, window.innerWidth - bounds.width - 12)),
            y: Math.max(12, Math.min(point.y, window.innerHeight - bounds.height - 12)) };
    }
    function endDrag(event: PointerEvent<HTMLElement>) {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null; setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    useEffect(() => {
        function resize() {
            drag.current = null; setDragging(false);
            setPosition(previous => {
                if (!previous || mobile) return previous;
                const next = clamp(previous);
                return next.x === previous.x && next.y === previous.y ? previous : next;
            });
        }
        window.addEventListener("resize", resize);
        return () => { window.removeEventListener("resize", resize); drag.current = null; };
    }, [mobile, open]);
    return { panel, dragging, style: !mobile && position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined,
        resetPosition: () => { setPosition(null); },
        onOpen: () => { if (!mobile) setPosition(previous => previous ? clamp(previous) : null); },
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
            if (mobile || !event.isPrimary || event.button !== 0 || !panel.current ||
                (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, summary, [role="button"]'))) return;
            const bounds = panel.current.getBoundingClientRect();
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: bounds.left, y: bounds.top } };
            setDragging(true);
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId || mobile) return;
            setPosition(clamp({ x: active.origin.x + event.clientX - active.start.x, y: active.origin.y + event.clientY - active.start.y }));
        }, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag };
}

// Only authorized review pages mount this host. State survives closing the portal and changing review tabs.
export default function AdviserResearchAssistant(props: Props) {
    return <ResearchChat key={`${props.submissionId}:${props.assignmentId ?? "main"}`} {...props} />;
}
function ResearchChat({ submissionId, assignmentId, enabled = true, children }: Props) {
    const mobile = useSyncExternalStore(subscribe, isMobile, () => false);
    const id = useId(), heading = useRef<HTMLHeadingElement>(null), end = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false), [task, setTask] = useState<ResearchDemoTask>("writing");
    const [question, setQuestion] = useState(""), [exchanges, setExchanges] = useState<Exchange[]>([]);
    const [authorized, setAuthorized] = useState(false), [checking, setChecking] = useState(true);
    const [pending, setPending] = useState(false), [message, setMessage] = useState("");
    const request = useRef(0), check = useRef(0), busy = useRef(false), blocked = useRef(false);
    const { panel: windowPanel, dragging, style: windowStyle, resetPosition, onOpen, onPointerDown, onPointerMove,
        onPointerUp, onPointerCancel, onLostPointerCapture } = useFloatingWindow(mobile, open);

    function reset() {
        request.current++; busy.current = false;
        setPending(false); setQuestion(""); setExchanges([]); setTask("writing"); setMessage("");
    }
    useEffect(() => {
        let mounted = true;
        function deny() {
            blocked.current = true;
            request.current++; busy.current = false;
            setPending(false); setQuestion(""); setExchanges([]); setOpen(false); setAuthorized(false); setChecking(false);
            setMessage("Adviser review access is unavailable. Temporary AI content has been cleared. Reload to verify access.");
        }
        if (!enabled) { deny(); return; }
        async function verify() {
            if (busy.current || blocked.current) return;
            const sequence = ++check.current; setChecking(true);
            try {
                const result = await getResearchDemoAvailabilityAction({ submissionId, ...(assignmentId === undefined ? {} : { assignmentId }) });
                if (!mounted || sequence !== check.current) return;
                if (result.success) { setAuthorized(true); setChecking(false); return; }
            } catch { /* Uncertain access never grants permission. */ }
            if (mounted && sequence === check.current) deny();
        }
        void verify();
        const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
        window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
        return () => { mounted = false; window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
    }, [submissionId, assignmentId, enabled, open]);
    useEffect(() => () => { request.current++; check.current++; }, []);
    useEffect(() => { if (open) end.current?.scrollIntoView({ block: "nearest" }); }, [open, exchanges, pending, message]);

    async function send(value: string, nextTask = task, starter = false) {
        if (busy.current || !authorized || checking || !enabled || !value.trim()) return;
        busy.current = true; const sequence = ++request.current;
        setPending(true); setMessage("");
        const previous = starter ? [] : exchanges;
        if (starter) { setTask(nextTask); setExchanges([]); }
        try {
            const result = await analyzeResearchDemoAction({ submissionId, ...(assignmentId === undefined ? {} : { assignmentId }), task: nextTask,
                excerpt: RESEARCH_DEMO_EXCERPT, question: value,
                history: previous.flatMap(exchange => [{ role: "user" as const, content: exchange.question }, { role: "assistant" as const, content: JSON.stringify(exchange.answer) }]) });
            if (sequence !== request.current) return;
            if (result.success) { setExchanges([...previous, { question: value.trim(), answer: result.answer }].slice(-4)); setQuestion(""); }
            else if (result.mode === "denied" || result.mode === "unavailable") {
                blocked.current = true; check.current++; setAuthorized(false); setOpen(false); setQuestion(""); setExchanges([]); setMessage(result.message);
            } else setMessage(result.message);
        } catch {
            if (sequence !== request.current) return;
            blocked.current = true; check.current++; setAuthorized(false); setOpen(false); setQuestion(""); setExchanges([]);
            setMessage("The request could not be confirmed. Temporary AI content has been cleared. Reload to verify access.");
        } finally { if (sequence === request.current) { busy.current = false; setPending(false); } }
    }
    function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(question); }
    const available = authorized && enabled, disabled = !available || checking || pending;
    return <div className={styles.context} data-research-assistant-context="">
        {children}
        <Dialog.Root open={open && available} onOpenChange={setOpen} modal={mobile}>
            {available && <Dialog.Trigger asChild><button type="button" className={styles.launcher} aria-label="Open AI Research Assistant" title="Open AI Research Assistant"><NavigationIcon name="feedback" /></button></Dialog.Trigger>}
            <Dialog.Portal>
                {mobile && <Dialog.Overlay className={styles.overlay} />}
                <Dialog.Content ref={windowPanel} className={styles.panel} data-mobile={mobile} style={windowStyle}
                    onOpenAutoFocus={event => { event.preventDefault(); onOpen(); heading.current?.focus(); }}
                    onEscapeKeyDown={event => {
                        const modal = !mobile && document.querySelector<HTMLDialogElement>("dialog:modal");
                        if (modal) {
                            // Radix listens in capture; pass Escape through the native dialog's existing cancel guard.
                            event.preventDefault();
                            if (typeof modal.requestClose === "function") modal.requestClose();
                            else if (modal.dispatchEvent(new Event("cancel", { cancelable: true }))) modal.close();
                        }
                    }}
                    onInteractOutside={event => {
                        // Keep editing underneath; yield to existing Help, notifications and higher-priority dialogs.
                        const overlay = event.target instanceof Element && event.target.closest('dialog, [popover], [popovertarget], [aria-haspopup="dialog"]');
                        if (!mobile && !overlay) event.preventDefault();
                    }}>
                    <header className={styles.header} data-dragging={dragging} title={mobile ? undefined : "Drag to move"}
                        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture}>
                        <div><Dialog.Title ref={heading} tabIndex={-1}>AI Research Assistant</Dialog.Title>
                            <Dialog.Description>Synthetic demonstration · Adviser guidance only</Dialog.Description></div>
                        <div className={styles.headerActions}><button type="button" className={styles.iconButton} onClick={reset} aria-label="Clear AI conversation" title="Clear AI conversation">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 10a9 9 0 1 1 2 8 M3 4v6h6" /></svg></button>
                            <Dialog.Close asChild><button type="button" className={styles.iconButton} aria-label="Close AI Research Assistant" title="Close AI Research Assistant"><NavigationIcon name="close" size={20} /></button></Dialog.Close></div>
                    </header>
                    <div className={styles.scroll}>
                        <details className={styles.info}><summary>About this demonstration</summary>
                            <p>Live research AI is disabled. Use the bundled fictional example and reviewed questions only. No real manuscripts, names, feedback or PDF contents are retrieved or analyzed.</p>
                            <p>Prepared examples may be incomplete. Verify suggestions yourself; no sources, grades, decisions or official feedback are produced. Existing aggregate-only consent grants no manuscript-processing permission.</p>
                            <p>Up to four exchanges stay in memory. Close/reopen and review tabs retain them; reset, submission changes, reload or detected access loss clear them. Nothing is saved.</p>
                            {!mobile && <button type="button" onClick={resetPosition}>Reset window position</button>}
                        </details>
                        <details className={styles.info}><summary>View fictional excerpt</summary><p className={styles.excerpt}>{RESEARCH_DEMO_EXCERPT}</p></details>
                        {!exchanges.length && <section className={styles.welcome} aria-labelledby={`${id}-welcome`}>
                            <h3 id={`${id}-welcome`}>How can I help with your research review?</h3>
                            <p>Try a prepared example using fictional research.</p>
                            <div className={styles.starters}>{RESEARCH_DEMO_TASKS.map((value, index) => <button key={value} type="button" disabled={disabled}
                                onClick={() => void send(RESEARCH_DEMO_QUESTIONS[value], value, true)}>{starters[index]}</button>)}</div>
                        </section>}
                        <div role="log" aria-label="Synthetic conversation" aria-live="polite" aria-relevant="additions" className={styles.conversation}>
                            {exchanges.map((exchange, index) => <article key={index} className={styles.exchange}>
                                <div className={styles.user}><h3>You</h3><p>{exchange.question}</p></div>
                                <div className={styles.answer}><h3>Assistant</h3><p className={styles.notice}>{RESEARCH_DEMO_LABEL}</p>
                                    <dl>{([["Observation", exchange.answer.observation], ["Explanation", exchange.answer.explanation], ["Suggested improvement", exchange.answer.suggestion], ["Limitation / verification note", exchange.answer.limitation]] as const)
                                        .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
                            </article>)}
                        </div>
                        <div role="status" aria-live="polite" className={styles.status}>{checking ? "Checking Adviser review access…" : pending ? "Preparing synthetic response…" : message}</div>
                        {!!exchanges.length && <div className={styles.followups} aria-label="Reviewed follow-up questions">{RESEARCH_DEMO_FOLLOWUPS.map((value, index) =>
                            <button key={value} type="button" disabled={disabled} onClick={() => void send(value)}>{index === 0 ? "Explain suggestion" : "What to verify"}</button>)}</div>}
                        <div ref={end} />
                    </div>
                    <form className={styles.composer} onSubmit={submit} autoComplete="off" aria-busy={pending}>
                        <label htmlFor={`${id}-question`}>Question <span>Reviewed questions only</span></label>
                        <div><textarea id={`${id}-question`} rows={2} maxLength={1000} value={question} disabled={disabled} placeholder="Ask a reviewed follow-up…" onChange={event => setQuestion(event.target.value)} />
                            <button type="submit" disabled={disabled || !question.trim()}>Send</button></div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
        {!available && message && <p role="status" className={styles.accessStatus}>{message}</p>}
    </div>;
}
