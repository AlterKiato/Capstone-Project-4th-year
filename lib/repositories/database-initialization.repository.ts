// Operator-only data access: an explicitly verified database is injected; never imports the runtime database.
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { ROLE_IDS, ROLE_NAMES } from "@/lib/auth/roles";

export type InitializationDatabase = PostgresJsDatabase<typeof schema>;
type RoleRow = { id: number; name: string };
const roles = Object.entries(ROLE_NAMES).map(([id, name]) => ({ id: Number(id), name }));
const unavailable = () => new Error("Database initialization could not be confirmed.");

export function missingCanonicalRoles(existing: RoleRow[], requireComplete = false) {
    for (const expected of roles) {
        if (existing.some(row => row.id === expected.id && row.name !== expected.name || row.name === expected.name && row.id !== expected.id))
            throw unavailable();
    }
    const missing = roles.filter(expected => !existing.some(row => row.id === expected.id && row.name === expected.name));
    if (requireComplete && missing.length) throw unavailable();
    return missing;
}

export async function initializeRoles(database: InitializationDatabase) {
    return database.transaction(async tx => {
        await tx.execute(sql`lock table ${schema.role} in share row exclusive mode`);
        const existing = await tx.select({ id: schema.role.id, name: schema.role.name }).from(schema.role);
        const missing = missingCanonicalRoles(existing);
        if (missing.length) await tx.insert(schema.role).values(missing);
        const [maximum] = await tx.execute<{ id: number }>(sql`select max(id)::int as id from ${schema.role}`);
        const [sequence] = await tx.execute<{ last_value: string | number; is_called: boolean }>(sql`select last_value,is_called from public.role_id_seq`);
        const next = Math.max(maximum.id + 1, Number(sequence.last_value) + (sequence.is_called ? 1 : 0));
        if (!Number.isSafeInteger(next) || next < 1 || next > 2147483647) throw unavailable();
        if (Number(sequence.last_value) < maximum.id || Number(sequence.last_value) === maximum.id && !sequence.is_called) {
            // ALTER ... RESTART is transactional; unlike setval, failure rolls this back with role inserts.
            await tx.execute(sql`alter sequence public.role_id_seq restart with ${sql.raw(String(next))}`);
        }
        missingCanonicalRoles(await tx.select({ id: schema.role.id, name: schema.role.name }).from(schema.role), true);
        return { inserted: missing.length };
    });
}

export async function insertInitialAdmin(database: InitializationDatabase, input: {
    firstName: string; lastName: string; email: string; passwordHash: string;
}) {
    if (!/^\$2[ab]\$12\$/.test(input.passwordHash)) throw unavailable();
    return database.transaction(async tx => {
        await tx.execute(sql`lock table ${schema.role} in share row exclusive mode`);
        missingCanonicalRoles(await tx.select({ id: schema.role.id, name: schema.role.name }).from(schema.role), true);
        // Serialize bootstrap with other bootstrap calls and ordinary user inserts/role changes.
        await tx.execute(sql`lock table ${schema.users} in share row exclusive mode`);
        const [admin] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.roleId, ROLE_IDS.ADMIN)).limit(1);
        if (admin) throw unavailable(); // Inactive Admins also require a separate recovery procedure.
        const [duplicate] = await tx.execute(sql`select id from ${schema.users} where lower(email)=${input.email} limit 1`);
        if (duplicate) throw unavailable();
        const [created] = await tx.insert(schema.users).values({ firstName: input.firstName, lastName: input.lastName,
            email: input.email, password: input.passwordHash, roleId: ROLE_IDS.ADMIN, isActive: true }).returning({ id: schema.users.id });
        if (!created) throw unavailable();
        return created.id;
    });
}
