/* Research notifications only. No fetch handler, offline cache, sync or private persistence. */
const destinations = Object.freeze({
    "student-notifications": "/dashboard/student/notifications",
    "adviser-notifications": "/dashboard/adviser/notifications",
});
function destinationKey(value) {
    return typeof value === "string" && Object.hasOwn(destinations, value) ? value : null;
}
self.addEventListener("push", event => {
    let destination = null;
    try {
        const text = event.data?.text() ?? "";
        const payload = text.length <= 256 ? JSON.parse(text) : null;
        if (payload && Object.keys(payload).length === 2 && payload.v === 1) destination = destinationKey(payload.destination);
    } catch { /* Missing/malformed data always uses the generic visible fallback. */ }
    event.waitUntil(self.registration.showNotification("ThesiSHS AI", {
        body: "A research update is available. Open ThesiSHS AI to view it.",
        icon: "/icons/thesishs-192.png", tag: "thesishs-research-update",
        data: destination ? { destination } : {},
    }).catch(() => {}));
});
self.addEventListener("notificationclick", event => {
    event.notification.close();
    const destination = destinationKey(event.notification.data?.destination);
    const path = destination ? destinations[destination] : "/dashboard";
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const target = new URL(path, self.location.origin).href;
        const existing = windows.find(client => client.url === target) ?? windows[0];
        if (existing) {
            await existing.focus();
            // The application bridge, when present, owns guarded navigation; the worker only focuses.
            if (destination && existing.url !== target) existing.postMessage({ type: "thesishs-research-push", destination });
        } else {
            await self.clients.openWindow(target);
        }
    })().catch(() => {}));
});
