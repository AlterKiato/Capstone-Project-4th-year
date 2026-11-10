// Finite deparser contract for the pinned migration snapshots, not a SQL normalizer.
// Exact spelling, casts, parentheses and literal contents are significant. Unknown forms fail closed.
import assert from "node:assert/strict";

const checks: Record<string, string> = {
    research_milestones_title_check: "CHECK ((((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 200)) AND ((title)::text ~ '[^[:space:]]'::text)))",
    research_milestones_revision_check: "CHECK ((revision >= 0))",
    research_milestones_verification_check: "CHECK ((((verified_by IS NULL) AND (verified_at IS NULL)) OR ((verified_by IS NOT NULL) AND (verified_at IS NOT NULL) AND (submission_id IS NOT NULL))))",
    ai_consent_event_check: "CHECK ((((event_kind)::text = ANY ((ARRAY['accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying])::text[])) AND (((event_kind)::text <> 'accepted'::text) OR (eligibility_event_id IS NOT NULL))))",
    ai_consent_terms_check: "CHECK (((length((terms_version)::text) > 0) AND ((terms_digest)::text ~ '^[a-f0-9]{64}$'::text)))",
    ai_eligibility_decision_check: "CHECK (((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying, 'Pending Verification'::character varying])::text[])))",
    ai_eligibility_event_check: "CHECK (COALESCE(((((event_kind)::text = 'bootstrap'::text) AND ((decision)::text = 'Eligible'::text) AND (decision_role_id = 1) AND (account_updated_at IS NOT NULL) AND (verifier_user_id IS NULL) AND (verifier_authorization_ref IS NULL) AND (length((external_authority_ref)::text) > 0) AND (NOT revoked)) OR (((event_kind)::text = ANY ((ARRAY['certification'::character varying, 'reset'::character varying, 'revocation'::character varying])::text[])) AND (verifier_user_id IS NOT NULL) AND (verifier_user_id <> user_id) AND (length((verifier_authorization_ref)::text) > 0) AND (external_authority_ref IS NULL) AND ((((event_kind)::text = 'certification'::text) AND ((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying])::text[])) AND (decision_role_id = ANY (ARRAY[1, 2])) AND (account_updated_at IS NOT NULL) AND (NOT revoked)) OR (((event_kind)::text = 'reset'::text) AND ((decision)::text = 'Pending Verification'::text) AND (NOT revoked)) OR (((event_kind)::text = 'revocation'::text) AND ((decision)::text = 'Not Eligible'::text) AND revoked)))), false))",
    ai_pilot_release_check: "CHECK (((released_at IS NULL) OR (released_at >= attempted_at)))",
    auth_rate_limit_digest_check: "CHECK (((key_digest)::text ~ '^[a-f0-9]{64}$'::text))",
    auth_rate_limit_count_check: "CHECK ((hit_count > 0))",
    auth_rate_limit_expiry_check: "CHECK ((expires_at > window_start))",
    email_verification_digest_check: "CHECK (((token_digest)::text ~ '^[a-f0-9]{64}$'::text))",
    email_verification_times_check: "CHECK ((((cardinality(request_times) >= 1) AND (cardinality(request_times) <= 5)) AND (array_position(request_times, NULL::timestamp with time zone) IS NULL)))",
    email_verification_expiry_check: "CHECK ((expires_at > last_requested_at))",
    email_verification_consumption_check: "CHECK (((consumed_at IS NULL) OR ((consumed_at >= last_requested_at) AND (consumed_at < expires_at))))",
    group_tasks_title_check: "CHECK ((((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 200)) AND ((title)::text ~ '[^[:space:]]'::text)))",
    group_tasks_description_check: "CHECK (((description IS NULL) OR (char_length(description) <= 5000)))",
    group_tasks_status_check: "CHECK (((status)::text = ANY ((ARRAY['To Do'::character varying, 'In Progress'::character varying, 'Done'::character varying])::text[])))",
    upload_intent_size_check: "CHECK (((declared_size >= 1) AND (declared_size <= 10485760)))",
    upload_intent_time_check: "CHECK (((expires_at > created_at) AND ((capability_expires_at IS NULL) OR (capability_expires_at > created_at))))",
    upload_intent_state_check: "CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'rejected'::character varying])::text[])))",
    upload_intent_completion_check: "CHECK ((((state)::text = 'completed'::text) = (submission_id IS NOT NULL)))",
    upload_intent_plan_check: "CHECK (((((final_path IS NULL) AND (content_sha256 IS NULL)) OR ((final_path IS NOT NULL) AND (content_sha256 IS NOT NULL) AND ((content_sha256)::text ~ '^[a-f0-9]{64}$'::text))) AND (((state)::text <> 'completed'::text) OR (final_path IS NOT NULL))))",
    upload_intent_staging_check: "CHECK (((staging_path)::text = (('staging/submissions/'::text || (id)::text) || '/upload.pdf'::text)))",
    upload_intent_filename_check: "CHECK (((file_name)::text ~ '^[a-zA-Z0-9_-]+[.]pdf$'::text))",
    upload_intent_final_check: "CHECK (((final_path IS NULL) OR ((final_path)::text ~ (((('^research/'::text || (paper_id)::text) || '/v[1-9][0-9]*/'::text) || (id)::text) || '-[a-zA-Z0-9_-]+[.]pdf$'::text))))",
    push_subscription_material_check: "CHECK (((enabled AND (endpoint IS NOT NULL) AND (p256dh IS NOT NULL) AND (auth IS NOT NULL) AND (vapid_key_id IS NOT NULL) AND (authorized_until IS NOT NULL)) OR ((NOT enabled) AND (endpoint IS NULL) AND (p256dh IS NULL) AND (auth IS NULL) AND (vapid_key_id IS NULL) AND (authorized_until IS NULL) AND (browser_expires_at IS NULL))))",
    push_subscription_endpoint_check: "CHECK (((endpoint IS NULL) OR ((octet_length((endpoint)::text) <= 2048) AND ((endpoint)::text ~ '^https://[^[:space:]]+$'::text))))",
    push_subscription_keys_check: "CHECK ((((p256dh IS NULL) OR ((p256dh)::text ~ '^[A-Za-z0-9_-]{87}$'::text)) AND ((auth IS NULL) OR ((auth)::text ~ '^[A-Za-z0-9_-]{22}$'::text)) AND ((vapid_key_id IS NULL) OR ((vapid_key_id)::text ~ '^[A-Za-z0-9_-]{1,64}$'::text))))",
    push_subscription_expiry_check: "CHECK (((NOT enabled) OR ((authorized_until > updated_at) AND ((browser_expires_at IS NULL) OR (browser_expires_at >= authorized_until)))))",
    task_notes_title_check: "CHECK ((((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 200)) AND ((title)::text ~ '[^[:space:]]'::text)))",
    task_notes_content_check: "CHECK ((((char_length(content) >= 1) AND (char_length(content) <= 20000)) AND (content ~ '[^[:space:]]'::text)))",
    task_notes_version_check: "CHECK ((version > 0))",
    co_adviser_distinct_actor_check: "CHECK ((co_adviser_id <> assigned_by))",
    co_adviser_recommendation_check: "CHECK (((recommendation IS NULL) OR (((char_length(recommendation) >= 1) AND (char_length(recommendation) <= 20000)) AND (recommendation ~ '[^[:space:]]'::text))))",
    co_adviser_lifecycle_check: "CHECK (((((state)::text = 'open'::text) AND (recommendation IS NULL) AND (completed_at IS NULL) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (closure_reason IS NULL)) OR (((state)::text = 'completed'::text) AND (recommendation IS NOT NULL) AND (completed_at IS NOT NULL) AND (completed_at >= created_at) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (closure_reason IS NULL)) OR (((state)::text = 'closed'::text) AND (closed_at IS NOT NULL) AND (closed_at >= created_at) AND (closure_reason IS NOT NULL) AND ((closure_reason)::text ~ '[^[:space:]]'::text) AND (((recommendation IS NULL) AND (completed_at IS NULL)) OR ((recommendation IS NOT NULL) AND (completed_at IS NOT NULL) AND (completed_at >= created_at) AND (completed_at <= closed_at))))))",
    main_adviser_singleton_check: "CHECK ((id = 1))",
    main_adviser_revision_check: "CHECK ((revision >= 0))",
    main_adviser_configuration_check: "CHECK ((((main_adviser_id IS NULL) AND (updated_by IS NULL) AND (revision = 0)) OR ((main_adviser_id IS NOT NULL) AND (updated_by IS NOT NULL) AND (revision > 0))))",
};

export function catalogCheck(name: string) {
    assert.ok(Object.hasOwn(checks, name), "Unreviewed CHECK representation");
    return checks[name];
}

export function catalogDefault(column: { type: string; default?: unknown }) {
    if (!("default" in column)) return null;
    const value = column.default;
    if (value === "now()") return "now()";
    if (column.type === "boolean" && typeof value === "boolean" || column.type === "integer" && Number.isSafeInteger(value)) return String(value);
    if (/^varchar\(\d+\)$/.test(column.type) && typeof value === "string" && /^'(?:[^']|'')*'$/.test(value)) return `${value}::character varying`;
    assert.fail("Unreviewed default representation");
}

type Index = { name: string; isUnique: boolean; method: string; columns: { expression: string; isExpression: boolean; asc: boolean; nulls: string }[]; where?: string; with?: Record<string, unknown> };
export function catalogIndex(table: string, item: Index) {
    assert.equal(item.method, "btree");
    assert.equal(Object.keys(item.with ?? {}).length, 0);
    const keys = item.columns.map(c => {
        assert.equal(c.asc, true); assert.equal(c.nulls, "last");
        if (c.isExpression) { assert.equal(table, "ai_pilot_attempts"); assert.equal(c.expression, "(1)"); return "(1)"; }
        assert.match(c.expression, /^[a-z_][a-z0-9_]*$/); return c.expression;
    });
    let predicate = "";
    if (item.where) {
        if (table === "ai_pilot_attempts") { assert.equal(item.where, '"ai_pilot_attempts"."released_at" is null'); predicate = " WHERE (released_at IS NULL)"; }
        else { assert.equal(table, "co_adviser_review_assignments"); assert.equal(item.where, '"co_adviser_review_assignments"."state" = \'open\''); predicate = " WHERE ((state)::text = 'open'::text)"; }
    }
    return `CREATE ${item.isUnique ? "UNIQUE " : ""}INDEX ${item.name.slice(0, 63)} ON public.${table} USING btree (${keys.join(", ")})${predicate}`;
}
