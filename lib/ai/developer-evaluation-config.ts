import "server-only";
const branchHost = "thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app";

// Distinct synthetic demonstration; institutional consent/eligibility are never satisfied here.
// Identity comes from trusted Vercel runtime metadata, never headers or a user-entered manifest.
export function getDeveloperEvaluationConfiguration() {
    const env = process.env;
    if (env.GROQ_DEMO_ENABLED !== "1" || env.NODE_ENV !== "production" || env.VERCEL !== "1" || env.CI ||
        env.VERCEL_ENV !== "preview" || env.VERCEL_TARGET_ENV !== "preview" ||
        env.VERCEL_GIT_PROVIDER !== "github" || env.VERCEL_GIT_REPO_OWNER?.toLowerCase() !== "alterkiato" ||
        env.VERCEL_GIT_REPO_SLUG?.toLowerCase() !== "capstone-project-4th-year" ||
        env.VERCEL_GIT_COMMIT_REF !== "feature/development" || env.VERCEL_BRANCH_URL !== branchHost ||
        !/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? "") ||
        !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? "") ||
        !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? "")) return null;
    const raw = env.GROQ_DEMO_ALLOWED_USER_IDS;
    if (!raw || raw.length > 256) return null;
    const entries = raw.split(",").map(value => value.trim());
    if (entries.length > 16 || entries.some(value => !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)) return null;
    const allowedUserIds = entries.map(Number);
    if (new Set(allowedUserIds).size !== allowedUserIds.length) return null;
    return { origin: `https://${branchHost}`, allowedUserIds,
        identity: { projectId: env.VERCEL_PROJECT_ID, deploymentId: env.VERCEL_DEPLOYMENT_ID, commitSha: env.VERCEL_GIT_COMMIT_SHA } };
}
