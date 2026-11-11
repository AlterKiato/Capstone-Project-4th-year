CREATE TABLE "revision_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" integer NOT NULL,
	"correction" text NOT NULL,
	"reference" varchar(120) DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revision_items_feedback_position_unique" UNIQUE("feedback_id","position"),
	CONSTRAINT "revision_items_correction_check" CHECK (char_length("revision_items"."correction") between 1 and 2000 and "revision_items"."correction" ~ '[^[:space:]]'),
	CONSTRAINT "revision_items_position_check" CHECK ("revision_items"."position" between 0 and 29)
);
--> statement-breakpoint
CREATE TABLE "revision_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"action_taken" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"frozen_by_submission_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revision_responses_item_student_unique" UNIQUE("item_id","student_id"),
	CONSTRAINT "revision_responses_action_check" CHECK (char_length("revision_responses"."action_taken") <= 2000),
	CONSTRAINT "revision_responses_revision_check" CHECK ("revision_responses"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_feedback_id_feedbacks_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_responses" ADD CONSTRAINT "revision_responses_item_id_revision_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."revision_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_responses" ADD CONSTRAINT "revision_responses_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_responses" ADD CONSTRAINT "revision_responses_frozen_by_submission_id_submissions_id_fk" FOREIGN KEY ("frozen_by_submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revision_responses_student_item_idx" ON "revision_responses" USING btree ("student_id","item_id");