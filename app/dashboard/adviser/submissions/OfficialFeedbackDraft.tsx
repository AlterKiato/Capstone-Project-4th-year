"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { RecommendationImport } from "@/types/co-adviser";

type ImportResult = { success: boolean; message: string };
type Handler = (source: RecommendationImport) => ImportResult;
const unavailable = () => ({ success: false, message: "Start review or return to editing before importing. Your draft has not changed." });
const Context = createContext<{ available: boolean; append: Handler; register: (handler: Handler | null) => void }>({ available: false, append: unavailable, register: () => {} });
export const useOfficialFeedbackDraft = () => useContext(Context);

export default function OfficialFeedbackDraft({ children }: { children: React.ReactNode }) {
    const handler = useRef<Handler | null>(null);
    const [available,setAvailable] = useState(false);
    const register = useCallback((next: Handler | null) => { handler.current = next;setAvailable(!!next); },[]);
    const append = useCallback<Handler>(source => handler.current?.(source) ?? unavailable(),[]);
    const value = useMemo(()=>({available,register,append}),[available,register,append]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
