import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { lockCurrentMainAdviser } from "./research-supervision.repository";
import { templateDraftSchema } from "@/lib/validations/evaluation-template";
import type { EvaluationTemplate, EvaluationTemplateDraft } from "@/lib/evaluation-templates";

const { evaluationTemplates: templates, evaluationTemplateCriteria: criteria, activityLogs } = schema;
type Header = typeof templates.$inferSelect;
export type EvaluationTemplateScope = {
    list(includeArchived: boolean): Promise<EvaluationTemplate[]>;
    read(templateId: number): Promise<EvaluationTemplate | undefined>;
    create(draft: EvaluationTemplateDraft): Promise<EvaluationTemplate>;
    update(row: EvaluationTemplate, draft?: EvaluationTemplateDraft): Promise<EvaluationTemplate>;
    log(action: string, row: EvaluationTemplate): Promise<void>;
};

export function createEvaluationTemplateRepository(database: PostgresJsDatabase<typeof schema>) {
    return {
        async withOwner<T>(actorId: number, operation: (scope: EvaluationTemplateScope) => Promise<T>): Promise<T | null> {
            return database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                if (!await lockCurrentMainAdviser(tx, actorId)) return null;
                async function details(headers: Header[]) {
                    const items = headers.length ? await tx.select({ item: criteria }).from(criteria)
                        .innerJoin(templates, eq(templates.id, criteria.templateId))
                        .where(and(eq(templates.ownerId, actorId), inArray(criteria.templateId, headers.map(row => row.id))))
                        .orderBy(asc(criteria.position)) : [];
                    return headers.map(row => ({ ...templateDraftSchema.parse({ name: row.name, scale: row.scale,
                        criteria: items.filter(item => item.item.templateId === row.id).map(({ item }) => ({ key: item.key,
                            position: item.position, name: item.name, description: item.description, allowsNa: item.allowsNa })) }),
                        id: row.id, revision: row.revision, archivedAt: row.archivedAt?.toISOString() ?? null,
                        createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
                }
                async function insertCriteria(templateId: number, draft: EvaluationTemplateDraft) {
                    await tx.insert(criteria).values(draft.criteria.map(row => ({ ...row, templateId })));
                }
                return operation({
                    async list(includeArchived) {
                        return details(await tx.select().from(templates).where(and(eq(templates.ownerId, actorId),
                            includeArchived ? undefined : isNull(templates.archivedAt))).orderBy(desc(templates.updatedAt), desc(templates.id)));
                    },
                    async read(templateId) {
                        const rows = await tx.select().from(templates).where(and(eq(templates.id, templateId), eq(templates.ownerId, actorId))).for("update");
                        return (await details(rows))[0];
                    },
                    async create(draft) {
                        const [row] = await tx.insert(templates).values({ ownerId: actorId, name: draft.name, scale: draft.scale }).returning();
                        if (!row) throw new Error("Template write unconfirmed.");
                        await insertCriteria(row.id, draft);
                        return (await details([row]))[0];
                    },
                    async update(row, draft) {
                        const [saved] = await tx.update(templates).set({ ...(draft ? { name: draft.name, scale: draft.scale } : { archivedAt: sql`clock_timestamp()` }),
                            revision: row.revision + 1, updatedAt: sql`clock_timestamp()` })
                            .where(and(eq(templates.id, row.id), eq(templates.ownerId, actorId), eq(templates.revision, row.revision), isNull(templates.archivedAt))).returning();
                        if (!saved) throw new Error("Template write unconfirmed.");
                        if (draft) {
                            // Finalized E1C results must snapshot these values rather than reference mutable criterion rows.
                            await tx.delete(criteria).where(eq(criteria.templateId, row.id));
                            await insertCriteria(row.id, draft);
                        }
                        return (await details([saved]))[0];
                    },
                    async log(action, row) {
                        await tx.insert(activityLogs).values({ userId: actorId, action,
                            description: `Evaluation template ${row.id}; revision ${row.revision}; ${row.criteria.length} criteria; ${row.scale.levels.length} rating levels.` });
                    },
                });
            });
        },
    };
}
