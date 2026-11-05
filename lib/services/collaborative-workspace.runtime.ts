import "server-only";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createCollaborativeWorkspaceRepository } from "@/lib/repositories/collaborative-workspace.repository";
import { createCollaborativeWorkspaceService } from "./collaborative-workspace.service";

// No page imports this foundation in C2. Invoking it requires the separately prepared schema/grants.
export const collaborativeWorkspace = createCollaborativeWorkspaceService({ session: getSession,
    repository: createCollaborativeWorkspaceRepository(db) });
