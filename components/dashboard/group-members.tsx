"use client";
import { useId, useState } from "react";
import styles from "./student-ui.module.css";
export default function GroupMembers({ members }: { members: { id: number; name: string }[] }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    return <div className={styles.memberSection}><button className={styles.toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{members.length} Group Members · {open ? "Hide Members" : "View Members"}</button>
        <ul id={id} hidden={!open} className={styles.members}>{members.map(member => <li key={member.id}>{member.name}</li>)}</ul></div>;
}
