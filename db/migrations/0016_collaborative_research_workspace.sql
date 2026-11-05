CREATE TABLE "group_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assigned_student_id" integer,
	"status" varchar(16) DEFAULT 'To Do' NOT NULL,
	"due_date" date,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_tasks_id_paper_unique" UNIQUE("id","paper_id"),
	CONSTRAINT "group_tasks_title_check" CHECK (char_length("group_tasks"."title") between 1 and 200 and "group_tasks"."title" ~ '[^[:space:]]'),
	CONSTRAINT "group_tasks_description_check" CHECK ("group_tasks"."description" is null or char_length("group_tasks"."description") <= 5000),
	CONSTRAINT "group_tasks_status_check" CHECK ("group_tasks"."status" in ('To Do', 'In Progress', 'Done'))
);
--> statement-breakpoint
CREATE TABLE "task_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"task_id" integer,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_notes_title_check" CHECK (char_length("task_notes"."title") between 1 and 200 and "task_notes"."title" ~ '[^[:space:]]'),
	CONSTRAINT "task_notes_content_check" CHECK (char_length("task_notes"."content") between 1 and 20000 and "task_notes"."content" ~ '[^[:space:]]'),
	CONSTRAINT "task_notes_version_check" CHECK ("task_notes"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "group_tasks" ADD CONSTRAINT "group_tasks_paper_id_research_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."research_papers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_tasks" ADD CONSTRAINT "group_tasks_assigned_student_id_users_id_fk" FOREIGN KEY ("assigned_student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_tasks" ADD CONSTRAINT "group_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_paper_id_research_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."research_papers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_task_paper_fk" FOREIGN KEY ("task_id","paper_id") REFERENCES "public"."group_tasks"("id","paper_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_tasks_paper_created_id_idx" ON "group_tasks" USING btree ("paper_id","created_at","id");--> statement-breakpoint
CREATE INDEX "task_notes_paper_updated_id_idx" ON "task_notes" USING btree ("paper_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "task_notes_task_paper_idx" ON "task_notes" USING btree ("task_id","paper_id");