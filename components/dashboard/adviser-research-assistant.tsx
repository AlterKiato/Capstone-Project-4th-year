"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { analyzeResearchDemoAction, getResearchDemoAvailabilityAction } from "@/lib/actions/adviser-research-assistant.action";
import { RESEARCH_DEMO_EXCERPT, RESEARCH_DEMO_FOLLOWUPS, RESEARCH_DEMO_LABEL, RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_TASKS, type ResearchDemoTask } from "@/lib/ai/adviser-research-demo";
import { activateResearchDemoDraftAccount, readResearchDemoDraft, saveResearchDemoDraft, removeResearchDemoDraft, researchDemoDraftKey,
    clearResearchDemoDrafts, RESEARCH_DEMO_DRAFT_CLEAR_EVENT, type SyntheticExchange } from "@/lib/ai/research-demo-draft";
import { researchDemoRecoveryContextSchema, type ResearchDemoRecoveryContext } from "@/lib/validations/research-demo-draft";
import NavigationIcon from "./navigation-icon";
import styles from "./adviser-research-assistant.module.css";

type Exchange = SyntheticExchange;
type Props = { submissionId: number; assignmentId?: number; enabled?: boolean; children?: ReactNode };
const starters = ["Review academic writing", "Check research consistency", "Suggest methodology improvements"];
const mobileQuery = "(max-width: 767px)";
const subscribe = (notify: () => void) => { const media = window.matchMedia(mobileQuery); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };
const isMobile = () => window.matchMedia(mobileQuery).matches;
type Position = { x: number; y: number };
type WindowBounds = Position & { width: number; height: number };

function useFloatingWindow(mobile: boolean, open: boolean) {
    const panel = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointerId: number; start: Position; origin: WindowBounds; kind: "drag" | "resize" } | null>(null);
    const [bounds, setBounds] = useState<WindowBounds | null>(null), [gesture, setGesture] = useState<"drag" | "resize" | null>(null);
    function measure(): WindowBounds | null {
        const bounds = panel.current?.getBoundingClientRect();
        return bounds ? { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height } : null;
    }
    function clamp(next: WindowBounds): WindowBounds {
        const maxWidth = Math.max(0, Math.min(680, window.innerWidth - 24));
        const maxHeight = Math.max(0, Math.min(window.innerHeight * .85, window.innerHeight - 24));
        const width = Math.max(Math.min(340, maxWidth), Math.min(next.width, maxWidth));
        const height = Math.max(Math.min(380, maxHeight), Math.min(next.height, maxHeight));
        return { width, height, x: Math.max(12, Math.min(next.x, window.innerWidth - width - 12)),
            y: Math.max(12, Math.min(next.y, window.innerHeight - height - 12)) };
    }
    function start(event: PointerEvent<HTMLElement>, kind: "drag" | "resize") {
        if (mobile || !event.isPrimary || event.button !== 0 ||
            (kind === "drag" && event.target instanceof Element && event.target.closest('button, a, input, textarea, select, summary, [role="button"]'))) return;
        const origin = measure(); if (!origin) return;
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin, kind };
        setGesture(kind);
    }
    function endDrag(event: PointerEvent<HTMLElement>) {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null; setGesture(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    useEffect(() => {
        function resize() {
            drag.current = null; setGesture(null);
            if (mobile || isMobile()) return;
            setBounds(previous => previous ? clamp(previous) : null);
        }
        window.addEventListener("resize", resize);
        return () => { window.removeEventListener("resize", resize); drag.current = null; };
    }, [mobile, open]);
    return { panel, dragging: gesture === "drag", resizing: gesture === "resize",
        style: !mobile && bounds ? { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, right: "auto", bottom: "auto" } : undefined,
        resetPosition: () => { setBounds(null); },
        onOpen: () => { if (!mobile) setBounds(previous => previous ? clamp(previous) : null); },
        onPointerDown: (event: PointerEvent<HTMLElement>) => start(event, "drag"),
        onResizeStart: (event: PointerEvent<HTMLElement>) => start(event, "resize"),
        onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            const current = measure();
            if (mobile || !current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            setBounds(clamp({ ...current, width: current.width + (event.key === "ArrowLeft" ? -20 : event.key === "ArrowRight" ? 20 : 0),
                height: current.height + (event.key === "ArrowUp" ? -20 : event.key === "ArrowDown" ? 20 : 0) }));
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId || mobile) return;
            const dx = event.clientX - active.start.x, dy = event.clientY - active.start.y;
            setBounds(clamp(active.kind === "resize" ? { ...active.origin, width: active.origin.width + dx, height: active.origin.height + dy }
                : { ...active.origin, x: active.origin.x + dx, y: active.origin.y + dy }));
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
    const [finishing, setFinishing] = useState(false);
    const recovery = useRef<ResearchDemoRecoveryContext | null>(null);
    const memoryOnly = useRef(false);
    const finishButton = useRef<HTMLButtonElement>(null), cancelFinish = useRef<HTMLButtonElement>(null);
    const request = useRef(0), check = useRef(0), busy = useRef(false), blocked = useRef(false);
    const { panel: windowPanel, dragging, resizing, style: windowStyle, resetPosition, onOpen, onPointerDown, onResizeStart, onResizeKeyDown, onPointerMove,
        onPointerUp, onPointerCancel, onLostPointerCapture } = useFloatingWindow(mobile, open);

    function reset() {
        memoryOnly.current = false;
        removeResearchDemoDraft(recovery.current);
        request.current++; busy.current = false;
        setPending(false); setQuestion(""); setExchanges([]); setTask("writing"); setMessage("");
    }
    useEffect(() => {
        let mounted = true;
        function deny() {
            removeResearchDemoDraft(recovery.current); recovery.current = null;
            blocked.current = true;
            request.current++; busy.current = false;
            setPending(false); setQuestion(""); setExchanges([]); setOpen(false); setFinishing(false); setAuthorized(false); setChecking(false);
            setMessage("Adviser review access is unavailable. Temporary AI content has been cleared. Reload to verify access.");
        }
        if (!enabled) { deny(); return; }
        async function verify() {
            if (busy.current || blocked.current) return;
            const sequence = ++check.current; setChecking(true);
            try {
                const result = await getResearchDemoAvailabilityAction({ submissionId, ...(assignmentId === undefined ? {} : { assignmentId }) });
                if (!mounted || sequence !== check.current) return;
                if (result.success) {
                    const context = researchDemoRecoveryContextSchema.parse(result.recoveryContext);
                    if (context.submissionId !== submissionId || (assignmentId === undefined ? context.authority !== "main"
                        : context.authority !== "co" || context.assignmentId !== assignmentId)) { deny(); return; }
                    const previous = recovery.current;
                    const changed = !previous || researchDemoDraftKey(previous) !== researchDemoDraftKey(context);
                    if (previous && changed) {
                        removeResearchDemoDraft(previous); request.current++; setQuestion(""); setFinishing(false);
                    }
                    recovery.current = context;
                    const ownerChanged = activateResearchDemoDraftAccount(context.accountId);
                    if (changed || ownerChanged) memoryOnly.current = false;
                    const draft = readResearchDemoDraft(context);
                    if (changed || ownerChanged || (draft !== undefined && !memoryOnly.current)) {
                        setExchanges(draft?.exchanges ?? []); setTask(draft?.task ?? "writing");
                    }
                    setAuthorized(true); setChecking(false); return;
                }
            } catch { /* Uncertain access never grants permission. */ }
            if (mounted && sequence === check.current) deny();
        }
        void verify();
        const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
        const onDraftsCleared = (event: Event) => {
            const nextAccount = (event as CustomEvent<unknown>).detail;
            if (nextAccount !== undefined && (!recovery.current || recovery.current.accountId === nextAccount)) return;
            check.current++; deny();
        };
        window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
        window.addEventListener(RESEARCH_DEMO_DRAFT_CLEAR_EVENT, onDraftsCleared);
        return () => { mounted = false; window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener(RESEARCH_DEMO_DRAFT_CLEAR_EVENT, onDraftsCleared); };
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
            if (result.success) {
                if (!recovery.current || result.recoveryAccountId !== recovery.current.accountId) { clearResearchDemoDrafts(); return; }
                const next = [...previous, { question: value.trim(), answer: result.answer }].slice(-4);
                setExchanges(next); setQuestion("");
                if (result.mode === "mock" && recovery.current) memoryOnly.current = !saveResearchDemoDraft(recovery.current, nextTask, next);
            }
            else if (result.mode === "denied" || result.mode === "unavailable") {
                removeResearchDemoDraft(recovery.current); recovery.current = null;
                blocked.current = true; check.current++; setAuthorized(false); setOpen(false); setQuestion(""); setExchanges([]); setMessage(result.message);
            } else setMessage(result.message);
        } catch {
            if (sequence !== request.current) return;
            removeResearchDemoDraft(recovery.current); recovery.current = null;
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
                            <p>Up to four fictional exchanges can recover in this browser tab for two hours. Only reviewed question identifiers are saved temporarily. Reset, Finish Chat, logout or detected access loss clear this draft.</p>
                            {!mobile && <button type="button" onClick={resetPosition}>Reset window position and size</button>}
                        </details>
                        <details className={styles.info}><summary>View fictional excerpt</summary><p className={styles.excerpt}>{RESEARCH_DEMO_EXCERPT}</p></details>
                        {!checking && !exchanges.length && <section className={styles.welcome} aria-labelledby={`${id}-welcome`}>
                            <h3 id={`${id}-welcome`}>How can I help with your research review?</h3>
                            <p>Try a prepared example using fictional research.</p>
                            <div className={styles.starters}>{RESEARCH_DEMO_TASKS.map((value, index) => <button key={value} type="button" disabled={disabled}
                                onClick={() => void send(RESEARCH_DEMO_QUESTIONS[value], value, true)}>{starters[index]}</button>)}</div>
                        </section>}
                        <div role="log" aria-label="Synthetic conversation" aria-live="polite" aria-relevant="additions" className={styles.conversation}>
                            {!checking && exchanges.map((exchange, index) => <article key={index} className={styles.exchange}>
                                <div className={styles.user}><h3>You</h3><p>{exchange.question}</p></div>
                                <div className={styles.answer}><h3>Assistant</h3><p className={styles.notice}>{RESEARCH_DEMO_LABEL}</p>
                                    <dl>{([["Observation", exchange.answer.observation], ["Explanation", exchange.answer.explanation], ["Suggested improvement", exchange.answer.suggestion], ["Limitation / verification note", exchange.answer.limitation]] as const)
                                        .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
                            </article>)}
                        </div>
                        <div role="status" aria-live="polite" className={styles.status}>{checking ? "Checking Adviser review access…" : pending ? "Preparing synthetic response…" : message}</div>
                        {!checking && !!exchanges.length && <div className={styles.followups} aria-label="Reviewed follow-up questions">{RESEARCH_DEMO_FOLLOWUPS.map((value, index) =>
                            <button key={value} type="button" disabled={disabled} onClick={() => void send(value)}>{index === 0 ? "Explain suggestion" : "What to verify"}</button>)}</div>}
                        <div ref={end} />
                    </div>
                    <form className={styles.composer} onSubmit={submit} autoComplete="off" aria-busy={pending}>
                        <div className={styles.composerHeading}><label htmlFor={`${id}-question`}>Question <span>Reviewed questions only</span></label>
                            <Dialog.Root open={finishing && available} onOpenChange={setFinishing} modal>
                                <Dialog.Trigger asChild><button ref={finishButton} type="button" className={styles.finishButton} disabled={disabled}>Finish Chat</button></Dialog.Trigger>
                                <Dialog.Portal><Dialog.Overlay className={styles.finishOverlay} />
                                    <Dialog.Content className={styles.finishDialog} onOpenAutoFocus={event => { event.preventDefault(); cancelFinish.current?.focus(); }}
                                        onCloseAutoFocus={event => { event.preventDefault(); finishButton.current?.focus(); }}>
                                        <Dialog.Title>Finish this chat?</Dialog.Title>
                                        <Dialog.Description>This will clear this conversation from the current browser session.</Dialog.Description>
                                        <div><Dialog.Close asChild><button ref={cancelFinish} type="button">Cancel</button></Dialog.Close>
                                            <button type="button" onClick={() => { reset(); setFinishing(false); }}>Finish Chat</button></div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        </div>
                        <div className={styles.composerInput}><textarea id={`${id}-question`} rows={2} maxLength={1000} value={question} disabled={disabled} placeholder="Ask a reviewed follow-up…" onChange={event => setQuestion(event.target.value)} />
                            <button type="submit" disabled={disabled || !question.trim()}>Send</button></div>
                    </form>
                    {!mobile && <button type="button" className={styles.resizeHandle} aria-label="Resize AI chat window" title="Drag or use arrow keys to resize" data-resizing={resizing}
                        onPointerDown={onResizeStart} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
                        onLostPointerCapture={onLostPointerCapture} onKeyDown={onResizeKeyDown}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 18 12-12 M12 18l6-6" /></svg>
                    </button>}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
        {!available && message && <p role="status" className={styles.accessStatus}>{message}</p>}
    </div>;
}
