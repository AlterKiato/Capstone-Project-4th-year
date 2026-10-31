"use client";

import { useEffect, useRef, useState } from "react";
import { encodeFeedback, feedbackPlainText, validateFeedback } from "@/lib/utils/feedback-content";
import { readFeedbackEditor, restoreFeedbackEditor } from "@/lib/utils/feedback-editor-dom";
import styles from "./review-workspace.module.css";
import WarmTooltip, { WarmTooltipGroup } from "@/components/react-bits/WarmTooltip";

const commands = [
    { command: "bold", label: "Bold", shortcut: "B" },
    { command: "italic", label: "Italic", shortcut: "I" },
    { command: "underline", label: "Underline", shortcut: "U" },
    { command: "insertUnorderedList", label: "Bulleted list", shortcut: "" },
    { command: "insertOrderedList", label: "Numbered list", shortcut: "" },
] as const;

function FormattingIcon({ command }: { command: typeof commands[number]["command"] }) {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {command === "bold" ? <path d="M6 4h7a4 4 0 0 1 0 8H6m0-8v16h8a4 4 0 0 0 0-8H6" /> :
            command === "italic" ? <path d="M10 4h9M5 20h9M15 4 9 20" /> :
                command === "underline" ? <path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" /> :
                    command === "insertUnorderedList" ? <><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /><path d="M9 6h12M9 12h12M9 18h12" /></> :
                        <><path d="M3 3h1v5M2 8h4M2 13a2 2 0 0 1 4 0c0 2-4 2-4 5h4M10 6h11M10 12h11M10 18h11" /></>}
    </svg>;
}

export default function FeedbackEditor({ value, onChange, disabled, onError }: { value: string; onChange: (value: string) => void; disabled: boolean; onError: (message: string) => void }) {
    const editor = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);
    const emitted = useRef<string | null>(null);
    const [pressed, setPressed] = useState<boolean[]>([]);
    const [unsupported, setUnsupported] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const root = editor.current;
        if (!root) return;
        if (emitted.current !== value) { restoreFeedbackEditor(root, value); emitted.current = value; savedRange.current = null; }
    }, [value]);

    useEffect(() => {
        function selectionChanged() {
            const root = editor.current, selection = window.getSelection();
            if (!root || !selection?.rangeCount || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return;
            savedRange.current = selection.getRangeAt(0).cloneRange();
            setPressed(commands.map(item => document.queryCommandState(item.command)));
        }
        document.addEventListener("selectionchange", selectionChanged);
        return () => document.removeEventListener("selectionchange", selectionChanged);
    }, []);

    function changed() {
        const root = editor.current;
        if (!root) return;
        try {
            const encoded = encodeFeedback(readFeedbackEditor(root));
            emitted.current = encoded; onChange(encoded); setError(""); onError("");
            setPressed(commands.map(item => document.queryCommandState(item.command)));
        } catch { const message = "Feedback formatting is too complex. Simplify the draft before continuing."; setError(message); onError(message); }
    }

    function command(name: string, text?: string) {
        const root = editor.current;
        if (!root || disabled) return;
        root.focus();
        const selection = window.getSelection();
        if (selection?.rangeCount && root.contains(selection.anchorNode) && root.contains(selection.focusNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
        else if (savedRange.current && root.contains(savedRange.current.commonAncestorContainer)) {
            selection?.removeAllRanges(); selection?.addRange(savedRange.current);
        }
        // Native commands retain the browser undo buffer; never insert arbitrary HTML.
        if (!document.execCommand(name, false, text)) { setUnsupported(true); return; }
        if (selection?.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange();
        changed();
    }

    const length = feedbackPlainText(value).trim().length;
    const invalid = !!error || value !== "" && !!validateFeedback(value);
    return <div className={styles.editorField}>
        <label id="comments-label" htmlFor="comments">Feedback Comments</label>
        <div className={styles.formatToolbar} role="group" aria-label="Feedback formatting">
            <WarmTooltipGroup delay={400} warmWindow={300} travel={120} lean={0}>
                {commands.map((item, index) => <WarmTooltip key={item.command} content={item.label} shortcut={item.shortcut ? `Ctrl/Cmd+${item.shortcut}` : undefined}
                    side="top" size="sm" radius={6} surfaceColor="var(--surface)" inkColor="var(--foreground)" popDuration={100} popScale={1} popBlur={0} disabled={disabled}>
                    <button type="button" aria-label={item.label} aria-pressed={pressed[index] ?? false}
                        aria-keyshortcuts={item.shortcut ? `Control+${item.shortcut} Meta+${item.shortcut}` : undefined}
                        disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => command(item.command)}>
                        <FormattingIcon command={item.command} />
                    </button>
                </WarmTooltip>)}
            </WarmTooltipGroup>
        </div>
        <div ref={editor} id="comments" role="textbox" aria-labelledby="comments-label" aria-multiline="true" aria-required="true"
            aria-disabled={disabled} aria-invalid={invalid} aria-describedby="comments-help comments-editor-status" tabIndex={0}
            contentEditable={!disabled} suppressContentEditableWarning className={styles.feedbackEditor} spellCheck onInput={changed}
            onBeforeInput={event => {
                const input = event.nativeEvent as InputEvent;
                if (input.inputType?.startsWith("format") && !["formatBold", "formatItalic", "formatUnderline"].includes(input.inputType)) event.preventDefault();
            }}
            onKeyDown={event => {
                if ((event.ctrlKey || event.metaKey) && !event.altKey && ["b", "i", "u"].includes(event.key.toLowerCase())) {
                    event.preventDefault(); command({ b: "bold", i: "italic", u: "underline" }[event.key.toLowerCase()]!);
                }
            }}
            onPaste={event => {
                event.preventDefault();
                const text = event.clipboardData.getData("text/plain");
                if (!text && event.clipboardData.getData("text/html")) { const message = "Paste as plain text to include this content. Your draft has not changed."; setError(message); onError(message); return; }
                if (text.length > 5000) { const message = "Pasted feedback must not exceed 5000 characters."; setError(message); onError(message); return; }
                command("insertText", text);
            }}
            onDragOver={event => event.preventDefault()} onDrop={event => event.preventDefault()} />
        <p id="comments-help" className="form-help">Explain revisions or approval, up to 5,000 characters. Paste inserts plain text. Use Ctrl/Cmd+Z to undo.</p>
        <p id="comments-editor-status" className="form-help" aria-live="polite">{error || (invalid ? validateFeedback(value) : unsupported ? "This formatting command is unavailable in this browser. Plain-text editing remains available." : `${length.toLocaleString()} / 5,000 characters`)}</p>
    </div>;
}
