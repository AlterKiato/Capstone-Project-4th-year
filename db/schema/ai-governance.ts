import { pgTable, serial, integer, varchar, timestamp, boolean, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { role } from "./role";

// Immutable domain audit events; absence means Pending Verification/no consent.
export const aiEligibilityEvents = pgTable("ai_eligibility_events", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    decision: varchar("decision", { length: 24 }).notNull(),
    eventKind: varchar("event_kind", { length: 16 }).notNull(),
    decisionRoleId: integer("decision_role_id").references(() => role.id, { onDelete: "restrict" }),
    accountUpdatedAt: timestamp("account_updated_at"),
    verifierUserId: integer("verifier_user_id").references(() => users.id, { onDelete: "restrict" }),
    verifierAuthorizationRef: varchar("verifier_authorization_ref", { length: 80 }),
    externalAuthorityRef: varchar("external_authority_ref", { length: 80 }),
    revoked: boolean("revoked").default(false).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
    index("ai_eligibility_user_event_idx").on(table.userId, table.id),
    check("ai_eligibility_decision_check", sql`${table.decision} in ('Eligible', 'Not Eligible', 'Pending Verification')`),
    check("ai_eligibility_event_check", sql`coalesce((
        (${table.eventKind} = 'bootstrap' and ${table.decision} = 'Eligible' and ${table.decisionRoleId} = 1
          and ${table.accountUpdatedAt} is not null and ${table.verifierUserId} is null
          and ${table.verifierAuthorizationRef} is null and length(${table.externalAuthorityRef}) > 0 and not ${table.revoked})
        or (${table.eventKind} in ('certification', 'reset', 'revocation') and ${table.verifierUserId} is not null
          and ${table.verifierUserId} <> ${table.userId} and length(${table.verifierAuthorizationRef}) > 0
          and ${table.externalAuthorityRef} is null and (
            (${table.eventKind} = 'certification' and ${table.decision} in ('Eligible', 'Not Eligible')
              and ${table.decisionRoleId} in (1,2) and ${table.accountUpdatedAt} is not null and not ${table.revoked})
            or (${table.eventKind} = 'reset' and ${table.decision} = 'Pending Verification' and not ${table.revoked})
            or (${table.eventKind} = 'revocation' and ${table.decision} = 'Not Eligible' and ${table.revoked})
          ))), false)`),
]);
export const aiConsentEvents = pgTable("ai_consent_events", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    eligibilityEventId: integer("eligibility_event_id").references(() => aiEligibilityEvents.id, { onDelete: "restrict" }),
    termsVersion: varchar("terms_version", { length: 64 }).notNull(),
    termsDigest: varchar("terms_digest", { length: 64 }).notNull(),
    eventKind: varchar("event_kind", { length: 16 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
    index("ai_consent_user_event_idx").on(table.userId, table.id),
    check("ai_consent_event_check", sql`${table.eventKind} in ('accepted','declined','withdrawn') and
        (${table.eventKind} <> 'accepted' or ${table.eligibilityEventId} is not null)`),
    check("ai_consent_terms_check", sql`length(${table.termsVersion}) > 0 and ${table.termsDigest} ~ '^[a-f0-9]{64}$'`),
]);
