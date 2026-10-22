CREATE TABLE "submission_upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"paper_id" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"staging_path" varchar(500) NOT NULL,
	"file_name" varchar(144) NOT NULL,
	"declared_size" integer NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"capability_expires_at" timestamp with time zone,
	"state" varchar(12) DEFAULT 'pending' NOT NULL,
	"submission_id" integer,
	"final_path" varchar(500),
	"content_sha256" varchar(64),
	CONSTRAINT "submission_upload_intents_staging_path_unique" UNIQUE("staging_path"),
	CONSTRAINT "submission_upload_intents_submission_id_unique" UNIQUE("submission_id"),
	CONSTRAINT "submission_upload_intents_final_path_unique" UNIQUE("final_path"),
	CONSTRAINT "upload_intent_student_request_unique" UNIQUE("student_id","request_key"),
	CONSTRAINT "upload_intent_size_check" CHECK ("submission_upload_intents"."declared_size" between 1 and 10485760),
	CONSTRAINT "upload_intent_time_check" CHECK ("submission_upload_intents"."expires_at" > "submission_upload_intents"."created_at" and ("submission_upload_intents"."capability_expires_at" is null or "submission_upload_intents"."capability_expires_at" > "submission_upload_intents"."created_at")),
	CONSTRAINT "upload_intent_state_check" CHECK ("submission_upload_intents"."state" in ('pending','completed','cancelled','rejected')),
	CONSTRAINT "upload_intent_completion_check" CHECK (("submission_upload_intents"."state" = 'completed') = ("submission_upload_intents"."submission_id" is not null)),
	CONSTRAINT "upload_intent_plan_check" CHECK ((("submission_upload_intents"."final_path" is null and "submission_upload_intents"."content_sha256" is null) or ("submission_upload_intents"."final_path" is not null and "submission_upload_intents"."content_sha256" is not null and "submission_upload_intents"."content_sha256" ~ '^[a-f0-9]{64}$')) and ("submission_upload_intents"."state" <> 'completed' or "submission_upload_intents"."final_path" is not null)),
	CONSTRAINT "upload_intent_staging_check" CHECK ("submission_upload_intents"."staging_path" = 'staging/submissions/' || "submission_upload_intents"."id"::text || '/upload.pdf'),
	CONSTRAINT "upload_intent_filename_check" CHECK ("submission_upload_intents"."file_name" ~ '^[a-zA-Z0-9_-]+[.]pdf$'),
	CONSTRAINT "upload_intent_final_check" CHECK ("submission_upload_intents"."final_path" is null or "submission_upload_intents"."final_path" ~ ('^research/' || "submission_upload_intents"."paper_id"::text || '/v[1-9][0-9]*/' || "submission_upload_intents"."id"::text || '-[a-zA-Z0-9_-]+[.]pdf$'))
);
--> statement-breakpoint
ALTER TABLE "submission_upload_intents" ADD CONSTRAINT "submission_upload_intents_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_upload_intents" ADD CONSTRAINT "submission_upload_intents_paper_id_research_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."research_papers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_upload_intents" ADD CONSTRAINT "submission_upload_intents_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_intent_student_created_idx" ON "submission_upload_intents" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "upload_intent_expiry_id_idx" ON "submission_upload_intents" USING btree ("expires_at","id");