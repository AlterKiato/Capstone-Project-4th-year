CREATE TABLE "co_adviser_review_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"co_adviser_id" integer NOT NULL,
	"assigned_by" integer NOT NULL,
	"state" varchar(20) DEFAULT 'open' NOT NULL,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_by" integer,
	"closure_reason" varchar(100),
	CONSTRAINT "co_adviser_distinct_actor_check" CHECK ("co_adviser_review_assignments"."co_adviser_id" <> "co_adviser_review_assignments"."assigned_by"),
	CONSTRAINT "co_adviser_recommendation_check" CHECK ("co_adviser_review_assignments"."recommendation" is null or (
        char_length("co_adviser_review_assignments"."recommendation") between 1 and 20000 and "co_adviser_review_assignments"."recommendation" ~ '[^[:space:]]')),
	CONSTRAINT "co_adviser_lifecycle_check" CHECK ((
        "co_adviser_review_assignments"."state" = 'open' and "co_adviser_review_assignments"."recommendation" is null and "co_adviser_review_assignments"."completed_at" is null
        and "co_adviser_review_assignments"."closed_at" is null and "co_adviser_review_assignments"."closed_by" is null and "co_adviser_review_assignments"."closure_reason" is null
    ) or (
        "co_adviser_review_assignments"."state" = 'completed' and "co_adviser_review_assignments"."recommendation" is not null and "co_adviser_review_assignments"."completed_at" is not null
        and "co_adviser_review_assignments"."completed_at" >= "co_adviser_review_assignments"."created_at" and "co_adviser_review_assignments"."closed_at" is null
        and "co_adviser_review_assignments"."closed_by" is null and "co_adviser_review_assignments"."closure_reason" is null
    ) or (
        "co_adviser_review_assignments"."state" = 'closed' and "co_adviser_review_assignments"."closed_at" is not null and "co_adviser_review_assignments"."closed_at" >= "co_adviser_review_assignments"."created_at"
        and "co_adviser_review_assignments"."closure_reason" is not null and "co_adviser_review_assignments"."closure_reason" ~ '[^[:space:]]'
        and (("co_adviser_review_assignments"."recommendation" is null and "co_adviser_review_assignments"."completed_at" is null)
            or ("co_adviser_review_assignments"."recommendation" is not null and "co_adviser_review_assignments"."completed_at" is not null
                and "co_adviser_review_assignments"."completed_at" >= "co_adviser_review_assignments"."created_at" and "co_adviser_review_assignments"."completed_at" <= "co_adviser_review_assignments"."closed_at"))
    ))
);
--> statement-breakpoint
CREATE TABLE "main_adviser_designation" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"main_adviser_id" integer,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "main_adviser_singleton_check" CHECK ("main_adviser_designation"."id" = 1),
	CONSTRAINT "main_adviser_revision_check" CHECK ("main_adviser_designation"."revision" >= 0),
	CONSTRAINT "main_adviser_configuration_check" CHECK ((
        "main_adviser_designation"."main_adviser_id" is null and "main_adviser_designation"."updated_by" is null and "main_adviser_designation"."revision" = 0
    ) or ("main_adviser_designation"."main_adviser_id" is not null and "main_adviser_designation"."updated_by" is not null and "main_adviser_designation"."revision" > 0))
);
--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_adviser_review_assignments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_adviser_review_assignments_co_adviser_id_users_id_fk" FOREIGN KEY ("co_adviser_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_adviser_review_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_adviser_review_assignments_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_adviser_designation" ADD CONSTRAINT "main_adviser_designation_main_adviser_id_users_id_fk" FOREIGN KEY ("main_adviser_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_adviser_designation" ADD CONSTRAINT "main_adviser_designation_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "co_adviser_open_assignment_unique" ON "co_adviser_review_assignments" USING btree ("submission_id","co_adviser_id") WHERE "co_adviser_review_assignments"."state" = 'open';--> statement-breakpoint
CREATE INDEX "co_adviser_assignment_inbox_idx" ON "co_adviser_review_assignments" USING btree ("co_adviser_id","state","submission_id");--> statement-breakpoint
-- Stable lock target for initial configuration; no account is designated by migration.
INSERT INTO "main_adviser_designation" ("id") VALUES (1);
