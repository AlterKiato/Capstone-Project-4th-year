ALTER TABLE "submissions" ADD CONSTRAINT "submissions_id_paper_unique" UNIQUE("id","paper_id");
--> statement-breakpoint
CREATE TABLE "research_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"due_date" date NOT NULL,
	"submission_id" integer,
	"verified_by" integer,
	"verified_at" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_milestones_title_check" CHECK (char_length("research_milestones"."title") between 1 and 200 and "research_milestones"."title" ~ '[^[:space:]]'),
	CONSTRAINT "research_milestones_revision_check" CHECK ("research_milestones"."revision" >= 0),
	CONSTRAINT "research_milestones_verification_check" CHECK (("research_milestones"."verified_by" is null and "research_milestones"."verified_at" is null) or ("research_milestones"."verified_by" is not null and "research_milestones"."verified_at" is not null and "research_milestones"."submission_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "research_milestones" ADD CONSTRAINT "research_milestones_paper_id_research_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."research_papers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_milestones" ADD CONSTRAINT "research_milestones_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_milestones" ADD CONSTRAINT "research_milestones_submission_paper_fk" FOREIGN KEY ("submission_id","paper_id") REFERENCES "public"."submissions"("id","paper_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_milestones_paper_due_id_idx" ON "research_milestones" USING btree ("paper_id","due_date","id");