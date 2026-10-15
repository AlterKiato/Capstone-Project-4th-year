"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getNotificationPreviewAction, markNotificationAsReadAction, markAllNotificationsAsReadAction } from "@/lib/actions/notification.action";
import type { NotificationPreview } from "@/lib/services/notification.service";

type State = {
    data: NotificationPreview | null; loading: boolean; error: string;
    historyHref: string | null;
    pending: number | "all" | null; refresh: () => Promise<void>; markRead: (id: number | "all") => Promise<void>;
};
const Context = createContext<State | null>(null);

export default function NotificationProvider({ children, historyHref }: { children: React.ReactNode; historyHref: string | null }) {
    const [data, setData] = useState<NotificationPreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pending, setPending] = useState<number | "all" | null>(null);
    const request = useRef<Promise<void> | null>(null);
    const mutation = useRef(false);
    const refresh = useCallback((): Promise<void> => {
        if (request.current) return request.current;
        setLoading(true);
        request.current = (async () => {
            try {
                const result = await getNotificationPreviewAction();
                if (!result.success || !result.data) throw new Error("Load failed");
                setData(result.data);
                setError("");
            } catch {
                setData(null);
                setError("Notifications could not be loaded. Please try again.");
            } finally {
                setLoading(false);
                request.current = null;
            }
        })();
        return request.current;
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);

    async function markRead(id: number | "all") {
        if (mutation.current) return;
        mutation.current = true;
        setPending(id);
        setError("");
        try {
            // Finish any open-refresh first so an older response cannot overwrite the mutation.
            await request.current;
            if (id === "all") await markAllNotificationsAsReadAction();
            else await markNotificationAsReadAction(id);
            await refresh();
        } catch {
            setError(id === "all" ? "Notifications could not be marked as read. Please try again." : "Notification could not be marked as read. Please try again.");
        } finally {
            mutation.current = false;
            setPending(null);
        }
    }
    return <Context.Provider value={{ data, loading, error, pending, refresh, markRead, historyHref }}>{children}</Context.Provider>;
}

export function useNotifications() {
    const state = useContext(Context);
    if (!state) throw new Error("NotificationProvider is required.");
    return state;
}
