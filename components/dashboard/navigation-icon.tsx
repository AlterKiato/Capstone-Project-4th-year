import type { NavigationIcon } from "@/lib/constants/dashboard-navigation";

type IconName = NavigationIcon | "feedback" | "checklist" | "workspace" | "history";

const paths: Record<IconName, string> = {
    home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
    document: "M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6",
    group: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M14 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-4-4 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    users: "M18 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    book: "M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z M12 5v15",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    report: "M4 3h16v18H4Z M8 16v-4 M12 16V8 M16 16v-6",
    guide: "M12 17v.01 M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    close: "m6 6 12 12 M6 18 18 6",
    collapse: "M4 3h16v18H4Z M9 3v18 m7-13-4 4 4 4",
    logout: "M9 3H4v18h5 M9 12h12 m-5-5 5 5-5 5",
    settings: "m10 3 4 0 .6 3 2 .9 2.8-.9 2 3.5-2.2 2v2l2.2 2-2 3.5-2.8-.9-2 .9-.6 3h-4l-.6-3-2-.9-2.8.9-2-3.5 2.2-2v-2l-2.2-2 2-3.5 2.8.9 2-.9Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    feedback: "M4 4h16v12H9l-5 4Z M8 8h8 M8 12h5",
    checklist: "m3 6 2 2 3-4 M11 6h10 m-18 7 2 2 3-4 M11 13h10 M4 20h3 M11 20h10",
    workspace: "M9 4H5v17h14V4h-4 M9 2h6v4H9Z M8 11h8 M8 15h8",
    history: "M5 12V3h9l5 5v3 M14 3v5h5 M21 17a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M15 14v3l2 1",
};

export default function NavigationIcon({ name, size = 22 }: { name: IconName; size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
