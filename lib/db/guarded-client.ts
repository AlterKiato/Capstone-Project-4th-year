import type postgres from "postgres";
import { verifyDatabaseIdentity, type DatabaseConfiguration, type IdentitySql } from "./identity";

type Client = postgres.Sql;
type Transaction = postgres.TransactionSql;
// Drizzle uses unsafe(...), unsafe(...).values(), begin() and savepoint(). No general SQL escape hatch.
export function guardedRuntimeClient(client: Client, configuration: DatabaseConfiguration): Client {
    if (configuration.environment === "development") return client;
    function pending(run: (values: boolean) => Promise<unknown>) {
        let result: Promise<unknown> | undefined;
        const start = (values = false) => result ??= run(values);
        return { then: (yes: (value: unknown) => unknown, no: (error: unknown) => unknown) => start().then(yes, no),
            values: () => start(true) };
    }
    function transactionClient(tx: Transaction, parent?: { verified?: Promise<unknown> }): Transaction {
        const state = parent ?? {};
        const verify = () => state.verified ??= verifyDatabaseIdentity(tx as unknown as IdentitySql, configuration);
        return new Proxy(tx, {
            apply() { throw new Error("Unsupported guarded database operation."); },
            get(target, key) {
                if (key === "unsafe") return (query: string, parameters: never[] = []) => {
                    const execute = async (values: boolean) => {
                        // Drizzle sets isolation/access mode before any transaction query. This statement cannot access data.
                        const setting = !parameters.length && /^set transaction(?: isolation level (?:read uncommitted|read committed|repeatable read|serializable))?(?: (?:read only|read write))?(?: (?:not )?deferrable)?$/i.test(query.trim());
                        if (!setting) await verify();
                        const pending = target.unsafe(query, parameters);
                        return values ? pending.values() : pending;
                    };
                    return pending(execute);
                };
                if (key === "savepoint") return (callback: (sql: Transaction) => unknown) => target.savepoint(nested => callback(transactionClient(nested, state)));
                if (key === "options") return Reflect.get(target, key);
                throw new Error("Unsupported guarded database operation.");
            },
        });
    }
    return new Proxy(client, {
        apply() { throw new Error("Unsupported guarded database operation."); },
        get(target, key) {
            if (key === "options") return target.options;
            if (key === "end") return target.end.bind(target);
            if (key === "begin") return (callback: (sql: Transaction) => unknown) => target.begin(tx => callback(transactionClient(tx)));
            if (key === "unsafe") return (query: string, parameters: never[] = []) => pending(async values =>
                target.begin(tx => values ? transactionClient(tx).unsafe(query, parameters).values() : transactionClient(tx).unsafe(query, parameters)));
            throw new Error("Unsupported guarded database operation.");
        },
    });
}
