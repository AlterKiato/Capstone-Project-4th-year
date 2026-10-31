"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type DraftControls = { setDirty: (dirty: boolean) => void; setPending: (pending: boolean) => void;
    registerConfirmationCancel: (cancel: () => void) => () => void; confirmLeave: () => boolean };
const DraftContext = createContext<DraftControls | null>(null);
export const useReviewDraft = () => useContext(DraftContext);
const DraftStatusContext = createContext({ dirty: false, session: 0 });
export const useReviewDraftStatus = () => useContext(DraftStatusContext);

export default function ReviewDraftBoundary({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState({ dirty: false, session: 0 });
    const { dirty } = status;
    const current = useRef({ dirty: false, pending: false, confirmedUntil: 0 });
    const confirmationCancels = useRef(new Set<() => void>());
    const controls = useMemo<DraftControls>(() => ({
        setDirty(value) {
            current.current.dirty = value;
            setStatus(previous => previous.dirty === value ? previous : { dirty: value, session: previous.session + (value ? 1 : 0) });
        },
        setPending(value) { current.current.pending = value; },
        registerConfirmationCancel(cancel) { confirmationCancels.current.add(cancel); return () => { confirmationCancels.current.delete(cancel); }; },
        confirmLeave() {
            confirmationCancels.current.forEach(cancel => cancel());
            if (!current.current.dirty) return true;
            if (current.current.pending) { window.alert("Feedback is still being submitted. Please wait before leaving."); return false; }
            const leave = window.confirm("Discard unsaved feedback for this submission and leave?");
            if (leave) current.current.confirmedUntil = Date.now() + 1000;
            return leave;
        },
    }), []);

    useEffect(() => {
        if (!dirty) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            confirmationCancels.current.forEach(cancel => cancel());
            if (!current.current.dirty || Date.now() < current.current.confirmedUntil) return;
            event.preventDefault(); event.returnValue = "";
        };
        const click = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
            const link = event.target.closest<HTMLAnchorElement>("a[href]");
            const logout = event.target.closest('button[aria-label="Logout"]');
            if (!link && !logout) return;
            if (link) {
                if (link.download || link.target && link.target !== "_self") return;
                const next = new URL(link.href, window.location.href);
                if (next.pathname === window.location.pathname && next.search === window.location.search && next.origin === window.location.origin) return;
            }
            if (!controls.confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
        };
        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("click", click, true);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", click, true);
        };
    }, [dirty, controls]);

    return <DraftContext.Provider value={controls}><DraftStatusContext.Provider value={status}>{children}</DraftStatusContext.Provider></DraftContext.Provider>;
}
