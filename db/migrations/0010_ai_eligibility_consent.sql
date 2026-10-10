CREATE TABLE "ai_consent_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"eligibility_event_id" integer,
	"terms_version" varchar(64) NOT NULL,
	"terms_digest" varchar(64) NOT NULL,
	"event_kind" varchar(16) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_consent_event_check" CHECK ("ai_consent_events"."event_kind" in ('accepted','declined','withdrawn') and
        ("ai_consent_events"."event_kind" <> 'accepted' or "ai_consent_events"."eligibility_event_id" is not null)),
	CONSTRAINT "ai_consent_terms_check" CHECK (length("ai_consent_events"."terms_version") > 0 and "ai_consent_events"."terms_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ai_eligibility_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"decision" varchar(24) NOT NULL,
	"event_kind" varchar(16) NOT NULL,
	"decision_role_id" integer,
	"account_updated_at" timestamp,
	"verifier_user_id" integer,
	"verifier_authorization_ref" varchar(80),
	"external_authority_ref" varchar(80),
	"revoked" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_eligibility_decision_check" CHECK ("ai_eligibility_events"."decision" in ('Eligible', 'Not Eligible', 'Pending Verification')),
	CONSTRAINT "ai_eligibility_event_check" CHECK (coalesce((
        ("ai_eligibility_events"."event_kind" = 'bootstrap' and "ai_eligibility_events"."decision" = 'Eligible' and "ai_eligibility_events"."decision_role_id" = 1
          and "ai_eligibility_events"."account_updated_at" is not null and "ai_eligibility_events"."verifier_user_id" is null
          and "ai_eligibility_events"."verifier_authorization_ref" is null and length("ai_eligibility_events"."external_authority_ref") > 0 and not "ai_eligibility_events"."revoked")
        or ("ai_eligibility_events"."event_kind" in ('certification', 'reset', 'revocation') and "ai_eligibility_events"."verifier_user_id" is not null
          and "ai_eligibility_events"."verifier_user_id" <> "ai_eligibility_events"."user_id" and length("ai_eligibility_events"."verifier_authorization_ref") > 0
          and "ai_eligibility_events"."external_authority_ref" is null and (
            ("ai_eligibility_events"."event_kind" = 'certification' and "ai_eligibility_events"."decision" in ('Eligible', 'Not Eligible')
              and "ai_eligibility_events"."decision_role_id" in (1,2) and "ai_eligibility_events"."account_updated_at" is not null and not "ai_eligibility_events"."revoked")
            or ("ai_eligibility_events"."event_kind" = 'reset' and "ai_eligibility_events"."decision" = 'Pending Verification' and not "ai_eligibility_events"."revoked")
            or ("ai_eligibility_events"."event_kind" = 'revocation' and "ai_eligibility_events"."decision" = 'Not Eligible' and "ai_eligibility_events"."revoked")
          ))), false))
);
--> statement-breakpoint
ALTER TABLE "ai_consent_events" ADD CONSTRAINT "ai_consent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_consent_events" ADD CONSTRAINT "ai_consent_events_eligibility_event_id_ai_eligibility_events_id_fk" FOREIGN KEY ("eligibility_event_id") REFERENCES "public"."ai_eligibility_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_eligibility_events" ADD CONSTRAINT "ai_eligibility_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_eligibility_events" ADD CONSTRAINT "ai_eligibility_events_decision_role_id_role_id_fk" FOREIGN KEY ("decision_role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_eligibility_events" ADD CONSTRAINT "ai_eligibility_events_verifier_user_id_users_id_fk" FOREIGN KEY ("verifier_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_consent_user_event_idx" ON "ai_consent_events" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "ai_eligibility_user_event_idx" ON "ai_eligibility_events" USING btree ("user_id","id");