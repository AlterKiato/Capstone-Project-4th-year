import Link from "next/link";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getGuideQuestions } from "@/lib/services/chatbot-guide.service";
import ChatbotGuide from "./ChatbotGuide";
import DashboardHeader from "@/components/dashboard/dashboard-header";

export default async function GuidePage() {
    const session = await requireRole([ROLE_IDS.ADMIN, ROLE_IDS.ADVISER, ROLE_IDS.STUDENT]);
    const result = await getGuideQuestions();
    return (
        <main className="dashboard-page guide-page">
            <DashboardHeader title="ThesiSHS AI System Guide" email={session.email} />
            <p>Reviewed static guidance for your role. AI explanations are disabled pending provider approval.</p>
            <p>This supplementary guide cannot evaluate research, make decisions or generate official Adviser feedback.
                Consult your Adviser for academic questions and your Admin for account or access help.</p>
            <p><Link className="surface-link" href="/dashboard">Back to Dashboard</Link></p>
            {result.success ? <ChatbotGuide questions={result.questions} /> : <p role="status">{result.message}</p>}
        </main>
    );
}
