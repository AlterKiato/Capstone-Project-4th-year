import "server-only";
import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { databaseConfiguration } from "@/lib/db/config";
import { guardedRuntimeClient } from "@/lib/db/guarded-client";

const configuration = databaseConfiguration(process.env);
const client = postgres(configuration.url, configuration.options);
export const db = drizzle(guardedRuntimeClient(client, configuration), { schema });
