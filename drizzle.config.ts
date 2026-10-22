import { defineConfig } from "drizzle-kit";

// This config is for offline schema/history tooling only. Direct Kit database commands
// bypass target confirmation and must never inherit the runtime DATABASE_URL.
// Live replay uses the supported ORM migrator in the identity-checked disposable harness.
if (!["check", "generate", "export"].includes(process.argv[2] ?? "")) {
    throw new Error("Direct Drizzle database commands are disabled. A separately reviewed operator migration procedure is required.");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./db/schema/*",
    out: "./db/migrations",
});
