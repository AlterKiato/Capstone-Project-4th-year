import { registrationSchema, removalSchema, PushFailure, type PushRepository } from "./contract";
import type { PushConfiguration } from "./config";
import type { AuthTokenPayload } from "@/types/auth";
import { ROLE_IDS } from "@/lib/auth/roles";

type Limit = "allowed" | "limited" | "unavailable";
export type PushOperation = "GET" | "POST" | "DELETE";
export type PushDependencies = {
    session(): Promise<AuthTokenPayload | null>;
    account(claims: AuthTokenPayload): Promise<"active" | "invalid" | "unavailable">;
    ingress(operation: PushOperation, headers: Headers): Promise<Limit>;
    accountLimit(operation: PushOperation, userId: number): Promise<Limit>;
    configuration(): PushConfiguration;
    repository: PushRepository;
    now?: () => number;
};
function admitted(result: Limit) { if (result !== "allowed") throw new PushFailure(result === "limited" ? "limited" : "unavailable"); }

// Independently authenticates every operation. Client data never supplies an actor.
export function createPushSubscriptionService(deps: PushDependencies) {
    const execute = async (operation: PushOperation, input: unknown, headers: Headers) => {
        admitted(await deps.ingress(operation, headers));
        const claims = await deps.session();
        const now = (deps.now ?? Date.now)();
        if (!claims || !Number.isSafeInteger(claims.userId) || claims.userId <= 0 || claims.userId > 2147483647 ||
            !Number.isSafeInteger(claims.exp) || claims.exp! * 1000 <= now || claims.exp! * 1000 > 8640000000000000)
            throw new PushFailure("unauthenticated");
        const account = await deps.account(claims);
        if (account !== "active") throw new PushFailure(account === "invalid" ? "unauthenticated" : "unavailable");
        // A concurrency precondition, never authority: old UI callbacks must not follow a switched cookie.
        const expectedAccount = headers.get("x-thesishs-push-account");
        if (expectedAccount !== null && expectedAccount !== String(claims.userId)) throw new PushFailure("unauthenticated");
        if (claims.roleId !== ROLE_IDS.ADVISER && claims.roleId !== ROLE_IDS.STUDENT) throw new PushFailure("forbidden");
        admitted(await deps.accountLimit(operation, claims.userId));
        const actor = { userId: claims.userId, roleId: claims.roleId, expiresAt: new Date(claims.exp! * 1000) };
        const config = deps.configuration();
        if (operation === "GET") return { ok: true as const, available: config.available, publicKey: config.publicKey, keyId: config.keyId,
            enrollment: await deps.repository.read(actor) };
        if (operation === "DELETE") {
            const parsed = removalSchema.safeParse(input);
            if (!parsed.success) throw new PushFailure("invalid");
            return { ok: true as const, enrollment: await deps.repository.disable(actor, parsed.data) };
        }
        const parsed = registrationSchema.safeParse(input);
        if (!parsed.success || parsed.data.subscription.expirationTime !== null && parsed.data.subscription.expirationTime <= now)
            throw new PushFailure("invalid");
        if (!config.available || !config.keyId) throw new PushFailure("unavailable");
        return { ok: true as const, enrollment: await deps.repository.register(actor, parsed.data, config.keyId) };
    };
    return async (operation: PushOperation, input: unknown, headers: Headers) => {
        try { return await execute(operation, input, headers); }
        catch (error) { throw error instanceof PushFailure ? error : new PushFailure("unavailable"); }
    };
}
