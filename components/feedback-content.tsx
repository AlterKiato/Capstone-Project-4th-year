import { decodeFeedback, FEEDBACK_PREFIX, type FeedbackRun } from "@/lib/utils/feedback-content";
import styles from "./feedback-content.module.css";

function Runs({ runs }: { runs: FeedbackRun[] }) {
    return runs.map((run, index) => {
        let content: React.ReactNode = run.text;
        if (run.underline) content = <u>{content}</u>;
        if (run.italic) content = <em>{content}</em>;
        if (run.bold) content = <strong>{content}</strong>;
        return <span key={index}>{content}</span>;
    });
}

/** Shared server/client renderer: text nodes and five allowed semantic elements only. */
export default function FeedbackContent({ value }: { value: string }) {
    if (!value.startsWith(FEEDBACK_PREFIX)) return <div className={styles.content}>{value}</div>;
    const document = decodeFeedback(value);
    return <div className={styles.content}>{document ? document.blocks.map((block, index) => {
        if (block.type === "paragraph") return <p key={index}><Runs runs={block.content} /></p>;
        const List = block.type === "bulletList" ? "ul" : "ol";
        return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Runs runs={item} /></li>)}</List>;
    }) : <p>Feedback formatting is unavailable.</p>}</div>;
}
