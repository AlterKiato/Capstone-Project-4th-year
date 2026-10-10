import Link from "next/link";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getGuideQuestions } from "@/lib/services/chatbot-guide.service";
import ChatbotGuide from "./ChatbotGuide";

export default async function GuidePage() {
    await requireRole([ROLE_IDS.ADMIN, ROLE_IDS.ADVISER, ROLE_IDS.STUDENT]);
    const result = await getGuideQuestions();
    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
            <h1>ThesiSHS AI System Guide</h1>
            <p>Reviewed static guidance for your role. AI explanations are disabled pending provider approval.</p>
            <p>This supplementary guide cannot evaluate research, make decisions or generate official Adviser feedback.
                Consult your Adviser for academic questions and your Admin for account or access help.</p>
            <p><Link href="/dashboard">Back to Dashboard</Link></p>
            {result.success ? <ChatbotGuide questions={result.questions} /> : <p role="status">{result.message}</p>}
        </main>
    );
}
