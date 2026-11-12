// Public fictional demonstration material. No manuscript retrieval or model inference.
export const RESEARCH_DEMO_LABEL = "SYNTHETIC DEMONSTRATION — NOT LIVE AI ANALYSIS";
export const RESEARCH_DEMO_TASKS = ["writing", "consistency", "methodology"] as const;
export type ResearchDemoTask = (typeof RESEARCH_DEMO_TASKS)[number];
export const RESEARCH_DEMO_TASK_LABELS: Record<ResearchDemoTask, string> = {
    writing: "Academic Writing Review", consistency: "Research Consistency Review", methodology: "Research Methodology Guidance",
};
export const RESEARCH_DEMO_EXCERPT = "FICTIONAL EXAMPLE — NO REAL PARTICIPANTS OR DATA\n\nThis fictional study aim to compare paper and digital study planners. The planners are very useful and useful for all learners.\n\nObjective: Compare weekly planning habits between learners using paper planners and learners using digital planners.\nResearch question: How do weekly planning habits differ between the two planner groups?\nMethodology: Invite a convenience sample of 20 fictional volunteers. Ask one general satisfaction question in a single survey, without recording planner type or planning habits.\nProposed conclusion: Digital planners caused better academic performance for every learner. No academic performance data were collected.";
export const RESEARCH_DEMO_QUESTIONS: Record<ResearchDemoTask, string> = {
    writing: "Show clearer academic wording for this fictional excerpt.",
    consistency: "How do the fictional objective, question and method align?",
    methodology: "What methodological changes could this fictional study consider?",
};
export const RESEARCH_DEMO_FOLLOWUPS = ["Explain the suggested improvement.", "What should I verify next?"] as const;

const examples = {
    writing: {
        observation: "The example contains subject–verb disagreement, repetitive wording and an unsupported universal claim.",
        explanation: "'This fictional study aim' needs 'aims'. 'Very useful and useful' repeats the same idea. 'All learners' exceeds what this example establishes.",
        suggestion: "Example revision: 'This fictional study aims to compare weekly planning habits among learners who use paper or digital planners.' Remove the repeated usefulness claim unless evidence supports a narrower statement.",
        limitation: "This is a prepared wording example for the bundled fictional text, not a grammar engine or a review of a complete manuscript.",
        verify: "Check agreement, define 'planning habits', and compare each claim with the evidence actually collected. A clearer sentence does not validate its claim.",
    },
    consistency: {
        observation: "The objective and question both compare planning habits across two planner groups; the proposed survey measures only general satisfaction.",
        explanation: "Without planner type and planning-habit measures, the stated comparison cannot be made. The proposed causal conclusion about performance concerns an outcome that was never collected.",
        suggestion: "Record planner type and define measurable planning habits that answer the comparison question, or narrow the objective and question to satisfaction. Remove causal and universal performance conclusions from this survey example.",
        limitation: "These relationships are prewritten for this fictional example. No other sections, instruments, results or manuscript have been inspected.",
        verify: "Map each objective to a research question, variable, collection item and analysis. Confirm the conclusion addresses measured outcomes without claiming causation.",
    },
    methodology: {
        observation: "A one-time convenience survey of 20 fictional volunteers has limited representativeness and cannot establish that planners caused an outcome.",
        explanation: "The example omits planner-group information and operational definitions. Convenience sampling can introduce selection bias; a single survey does not establish temporal or causal effects.",
        suggestion: "Consider a descriptive-comparative design if comparison remains the aim. Define planning-habit measures, record planner group, review instrument suitability, and select descriptive or comparative analysis only after checking measurement and assumptions.",
        limitation: "These are general options, not verified institutional requirements, a justified sample-size calculation, a prescribed statistical test or a causal study design.",
        verify: "Ask the Adviser to check design–question alignment, recruitment and ethics, measurement quality, sampling limitations and analysis assumptions. No citations or external sources were verified.",
    },
} as const;

/** Exact reviewed questions only; arbitrary text never receives pretend semantic analysis. */
export function getResearchDemoAnswer(task: ResearchDemoTask, question: string) {
    const example = examples[task];
    if (question !== RESEARCH_DEMO_QUESTIONS[task] && !RESEARCH_DEMO_FOLLOWUPS.some(item => item === question)) return null;
    return {
        label: RESEARCH_DEMO_LABEL, task,
        observation: example.observation,
        explanation: question === RESEARCH_DEMO_FOLLOWUPS[0]
            ? `The prepared suggestion connects to this example as follows: ${example.explanation}` : example.explanation,
        suggestion: question === RESEARCH_DEMO_FOLLOWUPS[1] ? example.verify : example.suggestion,
        limitation: example.limitation,
    };
}
