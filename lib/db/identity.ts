import type { databaseConfiguration } from "./config";

export type DatabaseConfiguration = ReturnType<typeof databaseConfiguration>;
export type IdentitySql = { unsafe(query: string, parameters?: unknown[]): PromiseLike<Record<string, unknown>[]> };
const denied = () => new Error("Database identity or privilege verification failed.");

/** Pins come from independent SQL observation and, for managed fallback, the provider control plane. */
async function observeIdentity(sql: IdentitySql, config: DatabaseConfiguration) {
    const pin = config.observed;
    if (!pin || config.environment === "development") throw denied();
    const rows = await sql.unsafe(`select pg_catalog.current_database() as database, current_user as username,
        session_user as login, (select oid::text from pg_catalog.pg_database where datname=pg_catalog.current_database()) as oid,
        pg_catalog.has_function_privilege(current_user,'pg_catalog.pg_control_system()','EXECUTE') as control,
        pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'CONNECT') as connect,
        pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'CREATE') as create_database_objects,
        pg_catalog.has_schema_privilege(current_user,'public','CREATE') as create_public,
        case when pg_catalog.to_regnamespace('drizzle') is null then false else pg_catalog.has_schema_privilege(current_user,'drizzle','CREATE') end as create_ledger,
        exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
            where n.nspname in ('public','drizzle') and c.relowner=(select oid from pg_catalog.pg_roles where rolname=current_user)) as owns_objects,
        exists(select 1 from pg_catalog.pg_namespace where nspname in ('public','drizzle') and nspowner=(select oid from pg_catalog.pg_roles where rolname=current_user)) as owns_schema,
        exists(select 1 from pg_catalog.pg_database where datname=pg_catalog.current_database() and datdba=(select oid from pg_catalog.pg_roles where rolname=current_user)) as owns_database`);
    const row = rows[0], expectedRole = config.purpose === "operator" ? pin.operatorRole : pin.runtimeRole;
    if (rows.length !== 1 || row.database !== config.endpoint.database || row.oid !== pin.databaseOid ||
        row.username !== expectedRole || row.login !== expectedRole || row.connect !== true) throw denied();
    if (row.control === true) {
        const [control] = await sql.unsafe("select system_identifier::text as cluster from pg_catalog.pg_control_system()");
        if (!pin.cluster || control?.cluster !== pin.cluster) throw denied();
    } else if (row.control !== false || pin.provider !== "supabase" || !pin.projectRef) throw denied();
    // Reject SET ROLE paths, including memberships whose privileges are not inherited automatically.
    const roles = await sql.unsafe(`select r.rolname as name,r.rolcanlogin as login,
        (r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolbypassrls) as elevated,
        exists(select 1 from pg_catalog.pg_auth_members m where m.member=r.oid) as memberships
        from pg_catalog.pg_roles r where r.rolname in ($1,$2) order by r.rolname`, [pin.runtimeRole, pin.operatorRole]);
    if (roles.length !== 2 || ![pin.runtimeRole, pin.operatorRole].every(name => roles.some(r => r.name === name &&
        r.login === true && r.elevated === false && r.memberships === false))) throw denied();
    if (config.purpose === "runtime" && (row.create_database_objects || row.create_public || row.create_ledger || row.owns_objects || row.owns_schema || row.owns_database)) throw denied();
    return { database: row.database as string, oid: row.oid as string, username: row.username as string,
        cluster: row.control ? pin.cluster! : null, provider: pin.provider, projectRef: pin.projectRef ?? null,
        verification: row.control ? "cluster" : "provider-route" };
}

export async function verifyDatabaseIdentity(sql: IdentitySql, config: DatabaseConfiguration) {
    try { return await observeIdentity(sql, config); } catch { throw denied(); }
}
