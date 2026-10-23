// Privileged commands never fall back to the application's runtime credentials.
import "dotenv/config";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as schema from "@/db/schema";
import { databaseConfiguration } from "@/lib/db/config";
import { initializeRoles } from "@/lib/repositories/database-initialization.repository";
import { bootstrapInitialAdmin } from "@/lib/services/database-initialization.service";
import { verifyDatabaseIdentity, type IdentitySql } from "@/lib/db/identity";

export async function inspectOperatorTarget(client: postgres.Sql, configuration: ReturnType<typeof databaseConfiguration>) {
    const identity: Record<string, unknown> = configuration.environment !== "development" ? await verifyDatabaseIdentity(client as unknown as IdentitySql, configuration) :
        (await client`select current_database() as database, current_user as username,
        inet_server_addr()::text as address, inet_server_port() as port,
        (select oid::text from pg_database where datname=current_database()) as oid,
        (select system_identifier::text from pg_control_system()) as cluster,
        current_setting('transaction_read_only') as read_only`)[0];
    if (configuration.environment === "development" && (!identity || identity.database !== configuration.endpoint.database ||
        identity.username !== configuration.endpoint.user || identity.read_only !== "off" || !identity.cluster || !identity.address))
        throw new Error("Target identity unavailable.");
    if (configuration.environment !== "development") {
        const [session] = await client`select current_setting('transaction_read_only') as read_only`;
        if (session?.read_only !== "off") throw new Error("Writable operator session required.");
    }
    const source = readMigrationFiles({ migrationsFolder: "db/migrations" });
    const ledger = await client`select hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    if (source.length !== 15 || ledger.length !== source.length ||
        ledger.some((row, index) => row.hash !== source[index].hash || row.created_at !== String(source[index].folderMillis)))
        throw new Error("Complete migration history required.");
    const fingerprint = createHash("sha256").update(JSON.stringify({ environment: configuration.environment,
        approvedIdentity: configuration.identity, endpoint: configuration.endpoint, identity })).digest("hex");
    return { fingerprint, migrations: ledger.length, environment: configuration.environment };
}

export function requirePrivateTerminal(input = process.stdin, output = process.stdout) {
    if (!input.isTTY || !output.isTTY) throw new Error("An interactive private terminal is required.");
}

export async function privateAdminInput(input = process.stdin, output = process.stdout) {
    requirePrivateTerminal(input, output);
    const previousRaw = input.isRaw;
    const hidden = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const terminal = createInterface({ input, output: hidden, terminal: true, historySize: 0 });
    const cancellation = new AbortController();
    terminal.on("SIGINT", () => { cancellation.abort(); terminal.close(); });
    terminal.on("close", () => cancellation.abort());
    async function ask(prompt: string) {
        if (cancellation.signal.aborted) throw new Error("Input cancelled.");
        output.write(`${prompt} (hidden): `);
        const value = await terminal.question("", { signal: cancellation.signal });
        output.write("\n");
        if (cancellation.signal.aborted) throw new Error("Input cancelled.");
        return value;
    }
    try {
        return { firstName: await ask("First name"), lastName: await ask("Last name"),
            email: await ask("Admin email"), password: await ask("Password"), confirmPassword: await ask("Confirm password") };
    } finally {
        terminal.close(); hidden.destroy();
        if (input.isTTY) input.setRawMode(previousRaw ?? false);
    }
}

export async function runDatabaseOperator(operation: "roles" | "admin") {
    let client: postgres.Sql | undefined;
    try {
        const args = process.argv.slice(2);
        const inspect = args.length === 1 && args[0] === "--inspect";
        const confirmed = args.length === 2 && args[0] === "--confirm-target" && /^[a-f0-9]{64}$/.test(args[1]);
        if (!inspect && !confirmed) throw new Error("Invalid operator arguments.");
        if (!inspect) requirePrivateTerminal();
        const configuration = databaseConfiguration(process.env, "operator");
        client = postgres(configuration.url, { ...configuration.options, onnotice: () => {} });
        const target = await inspectOperatorTarget(client, configuration);
        if (inspect) {
            console.log(`Approved configuration: ${target.environment}; migrations: ${target.migrations}; target fingerprint: ${target.fingerprint}`);
            return;
        }
        if (args[1] !== target.fingerprint) throw new Error("Target confirmation mismatch.");
        const database = drizzle(client, { schema });
        if (operation === "roles") {
            const result = await initializeRoles(database);
            console.log(`Canonical roles confirmed; inserted: ${result.inserted}.`);
        } else {
            const result = await bootstrapInitialAdmin(database, await privateAdminInput());
            if (!result.success) throw new Error("Admin bootstrap refused.");
            console.log("Initial Admin created. Use normal password login.");
        }
    } catch {
        console.error("Initialization not confirmed. Verify configuration, target fingerprint, migrations, role mappings and existing Admins before retrying. No automatic retry or recovery is performed.");
        process.exitCode = 1;
    } finally {
        try { await client?.end({ timeout: 5 }); } catch { process.exitCode = 1; }
    }
}
