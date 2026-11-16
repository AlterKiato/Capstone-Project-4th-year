"use client";
import { useId, useRef, useState } from "react";
import styles from "./student-ui.module.css";
export default function GroupMembers({ members }: { members: { id: number; name: string }[] }) {
    const [open, setOpen] = useState(false);
    const pointerType = useRef<string | null>(null);
    const id = useId();
    const label = `${members.length} ${members.length === 1 ? "Member" : "Members"}`;
    return <div className={styles.memberSection}
        onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
        onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}
        onFocus={event => { if (event.target.matches(":focus-visible")) setOpen(true); }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
        <button className={styles.toggle} type="button" aria-label={`View group members: ${label}`} aria-expanded={open} aria-controls={id}
            onPointerDown={event => { pointerType.current = event.pointerType; }}
            onClick={event => {
                if (event.detail === 0 || pointerType.current !== "mouse") setOpen(value => !value);
                else setOpen(true);
            }}>{label}</button>
        <ul id={id} hidden={!open} className={styles.members}>{members.map(member => <li key={member.id}>{member.name}</li>)}</ul></div>;
}
