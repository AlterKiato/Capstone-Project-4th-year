"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getGuideAnswerAction } from "@/lib/actions/chatbot-guide.action";
import type { GuideQuestion, GuideResult } from "@/types/chatbot-guide";

export default function ChatbotGuide({ questions }: { questions: GuideQuestion[] }) {
    const [result, setResult] = useState<GuideResult | null>(null);
    const [pending, startTransition] = useTransition();
    function selectTopic(topicId: GuideQuestion["id"]) {
        setResult(null);
        startTransition(async () => {
            try { setResult(await getGuideAnswerAction({ topicId })); }
            catch {
                setResult({ success: false, mode: "unavailable", message: "System guidance is unavailable. Please try again later or contact your Admin." });
            }
        });
    }
    return (
        <>
            <section aria-labelledby="guide-questions">
                <h2 id="guide-questions">Choose a guide question</h2>
                <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
                    {questions.map(question => (
                        <article key={question.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                            <button type="button" disabled={pending} onClick={() => selectTopic(question.id)}>
                                {question.question}
                            </button>
                        </article>
                    ))}
                </div>
            </section>
            <section aria-live="polite" aria-busy={pending} aria-labelledby="guide-answer">
                <h2 id="guide-answer">System guidance</h2>
                {pending ? <p>Loading verified guidance...</p> : result ? (
                    <>
                        <p role="status">{result.message}</p>
                        {result.success && (
                            <>
                                <h3>{result.topic.question}</h3>
                                <p>{result.topic.answer}</p>
                                {result.topic.links.map(link => (
                                    <p key={link.href}><Link href={link.href}>{link.label}</Link></p>
                                ))}
                            </>
                        )}
                    </>
                ) : <p>Select a question to see its verified system steps.</p>}
            </section>
        </>
    );
}
