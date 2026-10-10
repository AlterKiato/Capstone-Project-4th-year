import type { GUIDE_TOPIC_IDS } from "@/lib/constants/chatbot-guide";

export type GuideTopicId = (typeof GUIDE_TOPIC_IDS)[number];
export type GuideRole = 1 | 2 | 3;
export interface GuideQuestion { id: GuideTopicId; question: string }
export interface GuideTopic extends GuideQuestion {
    answer: string;
    links: { href: string; label: string }[];
}
export type GuideResult =
    | { success: true; mode: "static"; message: string; topic: GuideTopic }
    | { success: false; mode: "unsupported" | "unavailable"; message: string };
