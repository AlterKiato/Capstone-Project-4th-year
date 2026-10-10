import "server-only";
import { minimizeAdminAggregate, minimizeAdviserAggregate } from "./aggregate-policy";

// Reviewed fictional counts only; no research repository, rows or identifiers.
export function getSyntheticPilotPayload(topicId: "admin-overview-v1" | "adviser-workflow-overview-v1") {
    if (topicId === "admin-overview-v1") return minimizeAdminAggregate({ totalUsers:5, totalGroups:10, totalResearchPapers:15, approvedPapers:10, totalPublishedPapers:5 });
    if (topicId !== "adviser-workflow-overview-v1") return null;
    return minimizeAdviserAggregate({
        total:{versions:15,contributors:15,papers:15},
        submitted:{versions:5,contributors:5,papers:5}, review:{versions:5,contributors:5,papers:5},
        notSubmitted:{versions:10,contributors:10,papers:10}, notReview:{versions:10,contributors:10,papers:10},
        neither:{versions:5,contributors:5,papers:5},
    });
}
